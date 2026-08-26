import { Player, Item, EquipSlot, Rarity, Currency } from "../models/types";
import { Zone, ZoneEvent, ALL_ZONES, getZoneById, generateMonstersForZone, calculateExpReward, getAvailableZones } from "../data/zones";
import { generateItem, formatItem } from "./affix";
import { randomBase } from "../data/bases";
import { CURRENCIES, getCurrencyById } from "../data/currencies";
import { ALL_QUESTS, Quest, getAvailableQuests, generateQuestReward } from "../data/story";
import { getGemById } from "../data/gems";

// ===== 游戏状态 =====

export interface GameState {
  player: Player;
  currentZone: string | null;
  completedZones: string[];
  currentChapter: number;
  totalExp: number;
  explorationLog: ExplorationEntry[];
  // 任务状态
  completedQuests: string[];       // 已完成的任务ID
  pendingRewards: string[];        // 待领取奖励的任务ID
  activeQuests: string[];          // 当前可追踪的任务ID
  currentZoneResolved: boolean;    // 当前区域是否已完成一次遭遇
}

export interface ExplorationEntry {
  timestamp: number;
  zoneId: string;
  eventType: string;
  description: string;
  rewards: string[];
}

// ===== 探索结果 =====

export interface ExplorationResult {
  success: boolean;
  eventType: ZoneEvent["type"];
  description: string;
  rewards: ExplorationReward[];
  monsters?: any[];
  expGained: number;
  levelUp: boolean;
  newLevel?: number;
}

export interface ExplorationReward {
  type: "currency" | "item" | "experience" | "heal";
  id?: string;
  name: string;
  amount?: number;
  item?: Item;
}

// ===== 探索系统 =====

export class ZoneSystem {
  private state: GameState;
  private currentZoneResolved = false;
  
  constructor(player: Player, savedState?: Partial<GameState>) {
    this.state = {
      player,
      currentZone: savedState?.currentZone ?? null,
      completedZones: savedState?.completedZones ?? [],
      currentChapter: savedState?.currentChapter ?? 1,
      totalExp: savedState?.totalExp ?? 0,
      explorationLog: savedState?.explorationLog ?? [],
      completedQuests: savedState?.completedQuests ?? [],
      pendingRewards: savedState?.pendingRewards ?? [],
      activeQuests: savedState?.activeQuests ?? [],
      currentZoneResolved: savedState?.currentZoneResolved ?? false,
    };
    this.currentZoneResolved = this.state.currentZoneResolved;
    // 从存档恢复已完成区域
    if (savedState?.completedZones) {
      this.state.completedZones = [...savedState.completedZones];
    }
    // 如果没有活跃任务，自动刷新可接取任务
    if (this.state.activeQuests.length === 0 && this.state.completedQuests.length === 0) {
      this.refreshAvailableQuests();
    }
    this.checkQuestCompletion();
  }
  
  // 获取当前状态
  getState(): GameState {
    return { ...this.state };
  }
  
  // 获取可用区域
  getAvailableZones(): Zone[] {
    return getAvailableZones(
      this.state.player.level,
      this.state.completedZones
    );
  }
  
  // 获取所有区域（按章节分组）
  getAllZones(): { chapter: number; zones: Zone[] }[] {
    const chapters: { chapter: number; zones: Zone[] }[] = [];
    
    for (let ch = 1; ch <= 2; ch++) {
      const zones = ALL_ZONES.filter((z) => z.chapter === ch);
      if (zones.length > 0) {
        chapters.push({ chapter: ch, zones });
      }
    }
    
    return chapters;
  }
  
  // 选择区域
  selectZone(zoneId: string): boolean {
    const zone = getZoneById(zoneId);
    if (!zone) return false;
    
    // 检查等级要求
    if (this.state.player.level < zone.requiredLevel) return false;
    
    // 检查前置区域
    if (zone.prerequisiteZone && !this.state.completedZones.includes(zone.prerequisiteZone)) {
      return false;
    }
    
    this.state.currentZone = zoneId;
    this.currentZoneResolved = false;
    this.state.currentZoneResolved = false;
    return true;
  }
  
