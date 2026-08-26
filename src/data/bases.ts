import { EquipSlot, ModType, GemColor } from "../models/types";

export interface BaseItemData {
  id: string;
  name: string;
  slot: EquipSlot;
  type: string;
  implicit: { stat: string; modType: ModType; min: number; max: number }[];
  sockets: { min: number; max: number };
  requiredStats: Partial<Record<string, number>>;
  tags: string[];
  levelReq: number;
}

// ===== 武器 =====
export const WEAPON_BASES: BaseItemData[] = [
  // 近战武器
  {
    id: "rift_blade",
    name: "裂隙之刃",
    slot: EquipSlot.Weapon,
    type: "sword_1h",
    implicit: [{ stat: "physicalDamage", modType: ModType.Flat, min: 10, max: 20 }],
    sockets: { min: 3, max: 6 },
    requiredStats: { strength: 20 },
    tags: ["weapon", "melee"],
    levelReq: 1,
  },
  {
    id: "eternal_sword",
    name: "永恒之剑",
    slot: EquipSlot.Weapon,
    type: "sword_1h",
    implicit: [{ stat: "accuracy", modType: ModType.Flat, min: 50, max: 100 }],
    sockets: { min: 3, max: 6 },
    requiredStats: { strength: 10, dexterity: 10 },
    tags: ["weapon", "melee"],
    levelReq: 20,
  },
  {
    id: "labrys",
    name: "双刃巨斧",
    slot: EquipSlot.Weapon,
    type: "axe_2h",
    implicit: [{ stat: "physicalDamage", modType: ModType.Flat, min: 20, max: 35 }],
    sockets: { min: 4, max: 6 },
    requiredStats: { strength: 40 },
    tags: ["weapon", "melee", "two_hand"],
    levelReq: 15,
  },
  {
    id: "imperial_claw",
    name: "帝国之爪",
    slot: EquipSlot.Weapon,
    type: "claw",
    implicit: [
      { stat: "physicalDamage", modType: ModType.Flat, min: 5, max: 12 },
      { stat: "lifeLeech", modType: ModType.Flat, min: 1, max: 2 },
    ],
    sockets: { min: 3, max: 6 },
    requiredStats: { dexterity: 20 },
    tags: ["weapon", "melee"],
    levelReq: 10,
  },

  // 远程武器
  {
    id: "crude_bow",
    name: "粗糙之弓",
    slot: EquipSlot.Weapon,
    type: "bow",
    implicit: [{ stat: "accuracy", modType: ModType.Flat, min: 30, max: 60 }],
    sockets: { min: 3, max: 6 },
    requiredStats: { dexterity: 20 },
    tags: ["weapon", "ranged"],
    levelReq: 1,
  },
  {
    id: "thicket_bow",
    name: "密林之弓",
    slot: EquipSlot.Weapon,
    type: "bow",
    implicit: [{ stat: "attackSpeed", modType: ModType.Increased, min: 10, max: 15 }],
    sockets: { min: 4, max: 6 },
    requiredStats: { dexterity: 40 },
    tags: ["weapon", "ranged"],
    levelReq: 25,
  },

  // 法器
  {
    id: "driftwood_wand",
    name: "浮木魔杖",
    slot: EquipSlot.Weapon,
    type: "wand",
    implicit: [{ stat: "spellDamage", modType: ModType.Increased, min: 10, max: 20 }],
    sockets: { min: 3, max: 6 },
    requiredStats: { intelligence: 20 },
    tags: ["weapon", "caster"],
    levelReq: 1,
  },
  {
    id: "crystal_sceptre",
    name: "水晶权杖",
    slot: EquipSlot.Weapon,
    type: "sceptre",
    implicit: [{ stat: "elementalDamage", modType: ModType.Increased, min: 15, max: 25 }],
    sockets: { min: 3, max: 6 },
    requiredStats: { strength: 10, intelligence: 10 },
    tags: ["weapon", "caster", "melee"],
    levelReq: 10,
  },
];

// ===== 盾牌 =====
export const SHIELD_BASES: BaseItemData[] = [
  {
    id: "gothic_shield",
    name: "哥特之盾",
    slot: EquipSlot.Offhand,
    type: "shield",
    implicit: [{ stat: "blockChance", modType: ModType.Flat, min: 20, max: 25 }],
    sockets: { min: 2, max: 4 },
    requiredStats: { strength: 30 },
    tags: ["armor", "offhand"],
    levelReq: 5,
  },
  {
    id: "tower_shield",
    name: "高塔之盾",
    slot: EquipSlot.Offhand,
    type: "shield",
    implicit: [{ stat: "armor", modType: ModType.Flat, min: 80, max: 120 }],
    sockets: { min: 3, max: 6 },
    requiredStats: { strength: 50 },
    tags: ["armor", "offhand"],
    levelReq: 20,
  },
];

