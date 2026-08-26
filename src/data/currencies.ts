import { Currency } from "../models/types";

export const CURRENCIES: Currency[] = [
  // 常见通货
  {
    id: "orb_of_alteration",
    name: "点金石",
    description: "重掷一件魔法装备的词缀",
    effect: { type: "reforge_magic" },
  },
  {
    id: "orb_of_augmentation",
    name: "附魔石",
    description: "为一件魔法装备添加一条随机词缀",
    effect: { type: "add_prefix" },
  },
  {
    id: "scroll_of_wisdom",
    name: "鉴定卷轴",
    description: "鉴定一件未鉴定的装备",
    effect: { type: "identify" },
  },
  {
    id: "orb_of_scouring",
    name: "淬火石",
    description: "将一件装备清除为白色（普通）",
    effect: { type: "scour" },
  },
  {
    id: "blacksmith_whetstone",
    name: "磨刀石",
    description: "增加武器品质 +5%",
    effect: { type: "quality", amount: 5 },
  },
  {
    id: "armourers_scrap",
    name: "护甲片",
    description: "增加护甲品质 +5%",
    effect: { type: "quality", amount: 5 },
  },
  {
    id: "chromatic_orb",
    name: "变色石",
    description: "随机改变装备插槽颜色",
    effect: { type: "color" },
  },

  // 稀有通货
  {
    id: "orb_of_alchemy",
    name: "炼金石",
    description: "将一件普通装备升级为稀有装备",
    effect: { type: "alchemy" },
  },
  {
    id: "orb_of_regret",
    name: "悔恨石",
    description: "返还一个已分配的天赋点",
    effect: { type: "regret" },
  },
  {
    id: "regal_orb",
    name: "升华石",
    description: "将一件魔法装备升级为稀有装备，并添加一条新词缀",
    effect: { type: "upgrade_rarity" },
  },
  {
    id: "chaos_orb",
    name: "混沌石",
    description: "重掷一件稀有装备的全部词缀",
    effect: { type: "reforge_rare" },
  },
  {
    id: "divine_orb",
    name: "精炼石",
    description: "重roll词缀数值（不改变词缀本身）",
    effect: { type: "divine" },
  },
  {
    id: "jewellers_orb",
    name: "工匠石",
    description: "随机改变装备的插槽数量",
    effect: { type: "socket" },
  },
  {
    id: "orb_of_fusing",
    name: "链接石",
    description: "随机改变装备插槽的连接方式",
    effect: { type: "link" },
  },
  {
    id: "orb_of_portal",
    name: "传送卷轴",
    description: "传送回城镇",
    effect: { type: "portal" },
  },
  {
    id: "mirror_of_kalandra",
    name: "卡兰德之镜",
    description: "复制一件装备的词缀到另一件装备",
    effect: { type: "mirror" },
  },
  {
    id: "orb_of_chance",
    name: "机会石",
    description: "将一件白色装备随机变为魔法/稀有/独特品质",
    effect: { type: "chance" },
  },

  // 传说通货
  {
    id: "exalted_orb",
    name: "崇高石",
    description: "为一件稀有装备添加一条高阶随机词缀",
    effect: { type: "exalt" },
  },
  {
    id: "orb_of_annulment",
    name: "抹除石",
    description: "随机移除一件装备的一条词缀",
    effect: { type: "annul" },
  },
];

// 按ID查找通货
export function getCurrencyById(id: string): Currency | undefined {
  return CURRENCIES.find((c) => c.id === id);
}

// 常见通货ID列表
export const COMMON_CURRENCY = [
  "scroll_of_wisdom",
  "orb_of_alteration",
  "orb_of_augmentation",
  "orb_of_scouring",
  "blacksmith_whetstone",
  "armourers_scrap",
  "chromatic_orb",
  "orb_of_portal",
];

// 稀有通货ID列表
export const RARE_CURRENCY = [
  "orb_of_alchemy",
  "orb_of_regret",
  "regal_orb",
  "chaos_orb",
  "divine_orb",
  "jewellers_orb",
  "orb_of_fusing",
  "orb_of_chance",
];

// 传说通货ID列表
export const LEGENDARY_CURRENCY = ["exalted_orb", "orb_of_annulment", "mirror_of_kalandra"];


