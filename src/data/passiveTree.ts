import { PassiveNode, StatBonus, ModType } from "../models/types";
import { POE_PASSIVE_NODES, PoEPassiveNode, canAllocatePoENode, allocatePoENode, deallocatePoENode, getPoENodeById } from "./poePassiveTree";

// ===== Convert PoE raw data → PassiveNode format =====

function convertPoENode(raw: PoEPassiveNode): PassiveNode {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    x: raw.x,
    y: raw.y,
    connections: raw.connections,
    stats: [], // Structured stats not available from GGG text format
    requires: raw.requires,
    allocated: raw.allocated,
    displayStats: raw.displayStats,
    ascendancyName: raw.ascendancyName,
    flavourText: raw.flavourText,
    grantedStats: raw.grantedStats,
    isJewelSocket: raw.isJewelSocket,
  };
}

// ===== Converted node data =====
export const PASSIVE_NODES: PassiveNode[] = POE_PASSIVE_NODES.map(convertPoENode);

// ===== Cluster definitions (auto-generated from ascendancy data) =====

export interface PassiveCluster {
  name: string;
  description: string;
  center: { x: number; y: number };
  nodes: string[];
}

// Group nodes by ascendancy name for cluster labels
function buildAscendancyClusters(): PassiveCluster[] {
  const map = new Map<string, { xSum: number; ySum: number; count: number; nodes: string[] }>();
  for (const node of PASSIVE_NODES) {
    if (!node.ascendancyName) continue;
    let entry = map.get(node.ascendancyName);
    if (!entry) {
      entry = { xSum: 0, ySum: 0, count: 0, nodes: [] };
      map.set(node.ascendancyName, entry);
    }
    entry.xSum += node.x;
    entry.ySum += node.y;
    entry.count++;
    entry.nodes.push(node.id);
  }
  return Array.from(map.entries()).map(([name, data]) => ({
    name,
    description: "",
    center: { x: data.xSum / data.count, y: data.ySum / data.count },
    nodes: data.nodes,
  }));
}

export const PASSIVE_CLUSTERS: PassiveCluster[] = buildAscendancyClusters();

// ===== Tool functions =====

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

  // Jewel sockets are always allocatable (no prerequisites)
  if (node.isJewelSocket) return true;

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

    // Handle structured stats
    for (const stat of node.stats) {
      const entry = stats[stat.stat] || (stats[stat.stat] = { flat: 0, increased: 0, more: 0 });
      const value = (stat.min + stat.max) / 2;
      if (stat.modType === ModType.Flat) entry.flat += value;
      else if (stat.modType === ModType.Increased) entry.increased += value;
      else if (stat.modType === ModType.More) entry.more += value;
    }

    // Handle granted stats (e.g. +40 Str from ascendancy start)
    if (node.grantedStats) {
      for (const [stat, value] of Object.entries(node.grantedStats)) {
        const entry = stats[stat] || (stats[stat] = { flat: 0, increased: 0, more: 0 });
        entry.flat += value;
      }
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

    // Handle granted stats
    if (node.grantedStats) {
      for (const [stat, value] of Object.entries(node.grantedStats)) {
        if (!stats[stat]) stats[stat] = 0;
        stats[stat] += value;
      }
    }
  }

  return stats;
}
