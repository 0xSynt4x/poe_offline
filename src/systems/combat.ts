import { Player, Monster, DamageType, SkillGroup, Flask } from "../models/types";
import { computeSkillGroup, ComputedSkill, DamagePart } from "./gemLink";

// ===== 战斗实体 =====

function randomInt(min: number, max: number): number {
  const lower = Math.ceil(Math.min(min, max));
  const upper = Math.floor(Math.max(min, max));
  if (upper <= lower) return lower;
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

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
  damage: { min: number; max: number };
  damageType: DamageType;
  abilities: string[];
  abilityUses: Set<string>;
  
  // 状态
  statusEffects: StatusEffect[];
  utilityBuffs: { utility: "offense" | "guard" | "haste"; value: number; remainingTurns: number }[];
  isDead: boolean;
}

export interface StatusEffect {
  type: "ignite" | "freeze" | "shock" | "bleed" | "poison";
  /** 每回合/每跳造成的持续伤害（ignite/bleed/poison） */
  damagePerTick: number;
  /** 剩余持续回合数 */
  duration: number;
  /** 暴击倍率加成（ignite） */
  multiplier?: number;
  /** shock：增加受到伤害的百分比 */
  increasedDamageTaken?: number;
}

/** 异常状态图标映射 */
export const AILMENT_ICONS: Record<StatusEffect["type"], string> = {
  ignite: "🔥",
  freeze: "❄️",
  shock: "⚡",
  bleed: "🩸",
  poison: "☠️",
};

/** 异常状态中文名 */
export const AILMENT_NAMES: Record<StatusEffect["type"], string> = {
  ignite: "点燃",
  freeze: "冰冻",
  shock: "感电",
  bleed: "流血",
  poison: "中毒",
};

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
  return Math.max(0.05, speed * (1 + haste / 100));
}

// ===== 战斗计算 =====

export interface DamageResult {
  damage: number;
  isCrit: boolean;
  damageType: DamageType;
  isMiss: boolean;
  /** 防御计算前的各类型伤害（用于分别计算护甲/抗性和异常状态） */
  damageParts: DamagePart[];
  /** 防御计算前的总伤害（用于异常状态伤害计算） */
  baseDamageForAilment: number;
  /** 各异常状态的施加概率（0-100） */
  ailmentChances: {
    ignite: number;
    freeze: number;
    shock: number;
    bleed: number;
    poison: number;
  };
}

