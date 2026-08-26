import { DamageType, Gem, GemType, SkillGroup } from "../models/types";
import { getGemById } from "../data/gems";

/** 宝石等级曲线：等级越高需要的经验越多，避免低级宝石瞬间满级。 */
export function gemExperienceToNextLevel(level: number): number {
  if (level >= 20) return 0;
  return Math.floor(80 + level * level * 35);
}

export function addGemExperience(gem: Gem, amount: number): { levelsGained: number; level: number } {
  if (amount <= 0 || gem.level >= 20) return { levelsGained: 0, level: gem.level };
  let levelsGained = 0;
  gem.experience += amount;
  while (gem.level < 20) {
    const required = gemExperienceToNextLevel(gem.level);
    if (required <= 0 || gem.experience < required) break;
    gem.experience -= required;
    gem.level += 1;
    levelsGained += 1;
  }
  return { levelsGained, level: gem.level };
}

export function getGemProgress(gem: Gem): { current: number; required: number; percent: number } {
  const required = gemExperienceToNextLevel(gem.level);
  if (required <= 0) return { current: 0, required: 0, percent: 100 };
  return {
    current: Math.min(gem.experience, required),
    required,
    percent: Math.min(100, Math.floor(gem.experience / required * 100)),
  };
}

export interface DamagePart {
  type: DamageType;
  amount: number;
}

interface DamageStatTotals {
  attackSpeed: number;
  castSpeed: number;
  critChance: number;
  critMultiplier: number;
  aoeSize: number;
  firePenetration: number;
  coldPenetration: number;
  lightningPenetration: number;
  chaosPenetration: number;
  projectileCount: number;
  chainCount: number;
  pierceCount: number;
  duration: number;
  igniteChance: number;
  igniteDamage: number;
  freezeChance: number;
  freezeDuration: number;
  shockChance: number;
  shockEffect: number;
  maimChance: number;
  splashDamage: number;
  ailmentDuration: number;
  ailmentDamage: number;
  directDamageReduction: number;
}

function emptyStatTotals(): DamageStatTotals {
  return {
    attackSpeed: 0,
    castSpeed: 0,
    critChance: 0,
    critMultiplier: 0,
    aoeSize: 0,
    firePenetration: 0,
    coldPenetration: 0,
    lightningPenetration: 0,
    chaosPenetration: 0,
    projectileCount: 0,
    chainCount: 0,
    pierceCount: 0,
    duration: 0,
    igniteChance: 0,
    igniteDamage: 0,
    freezeChance: 0,
    freezeDuration: 0,
    shockChance: 0,
    shockEffect: 0,
    maimChance: 0,
    splashDamage: 0,
    ailmentDuration: 0,
    ailmentDamage: 0,
    directDamageReduction: 0,
  };
}

function isElementalTag(tag: string): boolean {
  return tag === "fire" || tag === "cold" || tag === "lightning" || tag === "elemental";
}

function hasRequiredTag(tags: string[], required: string): boolean {
  if (required === "elemental") return tags.some(isElementalTag);
  // 本地轻量标签模型用 dot 表示持续效果；PoB 的 duration 限制可由它满足。
  if (required === "duration") return tags.includes("duration") || tags.includes("dot");
  return tags.includes(required);
}

/**
 * PoB 的 support skillTypes 是 AND/OR 组合；本地数据用 requiredTagGroups 表达 AND，
 * requiredTags 表达 OR。旧数据中的 addedTags 仅作为 OR 要求，不会污染主动技能标签。
 */
function supportMatchesTags(
  tags: string[],
  support: NonNullable<ReturnType<typeof getGemById>>["support"],
): boolean {
  if (!support) return false;
  const groups = support.requiredTagGroups
    ?? (support.requiredTags ? [support.requiredTags] : support.addedTags ? [support.addedTags] : []);
  return groups.every((group) => group.length === 0 || group.some((tag) => hasRequiredTag(tags, tag)));
}

