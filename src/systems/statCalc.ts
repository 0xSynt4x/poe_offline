import { Player, StatBreakdown, StatSource, StatSourceDetail, EquipSlot } from "../models/types";
import { calculateItemStats } from "./affix";
import { calculatePassiveModifiers } from "../data/passiveTree";

/** Slot display names for tooltip */
const SLOT_NAMES: Record<string, string> = {
  [EquipSlot.Weapon]: "武器",
  [EquipSlot.Offhand]: "副手",
  [EquipSlot.Helmet]: "头盔",
  [EquipSlot.Body]: "胸甲",
  [EquipSlot.Gloves]: "手套",
  [EquipSlot.Boots]: "鞋子",
  [EquipSlot.Belt]: "腰带",
  [EquipSlot.Amulet]: "项链",
  [EquipSlot.Ring1]: "戒指1",
  [EquipSlot.Ring2]: "戒指2",
};

/**
 * Build a StatSource with optional more/increased split and detail lines.
 */
function src(
  base: number,
  equip: number,
  passive: number,
  opts?: {
    increased?: number;
    more?: number;
    details?: StatSourceDetail[];
  },
): StatSource {
  const total = base + equip + passive;
  return {
    base,
    equipment: equip,
    passive,
    total,
    ...(opts?.increased !== undefined ? { increased: opts.increased } : {}),
    ...(opts?.more !== undefined ? { more: opts.more } : {}),
    ...(opts?.details ? { details: opts.details } : {}),
  };
}

// Helper to build detail list from item stats map
function buildItemDetails(
  equipment: Partial<Record<EquipSlot, import("../models/types").Item | null>>,
  key: string,
  label: string,
): StatSourceDetail[] {
  const details: StatSourceDetail[] = [];
  for (const [slot, item] of Object.entries(equipment)) {
    if (!item) continue;
    const stats = calculateItemStats(item);
    const val = (stats as Record<string, number>)[key] ?? 0;
    if (val !== 0) {
      details.push({ label: `${SLOT_NAMES[slot] || slot} ${item.name}`, value: val, type: "equipment" });
    }
  }
  return details;
}

/**
 * Full stat breakdown for the right panel.
 * Separates base / equipment / passive contributions for every displayed stat.
 * Now also tracks increased vs more, and per-item detail lines for hover tooltips.
 */
