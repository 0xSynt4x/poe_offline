import { PassiveNode, StatBonus, ModType } from "../models/types";

// ===== 天赋树节点数据 =====

export const PASSIVE_NODES: PassiveNode[] = [
  // ===== 力量区域（左侧） =====
  // 起始点
  {
    id: "str_start",
    name: "力量源泉",
    type: "normal",
    x: 0,
    y: 0,
    connections: ["str_1", "str_2"],
    stats: [{ stat: "strength", modType: ModType.Flat, min: 10, max: 10 }],
    requires: [],
    allocated: false,
  },
  {
    id: "str_1",
    name: "力量",
    type: "normal",
    x: -1,
    y: 1,
    connections: ["str_start", "str_notable_1"],
    stats: [{ stat: "strength", modType: ModType.Flat, min: 10, max: 10 }],
    requires: ["str_start"],
    allocated: false,
  },
  {
    id: "str_2",
    name: "生命",
    type: "normal",
    x: 1,
    y: 1,
    connections: ["str_start", "str_notable_1"],
    stats: [{ stat: "maxLife", modType: ModType.Flat, min: 15, max: 15 }],
    requires: ["str_start"],
    allocated: false,
  },
  {
    id: "str_notable_1",
    name: "钢铁意志",
    type: "notable",
    x: 0,
    y: 2,
    connections: ["str_1", "str_2", "str_3", "str_4"],
    stats: [
      { stat: "maxLife", modType: ModType.Increased, min: 8, max: 8 },
      { stat: "physicalDamage", modType: ModType.Increased, min: 12, max: 12 },
    ],
    requires: ["str_1", "str_2"],
    allocated: false,
  },
  {
    id: "str_3",
    name: "护甲",
    type: "normal",
    x: -1,
    y: 3,
    connections: ["str_notable_1", "str_keystone"],
    stats: [{ stat: "armor", modType: ModType.Increased, min: 15, max: 15 }],
    requires: ["str_notable_1"],
    allocated: false,
  },
  {
    id: "str_4",
    name: "物理伤害",
    type: "normal",
    x: 1,
    y: 3,
    connections: ["str_notable_1", "str_keystone"],
    stats: [{ stat: "physicalDamage", modType: ModType.Increased, min: 10, max: 10 }],
    requires: ["str_notable_1"],
    allocated: false,
  },
  {
    id: "str_keystone",
    name: "不可阻挡",
    type: "keystone",
    x: 0,
    y: 4,
    connections: ["str_3", "str_4", "center_1"],
    stats: [
      { stat: "stunImmune", modType: ModType.Flat, min: 1, max: 1 },
      { stat: "evasion", modType: ModType.More, min: -30, max: -30 },
    ],
    requires: ["str_3", "str_4"],
    allocated: false,
  },

  // ===== 敏捷区域（下方） =====
  {
    id: "dex_start",
    name: "敏捷源泉",
    type: "normal",
    x: 0,
    y: 6,
    connections: ["dex_1", "dex_2"],
    stats: [{ stat: "dexterity", modType: ModType.Flat, min: 10, max: 10 }],
    requires: [],
    allocated: false,
  },
  {
    id: "dex_1",
    name: "敏捷",
    type: "normal",
    x: -1,
    y: 7,
    connections: ["dex_start", "dex_notable_1"],
    stats: [{ stat: "dexterity", modType: ModType.Flat, min: 10, max: 10 }],
    requires: ["dex_start"],
    allocated: false,
  },
  {
    id: "dex_2",
    name: "闪避",
    type: "normal",
    x: 1,
    y: 7,
    connections: ["dex_start", "dex_notable_1"],
    stats: [{ stat: "evasion", modType: ModType.Increased, min: 15, max: 15 }],
    requires: ["dex_start"],
    allocated: false,
  },
  {
    id: "dex_notable_1",
    name: "灵巧身法",
    type: "notable",
    x: 0,
    y: 8,
    connections: ["dex_1", "dex_2", "dex_3", "dex_4"],
    stats: [
      { stat: "attackSpeed", modType: ModType.Increased, min: 10, max: 10 },
      { stat: "evasion", modType: ModType.Increased, min: 20, max: 20 },
    ],
    requires: ["dex_1", "dex_2"],
    allocated: false,
  },
  {
    id: "dex_3",
    name: "暴击",
    type: "normal",
    x: -1,
    y: 9,
    connections: ["dex_notable_1", "dex_keystone"],
    stats: [{ stat: "critChance", modType: ModType.Increased, min: 15, max: 15 }],
    requires: ["dex_notable_1"],
    allocated: false,
  },
  {
    id: "dex_4",
    name: "命中",
    type: "normal",
    x: 1,
    y: 9,
    connections: ["dex_notable_1", "dex_keystone"],
    stats: [{ stat: "accuracy", modType: ModType.Flat, min: 30, max: 30 }],
    requires: ["dex_notable_1"],
    allocated: false,
  },
  {
    id: "dex_keystone",
    name: "闪避大师",
    type: "keystone",
    x: 0,
    y: 10,
    connections: ["dex_3", "dex_4", "center_1"],
    stats: [
      { stat: "evasion", modType: ModType.More, min: 50, max: 50 },
      { stat: "armor", modType: ModType.More, min: -30, max: -30 },
    ],
    requires: ["dex_3", "dex_4"],
    allocated: false,
  },

  // ===== 智力区域（右侧） =====
  {
    id: "int_start",
    name: "智力源泉",
    type: "normal",
    x: 6,
    y: 0,
    connections: ["int_1", "int_2"],
    stats: [{ stat: "intelligence", modType: ModType.Flat, min: 10, max: 10 }],
    requires: [],
    allocated: false,
  },
  {
    id: "int_1",
    name: "智力",
    type: "normal",
    x: 5,
    y: 1,
    connections: ["int_start", "int_notable_1"],
    stats: [{ stat: "intelligence", modType: ModType.Flat, min: 10, max: 10 }],
    requires: ["int_start"],
    allocated: false,
  },
  {
    id: "int_2",
    name: "法力",
    type: "normal",
    x: 7,
    y: 1,
    connections: ["int_start", "int_notable_1"],
    stats: [{ stat: "maxMana", modType: ModType.Flat, min: 20, max: 20 }],
    requires: ["int_start"],
    allocated: false,
  },
  {
    id: "int_notable_1",
    name: "奥术智慧",
    type: "notable",
    x: 6,
    y: 2,
    connections: ["int_1", "int_2", "int_3", "int_4"],
    stats: [
      { stat: "spellDamage", modType: ModType.Increased, min: 15, max: 15 },
      { stat: "maxMana", modType: ModType.Increased, min: 10, max: 10 },
    ],
    requires: ["int_1", "int_2"],
    allocated: false,
  },
  {
    id: "int_3",
    name: "能量护盾",
    type: "normal",
    x: 5,
    y: 3,
    connections: ["int_notable_1", "int_keystone"],
    stats: [{ stat: "energyShield", modType: ModType.Increased, min: 15, max: 15 }],
    requires: ["int_notable_1"],
    allocated: false,
  },
  {
    id: "int_4",
    name: "元素伤害",
    type: "normal",
    x: 7,
    y: 3,
    connections: ["int_notable_1", "int_keystone"],
    stats: [{ stat: "elementalDamage", modType: ModType.Increased, min: 10, max: 10 }],
    requires: ["int_notable_1"],
    allocated: false,
  },
  {
    id: "int_keystone",
    name: "元素掌控",
    type: "keystone",
    x: 6,
    y: 4,
    connections: ["int_3", "int_4", "center_1"],
    stats: [
      { stat: "elementalDamage", modType: ModType.More, min: 30, max: 30 },
      { stat: "maxLife", modType: ModType.More, min: -15, max: -15 },
    ],
    requires: ["int_3", "int_4"],
    allocated: false,
  },

  // ===== 中心区域（连接三个起点） =====
  {
    id: "center_1",
    name: "生命之心",
    type: "normal",
    x: 3,
    y: 4,
    connections: ["str_keystone", "dex_keystone", "int_keystone", "center_2"],
    stats: [{ stat: "maxLife", modType: ModType.Flat, min: 30, max: 30 }],
    requires: [],
    allocated: false,
  },
  {
    id: "center_2",
    name: "全能之心",
    type: "notable",
    x: 3,
    y: 5,
    connections: ["center_1"],
    stats: [
      { stat: "strength", modType: ModType.Flat, min: 15, max: 15 },
      { stat: "dexterity", modType: ModType.Flat, min: 15, max: 15 },
      { stat: "intelligence", modType: ModType.Flat, min: 15, max: 15 },
    ],
    requires: ["center_1"],
    allocated: false,
  },
];

