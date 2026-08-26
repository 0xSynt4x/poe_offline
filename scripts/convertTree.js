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
const MAX_RENDER_EDGE_DISTANCE = 8; // scaled world units; normal passive links are local

// Calculate angle for a given orbit index (matches GGG/PoB logic)
function calcOrbitAngle(orbitIndex, skillsInOrbit) {
  if (skillsInOrbit === 1) return 0;

  // For orbits with 6 nodes: regular spacing
  if (skillsInOrbit === 6) {
    return (2 * Math.PI * orbitIndex) / 6;
  }

  // For orbits with 16 nodes (orbits 2 & 3 post-3.17): irregular spacing.
  if (skillsInOrbit === 16) {
    const angles = [
      0, 30, 45, 60, 90, 120, 135, 150,
      180, 210, 225, 240, 270, 300, 315, 330,
    ];
    return Math.PI / 180 * angles[orbitIndex % 16];
  }

  // Orbit 4 also uses irregular spacing (10-degree steps plus 45-degree points).
  // The generic 360 / 40 spacing shifts nodes by up to 4.5 degrees and makes
  // otherwise adjacent nodes appear disconnected.
  if (skillsInOrbit === 40) {
    const angles = [
      0, 10, 20, 30, 40, 45, 50, 60, 70, 80,
      90, 100, 110, 120, 130, 135, 140, 150, 160, 170,
      180, 190, 200, 210, 220, 225, 230, 240, 250, 260,
      270, 280, 290, 300, 310, 315, 320, 330, 340, 350,
    ];
    return Math.PI / 180 * angles[orbitIndex % 40];
  }

  // Generic even spacing for other orbit sizes.
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
  return Array.from(connSet).filter((id) => isRenderableTreeEdge(nodeId, id));
}

// Ascendant path nodes use cross-tree links for allocation rules. Those links
// are not physical connectors on the passive tree and must not be drawn.
function isRenderableTreeEdge(nodeId, otherId) {
  const node = nodes[nodeId];
  const other = nodes[otherId];
  if (!node || !other) return false;
  if ((node.ascendancyName || null) !== (other.ascendancyName || null)) return false;

  const nodePos = calcNodePosition(node);
  const otherPos = calcNodePosition(other);
  const distance = Math.hypot(nodePos.x - otherPos.x, nodePos.y - otherPos.y) / 100;
  return distance <= MAX_RENDER_EDGE_DISTANCE;
}

// Build a reverse map: nodeId -> all connecting nodeIds
// (to compute 'requires' — we use the 'in' direction as prerequisites)
// Actually for the passive tree, 'in' means incoming connections = prerequisites
function getRequires(nodeId) {
  const node = nodes[nodeId];
  if (!node) return [];
  return node.in || [];
}

// Build visual group metadata from the same coordinates used by nodes.
function buildPassiveGroups(skipIds) {
  return Object.entries(groups)
    .map(([groupId, group]) => {
      const groupNodeIds = (group.nodes || []).filter((nodeId) => {
        const node = nodes[nodeId];
        return node && !skipIds.has(nodeId) && node.group !== undefined;
      });
      if (groupNodeIds.length === 0) return null;

      const groupNodes = groupNodeIds.map((nodeId) => nodes[nodeId]);
      const center = { x: group.x / 100, y: group.y / 100 };
      const radius = Math.max(
        1.2,
        ...groupNodes.map((node) => {
          const pos = calcNodePosition(node);
          return Math.hypot(pos.x / 100 - center.x, pos.y / 100 - center.y);
        })
      );
      const orbitRadiiForGroup = [...new Set(groupNodes
        .map((node) => node.orbit)
        .filter((orbit) => Number.isInteger(orbit)))]
        .sort((a, b) => a - b)
        .map((orbit) => (orbitRadii[orbit] || 0) / 100)
        .filter((orbitRadius) => orbitRadius > 0);
      const ascendancyName = groupNodes.find((node) => node.ascendancyName)?.ascendancyName;

      return {
        id: String(groupId),
        x: center.x,
        y: center.y,
        radius: radius + 1.1,
        orbitRadii: orbitRadiiForGroup,
        nodes: groupNodeIds.map((nodeId) => String(nodes[nodeId].skill || nodeId)),
        hasBackground: !!group.background,
        ...(ascendancyName && { ascendancyName }),
      };
    })
    .filter(Boolean);
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

  // Class start node names to filter (these are GGG internal nodes, not real passives)
  const classStartNames = [
    'MARAUDER', 'RANGER', 'WITCH', 'DUELIST', 'TEMPLAR',
    'SIX', 'Seven', 'Shadow', 'Scion',
    'Warden of the Maji', 'Warlock of the Mists', 'Wildwood Primalist',
  ];
  // Ascendancy start hub names (orbit 0 nodes with multiple connections, no stats)
  const ascendancyStartNames = [
    'Guardian', 'Juggernaut', 'Chieftain', 'Berserker',
    'Slayer', 'Gladiator', 'Champion', 'Deadeye', 'Raider', 'Pathfinder',
    'Assassin', 'Trickster', 'Saboteur', 'Necromancer', 'Elementalist', 'Occultist',
    'Hierophant', 'Inquisitor', 'Battlemage', 'Warlord', 'Ascendant',
  ];
  // Set of node IDs to skip
  const skipIds = new Set();
  for (const [nodeId, node] of Object.entries(nodes)) {
    // Skip masteries, proxies, multiple choice options
    if (node.isMastery) { skipIds.add(nodeId); continue; }
    if (node.isProxy) { skipIds.add(nodeId); continue; }
    if (node.isMultipleChoiceOption) { skipIds.add(nodeId); continue; }
    // Skip blighted nodes
    if (node.isBlighted) { skipIds.add(nodeId); continue; }
    // Skip nodes without group (bloodline, cluster jewel notables, etc.)
    if (node.group === undefined) { skipIds.add(nodeId); continue; }
    // Skip root meta-node (GGG internal)
    if (nodeId === '0') { skipIds.add(nodeId); continue; }
    // Ascendancy starts are allocation hubs, not visible passive nodes.
    if (node.isAscendancyStart) { skipIds.add(nodeId); continue; }
    // Skip class start nodes (no stats, all-caps names)
    if (classStartNames.includes(node.name) && (!node.stats || node.stats.length === 0)) {
      skipIds.add(nodeId); continue;
    }
    // Skip ascendancy start hub nodes (no stats, many connections)
    if (node.ascendancyName && ascendancyStartNames.includes(node.name)
        && (!node.stats || node.stats.length === 0)
        && ((node.in?.length || 0) + (node.out?.length || 0)) >= 4) {
      skipIds.add(nodeId); continue;
    }
  }

  let nodeIdx = 0;
  for (const [nodeId, node] of Object.entries(nodes)) {
    // Skip filtered nodes
    if (skipIds.has(nodeId)) continue;

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
      connections: connections.filter((id) => !skipIds.has(id) && nodes[id]).map((id) => String(nodes[id]?.skill || id)),
      displayStats,
      requires: requires.filter((id) => !skipIds.has(id) && nodes[id]).map((id) => String(nodes[id]?.skill || id)),
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

  // Build visual groups and ascendancy labels.
  const passiveGroups = buildPassiveGroups(skipIds);
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

export interface PoEPassiveGroup {
  id: string;
  x: number;
  y: number;
  radius: number;
  orbitRadii: number[];
  nodes: string[];
  ascendancyName?: string;
  hasBackground: boolean;
}

export const POE_PASSIVE_GROUPS: PoEPassiveGroup[] = ${JSON.stringify(passiveGroups, null, 2)};

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
