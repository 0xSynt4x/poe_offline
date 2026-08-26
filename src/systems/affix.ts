import {
  Affix,
  AffixCategory,
  Item,
  Rarity,
  Socket,
  GemColor,
  ModType,
  BaseItem,
  StatBonus,
} from "../models/types";
import { PREFIX_POOL, SUFFIX_POOL, IMPLICIT_POOL, AffixData } from "../data/affixes";
import { ALL_BASES } from "../data/bases";
import { createSockets, rerollSocketColors, getLinkDisplayString, getSocketStats, getColorEmoji } from "./socket";

// 工具函数：随机整数
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 工具函数：按权重随机选择
function weightedRandom<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  
  return items[items.length - 1];
}

// 工具函数：生成唯一ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// ===== 词缀Roll =====

export function rollAffix(
  category: AffixCategory,
  tags: string[],
  itemLevel: number,
  existingAffixes: Affix[] = []
): Affix | null {
  const pool = category === AffixCategory.Prefix ? PREFIX_POOL : SUFFIX_POOL;
  
  // 过滤符合条件的词缀
  const validAffixes = pool.filter((affixData) => {
    // 标签匹配
    const hasTag = tags.some((t) => affixData.tags.includes(t));
    // 物品等级符合
    const hasValidTier = affixData.tiers.some((t) => itemLevel >= t.itemLevelReq);
    // 不重复
    const isDuplicate = existingAffixes.some((e) => e.id === affixData.id);
    
    return hasTag && hasValidTier && !isDuplicate;
  });
  
  if (validAffixes.length === 0) return null;
  
  // 按权重随机选择词缀
  const affixData = weightedRandom(
    validAffixes,
    validAffixes.map((a) => {
      // 取最高可用tier的权重
      const maxTier = a.tiers
        .filter((t) => itemLevel >= t.itemLevelReq)
        .sort((a, b) => a.tier - b.tier)[0];
      return maxTier?.weight || 100;
    })
  );
  
  // 确定tier
  const availableTiers = affixData.tiers
    .filter((t) => itemLevel >= t.itemLevelReq)
    .sort((a, b) => a.tier - b.tier);
  
  const tier = weightedRandom(
    availableTiers,
    availableTiers.map((t) => t.weight)
  );
  
  // Roll数值
  const rolledValue = randomInt(tier.min, tier.max);
  
  return {
    id: affixData.id,
    name: affixData.name,
    category: affixData.category,
    tags: affixData.tags,
    tier: tier.tier,
    itemLevelReq: tier.itemLevelReq,
    stats: [
      {
        stat: affixData.id.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
        modType: tier.modType,
        min: tier.min,
        max: tier.max,
        rolled: rolledValue,
      },
    ],
  };
}

// ===== 装备生成 =====