function calculateDamage(
  attacker: CombatEntity,
  defender: CombatEntity,
  skill?: SkillGroup,
  attackerIsPlayer: boolean = false,
): DamageResult {
  let computedSkill: ComputedSkill | null = null;
  let damageParts: DamagePart[] = skill
    ? []
    : [{ type: attacker.damageType, amount: randomInt(attacker.damage.min, attacker.damage.max) }];
  if (skill) {
    computedSkill = computeSkillGroup(skill);
    damageParts = computedSkill.damageParts.map((part) => ({ ...part }));
  }

  // 角色/药剂的伤害加成作用于所有伤害部分。
  const utilityDamage = attacker.utilityBuffs
    .filter((buff) => buff.utility === "offense")
    .reduce((total, buff) => total + buff.value, 0);
  const damageMultiplier = Math.max(0, (1 + (attacker.increasedDamage + utilityDamage) / 100) * Math.max(0, attacker.moreDamage));
  for (const part of damageParts) part.amount *= damageMultiplier;

  let isCrit = false;
  const effectiveCritChance = Math.min(100, Math.max(0, attacker.critChance + (attackerIsPlayer && computedSkill ? computedSkill.critChanceBonus : 0)));
  const effectiveCritMultiplier = Math.max(100, attacker.critMultiplier + (attackerIsPlayer && computedSkill ? computedSkill.critMultiplierBonus : 0));

  const damageType = computedSkill?.damageType || attacker.damageType || DamageType.Physical;
  const zeroResult = {
    damage: 0,
    isCrit: false,
    damageType,
    isMiss: true,
    damageParts: [],
    baseDamageForAilment: 0,
    ailmentChances: { ignite: 0, freeze: 0, shock: 0, bleed: 0, poison: 0 },
  };
  const hitChance = Math.min(95, Math.max(5, 50 + attacker.accuracy - defender.evasion / 10));
  if (Math.random() * 100 >= hitChance) return zeroResult;

  if (Math.random() * 100 < effectiveCritChance) {
    isCrit = true;
    for (const part of damageParts) part.amount *= effectiveCritMultiplier / 100;
  }

  const baseDamageForAilment = Math.max(1, Math.floor(damageParts.reduce((total, part) => total + part.amount, 0)));
  if (damageParts.length === 0 || baseDamageForAilment <= 0) return { ...zeroResult, isMiss: false };
  const finalParts = damageParts.map((part) => ({ ...part }));
  const guard = defender.utilityBuffs
    .filter((buff) => buff.utility === "guard")
    .reduce((total, buff) => total + buff.value, 0);
  const effectiveArmor = defender.armor * (1 + guard / 100);
  for (const part of finalParts) {
    if (part.type === DamageType.Physical) {
      const physicalReduction = effectiveArmor <= 0
        ? 0
        : Math.min(90, effectiveArmor / (effectiveArmor + 5 * Math.max(1, part.amount)) * 100);
      part.amount *= 1 - physicalReduction / 100;
      continue;
    }
    const resistance = part.type === DamageType.Fire ? defender.resistances.fire
      : part.type === DamageType.Cold ? defender.resistances.cold
      : part.type === DamageType.Lightning ? defender.resistances.lightning
      : defender.resistances.chaos;
    const penetration = attackerIsPlayer && computedSkill
      ? part.type === DamageType.Fire ? computedSkill.firePenetration
      : part.type === DamageType.Cold ? computedSkill.coldPenetration
      : part.type === DamageType.Lightning ? computedSkill.lightningPenetration
      : computedSkill.chaosPenetration
      : 0;
    const damageMultiplier = Math.max(0, 1 - (resistance - penetration) / 100);
    part.amount *= damageMultiplier;
  }

  let finalDamage = finalParts.reduce((total, part) => total + part.amount, 0);
  const shockEffect = defender.statusEffects
    .filter((effect) => effect.type === "shock" && effect.duration > 0)
    .reduce((total, effect) => total + (effect.increasedDamageTaken ?? 0), 0);
  if (shockEffect > 0) finalDamage *= 1 + shockEffect / 100;

  const ailmentChances = calculateAilmentChances(
    attackerIsPlayer && computedSkill ? computedSkill : null,
    finalParts,
    isCrit,
  );
  return {
    damage: Math.max(1, Math.floor(finalDamage)),
    isCrit,
    damageType: computedSkill ? computedSkill.damageType : attacker.damageType,
    isMiss: false,
    damageParts: finalParts,
    baseDamageForAilment,
    ailmentChances,
  };
}

/**
 * 根据技能数据和攻击类型，计算各异常状态的施加概率。
 * PoE 规则：
 * - 点燃：火焰伤害技能 + 攻击者 igniteChance
 * - 冰冻：冰冷伤害技能 + 攻击者 freezeChance
 * - 感电：闪电伤害技能 + 攻击者 shockChance
 * - 流血：物理伤害 + 攻击者 bleedChance（从 gemLink 用 bleedChance 复用）
 * - 中毒：任意伤害 + 攻击者 poisonChance（从 gemLink 用 maimChance 复用）
 * - 暴击时基础概率 40%
 */