/** 判断一个辅助宝石是否能按当前 PoB 风格标签辅助主动技能。 */
export function canSupportSkill(activeGemId: string, supportGemId: string, linkedSupportGemIds: string[] = []): boolean {
  const active = getGemById(activeGemId);
  const candidate = getGemById(supportGemId);
  if (!active?.active || candidate?.type !== GemType.Support || !candidate.support) return false;

  const tags = [...active.active.tags];
  const linked = [...linkedSupportGemIds, supportGemId];
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of linked) {
      const support = getGemById(id)?.support;
      if (!support || !supportMatchesTags(tags, support)) continue;
      for (const tag of support.grantedTags || []) {
        if (!tags.includes(tag)) {
          tags.push(tag);
          changed = true;
        }
      }
    }
  }
  return supportMatchesTags(tags, candidate.support);
}

/** 返回配置界面使用的辅助条件，避免用户只能通过 DPS 变化猜测宝石未生效。 */
export function getSupportRequirementLabel(supportGemId: string): string {
  const support = getGemById(supportGemId)?.support;
  if (!support) return "";
  const groups = support.requiredTagGroups
    ?? (support.requiredTags ? [support.requiredTags] : support.addedTags ? [support.addedTags] : []);
  return groups.length ? groups.map((group) => group.join(" / ")).join(" + ") : "通用";
}

function addDamagePart(parts: DamagePart[], type: DamageType, amount: number): void {
  if (amount <= 0) return;
  const existing = parts.find((part) => part.type === type);
  if (existing) existing.amount += amount;
  else parts.push({ type, amount });
}

function getDominantDamageType(parts: DamagePart[], fallback: DamageType): DamageType {
  return parts.reduce(
    (dominant, part) => part.amount > dominant.amount ? part : dominant,
    { type: fallback, amount: 0 },
  ).type;
}

function applyStat(totals: DamageStatTotals, stat: string, value: number): void {
  switch (stat) {
    case "attackSpeed": totals.attackSpeed += value; break;
    case "castSpeed": totals.castSpeed += value; break;
    case "critChance": totals.critChance += value; break;
    case "critMultiplier": totals.critMultiplier += value; break;
    case "aoeSize": totals.aoeSize += value; break;
    case "firePenetration": totals.firePenetration += value; break;
    case "coldPenetration": totals.coldPenetration += value; break;
    case "lightningPenetration": totals.lightningPenetration += value; break;
    case "chaosPenetration": totals.chaosPenetration += value; break;
    case "projectileCount": totals.projectileCount += value; break;
    case "chainCount": totals.chainCount += value; break;
    case "pierceCount": totals.pierceCount += value; break;
    case "duration": totals.duration += value; break;
    case "igniteChance": totals.igniteChance += value; break;
    case "igniteDamage": totals.igniteDamage += value; break;
    case "freezeChance": totals.freezeChance += value; break;
    case "freezeDuration": totals.freezeDuration += value; break;
    case "shockChance": totals.shockChance += value; break;
    case "shockEffect": totals.shockEffect += value; break;
    case "maimChance": totals.maimChance += value; break;
    case "splashDamage": totals.splashDamage += value; break;
    case "ailmentDuration": totals.ailmentDuration += value; break;
    case "ailmentDamage": totals.ailmentDamage += value; break;
    case "directDamage": totals.directDamageReduction += Math.max(0, -value); break;
  }
}

// ===== 技能组计算 =====

/**
 * 计算技能组的完整属性。
 * 设计与 PoB 数据层保持一致：辅助宝石先检查要求标签，再授予转换标签；
 * more/increased、混合伤害和各元素穿透分开保留，供战斗系统逐项计算。
 */
