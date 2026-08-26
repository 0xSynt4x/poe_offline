import { Flask, FlaskType, UtilityFlaskEffect } from "../models/types";

export const FLASK_SLOT_COUNT = 5;

export interface FlaskDefinition {
  id: string;
  name: string;
  type: FlaskType;
  description: string;
  maxCharges: number;
  chargesPerUse: number;
  effect: Flask["effect"];
}

const FLASK_DEFINITIONS: FlaskDefinition[] = [
  {
    id: "small_life_flask",
    name: "小型生命药剂",
    type: "life",
    description: "立即恢复 35% 最大生命",
    maxCharges: 30,
    chargesPerUse: 10,
    effect: { type: "life", amountPercent: 35 },
  },
  {
    id: "large_life_flask",
    name: "强效生命药剂",
    type: "life",
    description: "立即恢复 55% 最大生命",
    maxCharges: 20,
    chargesPerUse: 10,
    effect: { type: "life", amountPercent: 55 },
  },
  {
    id: "sapphire_mana_flask",
    name: "蓝玉魔力药剂",
    type: "mana",
    description: "立即恢复 45% 最大魔力",
    maxCharges: 30,
    chargesPerUse: 10,
    effect: { type: "mana", amountPercent: 45 },
  },
  {
    id: "granite_flask",
    name: "坚岩药剂",
    type: "utility",
    description: "3 回合内护甲提高 50%",
    maxCharges: 30,
    chargesPerUse: 10,
    effect: { type: "utility", utility: "guard", value: 50, duration: 3 },
  },
  {
    id: "quicksilver_flask",
    name: "水银药剂",
    type: "utility",
    description: "3 回合内行动速度提高 35%",
    maxCharges: 30,
    chargesPerUse: 10,
    effect: { type: "utility", utility: "haste", value: 35, duration: 3 },
  },
];

function cloneDefinition(definition: FlaskDefinition): Flask {
  return {
    ...definition,
    charges: definition.maxCharges,
    effect: { ...definition.effect } as Flask["effect"],
  };
}

export function getFlaskDefinition(id: string): FlaskDefinition | undefined {
  return FLASK_DEFINITIONS.find((definition) => definition.id === id);
}

export function createDefaultFlasks(): Flask[] {
  return FLASK_DEFINITIONS.map(cloneDefinition);
}

export function restoreFlasks(raw: unknown): (Flask | null)[] {
  if (!Array.isArray(raw) || raw.length === 0) return createDefaultFlasks();

  return Array.from({ length: FLASK_SLOT_COUNT }, (_, index) => {
    const saved = raw[index] as Partial<Flask> | null | undefined;
    if (!saved) return null;

    const definition = getFlaskDefinition(saved.id || "");
    if (!definition) return null;

    return {
      ...cloneDefinition(definition),
      charges: Math.max(0, Math.min(definition.maxCharges, Number(saved.charges) || 0)),
    };
  });
}

export function getFlaskTypeLabel(type: FlaskType): string {
  const labels: Record<FlaskType, string> = {
    life: "生命",
    mana: "魔力",
    utility: "功能",
  };
  return labels[type];
}

export function getUtilityLabel(effect: UtilityFlaskEffect["utility"]): string {
  const labels: Record<UtilityFlaskEffect["utility"], string> = {
    offense: "伤害",
    guard: "护甲",
    haste: "速度",
  };
  return labels[effect];
}
