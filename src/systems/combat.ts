import { Player, Monster, Item, EquipSlot, DamageType, SkillGroup, Flask, ModType } from "../models/types";
import { computeSkillGroup, ComputedSkill } from "./gemLink";

// ===== 战斗实体 =====

interface CombatEntity {
  id: string;
  name: string;
  maxLife: number;
  life: number;
  maxMana?: number;
  mana?: number;
  manaReserved?: number;
  
  // 防御
  armor: number;
  evasion: number;
  energyShield: number;
  resistances: {
    fire: number;
    cold: number;
    lightning: number;
    chaos: number;
  };
  
  // 进攻
  attackSpeed: number;
  critChance: number;
  critMultiplier: number;
  accuracy: number;
  increasedDamage: number;
  moreDamage: number;
  
  // 状态
  statusEffects: StatusEffect[];
  utilityBuffs: { utility: "offense" | "guard" | "haste"; value: number; remainingTurns: number }[];
  isDead: boolean;
}

interface StatusEffect {
  type: "ignite" | "freeze" | "shock" | "bleed" | "poison";
  damage?: number;
  duration: number;
  multiplier?: number;
}

// ===== 行动条系统 =====

interface ActionEntry {
  entity: CombatEntity;
  nextAction: number;  // 行动点数
  skill?: SkillGroup;
  isPlayer: boolean;
}

function calculateActionSpeed(entity: CombatEntity, skill?: SkillGroup): number {
  let speed = entity.attackSpeed;
  
  if (skill) {
    const computed = computeSkillGroup(skill);
    // 施法时间影响速度
    speed = 1 / computed.castTime;
  }

  const haste = entity.utilityBuffs
    .filter((buff) => buff.utility === "haste")
    .reduce((total, buff) => total + buff.value, 0);
  return speed * (1 + haste / 100);
}

// ===== 战斗计算 =====

function calculateDamage(
  attacker: CombatEntity,
  defender: CombatEntity,
  skill?: SkillGroup
): { damage: number; isCrit: boolean; damageType: DamageType } {
  let baseDamage = 10; // 默认基础伤害
  let damageType = DamageType.Physical;
  
  if (skill) {
    const computed = computeSkillGroup(skill);
    baseDamage = computed.totalDamage;
    damageType = computed.damageType;
  }
  
  // 应用伤害加成
  const utilityDamage = attacker.utilityBuffs
    .filter((buff) => buff.utility === "offense")
    .reduce((total, buff) => total + buff.value, 0);
  baseDamage *= (1 + (attacker.increasedDamage + utilityDamage) / 100);
  baseDamage *= attacker.moreDamage;
  
  // 暴击判定
  let isCrit = false;
  if (Math.random() * 100 < attacker.critChance) {
    isCrit = true;
    baseDamage *= attacker.critMultiplier / 100;
  }
  
  // 命中判定
  const hitChance = Math.min(95, Math.max(5, 50 + attacker.accuracy - defender.evasion / 10));
  if (Math.random() * 100 > hitChance) {
    return { damage: 0, isCrit: false, damageType };
  }
  
  // 防御计算
  let finalDamage = baseDamage;
  
  if (damageType === DamageType.Physical) {
    // 物理伤害被护甲减免
    const guard = defender.utilityBuffs
      .filter((buff) => buff.utility === "guard")
      .reduce((total, buff) => total + buff.value, 0);
    const effectiveArmor = defender.armor * (1 + guard / 100);
    const physicalReduction = Math.min(90, effectiveArmor / (effectiveArmor + 5 * finalDamage));
    finalDamage *= (1 - physicalReduction / 100);
  } else {
    // 元素伤害被抗性减免
    let resistance = 0;
    switch (damageType) {
      case DamageType.Fire:
        resistance = defender.resistances.fire;
        break;
      case DamageType.Cold:
        resistance = defender.resistances.cold;
        break;
      case DamageType.Lightning:
        resistance = defender.resistances.lightning;
        break;
      case DamageType.Chaos:
        resistance = defender.resistances.chaos;
        break;
    }
    finalDamage *= (1 - resistance / 100);
  }
  
  return { damage: Math.max(1, Math.floor(finalDamage)), isCrit, damageType };
}

// ===== 战斗系统 =====

export class CombatSystem {
  private player: CombatEntity;
  private monsters: CombatEntity[];
  private actionQueue: ActionEntry[];
  private turnCount: number = 0;
  private combatLog: string[] = [];
  
  constructor(player: Player, monsters: Monster[]) {
    this.player = this.convertPlayer(player);
    this.monsters = monsters.map((m) => this.convertMonster(m));
    this.actionQueue = [];
    this.initActionQueue();
  }
  