export function generateItem(
  base: BaseItem,
  itemLevel: number,
  rarity: Rarity
): Item {
  // 使用新的Socket系统生成孔和链接
  const sockets = createSockets(base.type, itemLevel, base.sockets);
  
  // 获取基底固有属性
  const implicitData = IMPLICIT_POOL[base.id] || [];
  const implicit: Affix[] = implicitData.map((stat) => ({
    id: `implicit_${stat.stat}`,
    name: "固有",
    category: AffixCategory.Prefix,
    tags: ["implicit"],
    tier: 1,
    itemLevelReq: 1,
    stats: [
      {
        ...stat,
        rolled: randomInt(stat.min, stat.max),
      },
    ],
  }));
  
  // 根据稀有度roll词缀
  let prefixes: Affix[] = [];
  let suffixes: Affix[] = [];
  
  if (rarity === Rarity.Normal) {
    // 白色装备无词缀
  } else if (rarity === Rarity.Magic) {
    // 蓝色：随机 0-1 前缀 + 0-1 后缀，至少1条
    if (Math.random() < 0.6) {
      const affix = rollAffix(AffixCategory.Prefix, base.tags || [], itemLevel);
      if (affix) prefixes.push(affix);
    }
    if (Math.random() < 0.6) {
      const affix = rollAffix(AffixCategory.Suffix, base.tags || [], itemLevel);
      if (affix) suffixes.push(affix);
    }
    // 确保至少有1条
    if (prefixes.length === 0 && suffixes.length === 0) {
      if (Math.random() < 0.5) {
        const affix = rollAffix(AffixCategory.Prefix, base.tags || [], itemLevel);
        if (affix) prefixes.push(affix);
      } else {
        const affix = rollAffix(AffixCategory.Suffix, base.tags || [], itemLevel);
        if (affix) suffixes.push(affix);
      }
    }
  } else if (rarity === Rarity.Rare) {
    // 黄色：1-3前缀 + 1-3后缀
    const prefixCount = randomInt(1, 3);
    const suffixCount = randomInt(1, 3);
    
    for (let i = 0; i < prefixCount; i++) {
      const affix = rollAffix(AffixCategory.Prefix, base.tags || [], itemLevel, prefixes);
      if (affix) prefixes.push(affix);
    }
    
    for (let i = 0; i < suffixCount; i++) {
      const affix = rollAffix(AffixCategory.Suffix, base.tags || [], itemLevel, suffixes);
      if (affix) suffixes.push(affix);
    }
  }
  
  return {
    id: generateId(),
    name: generateItemName(rarity, base.name, prefixes, suffixes),
    baseId: base.id,
    slot: base.slot,
    rarity,
    itemLevel,
    implicit,
    prefixes,
    suffixes,
    sockets,
    quality: 0,
  };
}

// 生成物品名称
function generateItemName(
  rarity: Rarity,
  baseName: string,
  prefixes: Affix[],
  suffixes: Affix[]
): string {
  if (rarity === Rarity.Normal) {
    return baseName;
  }
  
  if (rarity === Rarity.Magic) {
    const prefix = prefixes[0]?.name || "";
    const suffix = suffixes[0]?.name || "";
    return `${prefix}${baseName}${suffix}`.trim();
  }
  
  if (rarity === Rarity.Rare) {
    // 黄色装备使用随机名称
    const rarePrefixes = ["复仇", "毁灭", "神圣", "黑暗", "永恒", "混沌", "元素", "钢铁", "血", "灵魂"];
    const rareSuffixes = ["之刃", "之心", "之触", "之怒", "之息", "之歌", "之环", "之冠"];
    const prefix = rarePrefixes[randomInt(0, rarePrefixes.length - 1)];
    const suffix = rareSuffixes[randomInt(0, rareSuffixes.length - 1)];
    return `${prefix}${suffix}`;
  }
  
  return baseName;
}

// ===== 通货系统 =====

function rebuildSocketLinks(socketCount: number): number[][] {
  if (socketCount <= 0) return [];
  if (socketCount === 1) return [[0]];
  const links: number[][] = [];
  let group = [0];
  for (let index = 0; index < socketCount - 1; index += 1) {
    const chance = group.length >= 5 ? 0.01 : group.length >= 4 ? 0.05 : group.length >= 3 ? 0.15 : group.length >= 2 ? 0.3 : 0.6;
    if (Math.random() < chance) group.push(index + 1);
    else { links.push(group); group = [index + 1]; }
  }
  links.push(group);
  return links;
}