// ===== 天赋树区域定义 =====

export interface PassiveCluster {
  name: string;
  description: string;
  center: { x: number; y: number };
  nodes: string[];
}

export const PASSIVE_CLUSTERS: PassiveCluster[] = [
  {
    name: "力量之路",
    description: "增加生命、护甲和物理伤害",
    center: { x: 0, y: 2 },
    nodes: ["str_start", "str_1", "str_2", "str_notable_1", "str_3", "str_4", "str_keystone"],
  },
  {
    name: "敏捷之道",
    description: "增加闪避、攻击速度和暴击",
    center: { x: 0, y: 8 },
    nodes: ["dex_start", "dex_1", "dex_2", "dex_notable_1", "dex_3", "dex_4", "dex_keystone"],
  },
  {
    name: "智慧之道",
    description: "增加法力、法术伤害和能量护盾",
    center: { x: 6, y: 2 },
    nodes: ["int_start", "int_1", "int_2", "int_notable_1", "int_3", "int_4", "int_keystone"],
  },
  {
    name: "中心枢纽",
    description: "连接三大路径的中心节点",
    center: { x: 3, y: 4.5 },
    nodes: ["center_1", "center_2"],
  },
];

// ===== 工具函数 =====

export function getNodeById(id: string): PassiveNode | undefined {
  return PASSIVE_NODES.find((n) => n.id === id);
}