  private convertPlayer(player: Player): CombatEntity {
    return {
      id: "player",
      name: player.name,
      maxLife: player.maxLife,
      life: player.life,
      maxMana: player.maxMana,
      mana: player.mana,
      manaReserved: player.manaReserved,
      armor: player.defenses.armor,
      evasion: player.defenses.evasion,
      energyShield: player.defenses.energyShield,
      resistances: {
        fire: player.defenses.fireRes,
        cold: player.defenses.coldRes,
        lightning: player.defenses.lightningRes,
        chaos: player.defenses.chaosRes,
      },
      attackSpeed: player.offense.attackSpeed,
      critChance: player.offense.critChance,
      critMultiplier: player.offense.critMultiplier,
      accuracy: player.offense.accuracy,
      increasedDamage: player.offense.increasedDamage,
      moreDamage: player.offense.moreDamage,
      statusEffects: [],
      utilityBuffs: [],
      isDead: false,
    };
  }
  
  private convertMonster(monster: Monster): CombatEntity {
    return {
      id: monster.id,
      name: monster.name,
      maxLife: monster.maxLife,
      life: monster.life,
      armor: monster.armor,
      evasion: monster.evasion,
      energyShield: 0,
      resistances: monster.resistances,
      attackSpeed: monster.attackSpeed,
      critChance: 5,
      critMultiplier: 150,
      accuracy: monster.accuracy,
      increasedDamage: 0,
      moreDamage: 1,
      statusEffects: [],
      utilityBuffs: [],
      isDead: false,
    };
  }
  
  private initActionQueue() {
    // 玩家初始行动点
    this.actionQueue.push({
      entity: this.player,
      nextAction: 0,
      isPlayer: true,
    });
    
    // 怪物初始行动点
    for (const monster of this.monsters) {
      this.actionQueue.push({
        entity: monster,
        nextAction: Math.floor(Math.random() * 50),  // 随机初始延迟
        isPlayer: false,
      });
    }
  }
  
  // 获取下一个行动的实体
  getNextActor(): { entity: CombatEntity; isPlayer: boolean } | null {
    if (this.isCombatOver()) return null;
    
    // 找到行动点最小的
    this.actionQueue.sort((a, b) => a.nextAction - b.nextAction);
    const next = this.actionQueue[0];
    
    return {
      entity: next.entity,
      isPlayer: next.isPlayer,
    };
  }
  
  // 执行玩家攻击
  executePlayerAttack(skill?: SkillGroup): CombatResult {
    const result: CombatResult = {
      actions: [],
      damageDealt: 0,
      damageTaken: 0,
      isCombatOver: false,
      winner: null,
    };
    
    // 玩家行动
    const computedSkill = skill ? computeSkillGroup(skill) : null;
    const manaCost = computedSkill?.manaCost || 0;
    if ((this.player.mana || 0) < manaCost) {
      result.actions.push({
        type: "status",
        message: "魔力不足，无法使用该技能",
      });
      return result;
    }
    this.player.mana = (this.player.mana || 0) - manaCost;
    const speed = calculateActionSpeed(this.player, skill);
    const actionEntry = this.actionQueue.find((a) => a.isPlayer);
    if (actionEntry) {
      actionEntry.nextAction += 100 / speed;
    }
    
    // 选择目标（第一个存活的怪物）
    const target = this.monsters.find((m) => !m.isDead);
    if (!target) {
      result.isCombatOver = true;
      result.winner = "player";
      return result;
    }
    
    // 计算伤害
    const { damage, isCrit, damageType } = calculateDamage(this.player, target, skill);
    
    if (damage > 0) {
      // 应用伤害
      this.applyDamage(target, damage);
      
      result.actions.push({
        type: "attack",
        attacker: this.player.name,
        target: target.name,
        damage,
        damageType,
        isCrit,
        message: `${this.player.name} 使用 ${skill?.activeGem.name || "普通攻击"} 对 ${target.name} 造成了 ${damage} 点${damageType}伤害${isCrit ? "（暴击！）" : ""}`,
      });
      
      result.damageDealt = damage;
      
      // 检查目标死亡
      if (target.isDead) {
        result.actions.push({
          type: "death",
          target: target.name,
          message: `${target.name} 被消灭了`,
        });
      }
    } else {
      result.actions.push({
        type: "miss",
        attacker: this.player.name,
        target: target.name,
        message: `${this.player.name} 的攻击被 ${target.name} 闪避了`,
      });
    }
    
    // 检查战斗结束
    if (this.isCombatOver()) {
      result.isCombatOver = true;
      result.winner = this.monsters.every((m) => m.isDead) ? "player" : "monster";
    }
    
    return result;
  }

