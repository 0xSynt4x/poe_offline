#!/usr/bin/env node
/**
 * Fixes poePassiveTree.ts by:
 * 1. Removing the "root" meta-node (GGG internal, not a real passive)
 * 2. Removing class start nodes (MARAUDER, RANGER, WITCH, etc.)
 * 3. Removing ascendancy start hub nodes (Guardian, Juggernaut, etc.)
 * 4. Removing connections that reference non-existent nodes
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'data', 'poePassiveTree.ts');

let content = fs.readFileSync(FILE, 'utf-8');

// ---- Step 1: Parse all node blocks using bracket-matching ----
function extractBalancedArray(text, startPos) {
  // startPos points to the '[' character
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startPos; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '[') depth++;
    if (ch === ']') { depth--; if (depth === 0) return text.substring(startPos, i + 1); }
  }
  return null;
}

function extractBalancedObject(text, startPos) {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startPos; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) return text.substring(startPos, i + 1); }
  }
  return null;
}

const nodes = [];
const nodeStartRegex = /\{\s*\n\s*id:\s*"/g;
let match;

while ((match = nodeStartRegex.exec(content)) !== null) {
  const blockStart = match.index;
  const block = extractBalancedObject(content, blockStart);
  if (!block) continue;

  const idM = block.match(/id:\s*"([^"]+)"/);
  const nameM = block.match(/name:\s*"([^"]+)"/);
  const typeM = block.match(/type:\s*"(\w+)"/);
  const xM = block.match(/x:\s*([\d.-]+)/);
  const yM = block.match(/y:\s*([\d.-]+)/);
  const ascM = block.match(/ascendancyName:\s*"([^"]+)"/);
  const gsM = block.match(/grantedStats:\s*(\{[^}]+\})/);
  const ftM = block.match(/flavourText:\s*(\[[^\]]*\])/);
  const jsM = block.match(/isJewelSocket:\s*true/);

  // Extract connections array properly
  const connArrStart = block.indexOf('connections: [');
  let connections = [];
  if (connArrStart >= 0) {
    const arrStart = block.indexOf('[', connArrStart);
    const arrStr = extractBalancedArray(block, arrStart);
    if (arrStr) {
      connections = (arrStr.match(/"(\d+)"/g) || []).map(s => s.replace(/"/g, ''));
    }
  }

  // Extract requires array properly
  const reqArrStart = block.indexOf('requires: [');
  let requires = [];
  if (reqArrStart >= 0) {
    const arrStart = block.indexOf('[', reqArrStart);
    const arrStr = extractBalancedArray(block, arrStart);
    if (arrStr) {
      requires = (arrStr.match(/"(\d+)"/g) || []).map(s => s.replace(/"/g, ''));
    }
  }

  // Extract displayStats array properly (may contain brackets inside strings!)
  const dsArrStart = block.indexOf('displayStats: [');
  let displayStatsStr = '[]';
  if (dsArrStart >= 0) {
    const arrStart = block.indexOf('[', dsArrStart);
    const arrStr = extractBalancedArray(block, arrStart);
    if (arrStr) {
      displayStatsStr = arrStr;
    }
  }

  const hasStats = displayStatsStr !== '[]' && displayStatsStr.length > 4;

  nodes.push({
    id: idM?.[1] || '',
    block,
    blockStart,
    name: nameM?.[1] || 'Unknown',
    type: typeM?.[1] || 'normal',
    x: parseFloat(xM?.[1] || '0'),
    y: parseFloat(yM?.[1] || '0'),
    connections,
    requires,
    ascendancy: ascM?.[1] || null,
    displayStatsStr,
    hasStats,
    grantedStats: gsM?.[1] || null,
    flavourText: ftM?.[1] || null,
    isJewelSocket: !!jsM,
  });
}

console.log(`Parsed ${nodes.length} nodes`);

// ---- Step 2: Identify nodes to remove ----
const removeIds = new Set();
const removeReasons = {};

const classStartNames = [
  'MARAUDER', 'RANGER', 'WITCH', 'DUELIST', 'TEMPLAR',
  'SIX', 'Seven', 'Shadow', 'Scion',
  'Warden of the Maji', 'Warlock of the Mists', 'Wildwood Primalist',
];

const ascendancyStartNames = [
  'Guardian', 'Juggernaut', 'Chieftain', 'Berserker',
  'Slayer', 'Gladiator', 'Champion', 'Deadeye', 'Raider', 'Pathfinder',
  'Assassin', 'Trickster', 'Saboteur', 'Necromancer', 'Elementalist', 'Occultist',
  'Hierophant', 'Inquisitor', 'Battlemage', 'Warlord', 'Ascendant',
];

for (const node of nodes) {
  if (node.id === 'root') {
    removeIds.add(node.id);
    removeReasons[node.id] = 'root meta-node';
    continue;
  }

  if (classStartNames.includes(node.name) && !node.hasStats) {
    removeIds.add(node.id);
    removeReasons[node.id] = `class start: ${node.name}`;
    continue;
  }

  if (ascendancyStartNames.includes(node.name) && node.type === 'ascendancy' && !node.hasStats && node.connections.length >= 4) {
    removeIds.add(node.id);
    removeReasons[node.id] = `ascendancy start hub: ${node.name}`;
  }
}

console.log(`Nodes to remove: ${removeIds.size}`);
for (const [id, reason] of Object.entries(removeReasons)) {
  const node = nodes.find(n => n.id === id);
  if (node) console.log(`  ${node.name} (${id}): ${reason}`);
}

// ---- Step 3: Build valid ID set and clean connections ----
const validIds = new Set(nodes.filter(n => !removeIds.has(n.id)).map(n => n.id));

let brokenConnsRemoved = 0;
let brokenReqsRemoved = 0;

for (const node of nodes) {
  if (removeIds.has(node.id)) continue;
  const origConn = node.connections.length;
  const origReq = node.requires.length;
  node.connections = node.connections.filter(id => validIds.has(id));
  node.requires = node.requires.filter(id => validIds.has(id));
  brokenConnsRemoved += origConn - node.connections.length;
  brokenReqsRemoved += origReq - node.requires.length;
}

console.log(`Broken connections removed: ${brokenConnsRemoved}`);
console.log(`Broken requires removed: ${brokenReqsRemoved}`);

// ---- Step 4: Regenerate the file ----
function escapeTS(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

const keptNodes = nodes.filter(n => !removeIds.has(n.id));
console.log(`Keeping ${keptNodes.length} nodes (removed ${nodes.length - keptNodes.length})`);

let ts = `// Auto-generated from GGG skilltree-export data.json (PoE 3.29.1)
// Fixed: removed root meta-node, class starts, broken connections
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

for (const node of keptNodes) {
  const fields = [];
  fields.push(`  id: "${escapeTS(node.id)}"`);
  fields.push(`  name: "${escapeTS(node.name)}"`);
  fields.push(`  type: "${node.type}"`);
  fields.push(`  x: ${node.x}`);
  fields.push(`  y: ${node.y}`);

  if (node.connections.length > 0) {
    fields.push(`  connections: [${node.connections.map(c => `"${escapeTS(c)}"`).join(', ')}]`);
  } else {
    fields.push(`  connections: []`);
  }

  // Use the properly extracted displayStats string
  fields.push(`  displayStats: ${node.displayStatsStr}`);

  if (node.requires.length > 0) {
    fields.push(`  requires: [${node.requires.map(r => `"${escapeTS(r)}"`).join(', ')}]`);
  } else {
    fields.push(`  requires: []`);
  }

  fields.push(`  allocated: false`);

  if (node.ascendancy) {
    fields.push(`  ascendancyName: "${escapeTS(node.ascendancy)}"`);
  }
  if (node.flavourText) {
    fields.push(`  flavourText: ${node.flavourText}`);
  }
  if (node.grantedStats) {
    fields.push(`  grantedStats: ${node.grantedStats}`);
  }
  if (node.isJewelSocket) {
    fields.push(`  isJewelSocket: true`);
  }

  ts += `  {\n${fields.map(f => `    ${f}`).join(',\n')},\n  },\n`;
}

ts += `];\n`;

// Helper functions
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

fs.writeFileSync(FILE, ts, 'utf-8');
console.log(`\n✅ Fixed ${FILE}`);
console.log(`Final stats: ${keptNodes.length} nodes`);