export function getNodesByCluster(clusterName: string): PassiveNode[] {
  const cluster = PASSIVE_CLUSTERS.find((c) => c.name === clusterName);
  if (!cluster) return [];
  return cluster.nodes.map((id) => getNodeById(id)).filter((n): n is PassiveNode => !!n);
}

export function canAllocateNode(nodeId: string, allocatedNodes: string[]): boolean {
  const node = getNodeById(nodeId);
  if (!node) return false;
  
  // 已分配
  if (allocatedNodes.includes(nodeId)) return false;
  
  // 检查前置条件
  if (node.requires.length === 0) return true;
  
  return node.requires.every((req) => allocatedNodes.includes(req));
}

export function allocateNode(nodeId: string, allocatedNodes: string[]): string[] {
  if (!canAllocateNode(nodeId, allocatedNodes)) return allocatedNodes;
  return [...allocatedNodes, nodeId];
}

export function deallocateNode(nodeId: string, allocatedNodes: string[]): string[] {
  // 检查是否有其他节点依赖此节点
  const dependentNodes = PASSIVE_NODES.filter(
    (n) => n.requires.includes(nodeId) && allocatedNodes.includes(n.id)
  );
  
  if (dependentNodes.length > 0) {
    // 先移除依赖节点
    let newAllocated = allocatedNodes.filter((id) => id !== nodeId);
    for (const dep of dependentNodes) {
      newAllocated = deallocateNode(dep.id, newAllocated);
    }
    return newAllocated;
  }
  
  return allocatedNodes.filter((id) => id !== nodeId);
}

export interface PassiveStatModifiers {
  flat: number;
  increased: number;
  more: number;
}

export function calculatePassiveModifiers(allocatedNodes: string[]): Record<string, PassiveStatModifiers> {
  const stats: Record<string, PassiveStatModifiers> = {};
  
  for (const nodeId of allocatedNodes) {
    const node = getNodeById(nodeId);
    if (!node) continue;
    
    for (const stat of node.stats) {
      const entry = stats[stat.stat] || (stats[stat.stat] = { flat: 0, increased: 0, more: 0 });
      const value = (stat.min + stat.max) / 2;
      if (stat.modType === ModType.Flat) entry.flat += value;
      else if (stat.modType === ModType.Increased) entry.increased += value;
      else if (stat.modType === ModType.More) entry.more += value;
    }
  }
  
  return stats;
}

export function calculatePassiveStats(allocatedNodes: string[]): Record<string, number> {
  const stats: Record<string, number> = {};
  
  for (const nodeId of allocatedNodes) {
    const node = getNodeById(nodeId);
    if (!node) continue;
    
    for (const stat of node.stats) {
      const key = stat.stat;
      if (!stats[key]) stats[key] = 0;
      
      if (stat.modType === ModType.Flat || stat.modType === ModType.Increased) {
        stats[key] += (stat.min + stat.max) / 2;
      }
    }
  }
  
  return stats;
}