export function computeSkillGroup(group: SkillGroup): ComputedSkill {
  const activeGem = group.activeGem;
  const activeData = getGemById(activeGem.id);
  if (!activeData?.active) return emptyComputedSkill();

  const active = activeData.active;
  const activeLevel = Math.max(1, Math.min(20, activeGem.level));
  // 只有数据显式声明 flatDamagePerLevel 才成长，避免重复套用虚构的通用百分比。
  const baseDamage = active.baseDamage + (active.flatDamagePerLevel || 0) * (activeLevel - 1);
  const tags = [...active.tags];
  const damageParts: DamagePart[] = [];
  const declaredParts = active.damageParts?.filter((part) => part.ratio > 0) || [];
  const ratioTotal = declaredParts.reduce((total, part) => total + part.ratio, 0);
  if (ratioTotal > 0) {
    for (const part of declaredParts) {
      addDamagePart(damageParts, part.type, baseDamage * part.ratio / ratioTotal);
    }
  } else {
    addDamagePart(damageParts, active.damageType, baseDamage);
  }

  const stats = emptyStatTotals();
  const specialEffects: string[] = [];
  let moreDamage = 1;
  let increasedDamage = 0;
  let addedFirePercent = 0;
  let addedColdPercent = 0;
  let addedLightningPercent = 0;
  let addedChaosFlat = 0;
  let noElementalDamage = false;
  let noElementalAilments = false;
  let multistrike = false;
  let chain = false;
  let fork = false;
  let meleeSplash = false;

  // 先解析转换类辅助授予的标签，避免支持宝石在链接中的排列顺序影响结果。
  let tagsChanged = true;
  while (tagsChanged) {
    tagsChanged = false;
    for (const supportGem of group.supportGems) {
      const support = getGemById(supportGem.id)?.support;
      if (!support || !supportMatchesTags(tags, support)) continue;
      for (const tag of support.grantedTags || []) {
        if (!tags.includes(tag)) {
          tags.push(tag);
          tagsChanged = true;
        }
      }
    }
  }

  for (const supportGem of group.supportGems) {
    const supportData = getGemById(supportGem.id);
    const support = supportData?.support;
    if (!support || !supportMatchesTags(tags, support)) continue;

    // PoB 未声明逐级效果时保持该数据的当前数值，不再统一虚构 +4%/级。
    const supportLevel = Math.max(1, Math.min(20, supportGem.level));
    const supportLevelScale = 1 + ((support.levelEffectPerLevel || 0) * (supportLevel - 1)) / 100;
    if (support.multiplier) {
      const multiplier = support.multiplier * supportLevelScale;
      if (multiplier >= 0) moreDamage *= 1 + multiplier;
      else moreDamage *= Math.max(0, 1 + multiplier);
    }

    for (const stat of support.addedStats || []) {
      const value = stat.value * supportLevelScale;
      switch (stat.stat) {
        case "fireDamageAsPhysPercent": addedFirePercent += value; break;
        case "coldDamageAsPhysPercent": addedColdPercent += value; break;
        case "lightningDamageAsPhysPercent": addedLightningPercent += value; break;
        case "chaosDamage": addedChaosFlat += value; break;
        case "increasedDamage": increasedDamage += value; break;
        default: applyStat(stats, stat.stat, value); break;
      }
    }

    // addedTags 是旧数据中的要求标签；只有 grantedTags 才会真正改变技能标签。
    for (const tag of support.grantedTags || []) {
      if (!tags.includes(tag)) tags.push(tag);
    }
    if (support.specialEffect) {
      specialEffects.push(support.specialEffect);
      switch (support.specialEffect) {
        case "no_elemental_damage": noElementalDamage = true; break;
        case "no_elemental_ailments": noElementalAilments = true; break;
        case "multistrike": multistrike = true; break;
        case "chain": chain = true; break;
        case "fork": fork = true; break;
        case "melee_splash": meleeSplash = true; break;
      }
    }
  }

  // 残暴不仅阻止新增元素伤害，也会移除主动技能原有的元素伤害。
  if (noElementalDamage) {
    for (let index = damageParts.length - 1; index >= 0; index -= 1) {
      if ([DamageType.Fire, DamageType.Cold, DamageType.Lightning, DamageType.Chaos].includes(damageParts[index].type)) {
        damageParts.splice(index, 1);
      }
    }
  }
  const physicalBase = damageParts.find((part) => part.type === DamageType.Physical)?.amount || 0;
  if (!noElementalDamage) {
    addDamagePart(damageParts, DamageType.Fire, physicalBase * addedFirePercent / 100);
    addDamagePart(damageParts, DamageType.Cold, physicalBase * addedColdPercent / 100);
    addDamagePart(damageParts, DamageType.Lightning, physicalBase * addedLightningPercent / 100);
  }
  addDamagePart(damageParts, DamageType.Chaos, addedChaosFlat * activeLevel);

  const finalMultiplier = Math.max(0, moreDamage * (1 + increasedDamage / 100));
  for (const part of damageParts) part.amount *= finalMultiplier;
  if (stats.directDamageReduction > 0) {
    const directMultiplier = Math.max(0, 1 - stats.directDamageReduction / 100);
    for (const part of damageParts) part.amount *= directMultiplier;
  }
  // 多重打击的总命中量是三次重复的近似值；攻速由 combat.ts 使用 attackSpeedBonus 处理。
  if (multistrike) {
    for (const part of damageParts) part.amount *= 2.79;
  }    const isAttack = tags.includes("attack");
  const isSpell = tags.includes("spell");
  let castTime = Math.max(0.05, active.castTime);
  if (isAttack) castTime /= 1 + Math.max(-95, stats.attackSpeed) / 100;
  else if (isSpell) castTime /= 1 + Math.max(-95, stats.castSpeed) / 100;

  const totalDamage = damageParts.reduce((total, part) => total + part.amount, 0);
  return {
    totalDamage: Math.max(0, Math.floor(totalDamage)),
    damageParts: damageParts.map((part) => ({ ...part, amount: Math.max(0, Math.floor(part.amount)) })),
    damageType: getDominantDamageType(damageParts, active.damageType),
    tags,
    manaCost: active.manaCost,
    castTime,
    specialEffects,
    multiplier: finalMultiplier,
    attackSpeedBonus: stats.attackSpeed,
    castSpeedBonus: stats.castSpeed,
    critChanceBonus: stats.critChance,
    critMultiplierBonus: stats.critMultiplier,
    aoeSizeBonus: stats.aoeSize,
    firePenetration: stats.firePenetration,
    coldPenetration: stats.coldPenetration,
    lightningPenetration: stats.lightningPenetration,
    chaosPenetration: stats.chaosPenetration,
    projectileCount: stats.projectileCount,
    chainCount: stats.chainCount,
    pierceCount: stats.pierceCount,
    durationBonus: stats.duration,
    igniteChance: stats.igniteChance,
    igniteDamage: stats.igniteDamage,
    freezeChance: stats.freezeChance,
    freezeDuration: stats.freezeDuration,
    shockChance: stats.shockChance,
    shockEffect: stats.shockEffect,
    maimChance: stats.maimChance,
    splashDamage: stats.splashDamage,
    ailmentDuration: stats.ailmentDuration,
    ailmentDamage: stats.ailmentDamage,
    noElementalDamage,
    noElementalAilments,
    chain,
    fork,
    multistrike,
    meleeSplash,
    activeGemLevel: activeLevel,
    supportGemCount: group.supportGems.length,
    estimatedDps: 0,
  };
}

