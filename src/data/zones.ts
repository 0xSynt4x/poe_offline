import { Monster, EquipSlot, Rarity, DamageType, ModType } from "../models/types";

// ===== 区域定义 =====

export interface Zone {
  id: string;
  name: string;
  chapter: number;
  difficulty: number;        // 1-3 难度等级
  levelRange: [number, number];
  description: string;
  monsterPool: MonsterTemplate[];
  dropBonus: number;          // 掉落加成%
  expBonus: number;           // 经验加成%
  events: ZoneEvent[];
  requiredLevel: number;
  prerequisiteZone?: string;  // 前置区域ID
}

export interface MonsterTemplate {
  id: string;
  name: string;
  baseLevel: number;
  lifeMultiplier: number;
  damageMultiplier: number;
  armor: number;
  evasion: number;
  resistances: { fire: number; cold: number; lightning: number; chaos: number };
  damageType: DamageType;
  abilities?: string[];
  isBoss?: boolean;
}

export interface ZoneEvent {
  type: "combat" | "chest" | "shop" | "npc" | "trap" | "treasure";
  weight: number;             // 出现权重
  description: string;
  rewards?: EventReward[];
}

export interface EventReward {
  type: "currency" | "item" | "experience" | "heal";
  id?: string;
  amount?: number;
  chance?: number;
}

// ===== 章节1：荒芜之地 =====

