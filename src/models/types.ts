// ===== 枚举类型 =====

export enum Rarity {
  Normal = "normal",
  Magic = "magic",
  Rare = "rare",
  Unique = "unique"
}

export enum EquipSlot {
  Weapon = "weapon",
  Offhand = "offhand",
  Helmet = "helmet",
  Body = "body",
  Gloves = "gloves",
  Boots = "boots",
  Belt = "belt",
  Amulet = "amulet",
  Ring1 = "ring1",
  Ring2 = "ring2"
}

export enum GemColor {
  Red = "red",
  Green = "green",
  Blue = "blue",
  White = "white"
}

export enum GemType {
  Active = "active",
  Support = "support"
}

export enum DamageType {
  Physical = "physical",
  Fire = "fire",
  Cold = "cold",
  Lightning = "lightning",
  Chaos = "chaos"
}

export enum AffixCategory {
  Prefix = "prefix",
  Suffix = "suffix"
}

export enum ModType {
  Flat = "flat",
  Percent = "percent",
  Increased = "increased",
  More = "more"
}

export type FlaskType = "life" | "mana" | "utility";
export type UtilityFlaskEffect = {
  type: "utility";
  utility: "offense" | "guard" | "haste";
  value: number;
  duration: number;
};
export type FlaskEffect =
  | { type: "life"; amountPercent: number }
  | { type: "mana"; amountPercent: number }
  | UtilityFlaskEffect;

export interface Flask {
  id: string;
  name: string;
  type: FlaskType;
  description: string;
  maxCharges: number;
  charges: number;
  chargesPerUse: number;
  effect: FlaskEffect;
}

// ===== 核心接口 =====

export interface StatBonus {
  stat: string;
  modType: ModType;
  min: number;
  max: number;
  rolled?: number;
}

export interface Affix {
  id: string;
  name: string;
  category: AffixCategory;
  tags: string[];
  tier: number;
  itemLevelReq: number;
  stats: StatBonus[];
}

export interface Socket {
  color: GemColor;
  gemId: string | null;
  linkedTo: number[];
}

export interface BaseItem {
  id: string;
  name: string;
  type: string;
  slot: EquipSlot;
  implicit: StatBonus[];
  sockets: { min: number; max: number };
  requiredStats: Partial<Record<string, number>>;
  tags: string[];
  levelReq: number;
}

export interface Item {
  id: string;
  name: string;
  baseId: string;
  slot: EquipSlot;
  rarity: Rarity;
  itemLevel: number;
  implicit: Affix[];
  prefixes: Affix[];
  suffixes: Affix[];
  sockets: Socket[];
  quality: number;
}

export interface Currency {
  id: string;
  name: string;
  description: string;
  effect: CurrencyEffect;
}

export type CurrencyEffect =
  | { type: "upgrade_rarity" }
  | { type: "reforge_rare" }
  | { type: "reforge_magic" }
  | { type: "add_prefix" }
  | { type: "add_suffix" }
  | { type: "annul" }
  | { type: "exalt" }
  | { type: "scour" }
  | { type: "quality"; amount: number }
  | { type: "socket" }
  | { type: "link" }
  | { type: "color" }
  | { type: "divine" }
  | { type: "alchemy" }
  | { type: "identify" }
  | { type: "regret" }
  | { type: "portal" }
  | { type: "mirror" }
  | { type: "chance" };

export interface Gem {
  id: string;
  name: string;
  type: GemType;
  color: GemColor;
  level: number;
  experience: number;
  /** 达到此等级所需的累计经验由宝石系统计算 */
  requiredLevel: number;
  active?: ActiveSkill;
  support?: SupportEffect;
}

export interface ActiveSkill {
  baseDamage: StatBonus[];
  tags: string[];
  damageType: DamageType;
  manaCost: number;
  castTime: number;
  description: string;
}

export interface SupportEffect {
  multiplier: number;
  addedTags: string[];
  specialEffect?: string;
  excludesTags: string[];
}

export interface SkillGroup {
  id: string;
  name: string;
  activeGem: Gem;
  supportGems: Gem[];
}

export interface PassiveNode {
  id: string;
  name: string;
  type: "normal" | "notable" | "keystone" | "ascendancy";
  x: number;
  y: number;
  connections: string[];
  stats: StatBonus[];
  requires: string[];
  allocated: boolean;
}

export interface Player {
  name: string;
  level: number;
  experience: number;
  stats: {
    strength: number;
    dexterity: number;
    intelligence: number;
  };
  life: number;
  maxLife: number;
  mana: number;
  maxMana: number;
  manaReserved: number;
  energyShield: number;
  defenses: {
    armor: number;
    evasion: number;
    energyShield: number;
    fireRes: number;
    coldRes: number;
    lightningRes: number;
    chaosRes: number;
    blockChance: number;
  };
  offense: {
    increasedDamage: number;
    moreDamage: number;
    attackSpeed: number;
    critChance: number;
    critMultiplier: number;
    accuracy: number;
  };
  passivePoints: number;
  allocatedNodes: string[];
  equipment: Partial<Record<EquipSlot, Item>>;
  skillGroups: SkillGroup[];
  flasks: (Flask | null)[];
  inventory: Inventory;
}

export interface Inventory {
  items: Item[];
  gems: Gem[];
  currencies: Map<string, number>;
  maxSlots: number;
}

export interface MapMod {
  id: string;
  name: string;
  description: string;
  effects: { stat: string; modType: ModType; value: number }[];
}

export interface GameMap {
  id: string;
  name: string;
  tier: number;
  baseLevel: number;
  mods: MapMod[];
  completed: boolean;
}

export interface Monster {
  id: string;
  name: string;
  level: number;
  life: number;
  maxLife: number;
  damage: StatBonus[];
  damageType: DamageType;
  attackSpeed: number;
  accuracy: number;
  armor: number;
  evasion: number;
  resistances: {
    fire: number;
    cold: number;
    lightning: number;
    chaos: number;
  };
}
