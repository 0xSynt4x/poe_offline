#!/usr/bin/env node
/**
 * Generate the local catalog from vendored Path of Building Community gem data.
 *
 * Usage:
 *   node scripts/importPobGems.js --version v2.67.2
 *   node scripts/importPobGems.js --version v2.67.2 --download
 *   node scripts/importPobGems.js --version v2.67.2 --download --refresh
 *
 * The default path is fully offline: PoB's generated Lua files are committed
 * under scripts/pob-data. Network access is only used when --download is set;
 * the browser only consumes generated TypeScript and never evaluates Lua.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.join(__dirname, "..");
const DEFAULT_VERSION = "v2.67.2";
const DATA_DIR = path.join(__dirname, "pob-data");
const OUTPUT = path.join(ROOT, "src", "data", "gems.generated.ts");
const SKILL_FILES = [
  "act_str.lua", "act_dex.lua", "act_int.lua",
  "sup_str.lua", "sup_dex.lua", "sup_int.lua",
  "other.lua", "minion.lua", "spectre.lua", "glove.lua",
];

const args = process.argv.slice(2);
const versionIndex = args.indexOf("--version");
const version = versionIndex >= 0 && args[versionIndex + 1] ? args[versionIndex + 1] : DEFAULT_VERSION;
const downloadSources = args.includes("--download") || args.includes("--refresh");
const refresh = args.includes("--refresh");
const versionDir = path.join(DATA_DIR, version);

function fail(message) {
  console.error(`PoB gem import failed: ${message}`);
  process.exit(1);
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { "User-Agent": "freebuff-pob-gem-importer" } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        download(new URL(response.headers.location, url).toString(), destination).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`${response.statusCode} ${response.statusMessage || "HTTP error"}`));
        return;
      }
      const stream = fs.createWriteStream(destination);
      response.pipe(stream);
      stream.on("finish", () => stream.close(resolve));
      stream.on("error", reject);
    });
    request.on("error", reject);
  });
}

async function ensureSources() {
  const files = ["Gems.lua", ...SKILL_FILES];
  const missing = files.filter((file) => {
    const destination = path.join(versionDir, file);
    return !fs.existsSync(destination) || fs.statSync(destination).size === 0;
  });
  if (!downloadSources) {
    if (missing.length > 0) {
      throw new Error(`missing vendored PoB source files: ${missing.join(", ")}. Re-run with --download to fetch them.`);
    }
    return;
  }

  fs.mkdirSync(versionDir, { recursive: true });
  for (const file of files) {
    const destination = path.join(versionDir, file);
    if (!refresh && fs.existsSync(destination) && fs.statSync(destination).size > 0) continue;
    const url = `https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding/${version}/src/Data/${file === "Gems.lua" ? file : `Skills/${file}`}`;
    process.stdout.write(`Downloading ${url}\n`);
    await download(url, destination);
  }
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = openIndex; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "-" && next === "-") {
      if (text[i + 2] === "[" && text[i + 3] === "[") {
        blockComment = true;
        i += 3;
      } else {
        lineComment = true;
        i += 1;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractAssignedTables(text, pattern) {
  const tables = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const openIndex = text.indexOf("{", match.index + match[0].length - 1);
    const closeIndex = findMatchingBrace(text, openIndex);
    if (closeIndex < 0) throw new Error(`Unclosed Lua table near ${match[0]}`);
    tables.push({ key: match[1], body: text.slice(openIndex + 1, closeIndex) });
    pattern.lastIndex = closeIndex + 1;
  }
  return tables;
}

function decodeLuaString(value) {
  return value
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function getString(body, field) {
  const match = body.match(new RegExp(`\\b${field}\\s*=\\s*([\\\"'])([\\s\\S]*?)\\1`));
  return match ? decodeLuaString(match[2]) : undefined;
}

function getNumber(body, field) {
  const match = body.match(new RegExp(`\\b${field}\\s*=\\s*(-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)`));
  return match ? Number(match[1]) : undefined;
}

function getBoolean(body, field) {
  const match = body.match(new RegExp(`\\b${field}\\s*=\\s*(true|false)`));
  return match ? match[1] === "true" : undefined;
}

function getTableBody(body, field) {
  const marker = new RegExp(`\\b${field}\\s*=\\s*\\{`, "g");
  const match = marker.exec(body);
  if (!match) return undefined;
  const openIndex = body.indexOf("{", match.index);
  const closeIndex = findMatchingBrace(body, openIndex);
  return closeIndex >= 0 ? body.slice(openIndex + 1, closeIndex) : undefined;
}

function getBooleanKeys(tableBody) {
  if (!tableBody) return [];
  return [...tableBody.matchAll(/(?:\[\s*(?:["']([^"']+)["']|([A-Za-z][A-Za-z0-9_.]*))\s*\]|([A-Za-z][A-Za-z0-9_.]*))\s*=\s*true/g)]
    .map((match) => (match[1] || match[2] || match[3]).replace(/^SkillType\./, ""));
}

function getQuotedValues(tableBody) {
  if (!tableBody) return [];
  const values = [...tableBody.matchAll(/(?:\[\s*["']([^"']+)["']\s*\]|"([^"]+)"|'([^']+)')\s*(?:,|$)/g)]
    .map((match) => decodeLuaString(match[1] || match[2] || match[3]));
  for (const match of tableBody.matchAll(/SkillType\.([A-Za-z0-9_]+)/g)) values.push(match[1]);
  return [...new Set(values)];
}

function splitTopLevel(text) {
  const result = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{" || char === "(") depth += 1;
    else if (char === "}" || char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      result.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (text.slice(start).trim()) result.push(text.slice(start).trim());
  return result;
}

function getLevelTables(body) {
  const levelsBody = getTableBody(body, "levels");
  if (!levelsBody) return [];
  const levels = [];
  const pattern = /\[(\d+)\]\s*=\s*\{/g;
  let match;
  while ((match = pattern.exec(levelsBody)) !== null) {
    const openIndex = levelsBody.indexOf("{", match.index);
    const closeIndex = findMatchingBrace(levelsBody, openIndex);
    if (closeIndex < 0) continue;
    const levelBody = levelsBody.slice(openIndex + 1, closeIndex);
    const parts = splitTopLevel(levelBody);
    const values = [];
    for (const part of parts) {
      const valueMatch = part.match(/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/);
      if (valueMatch) values.push(Number(valueMatch[0]));
      else break;
    }
    const costBody = getTableBody(levelBody, "cost");
    const level = {
      level: Number(match[1]),
      requiredLevel: getNumber(levelBody, "levelRequirement") || 1,
      values,
      ...(getNumber(levelBody, "damageEffectiveness") !== undefined && { damageEffectiveness: getNumber(levelBody, "damageEffectiveness") }),
      ...(getNumber(levelBody, "critChance") !== undefined && { critChance: getNumber(levelBody, "critChance") }),
      ...(getNumber(costBody || "", "Mana") !== undefined && { manaCost: getNumber(costBody || "", "Mana") }),
      ...(getNumber(levelBody, "manaMultiplier") !== undefined && { manaMultiplier: getNumber(levelBody, "manaMultiplier") }),
    };
    levels.push(level);
    pattern.lastIndex = closeIndex + 1;
  }
  return levels.sort((a, b) => a.level - b.level);
}

function getPairTable(body, field) {
  const tableBody = getTableBody(body, field);
  if (!tableBody) return [];
  return [...tableBody.matchAll(/\{\s*["']([^"']+)["']\s*,\s*(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*\}/g)]
    .map((match) => ({ stat: match[1], value: Number(match[2]) }));
}

function parseMetadata(text) {
  return extractAssignedTables(text, /\["([^"]+)"\]\s*=\s*\{/g).map(({ key, body }) => ({
    metadataId: key,
    name: getString(body, "name") || key.split("/").pop() || key,
    baseTypeName: getString(body, "baseTypeName"),
    grantedEffectId: getString(body, "grantedEffectId"),
    variantId: getString(body, "variantId"),
    tags: getBooleanKeys(getTableBody(body, "tags")),
    tagString: getString(body, "tagString"),
    color: getNumber(body, "color"),
    vaalGem: getBoolean(body, "vaalGem") === true,
    naturalMaxLevel: getNumber(body, "naturalMaxLevel"),
    reqStr: getNumber(body, "reqStr"),
    reqDex: getNumber(body, "reqDex"),
    reqInt: getNumber(body, "reqInt"),
  }));
}

function parseSkillFiles(files) {
  const skills = new Map();
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const tables = extractAssignedTables(text, /skills\["([^"]+)"\]\s*=\s*\{/g);
    for (const { key, body } of tables) {
      skills.set(key, {
        skillId: key,
        file: path.basename(file),
        name: getString(body, "name") || key,
        description: getString(body, "description") || "",
        color: getNumber(body, "color"),
        castTime: getNumber(body, "castTime"),
        baseEffectiveness: getNumber(body, "baseEffectiveness"),
        incrementalEffectiveness: getNumber(body, "incrementalEffectiveness"),
        skillTypes: [
          ...getBooleanKeys(getTableBody(body, "skillTypes")),
          ...getBooleanKeys(getTableBody(body, "baseFlags")),
        ],
        requireSkillTypes: getQuotedValues(getTableBody(body, "requireSkillTypes")),
        addSkillTypes: getQuotedValues(getTableBody(body, "addSkillTypes")),
        excludeSkillTypes: getQuotedValues(getTableBody(body, "excludeSkillTypes")),
        stats: getQuotedValues(getTableBody(body, "stats")),
        qualityStats: getPairTable(body, "qualityStats"),
        constantStats: getPairTable(body, "constantStats"),
        levels: getLevelTables(body),
        support: getBoolean(body, "support") === true,
      });
    }
  }
  return skills;
}

function slugify(value) {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
  return slug || "gem";
}

function normalizedTags(skillTypes, metadataTags) {
  const source = [...skillTypes, ...metadataTags];
  const result = new Set();
  const map = {
    Attack: "attack", Spell: "spell", Melee: "melee", Projectile: "projectile",
    Area: "aoe", Duration: "duration", Channelling: "channel", Channelled: "channel",
    Fire: "fire", Cold: "cold", Lightning: "lightning", Physical: "physical", Chaos: "chaos",
    Minion: "minion", Totem: "totem", Trap: "trap", Mine: "mine", Warcry: "warcry",
    Curse: "curse", Hex: "curse", Nova: "nova", Chain: "chain", Strike: "strike",
    Slam: "slam", Movement: "movement", Bow: "bow", Damage: "damage",    Brand: "brand",
    DegenOnlySpellDamage: "spell",
    SpellDamage: "spell",
    Channelling: "channel", Dot: "dot", DamageOverTime: "dot",
  };
  const knownTags = new Set([
    "attack", "spell", "melee", "projectile", "aoe", "area", "duration", "channel",
    "fire", "cold", "lightning", "physical", "chaos", "minion", "totem", "trap", "mine",
    "warcry", "curse", "nova", "chain", "strike", "slam", "movement", "bow", "damage",
    "brand", "dot", "channelling", "travel", "guard", "hex", "mark", "critical",
  ]);
  for (const tag of source) {
    const cleaned = tag.replace(/^SkillType\\./, "").toLowerCase();
    const normalized = map[tag] || map[tag.replace(/^SkillType\\./, "")] ||
      (knownTags.has(cleaned) ? (cleaned === "area" ? "aoe" : cleaned === "channelling" ? "channel" : cleaned) : undefined);
    if (normalized) result.add(normalized);
  }
  if (result.has("duration") && !result.has("dot") && [...result].some((tag) => ["fire", "cold", "lightning", "chaos", "physical"].includes(tag))) {
    // Duration is the closest local representation for PoB's persistent skills.
  }
  return [...result];
}

function firstLevel(skill) {
  return skill.levels && skill.levels.length ? skill.levels[0] : undefined;
}

function average(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function damageTypeFor(tags) {
  for (const type of ["fire", "cold", "lightning", "chaos", "physical"]) {
    if (tags.includes(type)) return type;
  }
  return "physical";
}

function requiredTagsForSupport(skill) {
  const tags = normalizedTags(skill.requireSkillTypes || [], []);
  return tags.filter((tag) => tag !== "damage");
}

function mapAddedStats(skill, level) {
  const values = level ? level.values : [];
  const first = values[0];
  if (first === undefined) return [];
  const stats = skill.stats || [];
  const mapped = [];
  const add = (stat, value = first) => mapped.push({ stat, value: Math.round(value * 10000) / 10000 });
  if (stats.some((stat) => stat.includes("physical_damage_%_to_add_as_fire"))) add("fireDamageAsPhysPercent");
  if (stats.some((stat) => stat.includes("physical_damage_%_to_add_as_cold"))) add("coldDamageAsPhysPercent");
  if (stats.some((stat) => stat.includes("physical_damage_%_to_add_as_lightning"))) add("lightningDamageAsPhysPercent");
  if (stats.some((stat) => stat.includes("added_chaos_damage"))) add("chaosDamage", average(values));
  if (stats.some((stat) => stat.includes("attack_speed_+%"))) add("attackSpeed");
  if (stats.some((stat) => stat.includes("cast_speed_+%"))) add("castSpeed");
  if (stats.some((stat) => stat.includes("critical_strike_chance_+%"))) add("critChance");
  if (stats.some((stat) => stat.includes("critical_strike_multiplier_+%"))) add("critMultiplier");
  if (stats.some((stat) => stat.includes("area_of_effect_+%"))) add("aoeSize");
  if (stats.some((stat) => stat.includes("number_of_projectiles"))) add("projectileCount");
  if (stats.some((stat) => stat.includes("number_of_chains"))) add("chainCount");
  if (stats.some((stat) => stat.includes("pierce"))) add("pierceCount");
  return mapped;
}

function mapMultiplier(skill, level) {
  if (!level || !level.values.length) return undefined;
  const stats = skill.stats || [];
  const hasFinalDamage = stats.some((stat) => stat.includes("damage_+%_final") || stat.includes("damage_+%_more"));
  if (!hasFinalDamage) return undefined;
  const value = level.values[0];
  if (!Number.isFinite(value) || value === 0 || Math.abs(value) > 200) return undefined;
  return Math.round(value / 100 * 10000) / 10000;
}

function toGem(metadata, skill, id, version) {
  const effectiveSkill = skill || {
    skillId: metadata.grantedEffectId || metadata.variantId || metadata.name,
    file: "metadata-only",
    name: metadata.name,
    description: "",
    color: metadata.color,
    castTime: 1,
    skillTypes: metadata.tags,
    levels: [],
    stats: [],
    qualityStats: [],
    constantStats: [],
    requireSkillTypes: [],
    addSkillTypes: [],
    excludeSkillTypes: [],
    support: metadata.tags.includes("support"),
  };
  const tags = normalizedTags(effectiveSkill.skillTypes || [], metadata.tags);
  const level = firstLevel(effectiveSkill);
  const colorNumber = effectiveSkill.color || metadata.color || (metadata.reqStr > metadata.reqInt && metadata.reqStr >= metadata.reqDex ? 1 : metadata.reqDex > metadata.reqInt ? 2 : 3);
  const color = colorNumber === 1 ? "Red" : colorNumber === 2 ? "Green" : colorNumber === 4 ? "White" : "Blue";
  const isSupport = metadata.tags.includes("support") || effectiveSkill.support;
  const source = {
    metadataId: metadata.metadataId,
    grantedEffectId: metadata.grantedEffectId,
    variantId: metadata.variantId,
    skillId: effectiveSkill.skillId,
    skillFile: effectiveSkill.file,
    tags: metadata.tags,
    tagString: metadata.tagString,
    vaalGem: metadata.vaalGem || undefined,
    naturalMaxLevel: metadata.naturalMaxLevel,
    baseEffectiveness: effectiveSkill.baseEffectiveness,
    incrementalEffectiveness: effectiveSkill.incrementalEffectiveness,
    skillTypes: effectiveSkill.skillTypes,
    requireSkillTypes: effectiveSkill.requireSkillTypes,
    addSkillTypes: effectiveSkill.addSkillTypes,
    excludeSkillTypes: effectiveSkill.excludeSkillTypes,
    stats: effectiveSkill.stats,
    qualityStats: effectiveSkill.qualityStats,
    constantStats: effectiveSkill.constantStats,
  };
  const cleanSource = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0)));
  const gem = {
    id,
    name: metadata.name,
    type: isSupport ? "Support" : "Active",
    color,
    requiredLevel: Math.max(1, level ? level.requiredLevel : 1),
    description: effectiveSkill.description || `PoB ${isSupport ? "support" : "active"} skill gem: ${metadata.name}`,
    ...(metadata.vaalGem && { limitedDrop: true }),
    source: cleanSource,
  };
  if (isSupport) {
    const requiredTags = requiredTagsForSupport(effectiveSkill);
    const support = {
      ...(mapMultiplier(effectiveSkill, level) !== undefined && { multiplier: mapMultiplier(effectiveSkill, level) }),
      ...(requiredTags.length === 1 && { requiredTags }),
      ...(requiredTags.length > 1 && { requiredTagGroups: [requiredTags] }),
      ...(effectiveSkill.addSkillTypes && effectiveSkill.addSkillTypes.length > 0 && { grantedTags: normalizedTags(effectiveSkill.addSkillTypes, []) }),
      ...(effectiveSkill.stats && effectiveSkill.stats.length > 0 && { stats: effectiveSkill.stats }),
      ...(effectiveSkill.levels && effectiveSkill.levels.length > 0 && { levels: effectiveSkill.levels }),
      ...(mapAddedStats(effectiveSkill, level).length > 0 && { addedStats: mapAddedStats(effectiveSkill, level) }),
    };
    gem.support = support;
  } else {
    const baseDamage = level && level.damageEffectiveness !== undefined
      ? Math.max(0, Math.round(level.damageEffectiveness * 100))
      : effectiveSkill.baseEffectiveness !== undefined
        ? Math.max(0, Math.round(effectiveSkill.baseEffectiveness * 100))
        : 0;
    const active = {
      baseDamage,
      tags,
      damageType: damageTypeFor(tags),
      manaCost: level && level.manaCost !== undefined ? level.manaCost : 0,
      castTime: effectiveSkill.castTime !== undefined ? effectiveSkill.castTime : 1,
      levelScaling: "per_level",
      ...(effectiveSkill.incrementalEffectiveness !== undefined && { flatDamagePerLevel: Math.round(effectiveSkill.incrementalEffectiveness * 100) }),
      ...(effectiveSkill.levels && effectiveSkill.levels.length > 0 && { levels: effectiveSkill.levels }),
      ...(effectiveSkill.skillTypes && effectiveSkill.skillTypes.length > 0 && { skillTypes: effectiveSkill.skillTypes }),
      ...(effectiveSkill.stats && effectiveSkill.stats.length > 0 && { stats: effectiveSkill.stats }),
    };
    gem.active = active;
  }
  return gem;
}

function generateTypeScript(gems) {
  const activeCount = gems.filter((gem) => gem.type === "Active").length;
  const supportCount = gems.length - activeCount;
  let serialized = JSON.stringify(gems, null, 2);
  serialized = serialized
    .replace(/("type": )"Active"/g, "$1GemType.Active")
    .replace(/("type": )"Support"/g, "$1GemType.Support")
    .replace(/("color": )"Red"/g, "$1GemColor.Red")
    .replace(/("color": )"Green"/g, "$1GemColor.Green")
    .replace(/("color": )"Blue"/g, "$1GemColor.Blue")
    .replace(/("color": )"White"/g, "$1GemColor.White")
    .replace(/("damageType": )"physical"/g, "$1DamageType.Physical")
    .replace(/("damageType": )"fire"/g, "$1DamageType.Fire")
    .replace(/("damageType": )"cold"/g, "$1DamageType.Cold")
    .replace(/("damageType": )"lightning"/g, "$1DamageType.Lightning")
    .replace(/("damageType": )"chaos"/g, "$1DamageType.Chaos");
  return `// Auto-generated from Path of Building Community gem data (${version}).\n// DO NOT EDIT MANUALLY - run: npm run import:gems -- --version ${version}\n// Source: https://github.com/PathOfBuildingCommunity/PathOfBuilding/tree/${version}/src/Data\n\nimport { DamageType, GemColor, GemType } from "../models/types";\nimport type { GemData } from "./gems";\n\nexport const GENERATED_GEM_COUNTS = { active: ${activeCount}, support: ${supportCount}, total: ${gems.length} } as const;\n\nexport const POB_GEM_DATA_SOURCE = {\n  provider: "Path of Building Community",\n  gameVersion: "PoE 3.29.1",\n  pobRelease: ${JSON.stringify(version)},\n  generatedData: "src/Data/Gems.lua",\n  skillData: "src/Data/Skills/{act_*,sup_*,other,minion,spectre,glove}.lua",\n  repository: "https://github.com/PathOfBuildingCommunity/PathOfBuilding/tree/${version}",\n  activeCount: ${activeCount},\n  supportCount: ${supportCount},\n} as const;\n\nexport const GENERATED_GEMS: GemData[] = ${serialized};\n`;
}

async function main() {
  await ensureSources();
  const metadataText = fs.readFileSync(path.join(versionDir, "Gems.lua"), "utf8");
  const metadata = parseMetadata(metadataText);
  const skillFiles = SKILL_FILES.map((file) => path.join(versionDir, file));
  const skills = parseSkillFiles(skillFiles);
  const seen = new Set();
  const gems = [];
  let collisionCount = 0;
  for (const item of metadata) {
    if (!item.tags.includes("grants_active_skill") && !item.tags.includes("support")) continue;
    let id = slugify(item.name);
    if (seen.has(id)) {
      collisionCount += 1;
      id = `${id}__${slugify(item.variantId || item.metadataId.split("/").pop())}`;
    }
    while (seen.has(id)) id += "_2";
    seen.add(id);
    const skill = skills.get(item.grantedEffectId) || skills.get(item.variantId);
    gems.push(toGem(item, skill, id, version));
  }
  if (gems.length === 0) fail("no active or support gems were parsed");
  const activeWithoutTags = gems.filter((gem) => gem.type === "Active" && gem.active && gem.active.tags.length === 0);
  if (activeWithoutTags.length > 0) fail(`${activeWithoutTags.length} active gems have no normalized tags (for example: ${activeWithoutTags[0].name})`);
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, generateTypeScript(gems), "utf8");
  console.log(`Generated ${OUTPUT}`);
  console.log(`PoB ${version}: ${gems.filter((gem) => gem.type === "Active").length} active, ${gems.filter((gem) => gem.type === "Support").length} support, ${collisionCount} id collisions`);
}

main().catch((error) => fail(error.stack || error.message));