export const CHAPTER_1_ZONES: Zone[] = [
  {
    id: "ch1_1",
    name: "枯萎森林",
    chapter: 1,
    difficulty: 1,
    levelRange: [1, 5],
    description: "一片被诅咒的森林，枯死的树木扭曲地伸向天空，空气中弥漫着腐败的气息。",
    monsterPool: [
      {
        id: "skeleton_warrior",
        name: "骸骨战士",
        baseLevel: 1,
        lifeMultiplier: 1,
        damageMultiplier: 1,
        armor: 5,
        evasion: 5,
        resistances: { fire: 0, cold: 0, lightning: 0, chaos: 0 },
        damageType: DamageType.Physical,
      },
      {
        id: "zombie",
        name: "腐化僵尸",
        baseLevel: 2,
        lifeMultiplier: 1.5,
        damageMultiplier: 0.8,
        armor: 10,
        evasion: 0,
        resistances: { fire: 0, cold: 0, lightning: 0, chaos: 20 },
        damageType: DamageType.Physical,
      },
      {
        id: "spider",
        name: "暗影蜘蛛",
        baseLevel: 1,
        lifeMultiplier: 0.7,
        damageMultiplier: 1.2,
        armor: 0,
        evasion: 15,
        resistances: { fire: 0, cold: 0, lightning: 0, chaos: 0 },
        damageType: DamageType.Physical,
      },
    ],
    dropBonus: 0,
    expBonus: 0,
    events: [
      { type: "combat", weight: 60, description: "你遇到了一群怪物！" },
      { type: "chest", weight: 20, description: "你发现了一个宝箱！" },
      { type: "npc", weight: 10, description: "你遇到了一位旅行商人。" },
      { type: "trap", weight: 10, description: "你触发了一个陷阱！" },
    ],
    requiredLevel: 1,
  },
  {
    id: "ch1_2",
    name: "泥沼村落",
    chapter: 1,
    difficulty: 1,
    levelRange: [4, 8],
    description: "被遗弃的村落，破败的房屋半陷在泥沼中，远处传来不详的低吼。",
    monsterPool: [
      {
        id: "mud_zombie",
        name: "泥沼行尸",
        baseLevel: 4,
        lifeMultiplier: 1.2,
        damageMultiplier: 1,
        armor: 15,
        evasion: 5,
        resistances: { fire: 0, cold: 10, lightning: 0, chaos: 0 },
        damageType: DamageType.Physical,
      },
      {
        id: "swamp_witch",
        name: "沼泽女巫",
        baseLevel: 5,
        lifeMultiplier: 0.8,
        damageMultiplier: 1.5,
        armor: 0,
        evasion: 20,
        resistances: { fire: 0, cold: 0, lightning: 20, chaos: 0 },
        damageType: DamageType.Fire,
      },
      {
        id: "toad",
        name: "巨型蟾蜍",
        baseLevel: 4,
        lifeMultiplier: 1.8,
        damageMultiplier: 0.9,
        armor: 20,
        evasion: 0,
        resistances: { fire: 0, cold: 0, lightning: 0, chaos: 30 },
        damageType: DamageType.Chaos,
      },
    ],
    dropBonus: 10,
    expBonus: 10,
    events: [
      { type: "combat", weight: 50, description: "怪物从泥沼中涌出！" },
      { type: "chest", weight: 25, description: "你发现了一个被泥沼半掩的箱子！" },
      { type: "shop", weight: 15, description: "你找到了一位隐藏的商人。" },
      { type: "npc", weight: 10, description: "你遇到了一位受伤的冒险者。" },
    ],
    requiredLevel: 3,
    prerequisiteZone: "ch1_1",
  },
  {
    id: "ch1_3",
    name: "下水道",
    chapter: 1,
    difficulty: 1,
    levelRange: [7, 11],
    description: "城市地下的排水系统，阴暗潮湿，散发着恶臭。据说这里隐藏着不为人知的秘密。",
    monsterPool: [
      {
        id: "rat",
        name: "变异巨鼠",
        baseLevel: 7,
        lifeMultiplier: 0.6,
        damageMultiplier: 1.3,
        armor: 0,
        evasion: 25,
        resistances: { fire: 0, cold: 0, lightning: 0, chaos: 10 },
        damageType: DamageType.Physical,
      },
      {
        id: "sewer_flayer",
        name: "下水道剥皮者",
        baseLevel: 8,
        lifeMultiplier: 1,
        damageMultiplier: 1.4,
        armor: 10,
        evasion: 15,
        resistances: { fire: 0, cold: 0, lightning: 0, chaos: 0 },
        damageType: DamageType.Physical,
      },
      {
        id: "ooze",
        name: "腐蚀粘液",
        baseLevel: 7,
        lifeMultiplier: 2,
        damageMultiplier: 0.6,
        armor: 30,
        evasion: 0,
        resistances: { fire: 0, cold: 0, lightning: 0, chaos: 50 },
        damageType: DamageType.Chaos,
      },
    ],
    dropBonus: 15,
    expBonus: 15,
    events: [
      { type: "combat", weight: 45, description: "怪物从阴影中扑出！" },
      { type: "chest", weight: 30, description: "你发现了一个古老的宝箱！" },
      { type: "trap", weight: 15, description: "你触发了毒气陷阱！" },
      { type: "treasure", weight: 10, description: "你发现了一处隐藏的宝藏！" },
    ],
    requiredLevel: 6,
    prerequisiteZone: "ch1_2",
  },
  {
    id: "ch1_4",
    name: "铁匠铺遗迹",
    chapter: 1,
    difficulty: 1,
    levelRange: [10, 13],
    description: "曾经繁荣的铁匠铺，如今只剩下锈迹斑斑的工具和不灭的炉火。",
    monsterPool: [
      {
        id: "iron_golem",
        name: "铁傀儡",
        baseLevel: 10,
        lifeMultiplier: 2.5,
        damageMultiplier: 1,
        armor: 50,
        evasion: 0,
        resistances: { fire: 30, cold: 0, lightning: 0, chaos: 0 },
        damageType: DamageType.Physical,
      },
      {
        id: "fire_spirit",
        name: "火焰精灵",
        baseLevel: 11,
        lifeMultiplier: 0.8,
        damageMultiplier: 1.8,
        armor: 0,
        evasion: 10,
        resistances: { fire: 75, cold: 0, lightning: 0, chaos: 0 },
        damageType: DamageType.Fire,
      },
      {
        id: "ghost_smith",
        name: "幽灵铁匠",
        baseLevel: 12,
        lifeMultiplier: 1.2,
        damageMultiplier: 1.5,
        armor: 20,
        evasion: 20,
        resistances: { fire: 20, cold: 20, lightning: 20, chaos: 0 },
        damageType: DamageType.Physical,
      },
    ],
    dropBonus: 25,
    expBonus: 20,
    events: [
      { type: "combat", weight: 40, description: "炉火中涌出怪物！" },
      { type: "chest", weight: 30, description: "你发现了铁匠的工具箱！" },
      { type: "shop", weight: 20, description: "你找到了铁匠的灵魂，他愿意为你打造装备。" },
      { type: "treasure", weight: 10, description: "你发现了传说中的锻造台！" },
    ],
    requiredLevel: 9,
    prerequisiteZone: "ch1_3",
  },
  {
    id: "ch1_boss",
    name: "腐化领主",
    chapter: 1,
    difficulty: 1,
    levelRange: [12, 15],
    description: "被腐化的领主盘踞在城堡深处，他的力量远超普通怪物。",
    monsterPool: [
      {
        id: "corrupted_lord",
        name: "腐化领主",
        baseLevel: 13,
        lifeMultiplier: 5,
        damageMultiplier: 1.5,
        armor: 40,
        evasion: 20,
        resistances: { fire: 20, cold: 20, lightning: 20, chaos: 30 },
        damageType: DamageType.Physical,
        isBoss: true,
        abilities: ["summon", "cleave", "enrage"],
      },
    ],
    dropBonus: 100,
    expBonus: 50,
    events: [
      { type: "combat", weight: 100, description: "腐化领主出现了！" },
    ],
    requiredLevel: 11,
    prerequisiteZone: "ch1_4",
  },
];

// ===== 章节2：王都废墟 =====

