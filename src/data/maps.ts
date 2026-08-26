import { ModType } from '../models/types';

// ===== 地图基底 (T1-T16) =====

export interface MapBase {
  id: string;
  name: string;
  tier: number;           // 1-16
  itemLevel: number;      // 等级区域
  itemClass: 'normal' | 'magic' | 'rare' | 'unique';
  description: string;
}

export const MAP_BASES: MapBase[] = [
  // Tier 1
  { id: 't1_ash_woods', name: '灰烬之林', tier: 1, itemLevel: 1, itemClass: 'normal', description: '荒凉的林地，零星的火光在树丛中闪烁。' },
  // Tier 2
  { id: 't2_rotten_core', name: '腐朽核心', tier: 2, itemLevel: 3, itemClass: 'normal', description: '腐烂的树根交织成网，散发着恶臭。' },
  // Tier 3
  { id: 't3_marsh_fort', name: '泥沼堡垒', tier: 3, itemLevel: 5, itemClass: 'normal', description: '一座被沼泽吞没的废弃要塞，阴森恐怖。' },
  // Tier 4
  { id: 't4_iron_flats', name: '铁原荒地', tier: 4, itemLevel: 7, itemClass: 'normal', description: '满是铁锈和残骸的荒原，风中带着金属的腥味。' },
  // Tier 5
  { id: 't5_cold_breach', name: '寒霜裂隙', tier: 5, itemLevel: 10, itemClass: 'normal', description: '寒风呼啸的裂隙，霜冻覆盖着一切。' },
  // Tier 6
  { id: 't6_spider_web', name: '蛛网密林', tier: 6, itemLevel: 12, itemClass: 'normal', description: '密集的蛛网覆盖了整片森林，猎手在暗处窥视。' },
  // Tier 7
  { id: 't7_flame_temple', name: '烈焰神殿', tier: 7, itemLevel: 14, itemClass: 'normal', description: '古老的神殿在永恒的火焰中燃烧。' },
  // Tier 8
  { id: 't8_abyss_depth', name: '深渊之底', tier: 8, itemLevel: 16, itemClass: 'magic', description: '无尽的黑暗深渊，未知的恐怖潜伏其中。' },
  // Tier 9
  { id: 't9_crystal_cave', name: '水晶洞穴', tier: 9, itemLevel: 18, itemClass: 'magic', description: '闪烁的水晶洞穴，光芒中隐藏着致命的陷阱。' },
  // Tier 10
  { id: 't10_blood_gulch', name: '血色峡谷', tier: 10, itemLevel: 20, itemClass: 'magic', description: '峡谷中回荡着战鼓的声响，鲜血染红了岩石。' },
  // Tier 11
  { id: 't11_chaos_realm', name: '混沌界域', tier: 11, itemLevel: 22, itemClass: 'rare', description: '现实与混沌交织的扭曲空间，一切都变得不可预测。' },
  // Tier 12
  { id: 't12_void_citadel', name: '虚空堡垒', tier: 12, itemLevel: 24, itemClass: 'rare', description: '漂浮在虚空中的古老堡垒，守护着被遗忘的秘密。' },
  // Tier 13
  { id: 't13_desecrated', name: '亵渎之地', tier: 13, itemLevel: 26, itemClass: 'rare', description: '神圣与腐朽交织的土地，被亵渎的力量扭曲。' },
  // Tier 14
  { id: 't14_doom_hollow', name: '末日深渊', tier: 14, itemLevel: 28, itemClass: 'rare', description: '末日降临的深渊，死亡与毁灭无处不在。' },
  // Tier 15
  { id: 't15_gods_fall', name: '诸神陨落', tier: 15, itemLevel: 30, itemClass: 'rare', description: '众神陨落之地，神力的残余扭曲了现实。' },
  // Tier 16
  { id: 't16_eternal_ruin', name: '永恒废墟', tier: 16, itemLevel: 32, itemClass: 'rare', description: '永恒帝国的最后遗迹，时间在此停滞。' },
];

// ===== 地图前缀（增加难度，增加奖励） =====

export interface MapModifier {
  id: string;
  name: string;
  tier: number;  // 1-3
  type: 'prefix' | 'suffix';
  description: string;
  effects: MapModifierEffect[];
}

export interface MapModifierEffect {
  type: 'monster_damage' | 'monster_life' | 'monster_speed' | 'item_quantity' | 'item_rarity' | 'monster_area' | 'monster_count';
  value: number;
}