function emptyComputedSkill(): ComputedSkill {
  return {
    totalDamage: 0,
    damageParts: [],
    damageType: DamageType.Physical,
    tags: [],
    manaCost: 0,
    castTime: 1,
    specialEffects: [],
    multiplier: 1,
    attackSpeedBonus: 0,
    castSpeedBonus: 0,
    critChanceBonus: 0,
    critMultiplierBonus: 0,
    aoeSizeBonus: 0,
    firePenetration: 0,
    coldPenetration: 0,
    lightningPenetration: 0,
    chaosPenetration: 0,
    projectileCount: 0,
    chainCount: 0,
    pierceCount: 0,
    durationBonus: 0,
    igniteChance: 0,
    igniteDamage: 0,
    freezeChance: 0,
    freezeDuration: 0,
    shockChance: 0,
    shockEffect: 0,
    maimChance: 0,
    splashDamage: 0,
    ailmentDuration: 0,
    ailmentDamage: 0,
    noElementalDamage: false,
    noElementalAilments: false,
    chain: false,
    fork: false,
    multistrike: false,
    meleeSplash: false,
    activeGemLevel: 1,
    supportGemCount: 0,
    estimatedDps: 0,
  };
}

export interface ComputedSkill {
  totalDamage: number;
  damageParts: DamagePart[];
  damageType: DamageType;
  tags: string[];
  manaCost: number;
  castTime: number;
  specialEffects: string[];
  multiplier: number;
  attackSpeedBonus: number;
  castSpeedBonus: number;
  critChanceBonus: number;
  critMultiplierBonus: number;
  aoeSizeBonus: number;
  firePenetration: number;
  coldPenetration: number;
  lightningPenetration: number;
  chaosPenetration: number;
  projectileCount: number;
  chainCount: number;
  pierceCount: number;
  durationBonus: number;
  igniteChance: number;
  igniteDamage: number;
  freezeChance: number;
  freezeDuration: number;
  shockChance: number;
  shockEffect: number;
  ailmentDuration: number;
  ailmentDamage: number;
  maimChance: number;
  splashDamage: number;
  noElementalDamage: boolean;
  noElementalAilments: boolean;
  chain: boolean;
  fork: boolean;
  multistrike: boolean;
  meleeSplash: boolean;
  activeGemLevel: number;
  supportGemCount: number;
  estimatedDps: number;
}