  // 使用药剂也会占用玩家行动，并在下一个怪物回合前生效。
  executePlayerFlask(effect: Flask["effect"]): CombatResult {
    const result: CombatResult = {
      actions: [],
      damageDealt: 0,
      damageTaken: 0,
      isCombatOver: false,
      winner: null,
    };
    const actionEntry = this.actionQueue.find((entry) => entry.isPlayer);
    if (actionEntry) {
      actionEntry.nextAction += 100 / calculateActionSpeed(this.player);
    }

    if (effect.type === "life") {
      const amount = Math.max(1, Math.floor(this.player.maxLife * effect.amountPercent / 100));
      const restored = Math.min(amount, this.player.maxLife - this.player.life);
      this.player.life += restored;
      result.actions.push({ type: "flask", message: `生命药剂恢复了 ${restored} 点生命` });
    } else if (effect.type === "mana") {
      const amount = Math.max(1, Math.floor((this.player.maxMana || 0) * effect.amountPercent / 100));
      const restored = Math.min(amount, (this.player.maxMana || 0) - (this.player.mana || 0));
      this.player.mana = (this.player.mana || 0) + restored;
      result.actions.push({ type: "flask", message: `魔力药剂恢复了 ${restored} 点魔力` });
    } else {
      this.player.utilityBuffs = this.player.utilityBuffs.filter((buff) => buff.utility !== effect.utility);
      this.player.utilityBuffs.push({
        utility: effect.utility,
        value: effect.value,
        remainingTurns: effect.duration,
      });
      result.actions.push({ type: "flask", message: `获得${effect.utility === "guard" ? "护甲" : effect.utility === "haste" ? "速度" : "伤害"}效果，持续 ${effect.duration} 回合` });
    }

    return result;
  }
  
  // 执行怪物行动
  executeMonsterTurn(): CombatResult {
    const result: CombatResult = {
      actions: [],
      damageDealt: 0,
      damageTaken: 0,
      isCombatOver: false,
      winner: null,
    };
    
    // 处理所有怪物
    for (const monster of this.monsters) {
      if (monster.isDead) continue;
      
      // 计算行动速度
      const speed = calculateActionSpeed(monster);
      const actionEntry = this.actionQueue.find((a) => a.entity === monster);
      if (actionEntry) {
        actionEntry.nextAction += 100 / speed;
      }
      
      // 计算伤害
      const { damage, isCrit, damageType } = calculateDamage(monster, this.player);
      
      if (damage > 0) {
        // 应用伤害
        this.applyDamage(this.player, damage);
        
        result.actions.push({
          type: "attack",
          attacker: monster.name,
          target: this.player.name,
          damage,
          damageType,
          isCrit,
          message: `${monster.name} 攻击了 ${this.player.name}，造成了 ${damage} 点${damageType}伤害${isCrit ? "（暴击！）" : ""}`,
        });
        
        result.damageTaken += damage;
      } else {
        result.actions.push({
          type: "miss",
          attacker: monster.name,
          target: this.player.name,
          message: `${monster.name} 的攻击被 ${this.player.name} 闪避了`,
        });
      }
    }
    
    // 处理持续伤害与功能药剂持续时间
    this.processStatusEffects();
    this.player.utilityBuffs = this.player.utilityBuffs
      .map((buff) => ({ ...buff, remainingTurns: buff.remainingTurns - 1 }))
      .filter((buff) => buff.remainingTurns > 0);
    
    // 检查战斗结束
    if (this.isCombatOver()) {
      result.isCombatOver = true;
      result.winner = this.player.isDead ? "monster" : "player";
    }
    
    return result;
  }
  
  private applyDamage(entity: CombatEntity, damage: number) {
    // 先扣能量护盾
    if (entity.energyShield > 0) {
      const esDamage = Math.min(entity.energyShield, damage);
      entity.energyShield -= esDamage;
      damage -= esDamage;
    }
    
    // 再扣生命
    entity.life = Math.max(0, entity.life - damage);
    
    if (entity.life <= 0) {
      entity.isDead = true;
    }
  }
  
  private processStatusEffects() {
    // 处理所有实体的状态效果
    const allEntities = [this.player, ...this.monsters];
    
    for (const entity of allEntities) {
      if (entity.isDead) continue;
      
      for (const effect of entity.statusEffects) {
        if (effect.duration <= 0) continue;
        
        // 处理持续伤害
        if (effect.damage) {
          this.applyDamage(entity, effect.damage);
        }
        
        effect.duration--;
      }
      
      // 移除过期效果
      entity.statusEffects = entity.statusEffects.filter((e) => e.duration > 0);
    }
  }
  