export const MAP_PREFIXES: MapModifier[] = [
  // Tier 1 - 轻度难度增加
  { id: 'mp_t1_1', name: '贫瘠的', tier: 1, type: 'prefix', description: '怪物增加20%物理伤害', effects: [{ type: 'monster_damage', value: 20 }] },
  { id: 'mp_t1_2', name: '寒冷的', tier: 1, type: 'prefix', description: '怪物增加20%冰冷伤害', effects: [{ type: 'monster_damage', value: 20 }] },
  { id: 'mp_t1_3', name: '燃烧的', tier: 1, type: 'prefix', description: '怪物增加20%火焰伤害', effects: [{ type: 'monster_damage', value: 20 }] },
  { id: 'mp_t1_4', name: '带电的', tier: 1, type: 'prefix', description: '怪物增加20%闪电伤害', effects: [{ type: 'monster_damage', value: 20 }] },
  { id: 'mp_t1_5', name: '坚硬的', tier: 1, type: 'prefix', description: '怪物增加20%生命', effects: [{ type: 'monster_life', value: 20 }] },
  { id: 'mp_t1_6', name: '敏捷的', tier: 1, type: 'prefix', description: '怪物增加15%移动速度', effects: [{ type: 'monster_speed', value: 15 }] },
  
  // Tier 2 - 中等难度增加
  { id: 'mp_t2_1', name: '残暴的', tier: 2, type: 'prefix', description: '怪物增加40%物理伤害', effects: [{ type: 'monster_damage', value: 40 }] },
  { id: 'mp_t2_2', name: '冰封的', tier: 2, type: 'prefix', description: '怪物增加40%冰冷伤害', effects: [{ type: 'monster_damage', value: 40 }] },
  { id: 'mp_t2_3', name: '燃烧的', tier: 2, type: 'prefix', description: '怪物增加40%火焰伤害', effects: [{ type: 'monster_damage', value: 40 }] },
  { id: 'mp_t2_4', name: '雷鸣的', tier: 2, type: 'prefix', description: '怪物增加40%闪电伤害', effects: [{ type: 'monster_damage', value: 40 }] },
  { id: 'mp_t2_5', name: '不朽的', tier: 2, type: 'prefix', description: '怪物增加50%生命', effects: [{ type: 'monster_life', value: 50 }] },
  { id: 'mp_t2_6', name: '迅捷的', tier: 2, type: 'prefix', description: '怪物增加30%移动速度', effects: [{ type: 'monster_speed', value: 30 }] },
  
  // Tier 3 - 高难度增加
  { id: 'mp_t3_1', name: '毁灭的', tier: 3, type: 'prefix', description: '怪物增加80%物理伤害', effects: [{ type: 'monster_damage', value: 80 }] },
  { id: 'mp_t3_2', name: '极寒的', tier: 3, type: 'prefix', description: '怪物增加80%冰冷伤害', effects: [{ type: 'monster_damage', value: 80 }] },
  { id: 'mp_t3_3', name: '焚天的', tier: 3, type: 'prefix', description: '怪物增加80%火焰伤害', effects: [{ type: 'monster_damage', value: 80 }] },
  { id: 'mp_t3_4', name: '雷霆的', tier: 3, type: 'prefix', description: '怪物增加80%闪电伤害', effects: [{ type: 'monster_damage', value: 80 }] },
  { id: 'mp_t3_5', name: '不朽的', tier: 3, type: 'prefix', description: '怪物增加100%生命', effects: [{ type: 'monster_life', value: 100 }] },
  { id: 'mp_t3_6', name: '疾风的', tier: 3, type: 'prefix', description: '怪物增加50%移动速度', effects: [{ type: 'monster_speed', value: 50 }] },
];

// ===== 地图后缀（增加奖励） =====

export const MAP_SUFFIXES: MapModifier[] = [
  // Tier 1
  { id: 'ms_t1_1', name: '丰饶的', tier: 1, type: 'suffix', description: '怪物掉落增加20%', effects: [{ type: 'item_quantity', value: 20 }] },
  { id: 'ms_t1_2', name: '富饶的', tier: 1, type: 'suffix', description: '怪物掉落品质增加20%', effects: [{ type: 'item_rarity', value: 20 }] },
  { id: 'ms_t1_3', name: '众多的', tier: 1, type: 'suffix', description: '怪物数量增加25%', effects: [{ type: 'monster_count', value: 25 }] },
  { id: 'ms_t1_4', name: '宽广的', tier: 1, type: 'suffix', description: '地图范围增加15%', effects: [{ type: 'monster_area', value: 15 }] },
  
  // Tier 2
  { id: 'ms_t2_1', name: '富饶的', tier: 2, type: 'suffix', description: '怪物掉落增加40%', effects: [{ type: 'item_quantity', value: 40 }] },
  { id: 'ms_t2_2', name: '珍稀的', tier: 2, type: 'suffix', description: '怪物掉落品质增加40%', effects: [{ type: 'item_rarity', value: 40 }] },
  { id: 'ms_t2_3', name: '密集的', tier: 2, type: 'suffix', description: '怪物数量增加50%', effects: [{ type: 'monster_count', value: 50 }] },
  { id: 'ms_t2_4', name: '辽阔的', tier: 2, type: 'suffix', description: '地图范围增加30%', effects: [{ type: 'monster_area', value: 30 }] },
  
  // Tier 3
  { id: 'ms_t3_1', name: '极丰的', tier: 3, type: 'suffix', description: '怪物掉落增加80%', effects: [{ type: 'item_quantity', value: 80 }] },
  { id: 'ms_t3_2', name: '至宝的', tier: 3, type: 'suffix', description: '怪物掉落品质增加80%', effects: [{ type: 'item_rarity', value: 80 }] },
  { id: 'ms_t3_3', name: '密集的', tier: 3, type: 'suffix', description: '怪物数量增加100%', effects: [{ type: 'monster_count', value: 100 }] },
  { id: 'ms_t3_4', name: '浩瀚的', tier: 3, type: 'suffix', description: '地图范围增加50%', effects: [{ type: 'monster_area', value: 50 }] },
];

