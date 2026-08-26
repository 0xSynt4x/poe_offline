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
  /** Raw stat text from PoE (e.g. "14% increased Evasion Rating") */
  displayStats?: string[];
  /** Ascendancy class name (e.g. "Juggernaut") */
  ascendancyName?: string;
  /** Flavor text for keystones */
  flavourText?: string[];
  /** Stats granted directly by this node (e.g. +40 Str) */
  grantedStats?: Record<string, number>;
  /** Whether this is a jewel socket node */
  isJewelSocket?: boolean;
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
  statBreakdown?: StatBreakdown;
}

export type StashCategory = "general" | "equipment" | "currency";

export interface Stash {
  items: Item[];
  gems: Gem[];
  currencies: Map<string, number>;
  maxSlots: number;
}

export interface Inventory {
  items: Item[];
  gems: Gem[];
  currencies: Map<string, number>;
  maxSlots: number;
  stash?: Stash;
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
  abilities?: string[];
}

// ===== 属性来源拆解 =====

export interface StatSource {
  base: number;
  equipment: number;
  passive: number;
  total: number;
  /** more 乘率（1.0 = 无额外乘率，如 1.2 表示 20% more） */
  more?: number;
  /** increased 叠加值（装备+天赋的 increased 之和） */
  increased?: number;
  /** 悬停详情：各来源逐条说明 */
  details?: StatSourceDetail[];
}

/** 属性来源单条明细（用于 hover 提示） */
export interface StatSourceDetail {
  label: string;
  value: number;
  type: "base" | "equipment" | "passive" | "more" | "flask";
}

export interface DefensiveStats {
  life: StatSource;
  mana: StatSource;
  armor: StatSource;
  evasion: StatSource;
  energyShield: StatSource;
  fireRes: StatSource;
  coldRes: StatSource;
  lightningRes: StatSource;
  chaosRes: StatSource;
  blockChance: StatSource;
}

export interface OffensiveStats {
  increasedDamage: StatSource;
  attackSpeed: StatSource;
  critChance: StatSource;
  critMultiplier: StatSource;
  accuracy: StatSource;
}

export interface StatBreakdown {
  defensive: DefensiveStats;
  offensive: OffensiveStats;
  stats: {
    strength: StatSource;
    dexterity: StatSource;
    intelligence: StatSource;
  };
}

// ===== DPS 拆解 =====

export interface DpsBreakdown {
  skillName: string;
  totalDps: number;
  baseDamage: number;
  effectiveSpeed: number;
  critChance: number;
  critMultiplier: number;
  critDpsMultiplier: number;
  nonCritDps: number;
  critDps: number;
  damageType: DamageType;
  penetration: { fire: number; cold: number; lightning: number; chaos: number };
  /** 各元素伤害占比 */
  elementDistribution: { type: DamageType; amount: number; percent: number }[];
  /** 暴击时每击伤害 */
  critHitDamage: number;
  /** 非暴击时每击伤害 */
  nonCritHitDamage: number;
}

// ===== 药剂效果描述 =====

export interface FlaskBonusDisplay {
  flaskName: string;
  flaskType: FlaskType;
  isUtility: boolean;
  bonuses: { label: string; value: string }[];
  active: boolean;
  charges: number;
  maxCharges: number;
}
