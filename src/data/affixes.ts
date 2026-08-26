import { AffixCategory, ModType } from "../models/types";

export interface AffixData {
  id: string;
  name: string;
  category: AffixCategory;
  tags: string[];
  tiers: {
    tier: number;
    itemLevelReq: number;
    min: number;
    max: number;
    modType: ModType;
    weight: number;
  }[];
}

// ===== 前缀词缀池 =====

export const PREFIX_POOL: AffixData[] = [
  // ---- 生命类（防具/首饰） ----
  {
    id: "flat_life",
    name: "鲜活的",
    category: AffixCategory.Prefix,
    tags: ["armor", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 80, min: 80, max: 100, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 60, min: 50, max: 79, modType: ModType.Flat, weight: 300 },
      { tier: 3, itemLevelReq: 40, min: 30, max: 49, modType: ModType.Flat, weight: 600 },
      { tier: 4, itemLevelReq: 20, min: 15, max: 29, modType: ModType.Flat, weight: 1000 },
      { tier: 5, itemLevelReq: 1, min: 5, max: 14, modType: ModType.Flat, weight: 2000 },
    ],
  },
  {
    id: "percent_life",
    name: "健康的",
    category: AffixCategory.Prefix,
    tags: ["armor"],
    tiers: [
      { tier: 1, itemLevelReq: 78, min: 8, max: 10, modType: ModType.Increased, weight: 100 },
      { tier: 2, itemLevelReq: 55, min: 5, max: 7, modType: ModType.Increased, weight: 400 },
      { tier: 3, itemLevelReq: 30, min: 3, max: 4, modType: ModType.Increased, weight: 1000 },
    ],
  },

  // ---- 魔力类（防具/首饰） ----
  {
    id: "flat_mana",
    name: "充沛的",
    category: AffixCategory.Prefix,
    tags: ["armor", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 75, min: 60, max: 80, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 50, min: 35, max: 59, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 25, min: 15, max: 34, modType: ModType.Flat, weight: 1200 },
      { tier: 4, itemLevelReq: 1, min: 5, max: 14, modType: ModType.Flat, weight: 2000 },
    ],
  },

  // ---- 护甲类（防具） ----
  {
    id: "flat_armor",
    name: "铁壁的",
    category: AffixCategory.Prefix,
    tags: ["armor_body", "armor_helmet", "armor_gloves", "armor_boots"],
    tiers: [
      { tier: 1, itemLevelReq: 82, min: 120, max: 180, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 60, min: 70, max: 119, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 35, min: 35, max: 69, modType: ModType.Flat, weight: 1000 },
      { tier: 4, itemLevelReq: 10, min: 10, max: 34, modType: ModType.Flat, weight: 2000 },
    ],
  },
  {
    id: "percent_armor",
    name: "坚韧的",
    category: AffixCategory.Prefix,
    tags: ["armor_body", "armor_helmet", "armor_gloves", "armor_boots"],
    tiers: [
      { tier: 1, itemLevelReq: 80, min: 40, max: 50, modType: ModType.Increased, weight: 100 },
      { tier: 2, itemLevelReq: 55, min: 25, max: 39, modType: ModType.Increased, weight: 400 },
      { tier: 3, itemLevelReq: 30, min: 10, max: 24, modType: ModType.Increased, weight: 1000 },
    ],
  },

  // ---- 闪避类（防具） ----
  {
    id: "flat_evasion",
    name: "灵巧的",
    category: AffixCategory.Prefix,
    tags: ["armor_body", "armor_helmet", "armor_gloves", "armor_boots"],
    tiers: [
      { tier: 1, itemLevelReq: 80, min: 150, max: 220, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 55, min: 80, max: 149, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 30, min: 40, max: 79, modType: ModType.Flat, weight: 1000 },
    ],
  },

  // ---- 能量护盾类（防具/首饰） ----
  {
    id: "flat_es",
    name: "奥术的",
    category: AffixCategory.Prefix,
    tags: ["armor", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 82, min: 90, max: 130, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 60, min: 50, max: 89, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 35, min: 25, max: 49, modType: ModType.Flat, weight: 1000 },
    ],
  },
  {
    id: "percent_es",
    name: "启迪的",
    category: AffixCategory.Prefix,
    tags: ["armor", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 78, min: 30, max: 40, modType: ModType.Increased, weight: 100 },
      { tier: 2, itemLevelReq: 55, min: 15, max: 29, modType: ModType.Increased, weight: 400 },
      { tier: 3, itemLevelReq: 25, min: 5, max: 14, modType: ModType.Increased, weight: 1000 },
    ],
  },

  // ---- 物理伤害类（武器） ----
  {
    id: "flat_phys_weapon",
    name: "锋利的",
    category: AffixCategory.Prefix,
    tags: ["weapon"],
    tiers: [
      { tier: 1, itemLevelReq: 84, min: 40, max: 70, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 65, min: 20, max: 39, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 40, min: 8, max: 19, modType: ModType.Flat, weight: 1000 },
      { tier: 4, itemLevelReq: 15, min: 2, max: 7, modType: ModType.Flat, weight: 2000 },
    ],
  },
  {
    id: "percent_phys_weapon",
    name: "毁灭的",
    category: AffixCategory.Prefix,
    tags: ["weapon"],
    tiers: [
      { tier: 1, itemLevelReq: 82, min: 100, max: 139, modType: ModType.Increased, weight: 100 },
      { tier: 2, itemLevelReq: 60, min: 60, max: 99, modType: ModType.Increased, weight: 400 },
      { tier: 3, itemLevelReq: 35, min: 30, max: 59, modType: ModType.Increased, weight: 1000 },
      { tier: 4, itemLevelReq: 10, min: 10, max: 29, modType: ModType.Increased, weight: 2000 },
    ],
  },

  // ---- 火焰伤害类（武器） ----
  {
    id: "flat_fire_weapon",
    name: "烈焰之",
    category: AffixCategory.Prefix,
    tags: ["weapon"],
    tiers: [
      { tier: 1, itemLevelReq: 82, min: 45, max: 75, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 65, min: 25, max: 44, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 40, min: 10, max: 24, modType: ModType.Flat, weight: 800 },
      { tier: 4, itemLevelReq: 15, min: 3, max: 9, modType: ModType.Flat, weight: 1500 },
    ],
  },

  // ---- 冰冷伤害类（武器） ----
  {
    id: "flat_cold_weapon",
    name: "冰霜之",
    category: AffixCategory.Prefix,
    tags: ["weapon"],
    tiers: [
      { tier: 1, itemLevelReq: 82, min: 40, max: 68, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 65, min: 22, max: 39, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 40, min: 8, max: 21, modType: ModType.Flat, weight: 800 },
      { tier: 4, itemLevelReq: 15, min: 2, max: 7, modType: ModType.Flat, weight: 1500 },
    ],
  },

  // ---- 闪电伤害类（武器） ----
  {
    id: "flat_lightning_weapon",
    name: "闪电之",
    category: AffixCategory.Prefix,
    tags: ["weapon"],
    tiers: [
      { tier: 1, itemLevelReq: 82, min: 1, max: 100, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 65, min: 1, max: 60, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 40, min: 1, max: 30, modType: ModType.Flat, weight: 800 },
      { tier: 4, itemLevelReq: 15, min: 1, max: 12, modType: ModType.Flat, weight: 1500 },
    ],
  },

  // ---- 混沌伤害类（武器） ----
  {
    id: "flat_chaos_weapon",
    name: "混沌之",
    category: AffixCategory.Prefix,
    tags: ["weapon"],
    tiers: [
      { tier: 1, itemLevelReq: 85, min: 30, max: 55, modType: ModType.Flat, weight: 50 },
      { tier: 2, itemLevelReq: 70, min: 15, max: 29, modType: ModType.Flat, weight: 200 },
      { tier: 3, itemLevelReq: 50, min: 5, max: 14, modType: ModType.Flat, weight: 600 },
    ],
  },

  // ---- 混沌伤害类（防具/持续伤害） ----
  {
    id: "flat_chaos_dmg_over_time",
    name: "腐蚀的",
    category: AffixCategory.Prefix,
    tags: ["weapon"],
    tiers: [
      { tier: 1, itemLevelReq: 80, min: 15, max: 25, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 60, min: 8, max: 14, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 35, min: 3, max: 7, modType: ModType.Flat, weight: 1000 },
    ],
  },

  // ---- 魔法伤害类（法杖/权杖） ----
  {
    id: "flat_spell_damage",
    name: "智者的",
    category: AffixCategory.Prefix,
    tags: ["weapon_caster"],
    tiers: [
      { tier: 1, itemLevelReq: 84, min: 80, max: 110, modType: ModType.Increased, weight: 100 },
      { tier: 2, itemLevelReq: 65, min: 50, max: 79, modType: ModType.Increased, weight: 400 },
      { tier: 3, itemLevelReq: 40, min: 25, max: 49, modType: ModType.Increased, weight: 1000 },
    ],
  },

  // ---- 元素伤害类（全局） ----
  {
    id: "flat_elemental_damage",
    name: "元素之",
    category: AffixCategory.Prefix,
    tags: ["weapon", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 80, min: 25, max: 40, modType: ModType.Increased, weight: 100 },
      { tier: 2, itemLevelReq: 55, min: 12, max: 24, modType: ModType.Increased, weight: 400 },
      { tier: 3, itemLevelReq: 30, min: 5, max: 11, modType: ModType.Increased, weight: 1000 },
    ],
  },

  // ---- 攻击伤害类（武器/戒指） ----
  {
    id: "flat_attack_damage",
    name: "凶猛的",
    category: AffixCategory.Prefix,
    tags: ["weapon", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 78, min: 30, max: 50, modType: ModType.Increased, weight: 100 },
      { tier: 2, itemLevelReq: 55, min: 15, max: 29, modType: ModType.Increased, weight: 400 },
      { tier: 3, itemLevelReq: 30, min: 5, max: 14, modType: ModType.Increased, weight: 1000 },
    ],
  },

  // ---- 投射物伤害类（武器） ----
  {
    id: "flat_projectile_damage",
    name: "穿透的",
    category: AffixCategory.Prefix,
    tags: ["weapon_ranged"],
    tiers: [
      { tier: 1, itemLevelReq: 80, min: 25, max: 40, modType: ModType.Increased, weight: 100 },
      { tier: 2, itemLevelReq: 55, min: 12, max: 24, modType: ModType.Increased, weight: 400 },
      { tier: 3, itemLevelReq: 30, min: 5, max: 11, modType: ModType.Increased, weight: 1000 },
    ],
  },

  // ---- 持续伤害加成（武器） ----
  {
    id: "flat_dot_multiplier",
    name: "衰败的",
    category: AffixCategory.Prefix,
    tags: ["weapon"],
    tiers: [
      { tier: 1, itemLevelReq: 82, min: 20, max: 30, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 60, min: 10, max: 19, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 35, min: 5, max: 9, modType: ModType.Flat, weight: 1000 },
    ],
  },
];

