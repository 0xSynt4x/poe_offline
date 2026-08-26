import { Gem, GemType, SkillGroup, GemColor, DamageType } from "../models/types";
import { GemData, getGemById, ACTIVE_GEMS, SUPPORT_GEMS } from "../data/gems";

/** 宝石等级曲线：等级越高需要的经验越多，避免低级宝石瞬间满级。 */
export function gemExperienceToNextLevel(level: number): number {
  return Math.floor(80 + level * level * 35);
}

export function addGemExperience(gem: Gem, amount: number): { levelsGained: number; level: number } {
  if (amount <= 0) return { levelsGained: 0, level: gem.level };
  let levelsGained = 0;
  gem.experience += amount;
  while (gem.level < 20 && gem.experience >= gemExperienceToNextLevel(gem.level)) {
    gem.experience -= gemExperienceToNextLevel(gem.level);
    gem.level += 1;
    levelsGained += 1;
  }
  return { levelsGained, level: gem.level };
}

export function getGemProgress(gem: Gem): { current: number; required: number; percent: number } {
  const required = gemExperienceToNextLevel(gem.level);
  return { current: gem.experience, required, percent: Math.min(100, Math.floor(gem.experience / required * 100)) };
}

// ===== 技能组计算 =====

export function computeSkillGroup(group: SkillGroup): ComputedSkill {
  const activeGem = group.activeGem;
  const activeData = getGemById(activeGem.id);
  
  if (!activeData?.active) {
    return {
      totalDamage: 0,
      damageType: DamageType.Physical,
      tags: [],
      manaCost: 0,
      castTime: 1,
      specialEffects: [],
      multiplier: 1,
    };
  }
  
  // 基础数据
  const baseDamage = activeData.active.baseDamage + 
    (activeData.active.flatDamagePerLevel || 0) * (activeGem.level - 1);
  
  const tags = [...activeData.active.tags];
  const specialEffects: string[] = [];
  let totalMultiplier = 1;
  let manaCost = activeData.active.manaCost;
  let castTime = activeData.active.castTime;
  
  // 应用辅助宝石
  for (const supportGem of group.supportGems) {
    const supportData = getGemById(supportGem.id);
    if (!supportData?.support) continue;
    
    const support = supportData.support;
    
    // 检查标签匹配
    const hasMatchingTag = tags.some((t) => 
      support.addedTags?.includes(t)
    );
    
    if (!hasMatchingTag) continue;
    
    // 应用伤害乘率
    if (support.multiplier && support.multiplier !== 0) {
      totalMultiplier *= (1 + support.multiplier);
    }
    
    // 应用额外属性
    if (support.addedStats) {
      for (const stat of support.addedStats) {
        // 这里简化处理，实际需要更复杂的属性系统
        if (stat.stat === "attackSpeed" || stat.stat === "critChance" || 
            stat.stat === "critMultiplier" || stat.stat === "aoeSize") {
          // 这些属性需要在战斗计算时应用
        }
      }
    }
    
    // 添加标签
    if (support.addedTags) {
      for (const tag of support.addedTags) {
        if (!tags.includes(tag)) tags.push(tag);
      }
    }

    // 辅助宝石的数值随宝石等级成长，保持“升级宝石”对 Build 有实际反馈。
    const supportLevelScale = 1 + Math.max(0, supportGem.level - 1) * 0.04;
    totalMultiplier *= supportLevelScale;
    
    // 记录特殊效果
    if (support.specialEffect) {
      specialEffects.push(support.specialEffect);
    }
  }
  
  return {
    totalDamage: Math.floor(baseDamage * totalMultiplier),
    damageType: activeData.active.damageType,
    tags,
    manaCost,
    castTime,
    specialEffects,
    multiplier: totalMultiplier,
  };
}

export interface ComputedSkill {
  totalDamage: number;
  damageType: DamageType;
  tags: string[];
  manaCost: number;
  castTime: number;
  specialEffects: string[];
  multiplier: number;
}

// ===== 技能组创建 =====

export function createSkillGroup(
  activeGemId: string,
  supportGemIds: string[] = []
): SkillGroup {
  const activeData = getGemById(activeGemId);
  if (!activeData || activeData.type !== GemType.Active) {
    throw new Error(`Invalid active gem: ${activeGemId}`);
  }
  
  const activeGem: Gem = {
    id: activeGemId,
    name: activeData.name,
    type: GemType.Active,
    color: activeData.color,
    level: 1,
    experience: 0,
    requiredLevel: activeData.requiredLevel,
  };
  
  const supportGems: Gem[] = [];
  for (const supportId of supportGemIds) {
    const supportData = getGemById(supportId);
    if (!supportData || supportData.type !== GemType.Support) {
      console.warn(`Invalid support gem: ${supportId}`);
      continue;
    }
    
    supportGems.push({
      id: supportId,
      name: supportData.name,
      type: GemType.Support,
      color: supportData.color,
      level: 1,
      experience: 0,
      requiredLevel: supportData.requiredLevel,
    });
  }
  
  return {
    id: `skill_${Date.now()}`,
    name: activeData.name,
    activeGem,
    supportGems,
  };
}

// ===== 格式化显示 =====

export function formatSkillGroup(group: SkillGroup): string {
  const computed = computeSkillGroup(group);
  
  const lines: string[] = [];
  lines.push(`${group.activeGem.name} (${computed.totalDamage} ${computed.damageType})`);
  lines.push(`  标签: ${computed.tags.join(", ")}`);
  lines.push(`  伤害倍率: ${(computed.multiplier * 100).toFixed(0)}%`);
  lines.push(`  魔力消耗: ${computed.manaCost}`);
  lines.push(`  施法时间: ${computed.castTime}s`);
  
  if (computed.specialEffects.length > 0) {
    lines.push(`  特殊效果: ${computed.specialEffects.join(", ")}`);
  }
  
  if (group.supportGems.length > 0) {
    lines.push(`  辅助宝石:`);
    for (const support of group.supportGems) {
      const supportData = getGemById(support.id);
      lines.push(`    - ${support.name}: ${supportData?.description || ""}`);
    }
  }
  
  return lines.join("\n");
}

// ===== 测试函数 =====

export function testGemSystem() {
  console.log("=== 宝石系统测试 ===\n");
  
  // 测试1: 单个主动技能
  const skill1 = createSkillGroup("lacerate");
  console.log("1. 单技能:");
  console.log(formatSkillGroup(skill1));
  console.log();
  
  // 测试2: 主动+1辅助
  const skill2 = createSkillGroup("lacerate", ["melee_physical_damage"]);
  console.log("2. 近战物理伤害辅助:");
  console.log(formatSkillGroup(skill2));
  console.log();
  
  // 测试3: 主动+2辅助
  const skill3 = createSkillGroup("lacerate", [
    "melee_physical_damage",
    "added_fire_damage",
  ]);
  console.log("3. 近战物理+火焰辅助:");
  console.log(formatSkillGroup(skill3));
  console.log();
  
  // 测试4: 法术技能
  const skill4 = createSkillGroup("fireball", [
    "controlled_destruction",
    "fire_penetration",
  ]);
  console.log("4. 火球术+操控毁灭+火焰穿透:");
  console.log(formatSkillGroup(skill4));
  console.log();
  
  // 测试5: 连锁效果
  const skill5 = createSkillGroup("lightning_arrow", ["chain"]);
  console.log("5. 闪电箭+连锁:");
  console.log(formatSkillGroup(skill5));
}