  // 执行探索
  explore(): ExplorationResult {
    if (!this.state.currentZone) {
      return {
        success: false,
        eventType: "combat",
        description: "你没有选择区域！",
        rewards: [],
        expGained: 0,
        levelUp: false,
      };
    }
    
    const zone = getZoneById(this.state.currentZone);
    if (!zone) {
      return {
        success: false,
        eventType: "combat",
        description: "区域不存在！",
        rewards: [],
        expGained: 0,
        levelUp: false,
      };
    }
    
    // 随机选择事件
    const event = this.selectEvent(zone);
    
    // 处理事件
    const result = this.processEvent(zone, event);
    
    if (result.eventType !== "combat" || !result.monsters || result.monsters.length === 0) {
      this.currentZoneResolved = true;
      this.state.currentZoneResolved = true;
    }

    // 记录日志
    this.state.explorationLog.push({
      timestamp: Date.now(),
      zoneId: zone.id,
      eventType: event.type,
      description: result.description,
      rewards: result.rewards.map((r) => `${r.name}${r.amount ? ` x${r.amount}` : ""}`),
    });
    
    return result;
  }
  
  // 选择事件
  private selectEvent(zone: Zone): ZoneEvent {
    const totalWeight = zone.events.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const event of zone.events) {
      random -= event.weight;
      if (random <= 0) return event;
    }
    