// ===== 后缀词缀池 =====

export const SUFFIX_POOL: AffixData[] = [
  // ---- 抗性类（防具/首饰） ----
  {
    id: "fire_resistance",
    name: "烈焰抗性",
    category: AffixCategory.Suffix,
    tags: ["armor", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 80, min: 40, max: 48, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 60, min: 30, max: 39, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 40, min: 20, max: 29, modType: ModType.Flat, weight: 800 },
      { tier: 4, itemLevelReq: 15, min: 10, max: 19, modType: ModType.Flat, weight: 1500 },
      { tier: 5, itemLevelReq: 1, min: 6, max: 9, modType: ModType.Flat, weight: 2000 },
    ],
  },
  {
    id: "cold_resistance",
    name: "冰霜抗性",
    category: AffixCategory.Suffix,
    tags: ["armor", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 80, min: 40, max: 48, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 60, min: 30, max: 39, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 40, min: 20, max: 29, modType: ModType.Flat, weight: 800 },
      { tier: 4, itemLevelReq: 15, min: 10, max: 19, modType: ModType.Flat, weight: 1500 },
      { tier: 5, itemLevelReq: 1, min: 6, max: 9, modType: ModType.Flat, weight: 2000 },
    ],
  },
  {
    id: "lightning_resistance",
    name: "闪电抗性",
    category: AffixCategory.Suffix,
    tags: ["armor", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 80, min: 40, max: 48, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 60, min: 30, max: 39, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 40, min: 20, max: 29, modType: ModType.Flat, weight: 800 },
      { tier: 4, itemLevelReq: 15, min: 10, max: 19, modType: ModType.Flat, weight: 1500 },
      { tier: 5, itemLevelReq: 1, min: 6, max: 9, modType: ModType.Flat, weight: 2000 },
    ],
  },
  {
    id: "chaos_resistance",
    name: "混沌抗性",
    category: AffixCategory.Suffix,
    tags: ["armor", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 82, min: 30, max: 35, modType: ModType.Flat, weight: 80 },
      { tier: 2, itemLevelReq: 60, min: 20, max: 29, modType: ModType.Flat, weight: 300 },
      { tier: 3, itemLevelReq: 35, min: 10, max: 19, modType: ModType.Flat, weight: 800 },
      { tier: 4, itemLevelReq: 10, min: 5, max: 9, modType: ModType.Flat, weight: 1500 },
    ],
  },
  {
    id: "all_resistance",
    name: "全能抗性",
    category: AffixCategory.Suffix,
    tags: ["jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 85, min: 10, max: 13, modType: ModType.Flat, weight: 50 },
      { tier: 2, itemLevelReq: 65, min: 6, max: 9, modType: ModType.Flat, weight: 200 },
      { tier: 3, itemLevelReq: 40, min: 3, max: 5, modType: ModType.Flat, weight: 600 },
    ],
  },

  // ---- 属性类 ----
  {
    id: "strength",
    name: "力量",
    category: AffixCategory.Suffix,
    tags: ["armor", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 82, min: 50, max: 55, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 60, min: 30, max: 49, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 35, min: 15, max: 29, modType: ModType.Flat, weight: 1000 },
      { tier: 4, itemLevelReq: 1, min: 8, max: 14, modType: ModType.Flat, weight: 2000 },
    ],
  },
  {
    id: "dexterity",
    name: "敏捷",
    category: AffixCategory.Suffix,
    tags: ["armor", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 82, min: 50, max: 55, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 60, min: 30, max: 49, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 35, min: 15, max: 29, modType: ModType.Flat, weight: 1000 },
      { tier: 4, itemLevelReq: 1, min: 8, max: 14, modType: ModType.Flat, weight: 2000 },
    ],
  },
  {
    id: "intelligence",
    name: "智力",
    category: AffixCategory.Suffix,
    tags: ["armor", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 82, min: 50, max: 55, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 60, min: 30, max: 49, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 35, min: 15, max: 29, modType: ModType.Flat, weight: 1000 },
      { tier: 4, itemLevelReq: 1, min: 8, max: 14, modType: ModType.Flat, weight: 2000 },
    ],
  },

  // ---- 攻击速度类（武器） ----
  {
    id: "attack_speed",
    name: "迅捷的",
    category: AffixCategory.Suffix,
    tags: ["weapon"],
    tiers: [
      { tier: 1, itemLevelReq: 85, min: 15, max: 17, modType: ModType.Increased, weight: 50 },
      { tier: 2, itemLevelReq: 70, min: 11, max: 14, modType: ModType.Increased, weight: 200 },
      { tier: 3, itemLevelReq: 50, min: 7, max: 10, modType: ModType.Increased, weight: 600 },
      { tier: 4, itemLevelReq: 25, min: 4, max: 6, modType: ModType.Increased, weight: 1500 },
    ],
  },

  // ---- 施法速度类（武器） ----
  {
    id: "cast_speed",
    name: "迅捷施法",
    category: AffixCategory.Suffix,
    tags: ["weapon_caster", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 85, min: 18, max: 22, modType: ModType.Increased, weight: 50 },
      { tier: 2, itemLevelReq: 70, min: 12, max: 17, modType: ModType.Increased, weight: 200 },
      { tier: 3, itemLevelReq: 50, min: 7, max: 11, modType: ModType.Increased, weight: 600 },
    ],
  },

  // ---- 暴击类 ----
  {
    id: "critical_chance",
    name: "致命的",
    category: AffixCategory.Suffix,
    tags: ["weapon", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 82, min: 30, max: 40, modType: ModType.Increased, weight: 100 },
      { tier: 2, itemLevelReq: 60, min: 15, max: 29, modType: ModType.Increased, weight: 400 },
      { tier: 3, itemLevelReq: 35, min: 8, max: 14, modType: ModType.Increased, weight: 1000 },
    ],
  },
  {
    id: "critical_multiplier",
    name: "残暴的",
    category: AffixCategory.Suffix,
    tags: ["weapon", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 85, min: 25, max: 35, modType: ModType.Flat, weight: 80 },
      { tier: 2, itemLevelReq: 65, min: 15, max: 24, modType: ModType.Flat, weight: 300 },
      { tier: 3, itemLevelReq: 40, min: 8, max: 14, modType: ModType.Flat, weight: 800 },
    ],
  },

  // ---- 命中类（武器/戒指） ----
  {
    id: "accuracy",
    name: "精准的",
    category: AffixCategory.Suffix,
    tags: ["weapon", "jewelry"],
    tiers: [
      { tier: 1, itemLevelReq: 80, min: 300, max: 400, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 60, min: 150, max: 299, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 35, min: 60, max: 149, modType: ModType.Flat, weight: 1000 },
    ],
  },

  // ---- 生命偷取类（武器） ----
  {
    id: "life_leech",
    name: "汲取的",
    category: AffixCategory.Suffix,
    tags: ["weapon"],
    tiers: [
      { tier: 1, itemLevelReq: 80, min: 2, max: 3, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 55, min: 1, max: 1, modType: ModType.Flat, weight: 400 },
    ],
  },

  // ---- 魔力偷取类（武器） ----
  {
    id: "mana_leech",
    name: "汲取法力",
    category: AffixCategory.Suffix,
    tags: ["weapon"],
    tiers: [
      { tier: 1, itemLevelReq: 75, min: 2, max: 3, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 50, min: 1, max: 1, modType: ModType.Flat, weight: 400 },
    ],
  },

  // ---- 格挡类（盾牌） ----
  {
    id: "block_chance",
    name: "格挡的",
    category: AffixCategory.Suffix,
    tags: ["armor_offhand"],
    tiers: [
      { tier: 1, itemLevelReq: 82, min: 5, max: 8, modType: ModType.Flat, weight: 100 },
      { tier: 2, itemLevelReq: 60, min: 3, max: 4, modType: ModType.Flat, weight: 400 },
      { tier: 3, itemLevelReq: 35, min: 1, max: 2, modType: ModType.Flat, weight: 1000 },
    ],
  },

  // ---- 药剂效果类（腰带） ----
  {
    id: "flask_effect",
    name: "药剂师",
    category: AffixCategory.Suffix,
    tags: ["armor_belt"],
    tiers: [
      { tier: 1, itemLevelReq: 80, min: 10, max: 15, modType: ModType.Increased, weight: 100 },
      { tier: 2, itemLevelReq: 55, min: 5, max: 9, modType: ModType.Increased, weight: 400 },
    ],
  },
];