  isCombatOver(): boolean {
    return this.player.isDead || this.monsters.every((m) => m.isDead);
  }
  
  getCombatLog(): string[] {
    return this.combatLog;
  }
  
  getMonsterStatus(): { name: string; life: number; maxLife: number; isDead: boolean }[] {
    return this.monsters.map((m) => ({
      name: m.name,
      life: m.life,
      maxLife: m.maxLife,
      isDead: m.isDead,
    }));
  }
  
  getPlayerStatus(): { life: number; maxLife: number; mana: number; maxMana: number } {
    return {
      life: this.player.life,
      maxLife: this.player.maxLife,
      mana: this.player.mana || 0,
      maxMana: this.player.maxMana || 0,
    };
  }
  
  getMonsterLevel(name: string): number {
    const monster = this.monsters.find((m) => m.name === name);
    return monster ? (this.monsters.indexOf(monster) + 1) * 5 : 1;
  }
}

// ===== 战斗结果类型 =====

export interface CombatResult {
  actions: CombatAction[];
  damageDealt: number;
  damageTaken: number;
  isCombatOver: boolean;
  winner: "player" | "monster" | null;
}

interface CombatAction {
  type: "attack" | "miss" | "death" | "status" | "flask";
  attacker?: string;
  target?: string;
  damage?: number;
  damageType?: DamageType;
  isCrit?: boolean;
  message: string;
}

// ===== 测试函数 =====

export function testCombatSystem() {
  console.log("=== 战斗系统测试 ===\n");
  
  // 创建测试玩家
  const player: Player = {
    name: "测试战士",
    level: 10,
    experience: 0,
    stats: { strength: 30, dexterity: 20, intelligence: 15 },
    life: 500,
    maxLife: 500,
    mana: 100,
    maxMana: 100,
    manaReserved: 0,
    energyShield: 0,
    defenses: {
      armor: 100,
      evasion: 50,
      energyShield: 0,
      fireRes: 0,
      coldRes: 0,
      lightningRes: 0,
      chaosRes: -30,
      blockChance: 0,
    },
    offense: {
      increasedDamage: 0,
      moreDamage: 1,
      attackSpeed: 1,
      critChance: 5,
      critMultiplier: 150,
      accuracy: 100,
    },
    passivePoints: 0,
    allocatedNodes: [],
    equipment: {},
    skillGroups: [],
    flasks: [],
    inventory: {
      items: [],
      gems: [],
      currencies: new Map(),
      maxSlots: 50,
    },
  };
  
  // 创建测试怪物
  const monsters: Monster[] = [
    {
      id: "skeleton_1",
      name: "骸骨战士",
      level: 5,
      life: 100,
      maxLife: 100,
      damage: [{ stat: "physicalDamage", modType: ModType.Flat, min: 5, max: 10 }],
      damageType: DamageType.Physical,
      attackSpeed: 1,
      accuracy: 50,
      armor: 20,
      evasion: 10,
      resistances: { fire: 0, cold: 0, lightning: 0, chaos: 0 },
    },
    {
      id: "skeleton_2",
      name: "骸骨弓手",
      level: 5,
      life: 80,
      maxLife: 80,
      damage: [{ stat: "physicalDamage", modType: ModType.Flat, min: 8, max: 12 }],
      damageType: DamageType.Physical,
      attackSpeed: 1.2,
      accuracy: 60,
      armor: 10,
      evasion: 30,
      resistances: { fire: 0, cold: 0, lightning: 0, chaos: 0 },
    },
  ];
  
  // 创建战斗系统
  const combat = new CombatSystem(player, monsters);
  
  // 模拟3回合战斗
  for (let turn = 0; turn < 3; turn++) {
    console.log(`--- 回合 ${turn + 1} ---`);
    
    // 玩家攻击
    const playerResult = combat.executePlayerAttack();
    for (const action of playerResult.actions) {
      console.log(action.message);
    }
    
    // 怪物攻击
    const monsterResult = combat.executeMonsterTurn();
    for (const action of monsterResult.actions) {
      console.log(action.message);
    }
    
    // 显示状态
    const playerStatus = combat.getPlayerStatus();
    const monsterStatus = combat.getMonsterStatus();
    
    console.log(`\n玩家: ${playerStatus.life}/${playerStatus.maxLife} HP`);
    for (const m of monsterStatus) {
      console.log(`${m.name}: ${m.life}/${m.maxLife} HP${m.isDead ? " (死亡)" : ""}`);
    }
    console.log();
    
    if (combat.isCombatOver()) {
      console.log("战斗结束！");
      break;
    }
  }
}