// ===== 地图数据接口 =====

export interface GameMap {
  id: string;
  name: string;
  tier: number;
  itemLevel: number;
  itemClass: 'normal' | 'magic' | 'rare' | 'unique';
  prefixes: MapModifier[];
  suffixes: MapModifier[];
  description: string;
  isCompleted: boolean;
  modifiersActive: boolean;
}

// ===== 工具函数 =====

export function getMapBaseById(id: string): MapBase | undefined {
  return MAP_BASES.find(m => m.id === id);
}

export function getMapBaseByTier(tier: number): MapBase | undefined {
  return MAP_BASES.find(m => m.tier === tier);
}

export function generateRandomMap(playerLevel: number): GameMap {
  // 确定地图等级：玩家等级 ± 3
  const minTier = Math.max(1, Math.floor(playerLevel / 2) - 3);
  const maxTier = Math.min(16, Math.ceil(playerLevel / 2) + 3);
  const tier = Math.floor(Math.random() * (maxTier - minTier + 1)) + minTier;
  
  const base = MAP_BASES.find(m => m.tier === tier) || MAP_BASES[0];
  
  // 确定地图品质
  let mapClass: 'normal' | 'magic' | 'rare' = 'normal';
  const rarityRoll = Math.random() * 100;
  if (rarityRoll < 10) mapClass = 'rare';
  else if (rarityRoll < 40) mapClass = 'magic';
  
  // 生成词缀
  const prefixes: MapModifier[] = [];
  const suffixes: MapModifier[] = [];
  
  if (mapClass === 'magic') {
    // 魔法地图：0-1前缀，0-1后缀
    if (Math.random() < 0.7) {
      const availablePrefixes = MAP_PREFIXES.filter(p => p.tier <= tier);
      if (availablePrefixes.length > 0) {
        prefixes.push(availablePrefixes[Math.floor(Math.random() * availablePrefixes.length)]);
      }
    }
    if (Math.random() < 0.5) {
      const availableSuffixes = MAP_SUFFIXES.filter(s => s.tier <= tier);
      if (availableSuffixes.length > 0) {
        suffixes.push(availableSuffixes[Math.floor(Math.random() * availableSuffixes.length)]);
      }
    }
  } else if (mapClass === 'rare') {
    // 稀有地图：1-2前缀，1-2后缀
    const prefixCount = 1 + Math.floor(Math.random() * 2);
    const suffixCount = 1 + Math.floor(Math.random() * 2);
    
    for (let i = 0; i < prefixCount; i++) {
      const available = MAP_PREFIXES.filter(p => p.tier <= tier && !prefixes.includes(p));
      if (available.length > 0) {
        prefixes.push(available[Math.floor(Math.random() * available.length)]);
      }
    }
    
    for (let i = 0; i < suffixCount; i++) {
      const available = MAP_SUFFIXES.filter(s => s.tier <= tier && !suffixes.includes(s));
      if (available.length > 0) {
        suffixes.push(available[Math.floor(Math.random() * available.length)]);
      }
    }
  }
  
  return {
    id: `map_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    name: `${base.name} T${tier}`,
    tier,
    itemLevel: base.itemLevel,
    itemClass: mapClass,
    prefixes,
    suffixes,
    description: base.description,
    isCompleted: false,
    modifiersActive: mapClass !== 'normal',
  };
}

export function getMapModifiers(map: GameMap): MapModifier[] {
  return [...map.prefixes, ...map.suffixes];
}

export function getMapEffects(map: GameMap): {
  monsterDamage: number;
  monsterLife: number;
  monsterSpeed: number;
  itemQuantity: number;
  itemRarity: number;
  monsterCount: number;
  monsterArea: number;
} {
  const effects = {
    monsterDamage: 0,
    monsterLife: 0,
    monsterSpeed: 0,
    itemQuantity: 0,
    itemRarity: 0,
    monsterCount: 0,
    monsterArea: 0,
  };
  
  for (const mod of getMapModifiers(map)) {
    for (const effect of mod.effects) {
      switch (effect.type) {
        case 'monster_damage': effects.monsterDamage += effect.value; break;
        case 'monster_life': effects.monsterLife += effect.value; break;
        case 'monster_speed': effects.monsterSpeed += effect.value; break;
        case 'item_quantity': effects.itemQuantity += effect.value; break;
        case 'item_rarity': effects.itemRarity += effect.value; break;
        case 'monster_count': effects.monsterCount += effect.value; break;
        case 'monster_area': effects.monsterArea += effect.value; break;
      }
    }
  }
  
  return effects;
}

export function rerollMapModifiers(map: GameMap): void {
  map.prefixes = [];
  map.suffixes = [];
  
  // 重新生成词缀
  const prefixCount = Math.floor(Math.random() * 2) + 1;
  const suffixCount = Math.floor(Math.random() * 2) + 1;
  
  for (let i = 0; i < prefixCount; i++) {
    const available = MAP_PREFIXES.filter(p => p.tier <= map.tier && !map.prefixes.includes(p));
    if (available.length > 0) {
      map.prefixes.push(available[Math.floor(Math.random() * available.length)]);
    }
  }
  
  for (let i = 0; i < suffixCount; i++) {
    const available = MAP_SUFFIXES.filter(s => s.tier <= map.tier && !map.suffixes.includes(s));
    if (available.length > 0) {
      map.suffixes.push(available[Math.floor(Math.random() * available.length)]);
    }
  }
  
  map.modifiersActive = map.prefixes.length > 0 || map.suffixes.length > 0;
}

export function addMapModifier(map: GameMap, modifier: MapModifier): boolean {
  if (modifier.type === 'prefix' && map.prefixes.length < 3) {
    if (!map.prefixes.find(p => p.id === modifier.id)) {
      map.prefixes.push(modifier);
      map.modifiersActive = true;
      return true;
    }
  } else if (modifier.type === 'suffix' && map.suffixes.length < 3) {
    if (!map.suffixes.find(s => s.id === modifier.id)) {
      map.suffixes.push(modifier);
      map.modifiersActive = true;
      return true;
    }
  }
  return false;
}

export function removeRandomModifier(map: GameMap): MapModifier | null {
  if (map.prefixes.length > 0 && Math.random() < 0.5) {
    const idx = Math.floor(Math.random() * map.prefixes.length);
    const removed = map.prefixes.splice(idx, 1)[0];
    if (map.prefixes.length === 0 && map.suffixes.length === 0) {
      map.modifiersActive = false;
    }
    return removed;
  } else if (map.suffixes.length > 0) {
    const idx = Math.floor(Math.random() * map.suffixes.length);
    const removed = map.suffixes.splice(idx, 1)[0];
    if (map.prefixes.length === 0 && map.suffixes.length === 0) {
      map.modifiersActive = false;
    }
    return removed;
  }
  return null;
}

export function canOpenMap(playerLevel: number, map: GameMap): { canOpen: boolean; reason?: string } {
  if (map.itemLevel > playerLevel + 10) {
    return { canOpen: false, reason: '地图等级过高，无法打开' };
  }
  return { canOpen: true };
}

export function getMapTierColor(tier: number): string {
  if (tier <= 3) return '#90EE90';    // 浅绿色
  if (tier <= 6) return '#87CEEB';    // 浅蓝色
  if (tier <= 9) return '#DDA0DD';    // 浅紫色
  if (tier <= 12) return '#FFB347';   // 橙色
  if (tier <= 14) return '#FF6B6B';   // 红色
  return '#FF0000';                   // 亮红色
}

export function formatMapName(map: GameMap): string {
  const color = getMapTierColor(map.tier);
  return `<span style="color:${color};font-weight:bold;">${map.name}</span>`;
}

export function formatMapModifiers(map: GameMap): string[] {
  const mods: string[] = [];
  
  for (const prefix of map.prefixes) {
    mods.push(`<span style="color:#ff6b6b">前缀: ${prefix.name} - ${prefix.description}</span>`);
  }
  
  for (const suffix of map.suffixes) {
    mods.push(`<span style="color:#4ecdc4">后缀: ${suffix.name} - ${suffix.description}</span>`);
  }
  
  return mods;
}