    return zone.events[0];
  }
  
  // 处理事件
  private processEvent(zone: Zone, event: ZoneEvent): ExplorationResult {
    switch (event.type) {
      case "combat":
        return this.processCombatEvent(zone, event);
      case "chest":
        return this.processChestEvent(zone, event);
      case "shop":
        return this.processShopEvent(zone, event);
      case "npc":
        return this.processNpcEvent(zone, event);
      case "trap":
        return this.processTrapEvent(zone, event);
      case "treasure":
        return this.processTreasureEvent(zone, event);
      default:
        return {
          success: true,
          eventType: event.type,
          description: event.description,
          rewards: [],
          expGained: 0,
          levelUp: false,
        };
    }
  }
  
  // 处理战斗事件
  private processCombatEvent(zone: Zone, event: ZoneEvent): ExplorationResult {
    const monsters = generateMonstersForZone(zone);
    
    // 计算经验奖励
    const totalExp = monsters.reduce(
      (sum, m) => sum + calculateExpReward(zone, m.level),
      0
    );
    
    // 战斗奖励在玩家胜利后由控制器发放，避免战斗开始前获得奖励。
    const rewards = this.generateCombatRewards(zone, monsters);
    
    return {
      success: true,
      eventType: "combat",
      description: event.description,
      rewards,
      monsters,
      expGained: totalExp,
      levelUp: false,
      newLevel: undefined,
    };
  }
  
  // 处理宝箱事件
  private processChestEvent(zone: Zone, event: ZoneEvent): ExplorationResult {
    const rewards: ExplorationReward[] = [];
    
    // 通货掉落
    const currencyChance = 0.7 + zone.dropBonus / 100;
    if (Math.random() < currencyChance) {
      const currency = this.getRandomCurrency(zone);
      const amount = 1 + Math.floor(Math.random() * 3);
      rewards.push({
        type: "currency",
        id: currency.id,
        name: currency.name,
        amount,
      });
      
      // 奖励由控制器在展示探索结果后统一发放。
    }
    
    // 装备掉落
    const itemChance = 0.4 + zone.dropBonus / 200;
    if (Math.random() < itemChance) {
      const item = this.generateRandomItem(zone);
      rewards.push({
        type: "item",
        id: item.id,
        name: item.name,
        item,
      });
      
      // 奖励由控制器在展示探索结果后统一发放。
    }
    
    // 经验
    const exp = 10 + zone.levelRange[0] * 2;
    const levelUp = false;
    const newLevel = undefined;
    
    return {
      success: true,
      eventType: "chest",
      description: event.description,
      rewards,
      expGained: exp,
      levelUp,
      newLevel,
    };
  }
  
  // 处理商店事件
  private processShopEvent(zone: Zone, event: ZoneEvent): ExplorationResult {
    // 简化处理：给予一些通货和装备
    const rewards: ExplorationReward[] = [];
    
    // 给予通货
    const currency = this.getRandomCurrency(zone);
    rewards.push({
      type: "currency",
      id: currency.id,
      name: currency.name,
      amount: 2,
    });
    // 奖励由控制器在展示探索结果后统一发放。
    
    // 给予装备
    const item = this.generateRandomItem(zone);
    rewards.push({
      type: "item",
      id: item.id,
      name: item.name,
      item,
    });
    // 奖励由控制器在展示探索结果后统一发放。
    
    return {
      success: true,
      eventType: "shop",
      description: event.description,
      rewards,
      expGained: 0,
      levelUp: false,
    };
  }
  
  // 处理NPC事件
  private processNpcEvent(zone: Zone, event: ZoneEvent): ExplorationResult {
    const rewards: ExplorationReward[] = [];
    
    // NPC给予经验
    const exp = 20 + zone.levelRange[0] * 3;
    const levelUp = false;
    const newLevel = undefined;
    
    rewards.push({
      type: "experience",
      name: "经验",
      amount: exp,
    });
    
    // 有几率给予物品
    if (Math.random() < 0.3) {
      const item = this.generateRandomItem(zone);
      rewards.push({
        type: "item",
        id: item.id,
        name: item.name,
        item,
      });
      // 奖励由控制器在展示探索结果后统一发放。
    }
    
    return {
      success: true,
      eventType: "npc",
      description: event.description,
      rewards,
      expGained: exp,
      levelUp,
      newLevel,
    };
  }
  
  // 处理陷阱事件
  private processTrapEvent(zone: Zone, event: ZoneEvent): ExplorationResult {
    // 陷阱造成伤害
    const damage = 10 + zone.levelRange[0] * 2;
    this.state.player.life = Math.max(1, this.state.player.life - damage);
    
    const rewards: ExplorationReward[] = [];
    
    // 陷阱有几率掉落物品
    if (Math.random() < 0.3) {
      const item = this.generateRandomItem(zone);
      rewards.push({
        type: "item",
        id: item.id,
        name: item.name,
        item,
      });
      // 奖励由控制器在展示探索结果后统一发放。
    }
    
    return {
      success: true,
      eventType: "trap",
      description: `${event.description} 你受到了 ${damage} 点伤害！`,
      rewards,
      expGained: 0,
      levelUp: false,
    };
  }
  
  // 处理宝藏事件
  private processTreasureEvent(zone: Zone, event: ZoneEvent): ExplorationResult {
    const rewards: ExplorationReward[] = [];
    
    // 大量通货
    for (let i = 0; i < 3; i++) {
      const currency = this.getRandomCurrency(zone);
      const amount = 1 + Math.floor(Math.random() * 5);
      rewards.push({
        type: "currency",
        id: currency.id,
        name: currency.name,
        amount,
      });
      // 奖励由控制器在展示探索结果后统一发放。
    }
    
    // 稀有装备
    const item = this.generateRandomItem(zone, Rarity.Rare);
    rewards.push({
      type: "item",
      id: item.id,
      name: item.name,
      item,
    });
    // 奖励由控制器在展示探索结果后统一发放。
    
    // 大量经验
    const exp = 50 + zone.levelRange[0] * 5;
    const levelUp = false;
    const newLevel = undefined;
    
    return {
      success: true,
      eventType: "treasure",
      description: event.description,
      rewards,
      expGained: exp,
      levelUp,
      newLevel,
    };
  }
  
  /** 标记当前区域的战斗已胜利，可安全离开并写入完成状态。 */
  markCurrentZoneResolved(): void {
    this.currentZoneResolved = true;
    this.state.currentZoneResolved = true;
  }

  // 完成区域
  completeZone(): boolean {
    if (!this.currentZoneResolved) return false;
    if (this.state.currentZone && !this.state.completedZones.includes(this.state.currentZone)) {
      this.state.completedZones.push(this.state.currentZone);
      // 检查任务完成条件
      this.checkQuestCompletion();
      this.refreshAvailableQuests();
    }
    this.state.currentZone = null;
    this.currentZoneResolved = false;
    this.state.currentZoneResolved = false;
    return true;
  }
  
  // ===== 任务系统 =====
  
  /** 刷新可接取的任务（根据等级和前置任务） */
  refreshAvailableQuests() {
    const available = getAvailableQuests(
      this.state.player.level,
      this.state.completedQuests
    );
    this.state.activeQuests = available.map((q) => q.id);
  }
  
  /** 检查活跃任务是否已完成 */
  private checkQuestCompletion() {
    for (const questId of this.state.activeQuests) {
      if (this.state.completedQuests.includes(questId)) continue;
      const quest = ALL_QUESTS.find((q) => q.id === questId);
      if (!quest) continue;
      
      let completed = false;
      
      if (quest.isBoss) {
        // Boss任务：需要完成对应区域
        const bossZoneId = this.getBossZoneForQuest(quest);
        if (bossZoneId && this.state.completedZones.includes(bossZoneId)) {
          completed = true;
        }
      } else {
        // 普通任务：检查是否完成了对应区域
        const questZones = this.getZonesForQuest(quest);
        if (questZones.length > 0 && questZones.every((z) => this.state.completedZones.includes(z))) {
          completed = true;
        }
      }
      
      if (completed) {
        this.state.completedQuests.push(questId);
        this.state.pendingRewards.push(questId);
      }
    }
  }
  
  /** 获取任务对应的Boss区域ID */
  private getBossZoneForQuest(quest: Quest): string | null {
    if (!quest.bossId) return null;
    // 查找包含该Boss的区域
    const zone = ALL_ZONES.find((z) =>
      z.monsterPool.some((m) => m.id === quest.bossId)
    );
    return zone?.id ?? null;
  }
  
  /** 获取普通任务对应的区域ID列表 */
  private getZonesForQuest(quest: Quest): string[] {
    // 按章节和顺序匹配区域
    const chapterZones = ALL_ZONES.filter((z) => z.chapter === quest.chapter);
    // 非Boss任务：任务顺序对应的区域（简单映射）
    const idx = quest.order - 1;
    if (idx < chapterZones.length) {
      return [chapterZones[idx].id];
    }
    return [];
  }
  
  /** 获取任务当前进度，区域型主线的目标为完成对应区域。 */
  getQuestProgress(quest: Quest): { current: number; target: number; status: "available" | "active" | "completed" | "claimed" } {
    const completed = this.state.completedQuests.includes(quest.id);
    const pending = this.state.pendingRewards.includes(quest.id);
    const targets = quest.isBoss ? this.getBossZoneForQuest(quest) : this.getZonesForQuest(quest);
    const target = 1;
    const current = targets && (Array.isArray(targets)
      ? targets.length > 0 && targets.every((zoneId) => this.state.completedZones.includes(zoneId))
      : this.state.completedZones.includes(targets)) ? 1 : 0;
    const status = completed ? (pending ? "completed" : "claimed") :
      (this.state.activeQuests.includes(quest.id) ? "active" : "available");
    return { current, target, status };
  }

  /** 在战斗胜利后发放经验，统一处理升级。 */
  grantExperience(amount: number): { levelUp: boolean; newLevel?: number } {
    if (amount <= 0) return { levelUp: false };
    return this.checkLevelUp(amount);
  }

  /** 获取待领取奖励的任务列表 */
  getPendingRewardQuests(): Quest[] {
    return this.state.pendingRewards
      .map((id) => ALL_QUESTS.find((q) => q.id === id))
      .filter((q): q is Quest => q !== undefined);
  }
  
  /** 领取任务奖励 */
  claimQuestReward(questId: string): { success: boolean; message: string } {
    const idx = this.state.pendingRewards.indexOf(questId);
    if (idx === -1) return { success: false, message: "该任务没有待领取的奖励" };
    
    const quest = ALL_QUESTS.find((q) => q.id === questId);
    if (!quest) return { success: false, message: "任务不存在" };
    
    const reward = generateQuestReward(quest);
    
    // 统一通过升级函数发放经验，避免经验和累计经验重复增加。
    const levelResult = this.checkLevelUp(reward.experience);
    
    // 发放通货
    for (const currencyId of reward.currencies) {
      const current = this.state.player.inventory.currencies.get(currencyId) || 0;
      this.state.player.inventory.currencies.set(currencyId, current + 1);
    }
    
    // 发放技能宝石奖励
    if (reward.gemId) {
      const gem = getGemById(reward.gemId);
      if (gem) {
        this.state.player.inventory.gems.push({
          id: gem.id,
          name: gem.name,
          type: gem.type,
          color: gem.color,
          level: 1,
          experience: 0,
          requiredLevel: gem.requiredLevel,
        });
      }
    }

    // 发放装备（如果有的话）
    if (reward.itemLevel > 0) {
      const slots = [EquipSlot.Weapon, EquipSlot.Body, EquipSlot.Helmet];
      const slot = slots[Math.floor(Math.random() * slots.length)];
      const base = randomBase(slot, reward.itemLevel);
      if (base) {
        const item = generateItem(base, reward.itemLevel, Rarity.Rare);
        this.state.player.inventory.items.push(item);
      }
    }
    
    // 移除待领取标记
    this.state.pendingRewards.splice(idx, 1);
    
    // 组装奖励描述
    const lines: string[] = [];
    lines.push(`任务「${quest.name}」完成！`);
    lines.push(`获得 ${reward.experience} 经验`);
    if (reward.currencies.length > 0) {
      const names = reward.currencies.map((id) => getCurrencyById(id)?.name || id);
      lines.push(`获得通货: ${names.join(", ")}`);
    }
    if (reward.itemLevel > 0) lines.push(`获得装备: 稀有装备×1`);
    if (reward.gemId) lines.push(`获得技能宝石: ${getGemById(reward.gemId)?.name || reward.gemId}`);
    if (levelResult.levelUp) lines.push(`🎉 升级到 Lv.${levelResult.newLevel}！`);
    
    return { success: true, message: lines.join("\n") };
  }
  
  /** 获取所有任务列表（按章节） */
  getAllQuests(): { chapter: number; quests: { quest: Quest; completed: boolean; pending: boolean }[] }[] {
    const result: { chapter: number; quests: { quest: Quest; completed: boolean; pending: boolean }[] }[] = [];
    const chapters = [1, 2, 3, 4];
    
    for (const ch of chapters) {
      const quests = ALL_QUESTS.filter((q) => q.chapter === ch);
      if (quests.length === 0) continue;
      
      result.push({
        chapter: ch,
        quests: quests.map((q) => ({
          quest: q,
          completed: this.state.completedQuests.includes(q.id),
          pending: this.state.pendingRewards.includes(q.id),
        })),
      });
    }
    
    return result;
  }
  
  /** 更新章节（根据完成的任务推进） */
  updateChapter() {
    // 根据已完成的最大章节区域推断当前章节
    let maxChapter = 1;
    for (const zoneId of this.state.completedZones) {
      const zone = getZoneById(zoneId);
      if (zone && zone.chapter > maxChapter) {
        maxChapter = zone.chapter;
      }
    }
    this.state.currentChapter = maxChapter;
  }
  
  // ===== 辅助函数 =====
  
  private checkLevelUp(expGained: number): { levelUp: boolean; newLevel?: number } {
    this.state.totalExp += expGained;
    this.state.player.experience += expGained;
    
    // 简化升级公式：每100经验升1级
    const expForNextLevel = this.state.player.level * 100;
    
    if (this.state.player.experience >= expForNextLevel) {
      this.state.player.level++;
      this.state.player.experience -= expForNextLevel;
      
      // 升级奖励
      this.state.player.maxLife += 20;
      this.state.player.life = this.state.player.maxLife;
      this.state.player.maxMana += 10;
      this.state.player.mana = this.state.player.maxMana;
      this.state.player.passivePoints += 1;
      
      return { levelUp: true, newLevel: this.state.player.level };
    }
    
    return { levelUp: false };
  }
  
  private getRandomCurrency(zone: Zone): Currency {
    // 根据区域难度选择通货
    const commonCurrencies = ["scroll_of_wisdom", "orb_of_alteration", "orb_of_scouring", "chromatic_orb", "orb_of_portal"];
    const rareCurrencies = ["orb_of_alchemy", "orb_of_regret", "chaos_orb", "regal_orb", "divine_orb"];
    const legendaryCurrencies = ["exalted_orb", "mirror_of_kalandra"];
    
    const roll = Math.random() * 100;
    let currencyId: string;
    
    if (roll < 60 - zone.difficulty * 10) {
      currencyId = commonCurrencies[Math.floor(Math.random() * commonCurrencies.length)];
    } else if (roll < 95 - zone.difficulty * 5) {
      currencyId = rareCurrencies[Math.floor(Math.random() * rareCurrencies.length)];
    } else {
      currencyId = legendaryCurrencies[Math.floor(Math.random() * legendaryCurrencies.length)];
    }
    
    return getCurrencyById(currencyId) || CURRENCIES[0];
  }
  
  private generateRandomItem(zone: Zone, forcedRarity?: Rarity): Item {
    const slots = [
      EquipSlot.Weapon,
      EquipSlot.Body,
      EquipSlot.Helmet,
      EquipSlot.Gloves,
      EquipSlot.Boots,
      EquipSlot.Ring1,
      EquipSlot.Amulet,
    ];
    
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const base = randomBase(slot, zone.levelRange[1]);
    
    if (!base) {
      // 如果找不到基底，返回一个默认的
      const defaultBase = randomBase(EquipSlot.Weapon, zone.levelRange[1]);
      if (!defaultBase) {
        throw new Error("No valid base found");
      }
      return generateItem(defaultBase, zone.levelRange[1], Rarity.Normal);
    }
    
    let rarity = forcedRarity;
    if (!rarity) {
      const rarityRoll = Math.random() * 100;
      if (rarityRoll < 50) rarity = Rarity.Normal;
      else if (rarityRoll < 80) rarity = Rarity.Magic;
      else rarity = Rarity.Rare;
    }
    
    return generateItem(base, zone.levelRange[1], rarity);
  }
  
  private generateCombatRewards(zone: Zone, monsters: any[]): ExplorationReward[] {
    const rewards: ExplorationReward[] = [];
    
    // 经验
    const totalExp = monsters.reduce(
      (sum, m) => sum + calculateExpReward(zone, m.level),
      0
    );
    rewards.push({
      type: "experience",
      name: "经验",
      amount: totalExp,
    });
    
    // 通货掉落
    for (const monster of monsters) {
      if (Math.random() < 0.3 + zone.dropBonus / 200) {
        const currency = this.getRandomCurrency(zone);
        rewards.push({
          type: "currency",
          id: currency.id,
          name: currency.name,
          amount: 1,
        });
      }
    }
    
    // 装备掉落
    if (Math.random() < 0.3 + zone.dropBonus / 100) {
      const item = this.generateRandomItem(zone);
      rewards.push({
        type: "item",
        id: item.id,
        name: item.name,
        item,
      });
    }
    
    return rewards;
  }
}