export function applyCurrency(item: Item, currencyEffect: string): Item {
  const newItem: Item = {
    ...item,
    implicit: item.implicit.map((affix) => ({ ...affix, stats: affix.stats.map((stat) => ({ ...stat })) })),
    prefixes: item.prefixes.map((affix) => ({ ...affix, stats: affix.stats.map((stat) => ({ ...stat })) })),
    suffixes: item.suffixes.map((affix) => ({ ...affix, stats: affix.stats.map((stat) => ({ ...stat })) })),
    sockets: item.sockets.map((socket) => ({ ...socket, linkedTo: [...socket.linkedTo] })),
  };
  
  // 从基底数据获取实际标签，而非硬编码
  const baseData = ALL_BASES.find((b) => b.id === newItem.baseId);
  const tags = baseData?.tags ?? [];
  
  switch (currencyEffect) {
    case "scour":
      // 淬火石：清除所有词缀
      newItem.prefixes = [];
      newItem.suffixes = [];
      newItem.rarity = Rarity.Normal;
      break;
      
    case "reforge_magic":
      // 点金石：重roll魔法装备
      if (newItem.rarity === Rarity.Magic) {
        newItem.prefixes = [];
        newItem.suffixes = [];
        // 重新roll
        const affix1 = rollAffix(AffixCategory.Prefix, tags, newItem.itemLevel);
        const affix2 = rollAffix(AffixCategory.Suffix, tags, newItem.itemLevel);
        if (affix1) newItem.prefixes.push(affix1);
        if (affix2) newItem.suffixes.push(affix2);
      }
      break;
      
    case "reforge_rare":
      // 混沌石：重roll稀有装备
      if (newItem.rarity === Rarity.Rare) {
        newItem.prefixes = [];
        newItem.suffixes = [];
        for (let i = 0; i < randomInt(1, 3); i++) {
          const affix = rollAffix(AffixCategory.Prefix, tags, newItem.itemLevel);
          if (affix) newItem.prefixes.push(affix);
        }
        for (let i = 0; i < randomInt(1, 3); i++) {
          const affix = rollAffix(AffixCategory.Suffix, tags, newItem.itemLevel);
          if (affix) newItem.suffixes.push(affix);
        }
      }
      break;
      
    case "upgrade_rarity":
      // 升华石：魔法变稀有
      if (newItem.rarity === Rarity.Magic) {
        newItem.rarity = Rarity.Rare;
        // 添加一条新词缀
        const newAffix = rollAffix(
          Math.random() < 0.5 ? AffixCategory.Prefix : AffixCategory.Suffix,
          tags,
          newItem.itemLevel,
          [...newItem.prefixes, ...newItem.suffixes]
        );
        if (newAffix) {
          if (newAffix.category === AffixCategory.Prefix) {
            newItem.prefixes.push(newAffix);
          } else {
            newItem.suffixes.push(newAffix);
          }
        }
      }
      break;
      
    case "alchemy":
      // 炼金石：将普通装备升级为稀有装备
      if (newItem.rarity === Rarity.Normal) {
        newItem.rarity = Rarity.Rare;
        const prefixCount = randomInt(1, 3);
        const suffixCount = randomInt(1, 3);
        for (let i = 0; i < prefixCount; i++) {
          const affix = rollAffix(AffixCategory.Prefix, tags, newItem.itemLevel, newItem.prefixes);
          if (affix) newItem.prefixes.push(affix);
        }
        for (let i = 0; i < suffixCount; i++) {
          const affix = rollAffix(AffixCategory.Suffix, tags, newItem.itemLevel, newItem.suffixes);
          if (affix) newItem.suffixes.push(affix);
        }
      }
      break;
      
    case "identify":
      // 鉴定卷轴：鉴定未鉴定物品（当前游戏无unidentified概念，此通货暂为占位）
      // 未来实现未鉴定掉落后，此处将标记物品为已鉴定
      break;
      
    case "divine":
      // 精炼石：只重roll数值
      [...newItem.prefixes, ...newItem.suffixes, ...newItem.implicit].forEach((affix) => {
        affix.stats.forEach((stat) => {
          if (stat.min !== undefined && stat.max !== undefined) {
            stat.rolled = randomInt(stat.min, stat.max);
          }
        });
      });
      break;
      
    case "socket":
      // 工匠石：按装备基底类型重掷孔数，同时保留词缀和其他物品状态。
      {
        const itemType = baseData?.type || newItem.slot;
        const previousGems = newItem.sockets.map((socket) => socket.gemId);
        const rerolled = createSockets(itemType, newItem.itemLevel, baseData?.sockets);
        rerolled.forEach((socket, index) => { socket.gemId = previousGems[index] || null; });
        newItem.sockets = rerolled;
      }
      break;
      
    case "link":
      // 链接石：只重掷连接关系，保留孔数、孔色和已镶嵌宝石。
      {
        const socketCount = newItem.sockets.length;
        const linkedTo = newItem.sockets.map(() => [] as number[]);
        for (const group of rebuildSocketLinks(socketCount)) {
          for (let index = 0; index < group.length; index += 1) {
            for (let other = index + 1; other < group.length; other += 1) {
              linkedTo[group[index]].push(group[other]);
              linkedTo[group[other]].push(group[index]);
            }
          }
        }
        newItem.sockets = newItem.sockets.map((socket, index) => ({ ...socket, linkedTo: linkedTo[index] }));
      }
      break;
      
    case "color":
      // 变色石：只重掷孔色，保留孔数、链接和已镶嵌宝石。
      rerollSocketColors(newItem.sockets, baseData?.type || newItem.slot);
      break;
      
    case "add_prefix":
      // 附魔石：为魔法装备添加一条随机前缀
      if (newItem.rarity === Rarity.Normal || newItem.rarity === Rarity.Magic) {
        const newPrefix = rollAffix(AffixCategory.Prefix, tags, newItem.itemLevel, newItem.prefixes);
        if (newPrefix) {
          newItem.prefixes.push(newPrefix);
          if (newItem.rarity === Rarity.Normal) {
            newItem.rarity = Rarity.Magic;
          }
        }
      }
      break;
      
    case "add_suffix":
      // 为装备添加一条随机后缀
      if (newItem.rarity === Rarity.Normal || newItem.rarity === Rarity.Magic) {
        const newSuffix = rollAffix(AffixCategory.Suffix, tags, newItem.itemLevel, newItem.suffixes);
        if (newSuffix) {
          newItem.suffixes.push(newSuffix);
          if (newItem.rarity === Rarity.Normal) {
            newItem.rarity = Rarity.Magic;
          }
        }
      }
      break;
      
    case "annul":
      // 抹除石：随机移除一条词缀
      if (newItem.prefixes.length + newItem.suffixes.length > 0) {
        const allAffixes = [...newItem.prefixes.map((a, i) => ({ affix: a, type: "prefix" as const, index: i })),
                          ...newItem.suffixes.map((a, i) => ({ affix: a, type: "suffix" as const, index: i }))];
        const removeIdx = Math.floor(Math.random() * allAffixes.length);
        const removed = allAffixes[removeIdx];
        if (removed.type === "prefix") {
          newItem.prefixes.splice(removed.index, 1);
        } else {
          newItem.suffixes.splice(removed.index, 1);
        }
        // 降级稀有度
        if (newItem.prefixes.length + newItem.suffixes.length === 0) {
          newItem.rarity = Rarity.Normal;
        } else if (newItem.rarity === Rarity.Rare && newItem.prefixes.length + newItem.suffixes.length <= 1) {
          newItem.rarity = Rarity.Magic;
        }
      }
      break;
      
    case "exalt":
      // 崇高石：为稀有装备添加一条高阶词缀
      if (newItem.rarity === Rarity.Rare) {
        const canAddPrefix = newItem.prefixes.length < 3;
        const canAddSuffix = newItem.suffixes.length < 3;
        if (canAddPrefix || canAddSuffix) {
          const category = canAddPrefix && (!canAddSuffix || Math.random() < 0.5)
            ? AffixCategory.Prefix : AffixCategory.Suffix;
          const exaltAffix = rollAffix(category, tags, newItem.itemLevel, [...newItem.prefixes, ...newItem.suffixes]);
          if (exaltAffix) {
            if (exaltAffix.category === AffixCategory.Prefix) {
              newItem.prefixes.push(exaltAffix);
            } else {
              newItem.suffixes.push(exaltAffix);
            }
          }
        }
      }
      break;
      
    case "quality":
      // 品质石：增加装备品质
      newItem.quality = Math.min(20, (newItem.quality || 0) + 5);
      break;
      
    case "chance":
      // 机会石：白色装备随机变为魔法/稀有（PoE1中极小概率变独特）
      if (newItem.rarity === Rarity.Normal) {
        const roll = Math.random() * 100;
        if (roll < 70) {
          // 70% 变魔法：添加1-2条词缀
          newItem.rarity = Rarity.Magic;
          if (Math.random() < 0.6) {
            const affix = rollAffix(AffixCategory.Prefix, tags, newItem.itemLevel);
            if (affix) newItem.prefixes.push(affix);
          }
          if (Math.random() < 0.6) {
            const affix = rollAffix(AffixCategory.Suffix, tags, newItem.itemLevel);
            if (affix) newItem.suffixes.push(affix);
          }
          // 确保至少1条词缀
          if (newItem.prefixes.length === 0 && newItem.suffixes.length === 0) {
            const fallback = rollAffix(
              Math.random() < 0.5 ? AffixCategory.Prefix : AffixCategory.Suffix,
              tags, newItem.itemLevel
            );
            if (fallback) {
              if (fallback.category === AffixCategory.Prefix) newItem.prefixes.push(fallback);
              else newItem.suffixes.push(fallback);
            }
          }
        } else {
          // 30% 变稀有：添加4-6条词缀
          newItem.rarity = Rarity.Rare;
          const pCount = randomInt(1, 3);
          const sCount = randomInt(1, 3);
          for (let i = 0; i < pCount; i++) {
            const affix = rollAffix(AffixCategory.Prefix, tags, newItem.itemLevel, newItem.prefixes);
            if (affix) newItem.prefixes.push(affix);
          }
          for (let i = 0; i < sCount; i++) {
            const affix = rollAffix(AffixCategory.Suffix, tags, newItem.itemLevel, newItem.suffixes);
            if (affix) newItem.suffixes.push(affix);
          }
        }
      }
      break;
  }
  
  return newItem;
}