// ===== 头盔 =====
export const HELMET_BASES: BaseItemData[] = [
  {
    id: "iron_helmet",
    name: "铁盔",
    slot: EquipSlot.Helmet,
    type: "helmet",
    implicit: [{ stat: "armor", modType: ModType.Flat, min: 30, max: 50 }],
    sockets: { min: 2, max: 4 },
    requiredStats: { strength: 15 },
    tags: ["armor", "helmet"],
    levelReq: 1,
  },
  {
    id: "scholar_hat",
    name: "学者之帽",
    slot: EquipSlot.Helmet,
    type: "helmet",
    implicit: [{ stat: "energyShield", modType: ModType.Flat, min: 15, max: 25 }],
    sockets: { min: 2, max: 4 },
    requiredStats: { intelligence: 15 },
    tags: ["armor", "helmet"],
    levelReq: 1,
  },
  {
    id: "lion_pelt",
    name: "狮鹫之盔",
    slot: EquipSlot.Helmet,
    type: "helmet",
    implicit: [{ stat: "evasion", modType: ModType.Flat, min: 30, max: 50 }],
    sockets: { min: 2, max: 4 },
    requiredStats: { dexterity: 15 },
    tags: ["armor", "helmet"],
    levelReq: 1,
  },
];

// ===== 胸甲 =====
export const BODY_BASES: BaseItemData[] = [
  {
    id: "plate_vest",
    name: "板甲背心",
    slot: EquipSlot.Body,
    type: "body",
    implicit: [{ stat: "armor", modType: ModType.Flat, min: 80, max: 120 }],
    sockets: { min: 3, max: 6 },
    requiredStats: { strength: 30 },
    tags: ["armor", "body"],
    levelReq: 1,
  },
  {
    id: "woven_garb",
    name: "编织外衣",
    slot: EquipSlot.Body,
    type: "body",
    implicit: [{ stat: "evasion", modType: ModType.Flat, min: 60, max: 100 }],
    sockets: { min: 3, max: 6 },
    requiredStats: { dexterity: 30 },
    tags: ["armor", "body"],
    levelReq: 1,
  },
  {
    id: "cloth_robe",
    name: "布袍",
    slot: EquipSlot.Body,
    type: "body",
    implicit: [{ stat: "energyShield", modType: ModType.Flat, min: 40, max: 70 }],
    sockets: { min: 3, max: 6 },
    requiredStats: { intelligence: 30 },
    tags: ["armor", "body"],
    levelReq: 1,
  },
];

// ===== 手套 =====
export const GLOVES_BASES: BaseItemData[] = [
  {
    id: "iron_gauntlets",
    name: "铁手套",
    slot: EquipSlot.Gloves,
    type: "gloves",
    implicit: [{ stat: "armor", modType: ModType.Flat, min: 15, max: 30 }],
    sockets: { min: 2, max: 4 },
    requiredStats: { strength: 10 },
    tags: ["armor", "gloves"],
    levelReq: 1,
  },
  {
    id: "silk_gloves",
    name: "丝绸手套",
    slot: EquipSlot.Gloves,
    type: "gloves",
    implicit: [{ stat: "energyShield", modType: ModType.Flat, min: 10, max: 18 }],
    sockets: { min: 2, max: 4 },
    requiredStats: { intelligence: 10 },
    tags: ["armor", "gloves"],
    levelReq: 1,
  },
];

// ===== 靴子 =====
export const BOOTS_BASES: BaseItemData[] = [
  {
    id: "iron_greaves",
    name: "铁胫甲",
    slot: EquipSlot.Boots,
    type: "boots",
    implicit: [{ stat: "armor", modType: ModType.Flat, min: 15, max: 30 }],
    sockets: { min: 2, max: 4 },
    requiredStats: { strength: 10 },
    tags: ["armor", "boots"],
    levelReq: 1,
  },
  {
    id: "slippers",
    name: "软底鞋",
    slot: EquipSlot.Boots,
    type: "boots",
    implicit: [{ stat: "evasion", modType: ModType.Flat, min: 10, max: 20 }],
    sockets: { min: 2, max: 4 },
    requiredStats: { dexterity: 10 },
    tags: ["armor", "boots"],
    levelReq: 1,
  },
];