export function estimateDps(
  computed: ComputedSkill,
  playerCritChance: number,
  playerCritMultiplier: number,
  playerAttackSpeed: number,
): number {
  const effectiveCritChance = Math.max(0, Math.min(100, playerCritChance + computed.critChanceBonus)) / 100;
  const effectiveCritMultiplier = Math.max(0, playerCritMultiplier + computed.critMultiplierBonus) / 100;
  const critDpsMultiplier = 1 + effectiveCritChance * (effectiveCritMultiplier - 1);
  const isAttack = computed.tags.includes("attack");
  const effectiveSpeed = isAttack
    ? Math.max(0, playerAttackSpeed * (1 + computed.attackSpeedBonus / 100))
    : 1 / Math.max(0.05, computed.castTime);
  return Math.max(0, Math.floor(computed.totalDamage * effectiveSpeed * critDpsMultiplier));
}

export function createSkillGroup(activeGemId: string, supportGemIds: string[] = []): SkillGroup {
  const activeData = getGemById(activeGemId);
  if (!activeData || activeData.type !== GemType.Active) {
    throw new Error(`Invalid active gem: ${activeGemId}`);
  }

  const activeGem: Gem = {
    id: activeGemId,
    name: activeData.name,
    type: GemType.Active,
    color: activeData.color,
    level: 1,
    experience: 0,
    requiredLevel: activeData.requiredLevel,
  };
  const supportGems: Gem[] = [];
  for (const supportId of supportGemIds) {
    const supportData = getGemById(supportId);
    if (!supportData || supportData.type !== GemType.Support) continue;
    supportGems.push({
      id: supportId,
      name: supportData.name,
      type: GemType.Support,
      color: supportData.color,
      level: 1,
      experience: 0,
      requiredLevel: supportData.requiredLevel,
    });
  }
  return { id: `skill_${Date.now()}`, name: activeData.name, activeGem, supportGems };
}

export function formatSkillGroup(group: SkillGroup): string {
  const computed = computeSkillGroup(group);
  const lines = [
    `${group.activeGem.name} (${computed.totalDamage} ${computed.damageType})`,
    `  标签: ${computed.tags.join(", ")}`,
    `  伤害倍率: ${(computed.multiplier * 100).toFixed(0)}%`,
    `  魔力消耗: ${computed.manaCost}`,
    `  施法时间: ${computed.castTime.toFixed(2)}s`,
  ];
  const parts = computed.damageParts.map((part) => `${part.type}:${Math.floor(part.amount)}`).join(", ");
  if (parts) lines.push(`  伤害组成: ${parts}`);
  const penetrations = [
    computed.firePenetration > 0 ? `火${computed.firePenetration}%` : "",
    computed.coldPenetration > 0 ? `冰${computed.coldPenetration}%` : "",
    computed.lightningPenetration > 0 ? `雷${computed.lightningPenetration}%` : "",
    computed.chaosPenetration > 0 ? `混${computed.chaosPenetration}%` : "",
  ].filter(Boolean);
  if (penetrations.length) lines.push(`  穿透: ${penetrations.join(", ")}`);
  if (computed.critChanceBonus || computed.critMultiplierBonus) {
    lines.push(`  暴击: ${computed.critChanceBonus >= 0 ? "+" : ""}${computed.critChanceBonus}% 几率, ${computed.critMultiplierBonus >= 0 ? "+" : ""}${computed.critMultiplierBonus}% 伤害`);
  }
  if (computed.specialEffects.length) lines.push(`  特殊效果: ${computed.specialEffects.join(", ")}`);
  return lines.join("\n");
}

export function testGemSystem(): void {
  console.log(formatSkillGroup(createSkillGroup("lacerate", ["melee_physical_damage", "added_fire_damage"])));
  console.log(formatSkillGroup(createSkillGroup("fireball", ["controlled_destruction", "fire_penetration"])));
  console.log(formatSkillGroup(createSkillGroup("lightning_arrow", ["chain"])));
}