// ===== 基底固有属性（Implicit） =====
export const IMPLICIT_POOL: Record<string, { stat: string; modType: ModType; min: number; max: number }[]> = {
  // 武器
  "rift_blade": [{ stat: "physicalDamage", modType: ModType.Flat, min: 10, max: 20 }],
  "eternal_sword": [{ stat: "accuracy", modType: ModType.Flat, min: 50, max: 100 }],
  "driftwood_wand": [{ stat: "spellDamage", modType: ModType.Increased, min: 10, max: 20 }],
  "crude_bow": [{ stat: "accuracy", modType: ModType.Flat, min: 30, max: 60 }],
  
  // 盾牌
  "gothic_shield": [{ stat: "blockChance", modType: ModType.Flat, min: 20, max: 25 }],
  
  // 头盔
  "iron_helmet": [{ stat: "armor", modType: ModType.Flat, min: 30, max: 50 }],
  "scholar_hat": [{ stat: "energyShield", modType: ModType.Flat, min: 15, max: 25 }],
  
  // 胸甲
  "plate_vest": [{ stat: "armor", modType: ModType.Flat, min: 80, max: 120 }],
  "woven_garb": [{ stat: "evasion", modType: ModType.Flat, min: 60, max: 100 }],
  "cloth_robe": [{ stat: "energyShield", modType: ModType.Flat, min: 40, max: 70 }],
  
  // 手套
  "iron_gauntlets": [{ stat: "armor", modType: ModType.Flat, min: 15, max: 30 }],
  "silk_gloves": [{ stat: "energyShield", modType: ModType.Flat, min: 10, max: 18 }],
  
  // 靴子
  "iron_greaves": [{ stat: "armor", modType: ModType.Flat, min: 15, max: 30 }],
  "slippers": [{ stat: "evasion", modType: ModType.Flat, min: 10, max: 20 }],
  
  // 腰带
  "heavy_belt": [{ stat: "strength", modType: ModType.Flat, min: 10, max: 25 }],
  "scholar_belt": [{ stat: "intelligence", modType: ModType.Flat, min: 10, max: 25 }],
  
  // 项链
  "jade_amulet": [{ stat: "dexterity", modType: ModType.Flat, min: 10, max: 30 }],
  "ruby_amulet": [{ stat: "strength", modType: ModType.Flat, min: 10, max: 30 }],
  
  // 戒指
  "iron_ring": [{ stat: "physicalDamage", modType: ModType.Flat, min: 1, max: 4 }],
  "ruby_ring": [{ stat: "fireResistance", modType: ModType.Flat, min: 15, max: 30 }],
  "sapphire_ring": [{ stat: "coldResistance", modType: ModType.Flat, min: 15, max: 30 }],
  "topaz_ring": [{ stat: "lightningResistance", modType: ModType.Flat, min: 15, max: 30 }],
};

// 获取词缀池
export function getAffixPool(category: AffixCategory, tag: string, itemLevel: number): AffixData[] {
  const pool = category === AffixCategory.Prefix ? PREFIX_POOL : SUFFIX_POOL;
  
  return pool.filter((affix) => {
    // 检查标签匹配
    const hasTag = affix.tags.some((t) => tag.includes(t) || tag === t);
    // 检查是否有符合物品等级的tier
    const hasValidTier = affix.tiers.some((t) => itemLevel >= t.itemLevelReq);
    
    return hasTag && hasValidTier;
  });
}