function calculateAilmentChances(
  computedSkill: ComputedSkill | null,
  damageParts: DamagePart[],
  isCrit: boolean,
): { ignite: number; freeze: number; shock: number; bleed: number; poison: number } {
  // 暴击的基础异常状态概率
  const critBase = isCrit ? 40 : 0;
  
  // 从技能获取的施加概率（gemLink 中 igniteChance/freezeChance/shockChance）
  const skillIgnite = computedSkill?.igniteChance ?? 0;
  const skillFreeze = computedSkill?.freezeChance ?? 0;
  const skillShock = computedSkill?.shockChance ?? 0;
  // bleed/poison 复用 gemLink 中的 maimChance（流血）和 ailmentDuration（中毒）字段
  const skillBleed = computedSkill?.maimChance ?? 0;
  const skillPoison = computedSkill?.ailmentDuration ?? 0;
  
  const hasType = (type: DamageType) => damageParts.some((part) => part.type === type && part.amount > 0);
  const noElementalAilments = computedSkill?.noElementalAilments ?? false;
  const baseIgnite = hasType(DamageType.Fire) && !noElementalAilments ? 10 : 0;
  const baseFreeze = hasType(DamageType.Cold) && !noElementalAilments ? 10 : 0;
  const baseShock = hasType(DamageType.Lightning) && !noElementalAilments ? 10 : 0;
  const baseBleed = hasType(DamageType.Physical) ? 8 : 0;
  const basePoison = hasType(DamageType.Physical) || hasType(DamageType.Chaos) ? 5 : 0;
  
  return {
    ignite: noElementalAilments ? 0 : Math.min(100, baseIgnite + skillIgnite + critBase),
    freeze: noElementalAilments ? 0 : Math.min(100, baseFreeze + skillFreeze + critBase),
    shock: noElementalAilments ? 0 : Math.min(100, baseShock + skillShock + critBase),
    bleed: Math.min(100, baseBleed + skillBleed + critBase),
    poison: Math.min(100, basePoison + skillPoison + (critBase > 0 ? critBase / 2 : 0)),
  };
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
      damage: { min: 0, max: 0 },
      damageType: DamageType.Physical,
      abilities: [],
      abilityUses: new Set(),
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
      damage: this.getMonsterDamage(monster),
      damageType: monster.damageType,
      abilities: monster.abilities || [],
      abilityUses: new Set(),
      statusEffects: [],
      utilityBuffs: [],
      isDead: false,
    };
  }
  
  private getMonsterDamage(monster: Monster): { min: number; max: number } {
    const values = monster.damage
      .filter((stat) => Number.isFinite(stat.min) && Number.isFinite(stat.max))
      .map((stat) => ({ min: Math.max(0, stat.min), max: Math.max(stat.min, stat.max) }));
    if (values.length === 0) return { min: 0, max: 0 };
    return {
      min: values.reduce((total, value) => total + value.min, 0),
      max: values.reduce((total, value) => total + value.max, 0),
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
    const availableMana = Math.max(0, (this.player.mana || 0) - (this.player.manaReserved || 0));
    if (availableMana < manaCost) {
      result.actions.push({
        type: "status",
        message: "魔力不足，无法使用该技能",
      });
      return result;
    }
    // 检查玩家是否被冰冻；被控时不消耗魔力或行动点。
    if (this.isPlayerFrozen()) {
      result.actions.push({
        type: "status",
        message: "你被冰冻了，无法行动！",
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
    
    // 计算伤害（使用增强的穿透和暴击计算）
    const damageResult = calculateDamage(this.player, target, skill, true);
    
    if (!damageResult.isMiss && damageResult.damage > 0) {
      // 应用伤害
      this.applyDamage(target, damageResult.damage);
      
      // 构建伤害信息
      let damageInfo = `${damageResult.damage} 点${damageResult.damageType}伤害`;
      if (damageResult.isCrit) damageInfo += "（暴击！）";
      if (computedSkill && computedSkill.firePenetration > 0 && damageResult.damageType === DamageType.Fire) {
        damageInfo += ` [穿透${computedSkill.firePenetration}%]`;
      } else if (computedSkill && computedSkill.coldPenetration > 0 && damageResult.damageType === DamageType.Cold) {
        damageInfo += ` [穿透${computedSkill.coldPenetration}%]`;
      } else if (computedSkill && computedSkill.lightningPenetration > 0 && damageResult.damageType === DamageType.Lightning) {
        damageInfo += ` [穿透${computedSkill.lightningPenetration}%]`;
      }
      
      result.actions.push({
        type: "attack",
        attacker: this.player.name,
        target: target.name,
        damage: damageResult.damage,
        damageType: damageResult.damageType,
        isCrit: damageResult.isCrit,
        message: `${this.player.name} 使用 ${skill?.activeGem.name || "普通攻击"} 对 ${target.name} 造成了 ${damageInfo}`,
      });
      
      result.damageDealt = damageResult.damage;
      
      // 施加异常状态
      this.applyAilments(target, damageResult.ailmentChances, damageResult.baseDamageForAilment, true, damageResult.isCrit, result, computedSkill);
      
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
    
    this.turnCount += 1;

    // 有召唤能力的怪物在首次敌方回合生成一个较弱的召唤物。
    for (const monster of [...this.monsters]) {
      if (!monster.isDead && monster.abilities.includes("summon") && !monster.abilityUses.has("summon")) {
        monster.abilityUses.add("summon");
        const summoned: CombatEntity = {
          ...monster,
          id: `${monster.id}_summon_${this.turnCount}`,
          name: `${monster.name}的召唤物`,
          maxLife: Math.max(1, Math.floor(monster.maxLife * 0.35)),
          life: Math.max(1, Math.floor(monster.maxLife * 0.35)),
          damage: {
            min: Math.max(1, Math.floor(monster.damage.min * 0.4)),
            max: Math.max(1, Math.floor(monster.damage.max * 0.4)),
          },
          abilities: [],
          abilityUses: new Set(),
          statusEffects: [],
        };
        this.monsters.push(summoned);
        this.actionQueue.push({ entity: summoned, nextAction: 100, isPlayer: false });
        result.actions.push({ type: "status", message: `${monster.name} 召唤了一个援军！` });
      }
    }

    // 处理所有怪物
    for (const monster of [...this.monsters]) {
      if (monster.isDead) continue;
      
      // 冰冻的怪物跳过行动
      if (monster.statusEffects.some((e) => e.type === "freeze" && e.duration > 0)) {
        result.actions.push({
          type: "status",
          message: `${monster.name} 被冰冻，无法行动！`,
        });
        continue;
      }
      
      // 计算行动速度
      const speed = calculateActionSpeed(monster);
      const actionEntry = this.actionQueue.find((a) => a.entity === monster);
      if (actionEntry) {
        actionEntry.nextAction += 100 / speed;
      }
      
      // 怪物词条能力对当前行动生效，基础伤害仍来自 Monster.damage 区间。
      const abilityMultiplier = (monster.abilities.includes("enrage") && monster.life <= monster.maxLife * 0.5 ? 1.5 : 1)
        * (monster.abilities.includes("cleave") ? 1.1 : 1);
      const monsterAttacker = abilityMultiplier === 1 ? monster : {
        ...monster,
        damage: {
          min: Math.floor(monster.damage.min * abilityMultiplier),
          max: Math.floor(monster.damage.max * abilityMultiplier),
        },
      };
      const damageResult = calculateDamage(monsterAttacker, this.player);
      
      if (!damageResult.isMiss && damageResult.damage > 0) {
        // 应用伤害
        this.applyDamage(this.player, damageResult.damage);
        
        result.actions.push({
          type: "attack",
          attacker: monster.name,
          target: this.player.name,
          damage: damageResult.damage,
          damageType: damageResult.damageType,
          isCrit: damageResult.isCrit,
          message: `${monster.name} 攻击了 ${this.player.name}，造成了 ${damageResult.damage} 点${damageResult.damageType}伤害${damageResult.isCrit ? "（暴击！）" : ""}`,
        });
        
        // 怪物施加异常状态（概率较低）
        this.applyAilments(this.player, damageResult.ailmentChances, damageResult.baseDamageForAilment, false, damageResult.isCrit, result, null);
        
        result.damageTaken += damageResult.damage;
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
    damage = Math.max(0, Math.floor(damage));
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
  
  /**
   * 对目标施加异常状态。
   * 每种异常状态独立掷骰，成功则添加或刷新效果。
   * 同类型效果取较高值刷新（不叠加，而是延长/增强）。
   */
  private applyAilments(
    target: CombatEntity,
    chances: { ignite: number; freeze: number; shock: number; bleed: number; poison: number },
    baseDamageForAilment: number,
    attackerIsPlayer: boolean,
    isCrit: boolean,
    result: CombatResult,
    computedSkill: ComputedSkill | null,
  ) {
    const ailmentDamageMultiplier = (isCrit ? 1.5 : 1.0) * (1 + (computedSkill?.ailmentDamage ?? 0) / 100);
    const ailmentBaseDuration = Math.max(1, Math.floor(4 * (1 + ((computedSkill?.ailmentDuration ?? 0) + (computedSkill?.durationBonus ?? 0)) / 100)));
    const targetMaxLife = target.maxLife || 100;

    // 点燃：火焰持续伤害
    if (Math.random() * 100 < chances.ignite) {
      const igniteDmg = Math.max(1, Math.floor(baseDamageForAilment * 0.2 * ailmentDamageMultiplier));
      this.applyOrRefreshAilment(target, "ignite", igniteDmg, ailmentBaseDuration);
      result.actions.push({
        type: "ailment",
        message: `${target.name} 被点燃了！（每回合 ${igniteDmg} 火焰伤害）`,
      });
    }

    // 冰冻：眩晕若干回合（用 damagePerTick=0, duration 表示眩晕回合）
    if (Math.random() * 100 < chances.freeze) {
      // 冰冻时间基于冰冷伤害占生命比例：0.3 * (dmg / maxLife)，最少 1 回合，最多 3 回合
      const freezeRatio = Math.min(1, baseDamageForAilment / targetMaxLife);
      const freezeTurns = Math.max(1, Math.min(3, Math.floor((freezeRatio * 6 + 1) * (1 + (computedSkill?.freezeDuration ?? 0) / 100))));
      this.applyOrRefreshAilment(target, "freeze", 0, freezeTurns);
      result.actions.push({
        type: "ailment",
        message: `${target.name} 被冰冻了！（${freezeTurns} 回合无法行动）`,
      });
    }

    // 感电：增加受到的伤害
    if (Math.random() * 100 < chances.shock) {
      const shockEffect = Math.min(50, Math.floor((15 + baseDamageForAilment / targetMaxLife * 30) * (1 + (computedSkill?.shockEffect ?? 0) / 100)));
      this.applyOrRefreshAilment(target, "shock", 0, ailmentBaseDuration, shockEffect);
      result.actions.push({
        type: "ailment",
        message: `${target.name} 被感电了！（受到伤害 +${shockEffect}%）`,
      });
    }

    // 流血：物理持续伤害（只有攻击者移动时触发，文字游戏简化为每回合触发）
    if (Math.random() * 100 < chances.bleed) {
      const bleedDmg = Math.max(1, Math.floor(baseDamageForAilment * 0.1 * ailmentDamageMultiplier));
      this.applyOrRefreshAilment(target, "bleed", bleedDmg, ailmentBaseDuration);
      result.actions.push({
        type: "ailment",
        message: `${target.name} 正在流血！（每回合 ${bleedDmg} 物理伤害）`,
      });
    }

    // 中毒：混沌持续伤害，可叠加（最多 5 层）
    if (Math.random() * 100 < chances.poison) {
      const poisonDmg = Math.max(1, Math.floor(baseDamageForAilment * 0.08 * ailmentDamageMultiplier));
      const existingPoisons = target.statusEffects.filter((e) => e.type === "poison").length;
      if (existingPoisons < 5) {
        target.statusEffects.push({ type: "poison", damagePerTick: poisonDmg, duration: ailmentBaseDuration });
        result.actions.push({
          type: "ailment",
          message: `${target.name} 中毒了！（每回合 ${poisonDmg} 混沌伤害 · ${existingPoisons + 1} 层）`,
        });
      }
    }
  }

  /**
   * 刷新或添加异常状态：同类型取较高伤害和较长持续时间。
   * 中毒例外：中毒可叠加层数。
   */
  private applyOrRefreshAilment(
    target: CombatEntity,
    type: StatusEffect["type"],
    newDamage: number,
    newDuration: number,
    increasedDamageTaken?: number,
  ) {
    const existing = target.statusEffects.find((e) => e.type === type);
    if (existing) {
      // 刷新：取较高伤害，延长持续时间
      existing.damagePerTick = Math.max(existing.damagePerTick, newDamage);
      existing.duration = Math.max(existing.duration, newDuration);
      if (increasedDamageTaken !== undefined) {
        existing.increasedDamageTaken = Math.max(existing.increasedDamageTaken ?? 0, increasedDamageTaken);
      }
    } else {
      target.statusEffects.push({
        type,
        damagePerTick: newDamage,
        duration: newDuration,
        ...(increasedDamageTaken !== undefined ? { increasedDamageTaken } : {}),
      });
    }
  }

  private processStatusEffects() {
    const allEntities = [this.player, ...this.monsters];
    
    for (const entity of allEntities) {
      if (entity.isDead) continue;
      
      // 冰冻：跳过行动（在 monsterTurn 中处理，此处只减少持续时间）
      const isFrozen = entity.statusEffects.some((e) => e.type === "freeze" && e.duration > 0);
      
      for (const effect of [...entity.statusEffects]) {
        if (effect.duration <= 0) continue;
        
        // 持续伤害：ignite/bleed/poison
        if (effect.damagePerTick > 0 && effect.type !== "freeze") {
          this.applyDamage(entity, effect.damagePerTick);
        }
        
        effect.duration--;
      }
      
      // 移除过期效果
      entity.statusEffects = entity.statusEffects.filter((e) => e.duration > 0);
    }
  }

  /**
   * 获取指定实体的当前异常状态列表（供 UI 使用）。
   */
  getEntityStatusEffects(entityId: string): StatusEffect[] {
    if (entityId === "player") {
      return [...this.player.statusEffects];
    }
    const monster = this.monsters.find((m) => m.id === entityId);
    return monster ? [...monster.statusEffects] : [];
  }

  /**
   * 获取所有怪物的异常状态（供 UI 批量渲染）。
   */
  getAllMonsterStatusEffects(): { id: string; name: string; effects: StatusEffect[] }[] {
    return this.monsters.map((m) => ({
      id: m.id,
      name: m.name,
      effects: [...m.statusEffects],
    }));
  }

  /**
   * 检查玩家是否被冰冻（当前回合无法行动）。
   */
  isPlayerFrozen(): boolean {
    return this.player.statusEffects.some((e) => e.type === "freeze" && e.duration > 0);
  }
  
  isCombatOver(): boolean {
    return this.player.isDead || this.monsters.every((m) => m.isDead);
  }
  
  getCombatLog(): string[] {
    return this.combatLog;
  }
  
  getMonsterStatus(): { name: string; life: number; maxLife: number; isDead: boolean; statusEffects: StatusEffect[] }[] {
    return this.monsters.map((m) => ({
      name: m.name,
      life: m.life,
      maxLife: m.maxLife,
      isDead: m.isDead,
      statusEffects: [...m.statusEffects],
    }));
  }
  
  getPlayerStatus(): { life: number; maxLife: number; mana: number; maxMana: number; energyShield: number; statusEffects: StatusEffect[] } {
    return {
      life: this.player.life,
      maxLife: this.player.maxLife,
      mana: this.player.mana || 0,
      maxMana: this.player.maxMana || 0,
      energyShield: this.player.energyShield,
      statusEffects: [...this.player.statusEffects],
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
  type: "attack" | "miss" | "death" | "status" | "flask" | "ailment";
  attacker?: string;
  target?: string;
  damage?: number;
  damageType?: DamageType;
  isCrit?: boolean;
  message: string;
}
