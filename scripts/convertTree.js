#!/usr/bin/env node
/**
 * Converts GGG's skilltree-export data.json into TypeScript PassiveNode[] format.
 * Usage: node scripts/convertTree.js
 * Input:  ./scripts/poe_tree_data.json  (downloaded from GGG)
 * Output: ./src/data/poePassiveTree.ts
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, 'poe_tree_data.json');
const OUTPUT = path.join(__dirname, '..', 'src', 'data', 'poePassiveTree.ts');

if (!fs.existsSync(INPUT)) {
  console.error('Input file not found:', INPUT);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
const { nodes, groups, constants, classes } = raw;
const { skillsPerOrbit, orbitRadii } = constants;

// Calculate angle for a given orbit index (matches GGG/PoB logic)
function calcOrbitAngle(orbitIndex, skillsInOrbit) {
  if (skillsInOrbit === 1) return 0;

  // For orbits with 6 nodes: regular spacing
  if (skillsInOrbit === 6) {
    return (2 * Math.PI * orbitIndex) / 6;
  }

  // For orbits with 16 nodes (orbits 2 & 3 post-3.17): irregular spacing
  // The angles are symmetric per quarter
  if (skillsInOrbit === 16) {
    const angles = [
      0, 30, 45, 60, 90, 120, 135, 150,
      180, 210, 225, 240, 270, 300, 315, 330,
    ];
    const idx = orbitIndex % 16;
    // Determine which quarter
    const quarter = Math.floor(orbitIndex / 16);
    return Math.PI / 180 * (angles[idx] + quarter * 360);
  }

  // Generic even spacing for other orbit sizes
  return (2 * Math.PI * orbitIndex) / skillsInOrbit;
}

// Calculate world x,y for a node
function calcNodePosition(node) {
  const group = groups[node.group];
  if (!group) return { x: 0, y: 0 };

  const orbit = node.orbit || 0;
  const orbitIndex = node.orbitIndex || 0;
  const radius = orbitRadii[orbit] || 0;
  const skillsInOrbit = skillsPerOrbit[orbit] || 1;
  const angle = calcOrbitAngle(orbitIndex, skillsInOrbit);

  // PoE coordinate system: x goes right, y goes down
  // The angle 0 is at the top (12 o'clock), rotating clockwise
  // So: x = sin(angle), y = -cos(angle)
  return {
    x: group.x + radius * Math.sin(angle),
    y: group.y - radius * Math.cos(angle),
  };
}

// Map node type
function getNodeType(node) {
  if (node.isKeystone) return 'keystone';
  if (node.isNotable) return 'notable';
  if (node.ascendancyName) return 'ascendancy';
  return 'normal';
}

// Escape string for TypeScript
function escapeTS(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// Get all connections (both out + in, deduplicated)
function getConnections(nodeId) {
  const node = nodes[nodeId];
  if (!node) return [];
  const connSet = new Set();
  if (node.out) node.out.forEach((id) => connSet.add(id));
  if (node.in) node.in.forEach((id) => connSet.add(id));
  return Array.from(connSet);
}

// Build a reverse map: nodeId -> all connecting nodeIds
// (to compute 'requires' — we use the 'in' direction as prerequisites)
// Actually for the passive tree, 'in' means incoming connections = prerequisites
function getRequires(nodeId) {
  const node = nodes[nodeId];
  if (!node) return [];
  return node.in || [];
}

// Build clusters from groups
function buildClusters() {
  const clusters = [];
  const groupEntries = Object.entries(groups);

  // Group nodes by ascendancy name (for ascendancy clusters)
  const ascendancyMap = {};
  for (const [nodeId, node] of Object.entries(nodes)) {
    if (node.ascendancyName) {
      if (!ascendancyMap[node.ascendancyName]) {
        ascendancyMap[node.ascendancyName] = { nodes: [], classId: null };
      }
      ascendancyMap[node.ascendancyName].nodes.push(nodeId);
      // Find which class this belongs to
      if (node.classId !== undefined) {
        ascendancyMap[node.ascendancyName].classId = node.classId;
      }
    }
  }

  // Create ascendancy clusters
  for (const [ascName, data] of Object.entries(ascendancyMap)) {
    // Find center position
    let cx = 0, cy = 0;
    for (const nid of data.nodes) {
      const pos = calcNodePosition(nodes[nid]);
      cx += pos.x;
      cy += pos.y;
    }
    cx /= data.nodes.length;
    cy /= data.nodes.length;

    clusters.push({
      name: ascName,
      description: '',
      center: { x: cx, y: cy },
      nodes: data.nodes,
      isAscendancy: true,
    });
  }

  // Identify class start positions (one per class)
  const classNames = ['Str', 'Dex', 'Int', 'StrDex', 'StrInt', 'DexInt', 'StrDexInt'];

  // Find class start nodes — they are the ones with no 'in' connections at orbit 0
  // and are at the beginning of each class's tree
  // Actually, PoB marks them with ascendancyName == className
  // Let's just find nodes that are ascendancy starts
  const classStartNodes = {};
  for (const [nodeId, node] of Object.entries(nodes)) {
    if (node.isAscendancyStart) {
      classStartNodes[nodeId] = node;
    }
  }

  return clusters;
}

// Main conversion
function convert() {
  const outputNodes = [];
  const nodeMap = new Map(); // old id -> new index

  // Build class name map
  const classMap = {};
  for (const [clsId, cls] of Object.entries(classes || {})) {
    classMap[clsId] = cls;
  }

  let nodeIdx = 0;
  for (const [nodeId, node] of Object.entries(nodes)) {
    // Skip masteries, proxies, multiple choice options
    if (node.isMastery) continue;
    if (node.isProxy) continue;
    if (node.isMultipleChoiceOption) continue;
    // Skip blighted nodes
    if (node.isBlighted) continue;
    // Skip nodes without group (bloodline, cluster jewel notables, etc.)
    if (node.group === undefined) continue;

    const pos = calcNodePosition(node);
    const nodeType = getNodeType(node);
    const connections = getConnections(nodeId);
    const requires = getRequires(nodeId);

    // Convert coordinates to a scale similar to PoB (world coords)
    // GGG uses raw pixel coords, we scale them down for the UI
    // PoB tree area is roughly 6000x6000 pixels centered at 0,0
    // Let's keep the GGG coords but scale them down
    const x = pos.x / 100; // Scale down to match existing tree scale (~0-250 range)
    const y = pos.y / 100;

    // Stats: store as raw text
    const displayStats = node.stats || [];

    // Determine ascendancy class
    const ascendancyName = node.ascendancyName || null;

    // Flavor text
    const flavourText = node.flavourText || [];

    // Granted stats from passive (like grantedStrength, grantedDexterity, etc.)
    const grantedStats = {};
    if (node.grantedStrength) grantedStats.strength = node.grantedStrength;
    if (node.grantedDexterity) grantedStats.dexterity = node.grantedDexterity;
    if (node.grantedIntelligence) grantedStats.intelligence = node.grantedIntelligence;

    const outNode = {
      id: String(node.skill || nodeId),
      name: node.name || 'Unknown',
      type: nodeType,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      connections: connections.map((id) => String(nodes[id]?.skill || id)),
      displayStats,
      requires: requires.map((id) => String(nodes[id]?.skill || id)),
      allocated: false,
      ...(ascendancyName && { ascendancyName }),
      ...(flavourText.length > 0 && { flavourText }),
      ...(Object.keys(grantedStats).length > 0 && { grantedStats }),
      ...(node.isJewelSocket && { isJewelSocket: true }),
    };

    nodeMap.set(nodeId, nodeIdx);
    outputNodes.push(outNode);
    nodeIdx++;
  }

  // Now fix up connections and requires to use the new IDs
  // (they should already be correct since we used node.skill)

  // Build clusters
  const clusters = buildClusters().filter((c) => c.isAscendancy);

  // Generate TypeScript
  let ts = `// Auto-generated from GGG skilltree-export data.json (PoE 3.29.1)
// DO NOT EDIT MANUALLY — run: node scripts/convertTree.js
//
// Source: https://github.com/grindinggear/skilltree-export (tag 3.29.1)
// Generated: ${new Date().toISOString()}

export interface PoEPassiveNode {
  id: string;
  name: string;
  type: "normal" | "notable" | "keystone" | "ascendancy";
  x: number;
  y: number;
  connections: string[];
  displayStats: string[];
  requires: string[];
  allocated: boolean;
  ascendancyName?: string;
  flavourText?: string[];
  grantedStats?: Record<string, number>;
  isJewelSocket?: boolean;
}

export const POE_PASSIVE_NODES: PoEPassiveNode[] = [
`;

  for (const node of outputNodes) {
    const fields = [];
    fields.push(`  id: "${escapeTS(node.id)}"`);
    fields.push(`  name: "${escapeTS(node.name)}"`);
    fields.push(`  type: "${node.type}"`);
    fields.push(`  x: ${node.x}`);
    fields.push(`  y: ${node.y}`);

    // Connections
    if (node.connections.length > 0) {
      const connStr = node.connections.map((c) => `"${escapeTS(c)}"`).join(', ');
      fields.push(`  connections: [${connStr}]`);
    } else {
      fields.push(`  connections: []`);
    }

    // Display stats
    if (node.displayStats.length > 0) {
      const statsStr = node.displayStats.map((s) => `"${escapeTS(s)}"`).join(', ');
      fields.push(`  displayStats: [${statsStr}]`);
    } else {
      fields.push(`  displayStats: []`);
    }

    // Requires
    if (node.requires.length > 0) {
      const reqStr = node.requires.map((r) => `"${escapeTS(r)}"`).join(', ');
      fields.push(`  requires: [${reqStr}]`);
    } else {
      fields.push(`  requires: []`);
    }

    fields.push(`  allocated: false`);

    if (node.ascendancyName) {
      fields.push(`  ascendancyName: "${escapeTS(node.ascendancyName)}"`);
    }
    if (node.flavourText && node.flavourText.length > 0) {
      const ftStr = node.flavourText.map((f) => `"${escapeTS(f)}"`).join(', ');
      fields.push(`  flavourText: [${ftStr}]`);
    }
    if (node.grantedStats && Object.keys(node.grantedStats).length > 0) {
      const gsEntries = Object.entries(node.grantedStats)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      fields.push(`  grantedStats: { ${gsEntries} }`);
    }
    if (node.isJewelSocket) {
      fields.push(`  isJewelSocket: true`);
    }

    ts += `  {\n${fields.map((f) => `    ${f}`).join(',\n')},\n  },\n`;
  }

  ts += `];\n`;

  // Add helper functions
  ts += `
// ===== Helper functions =====

export function getPoENodeById(id: string): PoEPassiveNode | undefined {
  return POE_PASSIVE_NODES.find((n) => n.id === id);
}

export function getPoENodesByType(type: PoEPassiveNode["type"]): PoEPassiveNode[] {
  return POE_PASSIVE_NODES.filter((n) => n.type === type);
}

export function canAllocatePoENode(nodeId: string, allocatedNodes: string[]): boolean {
  const node = getPoENodeById(nodeId);
  if (!node) return false;
  if (allocatedNodes.includes(nodeId)) return false;
  if (!node.requires || node.requires.length === 0) return true;
  return node.requires.every((req) => allocatedNodes.includes(req));
}

export function allocatePoENode(nodeId: string, allocatedNodes: string[]): string[] {
  if (!canAllocatePoENode(nodeId, allocatedNodes)) return allocatedNodes;
  return [...allocatedNodes, nodeId];
}

export function deallocatePoENode(nodeId: string, allocatedNodes: string[]): string[] {
  // Check for dependent nodes
  const dependentNodes = POE_PASSIVE_NODES.filter(
    (n) => n.requires.includes(nodeId) && allocatedNodes.includes(n.id)
  );
  if (dependentNodes.length > 0) {
    let newAllocated = allocatedNodes.filter((id) => id !== nodeId);
    for (const dep of dependentNodes) {
      newAllocated = deallocatePoENode(dep.id, newAllocated);
    }
    return newAllocated;
  }
  return allocatedNodes.filter((id) => id !== nodeId);
}

export function searchPoENodes(query: string): PoEPassiveNode[] {
  const lower = query.toLowerCase();
  return POE_PASSIVE_NODES.filter((n) => n.name.toLowerCase().includes(lower));
}

// Stats
export const POE_TREE_STATS = {
  totalNodes: POE_PASSIVE_NODES.length,
  keystones: POE_PASSIVE_NODES.filter((n) => n.type === "keystone").length,
  notables: POE_PASSIVE_NODES.filter((n) => n.type === "notable").length,
  normal: POE_PASSIVE_NODES.filter((n) => n.type === "normal" && !n.isJewelSocket).length,
  ascendancy: POE_PASSIVE_NODES.filter((n) => n.type === "ascendancy").length,
  jewelSockets: POE_PASSIVE_NODES.filter((n) => n.isJewelSocket).length,
};
`;

  fs.writeFileSync(OUTPUT, ts, 'utf-8');
  console.log(`Generated ${outputNodes.length} nodes → ${OUTPUT}`);
  console.log(`Node types: keystones=${outputNodes.filter((n) => n.type === 'keystone').length}, notables=${outputNodes.filter((n) => n.type === 'notable').length}, normal=${outputNodes.filter((n) => n.type === 'normal').length}, ascendancy=${outputNodes.filter((n) => n.type === 'ascendancy').length}`);
}

convert();