// ===== 腰带 =====
export const BELT_BASES: BaseItemData[] = [
  {
    id: "heavy_belt",
    name: "重腰带",
    slot: EquipSlot.Belt,
    type: "belt",
    implicit: [{ stat: "strength", modType: ModType.Flat, min: 10, max: 25 }],
    sockets: { min: 0, max: 0 },
    requiredStats: {},
    tags: ["armor", "belt"],
    levelReq: 1,
  },
  {
    id: "scholar_belt",
    name: "学者腰带",
    slot: EquipSlot.Belt,
    type: "belt",
    implicit: [{ stat: "intelligence", modType: ModType.Flat, min: 10, max: 25 }],
    sockets: { min: 0, max: 0 },
    requiredStats: {},
    tags: ["armor", "belt"],
    levelReq: 1,
  },
];

// ===== 项链 =====
export const AMULET_BASES: BaseItemData[] = [
  {
    id: "jade_amulet",
    name: "翡翠项链",
    slot: EquipSlot.Amulet,
    type: "amulet",
    implicit: [{ stat: "dexterity", modType: ModType.Flat, min: 10, max: 30 }],
    sockets: { min: 0, max: 0 },
    requiredStats: {},
    tags: ["jewelry", "amulet"],
    levelReq: 1,
  },
  {
    id: "ruby_amulet",
    name: "红宝石项链",
    slot: EquipSlot.Amulet,
    type: "amulet",
    implicit: [{ stat: "strength", modType: ModType.Flat, min: 10, max: 30 }],
    sockets: { min: 0, max: 0 },
    requiredStats: {},
    tags: ["jewelry", "amulet"],
    levelReq: 1,
  },
];

// ===== 戒指 =====
export const RING_BASES: BaseItemData[] = [
  {
    id: "iron_ring",
    name: "铁戒指",
    slot: EquipSlot.Ring1,
    type: "ring",
    implicit: [{ stat: "physicalDamage", modType: ModType.Flat, min: 1, max: 4 }],
    sockets: { min: 0, max: 0 },
    requiredStats: {},
    tags: ["jewelry", "ring"],
    levelReq: 1,
  },
  {
    id: "ruby_ring",
    name: "红宝石戒指",
    slot: EquipSlot.Ring1,
    type: "ring",
    implicit: [{ stat: "fireResistance", modType: ModType.Flat, min: 15, max: 30 }],
    sockets: { min: 0, max: 0 },
    requiredStats: {},
    tags: ["jewelry", "ring"],
    levelReq: 1,
  },
  {
    id: "sapphire_ring",
    name: "蓝宝石戒指",
    slot: EquipSlot.Ring1,
    type: "ring",
    implicit: [{ stat: "coldResistance", modType: ModType.Flat, min: 15, max: 30 }],
    sockets: { min: 0, max: 0 },
    requiredStats: {},
    tags: ["jewelry", "ring"],
    levelReq: 1,
  },
  {
    id: "topaz_ring",
    name: "黄玉戒指",
    slot: EquipSlot.Ring1,
    type: "ring",
    implicit: [{ stat: "lightningResistance", modType: ModType.Flat, min: 15, max: 30 }],
    sockets: { min: 0, max: 0 },
    requiredStats: {},
    tags: ["jewelry", "ring"],
    levelReq: 1,
  },
];

// ===== 所有基底合并 =====
export const ALL_BASES: BaseItemData[] = [
  ...WEAPON_BASES,
  ...SHIELD_BASES,
  ...HELMET_BASES,
  ...BODY_BASES,
  ...GLOVES_BASES,
  ...BOOTS_BASES,
  ...BELT_BASES,
  ...AMULET_BASES,
  ...RING_BASES,
];

// 按槽位查找基底
export function getBasesBySlot(slot: EquipSlot): BaseItemData[] {
  return ALL_BASES.filter((b) => b.slot === slot);
}

// 随机选择基底
export function randomBase(slot: EquipSlot, itemLevel: number): BaseItemData | null {
  const bases = getBasesBySlot(slot).filter((b) => b.levelReq <= itemLevel);
  if (bases.length === 0) return null;
  return bases[Math.floor(Math.random() * bases.length)];
}