export const CHAPTER_2_ZONES: Zone[] = [
  {
    id: "ch2_1",
    name: "破碎城墙",
    chapter: 2,
    difficulty: 2,
    levelRange: [13, 16],
    description: "王都的城墙已成废墟，曾经宏伟的建筑如今只剩下断壁残垣。",
    monsterPool: [
      {
        id: "skeleton_knight",
        name: "骸骨骑士",
        baseLevel: 13,
        lifeMultiplier: 1.5,
        damageMultiplier: 1.2,
        armor: 25,
        evasion: 15,
        resistances: { fire: 0, cold: 10, lightning: 0, chaos: 0 },
        damageType: DamageType.Physical,
      },
      {
        id: "wraith",
        name: "怨灵",
        baseLevel: 14,
        lifeMultiplier: 0.9,
        damageMultiplier: 1.6,
        armor: 0,
        evasion: 30,
        resistances: { fire: 0, cold: 0, lightning: 30, chaos: 0 },
        damageType: DamageType.Lightning,
      },
      {
        id: "stone_gargoyle",
        name: "石像鬼",
        baseLevel: 15,
        lifeMultiplier: 2,
        damageMultiplier: 1,
        armor: 60,
        evasion: 0,
        resistances: { fire: 20, cold: 20, lightning: 20, chaos: 0 },
        damageType: DamageType.Physical,
      },
    ],
    dropBonus: 30,
    expBonus: 25,
    events: [
      { type: "combat", weight: 50, description: "守城的怪物向你扑来！" },
      { type: "chest", weight: 25, description: "你发现了一个战利品箱！" },
      { type: "shop", weight: 15, description: "你找到了一位难民商人。" },
      { type: "npc", weight: 10, description: "你遇到了一位幸存的守卫。" },
    ],
    requiredLevel: 12,
    prerequisiteZone: "ch1_boss",
  },
];

// ===== 所有区域 =====

export const ALL_ZONES: Zone[] = [
  ...CHAPTER_1_ZONES,
  ...CHAPTER_2_ZONES,
];

// ===== 工具函数 =====

export function getZoneById(id: string): Zone | undefined {
  return ALL_ZONES.find((z) => z.id === id);
}

export function getZonesByChapter(chapter: number): Zone[] {
  return ALL_ZONES.filter((z) => z.chapter === chapter);
}

export function getAvailableZones(playerLevel: number, completedZones: string[]): Zone[] {
  return ALL_ZONES.filter((z) => {
    // 等级要求
    if (playerLevel < z.requiredLevel) return false;
    
    // 前置区域要求
    if (z.prerequisiteZone && !completedZones.includes(z.prerequisiteZone)) return false;
    
    return true;
  });
}

export function generateMonster(template: MonsterTemplate, zoneLevel: number): Monster {
  const levelVariance = Math.floor(Math.random() * 3) - 1; // -1, 0, +1
  const level = Math.max(1, zoneLevel + levelVariance);
  
  const baseLife = 50 + level * 10;
  const baseDamage = 5 + level * 2;
  
  return {
    id: `${template.id}_${Date.now()}`,
    name: template.name,
    level,
    life: Math.floor(baseLife * template.lifeMultiplier),
    maxLife: Math.floor(baseLife * template.lifeMultiplier),
    damage: [
      {
        stat: "physicalDamage",
        modType: "flat" as any,
        min: Math.floor(baseDamage * template.damageMultiplier * 0.8),
        max: Math.floor(baseDamage * template.damageMultiplier * 1.2),
      },
    ],
    damageType: template.damageType,
    attackSpeed: 0.8 + Math.random() * 0.4,
    accuracy: 30 + level * 5,
    armor: template.armor,
    evasion: template.evasion,
    resistances: template.resistances,
  };
}

export function generateMonstersForZone(zone: Zone): Monster[] {
  const zoneLevel = Math.floor(
    (zone.levelRange[0] + zone.levelRange[1]) / 2
  );
  
  const isBoss = zone.id.includes("boss");
  
  if (isBoss) {
    // Boss区域只有Boss
    const bossTemplate = zone.monsterPool.find((m) => m.isBoss);
    if (bossTemplate) {
      return [generateMonster(bossTemplate, zoneLevel)];
    }
  }
  
  // 普通区域：1-3只怪物
  const monsterCount = 1 + Math.floor(Math.random() * 2);
  const monsters: Monster[] = [];
  
  for (let i = 0; i < monsterCount; i++) {
    const template = zone.monsterPool[Math.floor(Math.random() * zone.monsterPool.length)];
    monsters.push(generateMonster(template, zoneLevel));
  }
  
  return monsters;
}

export function calculateExpReward(zone: Zone, monsterLevel: number): number {
  const baseExp = 20 + monsterLevel * 5;
  return Math.floor(baseExp * (1 + zone.expBonus / 100));
}