export function calculateStatBreakdown(player: Player): StatBreakdown {
  const passive = calculatePassiveModifiers(player.allocatedNodes);
  const pv = (stat: string, type: "flat" | "increased" | "more"): number =>
    passive[stat]?.[type] || 0;

  // --- Per-slot equipment totals (for detail tracking) ---
  let eqArmor = 0, eqEvasion = 0, eqES = 0;
  let eqFireRes = 0, eqColdRes = 0, eqLightRes = 0, eqChaosRes = 0;
  let eqDamage = 0, eqAtkSpd = 0, eqCrit = 0;
  let eqStr = 0, eqDex = 0, eqInt = 0;
  let eqFlatLife = 0, eqPctLife = 0;
  let eqFlatMana = 0, eqPctMana = 0;
  let eqPctArmor = 0, eqPctEvasion = 0, eqPctES = 0;

  for (const item of Object.values(player.equipment)) {
    if (!item) continue;
    const stats = calculateItemStats(item);
    const entries = Object.entries(stats) as [string, number][];
    for (const [key, value] of entries) {
      switch (key) {
        case "armor": eqArmor += value; break;
        case "percentArmor": eqPctArmor += value; break;
        case "evasion": eqEvasion += value; break;
        case "percentEvasion": eqPctEvasion += value; break;
        case "energyShield": eqES += value; break;
        case "percentEs": eqPctES += value; break;
        case "fireResistance": eqFireRes += value; break;
        case "coldResistance": eqColdRes += value; break;
        case "lightningResistance": eqLightRes += value; break;
        case "chaosResistance": eqChaosRes += value; break;
        case "physicalDamage": eqDamage += value; break;
        case "flatAttackDamage": case "flatElementalDamage": case "flatSpellDamage": case "percentPhysWeapon": eqDamage += value; break;
        case "attackSpeed": eqAtkSpd += value; break;
        case "critChance": eqCrit += value; break;
        case "strength": eqStr += value; break;
        case "dexterity": eqDex += value; break;
        case "intelligence": eqInt += value; break;
        case "maxLife": eqFlatLife += value; break;
        case "percentLife": eqPctLife += value; break;
        case "maxMana": eqFlatMana += value; break;
        case "percentMana": eqPctMana += value; break;
      }
    }
  }

  // --- Level-based bases (mirrors recalculatePlayerStats) ---
  const ld = Math.max(0, player.level - 10);
  const baseLife = 500 + ld * 20;
  const baseMana = 100 + ld * 10;

  const lifeMore = 1 + pv("maxLife", "more") / 100;
  const manaMore = 1 + pv("maxMana", "more") / 100;
  const totalMaxLife = Math.max(1, Math.floor(
    (baseLife + eqFlatLife + pv("maxLife", "flat")) *
    (1 + (eqPctLife + pv("maxLife", "increased")) / 100) * lifeMore
  ));
  const totalMaxMana = Math.max(1, Math.floor(
    (baseMana + eqFlatMana + pv("maxMana", "flat")) *
    (1 + (eqPctMana + pv("maxMana", "increased")) / 100) * manaMore
  ));
  const totalArmor = Math.floor(
    (100 + eqArmor) * (1 + (eqPctArmor + pv("armor", "increased")) / 100) *
    (1 + pv("armor", "more") / 100)
  );
  const totalEvasion = Math.floor(
    (50 + eqEvasion) * (1 + (eqPctEvasion + pv("evasion", "increased")) / 100) *
    (1 + pv("evasion", "more") / 100)
  );
  const totalES = Math.floor(
    eqES * (1 + (eqPctES + pv("energyShield", "increased")) / 100) *
    (1 + pv("energyShield", "more") / 100)
  );
  const totalFireRes = eqFireRes;
  const totalColdRes = eqColdRes;
  const totalLightRes = eqLightRes;
  const totalChaosRes = -30 + eqChaosRes;
  const totalDamage = eqDamage + pv("physicalDamage", "increased") +
    pv("spellDamage", "increased") + pv("elementalDamage", "increased");
  const totalAtkSpd = 1 + (eqAtkSpd + pv("attackSpeed", "increased")) / 100;
  const totalCrit = 5 + eqCrit + pv("critChance", "increased");
  const totalStr = 30 + eqStr + pv("strength", "flat");
  const totalDex = 20 + eqDex + pv("dexterity", "flat");
  const totalInt = 15 + eqInt + pv("intelligence", "flat");

  // --- Build detail lists for key stats ---
  const lifeEquipFlat = eqFlatLife;
  const lifeEquipPct = Math.floor(baseLife * eqPctLife / 100 * lifeMore);
  const lifePassiveFlat = pv("maxLife", "flat");
  const lifePassivePct = Math.floor(baseLife * pv("maxLife", "increased") / 100 * lifeMore);
  const lifePassiveMore = pv("maxLife", "more");
  const lifeDetails: StatSourceDetail[] = [
    { label: "等级基础", value: baseLife, type: "base" },
    ...buildItemDetails(player.equipment, "maxLife", "+生命"),
  ];
  if (lifePassiveFlat > 0) lifeDetails.push({ label: "天赋 +生命", value: lifePassiveFlat, type: "passive" });
  if (pv("maxLife", "increased") > 0) lifeDetails.push({ label: `天赋 +${pv("maxLife", "increased")}% 生命`, value: pv("maxLife", "increased"), type: "passive" });
  if (lifeMore > 1) lifeDetails.push({ label: `天赋 more ${((lifeMore - 1) * 100).toFixed(0)}%`, value: lifeMore - 1, type: "more" });

  const manaDetails: StatSourceDetail[] = [
    { label: "等级基础", value: baseMana, type: "base" },
    ...buildItemDetails(player.equipment, "maxMana", "+魔力"),
  ];
  if (pv("maxMana", "flat") > 0) manaDetails.push({ label: "天赋 +魔力", value: pv("maxMana", "flat"), type: "passive" });
  if (pv("maxMana", "more") > 0) manaDetails.push({ label: `天赋 more ${pv("maxMana", "more")}%`, value: pv("maxMana", "more"), type: "more" });

  const armorDetails: StatSourceDetail[] = [
    { label: "基础护甲", value: 100, type: "base" },
    ...buildItemDetails(player.equipment, "armor", "+护甲"),
  ];
  if (pv("armor", "increased") > 0) armorDetails.push({ label: `天赋 +${pv("armor", "increased")}%`, value: pv("armor", "increased"), type: "passive" });
  if (pv("armor", "more") > 0) armorDetails.push({ label: `天赋 more ${pv("armor", "more")}%`, value: pv("armor", "more"), type: "more" });

  const evasionDetails: StatSourceDetail[] = [
    { label: "基础闪避", value: 50, type: "base" },
    ...buildItemDetails(player.equipment, "evasion", "+闪避"),
  ];
  if (pv("evasion", "increased") > 0) evasionDetails.push({ label: `天赋 +${pv("evasion", "increased")}%`, value: pv("evasion", "increased"), type: "passive" });

  const esDetails: StatSourceDetail[] = [
    ...buildItemDetails(player.equipment, "energyShield", "+能量护盾"),
  ];
  if (pv("energyShield", "increased") > 0) esDetails.push({ label: `天赋 +${pv("energyShield", "increased")}%`, value: pv("energyShield", "increased"), type: "passive" });

  const fireResDetails: StatSourceDetail[] = buildItemDetails(player.equipment, "fireResistance", "+火抗");
  const coldResDetails: StatSourceDetail[] = buildItemDetails(player.equipment, "coldResistance", "+冰抗");
  const lightResDetails: StatSourceDetail[] = buildItemDetails(player.equipment, "lightningResistance", "+雷抗");
  const chaosResDetails: StatSourceDetail[] = [
    { label: "基础 (负抗)", value: -30, type: "base" },
    ...buildItemDetails(player.equipment, "chaosResistance", "+混抗"),
  ];

  const increasedPvDmg = pv("physicalDamage", "increased") + pv("spellDamage", "increased") + pv("elementalDamage", "increased");
  const damageDetails: StatSourceDetail[] = [
    ...buildItemDetails(player.equipment, "physicalDamage", "+物理伤害"),
    ...buildItemDetails(player.equipment, "flatAttackDamage", "+攻击伤害"),
    ...buildItemDetails(player.equipment, "flatElementalDamage", "+元素伤害"),
    ...buildItemDetails(player.equipment, "flatSpellDamage", "+法术伤害"),
    ...buildItemDetails(player.equipment, "percentPhysWeapon", "%物理伤害"),
  ];
  if (increasedPvDmg > 0) damageDetails.push({ label: `天赋 +${increasedPvDmg}% 伤害`, value: increasedPvDmg, type: "passive" });

  const atkSpdDetails: StatSourceDetail[] = buildItemDetails(player.equipment, "attackSpeed", "+攻速");
  if (pv("attackSpeed", "increased") > 0) atkSpdDetails.push({ label: `天赋 +${pv("attackSpeed", "increased")}%`, value: pv("attackSpeed", "increased"), type: "passive" });

  const critDetails: StatSourceDetail[] = [
    { label: "基础", value: 5, type: "base" },
    ...buildItemDetails(player.equipment, "critChance", "+暴击率"),
  ];
  if (pv("critChance", "increased") > 0) critDetails.push({ label: `天赋 +${pv("critChance", "increased")}%`, value: pv("critChance", "increased"), type: "passive" });

  const strDetails: StatSourceDetail[] = [
    { label: "基础", value: 30, type: "base" },
    ...buildItemDetails(player.equipment, "strength", "+力量"),
  ];
  if (pv("strength", "flat") > 0) strDetails.push({ label: "天赋 +力量", value: pv("strength", "flat"), type: "passive" });

  const dexDetails: StatSourceDetail[] = [
    { label: "基础", value: 20, type: "base" },
    ...buildItemDetails(player.equipment, "dexterity", "+敏捷"),
  ];
  if (pv("dexterity", "flat") > 0) dexDetails.push({ label: "天赋 +敏捷", value: pv("dexterity", "flat"), type: "passive" });

  const intDetails: StatSourceDetail[] = [
    { label: "基础", value: 15, type: "base" },
    ...buildItemDetails(player.equipment, "intelligence", "+智慧"),
  ];
  if (pv("intelligence", "flat") > 0) intDetails.push({ label: "天赋 +智慧", value: pv("intelligence", "flat"), type: "passive" });

  return {
    stats: {
      strength:     src(30, eqStr, pv("strength", "flat"), { details: strDetails }),
      dexterity:    src(20, eqDex, pv("dexterity", "flat"), { details: dexDetails }),
      intelligence: src(15, eqInt, pv("intelligence", "flat"), { details: intDetails }),
    },
    defensive: {
      life:         src(baseLife, eqFlatLife + lifeEquipPct + lifePassiveFlat + lifePassivePct, 0, { more: lifeMore, details: lifeDetails }),
      mana:         src(baseMana, eqFlatMana + Math.floor(baseMana * eqPctMana / 100 * manaMore) + Math.floor(pv("maxMana", "flat") * manaMore), 0, { more: manaMore, details: manaDetails }),
      armor:        src(100, totalArmor - 100, 0, { increased: eqPctArmor + pv("armor", "increased"), more: pv("armor", "more"), details: armorDetails }),
      evasion:      src(50, totalEvasion - 50, 0, { increased: eqPctEvasion + pv("evasion", "increased"), more: pv("evasion", "more"), details: evasionDetails }),
      energyShield: src(0, totalES, 0, { increased: eqPctES + pv("energyShield", "increased"), more: pv("energyShield", "more"), details: esDetails }),
      fireRes:      src(0, totalFireRes, 0, { details: fireResDetails }),
      coldRes:      src(0, totalColdRes, 0, { details: coldResDetails }),
      lightningRes: src(0, totalLightRes, 0, { details: lightResDetails }),
      chaosRes:     src(-30, eqChaosRes, 0, { details: chaosResDetails }),
      blockChance:  src(0, 0, 0),
    },
    offensive: {
      increasedDamage: src(0, totalDamage, 0, { increased: increasedPvDmg, details: damageDetails }),
      attackSpeed:     src(1, totalAtkSpd - 1, 0, { increased: eqAtkSpd + pv("attackSpeed", "increased"), details: atkSpdDetails }),
      critChance:      src(5, totalCrit - 5, 0, { increased: eqCrit + pv("critChance", "increased"), details: critDetails }),
      critMultiplier:  src(150, 0, 0),
      accuracy:        src(100, 0, 0),
    },
  };
}