// ===== 装备属性计算 =====

export function calculateItemStats(item: Item): Record<string, number> {
  const stats: Record<string, number> = {};
  
  // 基底固有属性
  item.implicit.forEach((affix) => {
    affix.stats.forEach((stat) => {
      const key = stat.stat;
      if (!stats[key]) stats[key] = 0;
      stats[key] += stat.rolled || 0;
    });
  });
  
  // 前缀和后缀词缀
  [...item.prefixes, ...item.suffixes].forEach((affix) => {
    affix.stats.forEach((stat) => {
      const key = stat.stat;
      if (!stats[key]) stats[key] = 0;
      stats[key] += stat.rolled || 0;
    });
  });
  
  return stats;
}

// ===== 格式化显示 =====

export function formatItem(item: Item): string {
  const rarityColors: Record<string, string> = {
    normal: "#c8c8c8",
    magic: "#6699cc",
    rare: "#ffff00",
    unique: "#ff8c00",
  };
  
  const color = rarityColors[item.rarity] || "#c8c8c8";
  const lines: string[] = [];
  
  lines.push(`<span style="color:${color}">${item.name}</span>`);
  lines.push(`<span style="color:#888">物品等级: ${item.itemLevel}</span>`);
  
  // 孔和链接显示
  if (item.sockets.length > 0) {
    const socketStats = getSocketStats(item.sockets);
    lines.push(`<span style="color:#888">孔数: ${socketStats.total} | 链接: ${socketStats.maxLink}</span>`);
    lines.push(`<span style="color:#888">颜色: ${getLinkDisplayString(item.sockets)}</span>`);
  }
  
  // 固有属性
  if (item.implicit.length > 0) {
    lines.push("---");
    item.implicit.forEach((affix) => {
      affix.stats.forEach((stat) => {
        const modStr = stat.modType === "flat" ? `+${stat.rolled}` : `+${stat.rolled}%`;
        lines.push(`<span style="color:#888">${modStr} ${stat.stat}</span>`);
      });
    });
  }
  
  // 词缀
  if (item.prefixes.length > 0 || item.suffixes.length > 0) {
    lines.push("---");
    [...item.prefixes, ...item.suffixes].forEach((affix) => {
      affix.stats.forEach((stat) => {
        const modStr = stat.modType === "flat" ? `+${stat.rolled}` : `+${stat.rolled}%`;
        lines.push(`${modStr} ${stat.stat}`);
      });
    });
  }
  
  return lines.join("\n");
}
