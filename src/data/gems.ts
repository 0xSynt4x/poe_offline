import { GemType, GemColor, DamageType } from "../models/types";
import { GENERATED_GEMS, POB_GEM_DATA_SOURCE } from "./gems.generated";

/** PoB 生成目录的类型适配层；浏览器不运行 Lua，也不依赖运行时联网。 */
export interface GemLevelData {
  level: number;
  requiredLevel: number;
  values: number[];
  damageEffectiveness?: number;
  critChance?: number;
  manaCost?: number;
  manaMultiplier?: number;
}

export interface GemSourceData {
  metadataId?: string;
  grantedEffectId?: string;
  variantId?: string;
  skillId?: string;
  skillFile?: string;
  tags?: string[];
  tagString?: string;
  vaalGem?: boolean;
  naturalMaxLevel?: number;
  baseEffectiveness?: number;
  incrementalEffectiveness?: number;
  skillTypes?: string[];
  requireSkillTypes?: string[];
  addSkillTypes?: string[];
  excludeSkillTypes?: string[];
  stats?: string[];
  qualityStats?: { stat: string; value: number }[];
  constantStats?: { stat: string; value: number }[];
}

export interface GemData {
  id: string;
  name: string;
  type: GemType;
  color: GemColor;
  requiredLevel: number;
  description: string;
  limitedDrop?: boolean;
  dataSource?: typeof GEM_DATA_SOURCE;
  source?: GemSourceData;
  active?: {
    baseDamage: number;
    tags: string[];
    damageType: DamageType;
    damageParts?: { type: DamageType; ratio: number }[];
    manaCost: number;
    castTime: number;
    levelScaling: "per_level" | "flat";
    flatDamagePerLevel?: number;
    levels?: GemLevelData[];
    skillTypes?: string[];
    stats?: string[];
  };
  support?: {
    multiplier?: number;
    addedTags?: string[];
    requiredTags?: string[];
    requiredTagGroups?: string[][];
    grantedTags?: string[];
    levelEffectPerLevel?: number;
    specialEffect?: string;
    addedStats?: { stat: string; value: number }[];
    stats?: string[];
    levels?: GemLevelData[];
  };
}

export const GEM_DATA_SOURCE = POB_GEM_DATA_SOURCE;
export const ALL_GEMS: GemData[] = GENERATED_GEMS.map((gem) => ({
  ...gem,
  dataSource: GEM_DATA_SOURCE,
}));
export const ACTIVE_GEMS: GemData[] = ALL_GEMS.filter((gem) => gem.type === GemType.Active);
export const SUPPORT_GEMS: GemData[] = ALL_GEMS.filter((gem) => gem.type === GemType.Support);

/** 检查导入目录是否包含重复 ID、空名称或不完整的技能数据。 */
export function validateGemCatalog(gems: GemData[] = ALL_GEMS): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const gem of gems) {
    if (ids.has(gem.id)) errors.push(`duplicate gem id: ${gem.id}`);
    ids.add(gem.id);
    if (!gem.name.trim()) errors.push(`empty gem name: ${gem.id}`);
    if (gem.requiredLevel < 1) errors.push(`invalid required level: ${gem.id}`);
    if (gem.type === GemType.Active && !gem.active) errors.push(`active gem has no skill data: ${gem.id}`);
    if (gem.active?.damageParts) {
      const ratioTotal = gem.active.damageParts.reduce((total, part) => total + part.ratio, 0);
      if (ratioTotal <= 0 || gem.active.damageParts.some((part) => part.ratio < 0)) {
        errors.push(`invalid damage parts: ${gem.id}`);
      }
    }
    if (gem.type === GemType.Support && !gem.support) errors.push(`support gem has no support data: ${gem.id}`);
  }
  return errors;
}

const GEM_ID_ALIASES: Record<string, string> = {
  lesser_multiple_projectiles: "multiple_projectiles",
  increased_crit: "increased_critical_strikes",
  increased_crit_damage: "increased_critical_damage",
};

export function getGemById(id: string): GemData | undefined {
  const canonicalId = GEM_ID_ALIASES[id] || id;
  return ALL_GEMS.find((gem) => gem.id === canonicalId);
}

export function getGemsByType(type: GemType): GemData[] {
  return ALL_GEMS.filter((gem) => gem.type === type);
}

export function getGemsByColor(color: GemColor): GemData[] {
  return ALL_GEMS.filter((gem) => gem.color === color);
}
