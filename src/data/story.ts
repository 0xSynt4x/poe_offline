// ===== 剧情系统 - PoE1风格 =====

// ===== NPC商店类型 =====

export interface NpcShop {
  id: string;
  name: string;
  description: string;
  chapter: number;
  sells: string[];              // 出售的宝石ID列表
  currencyType: string;         // 货币类型（通货ID）
  pricePerGem: number;          // 每个宝石的价格
}

// ===== 任务奖励类型 =====

export interface QuestReward {
  experience: number;
  currency: string[];          // 通货ID列表（1-3个随机）
  itemLevel: number;           // 装备生成等级
  gemReward?: string;          // 技能宝石ID（可选）
}

// ===== 任务定义 =====

export interface Quest {
  id: string;
  name: string;
  description: string;
  chapter: number;
  order: number;               // 任务顺序
  requiredLevel: number;
  prerequisiteQuest?: string;  // 前置任务ID
  isBoss: boolean;             // 是否为Boss任务
  bossId?: string;             // Boss怪物ID
  reward: QuestReward;
}

// ===== 章节定义 =====

export interface Chapter {
  id: string;
  name: string;
  description: string;
  levelRange: [number, number];
  quests: Quest[];
  npcs?: NpcShop[];             // 章节内NPC（可选）
}

// ===== 章节1：平静小镇（Lv1-15）=====

const CHAPTER_1_QUESTS: Quest[] = [
  {
    id: "ch1_q1",
    name: "镇外的异动",
    description: "调查小镇周围出现的异常怪物，保护居民安全。",
    chapter: 1,
    order: 1,
    requiredLevel: 1,
    isBoss: false,
    reward: {
      experience: 100,
      currency: ["orb_of_alteration"],
      itemLevel: 3,
      gemReward: "lacerate",  // 第一个主动技能宝石
    },
  },
  {
    id: "ch1_q2",
    name: "矿洞的秘密",
    description: "前往废弃矿洞调查，据说里面发现了古代遗迹。",
    chapter: 1,
    order: 2,
    requiredLevel: 5,
    prerequisiteQuest: "ch1_q1",
    isBoss: false,
    reward: {
      experience: 250,
      currency: ["orb_of_augmentation", "blacksmith_whetstone"],
      itemLevel: 8,
    },
  },
  {
    id: "ch1_q3",
    name: "森林深处的呼唤",
    description: "追踪逃入森林的怪物，发现了一座被遗忘的神殿。",
    chapter: 1,
    order: 3,
    requiredLevel: 10,
    prerequisiteQuest: "ch1_q2",
    isBoss: false,
    reward: {
      experience: 500,
      currency: ["chromatic_orb", "armourers_scrap"],
      itemLevel: 12,
    },
  },
  {
    id: "ch1_boss",
    name: "腐化领主",
    description: "击败盘踞在神殿深处的腐化领主，解除小镇的威胁。",
    chapter: 1,
    order: 4,
    requiredLevel: 12,
    prerequisiteQuest: "ch1_q3",
    isBoss: true,
    bossId: "corrupted_lord",
    reward: {
      experience: 1000,
      currency: ["chaos_orb", "orb_of_scouring", "chromatic_orb"],
      itemLevel: 15,
    },
  },
];

// ===== 章节2：荒野探索（Lv16-30）=====

const CHAPTER_2_QUESTS: Quest[] = [
  {
    id: "ch2_q1",
    name: "破碎城墙",
    description: "穿越荒野，抵达王都废墟，调查城墙倒塌的原因。",
    chapter: 2,
    order: 1,
    requiredLevel: 16,
    prerequisiteQuest: "ch1_boss",
    isBoss: false,
    reward: {
      experience: 1200,
      currency: ["orb_of_augmentation", "blacksmith_whetstone"],
      itemLevel: 18,
    },
  },
  {
    id: "ch2_q2",
    name: "地下墓穴",
    description: "探索王都地下的古老墓穴，寻找失落的传承。",
    chapter: 2,
    order: 2,
    requiredLevel: 20,
    prerequisiteQuest: "ch2_q1",
    isBoss: false,
    reward: {
      experience: 2000,
      currency: ["regal_orb", "chromatic_orb"],
      itemLevel: 22,
    },
  },
  {
    id: "ch2_q3",
    name: "守护者之塔",
    description: "攀登守护者之塔，击败盘踞其中的恶魔。",
    chapter: 2,
    order: 3,
    requiredLevel: 25,
    prerequisiteQuest: "ch2_q2",
    isBoss: false,
    reward: {
      experience: 3500,
      currency: ["chaos_orb", "armourers_scrap", "orb_of_scouring"],
      itemLevel: 27,
    },
  },
  {
    id: "ch2_boss",
    name: "荒野之王",
    description: "击败统治荒野的邪恶领主，通往要塞的道路即将开启。",
    chapter: 2,
    order: 4,
    requiredLevel: 28,
    prerequisiteQuest: "ch2_q3",
    isBoss: true,
    bossId: "wasteland_king",
    reward: {
      experience: 6000,
      currency: ["exalted_orb", "chaos_orb", "divine_orb"],
      itemLevel: 30,
    },
  },
];

// ===== 章节3：要塞攻防（Lv31-45）=====

const CHAPTER_3_QUESTS: Quest[] = [
  {
    id: "ch3_q1",
    name: "要塞前线",
    description: "加入联盟军队，参与对黑暗要塞的围攻。",
    chapter: 3,
    order: 1,
    requiredLevel: 31,
    prerequisiteQuest: "ch2_boss",
    isBoss: false,
    reward: {
      experience: 8000,
      currency: ["regal_orb", "blacksmith_whetstone"],
      itemLevel: 33,
    },
  },
  {
    id: "ch3_q2",
    name: "内城渗透",
    description: "潜入要塞内部，破坏敌人的防御工事。",
    chapter: 3,
    order: 2,
    requiredLevel: 35,
    prerequisiteQuest: "ch3_q1",
    isBoss: false,
    reward: {
      experience: 12000,
      currency: ["chaos_orb", "orb_of_fusing"],
      itemLevel: 37,
    },
  },
  {
    id: "ch3_q3",
    name: "魔法屏障",
    description: "摧毁维持要塞魔法屏障的能量节点。",
    chapter: 3,
    order: 3,
    requiredLevel: 40,
    prerequisiteQuest: "ch3_q2",
    isBoss: false,
    reward: {
      experience: 18000,
      currency: ["divine_orb", "chromatic_orb", "armourers_scrap"],
      itemLevel: 42,
    },
  },
  {
    id: "ch3_q4",
    name: "最终防御",
    description: "要塞守卫长亲自出马，击败他才能打开终局之门。",
    chapter: 3,
    order: 4,
    requiredLevel: 43,
    prerequisiteQuest: "ch3_q3",
    isBoss: true,
    bossId: "fortress_guardian",
    reward: {
      experience: 30000,
      currency: ["exalted_orb", "chaos_orb", "divine_orb"],
      itemLevel: 45,
    },
  },
];

// ===== 章节4：终局之门（Lv46-60）=====

const CHAPTER_4_QUESTS: Quest[] = [
  {
    id: "ch4_q1",
    name: "虚空中转",
    description: "穿过终局之门，进入未知的虚空领域。",
    chapter: 4,
    order: 1,
    requiredLevel: 46,
    prerequisiteQuest: "ch3_q4",
    isBoss: false,
    reward: {
      experience: 40000,
      currency: ["regal_orb", "orb_of_chance"],
      itemLevel: 48,
    },
  },
  {
    id: "ch4_q2",
    name: "扭曲的现实",
    description: "虚空中的现实支离破碎，击败扭曲的幻象。",
    chapter: 4,
    order: 2,
    requiredLevel: 50,
    prerequisiteQuest: "ch4_q1",
    isBoss: false,
    reward: {
      experience: 60000,
      currency: ["divine_orb", "chaos_orb", "orb_of_annulment"],
      itemLevel: 52,
    },
  },
  {
    id: "ch4_q3",
    name: "虚空守望者",
    description: "击败守护虚空通道的强大存在。",
    chapter: 4,
    order: 3,
    requiredLevel: 55,
    prerequisiteQuest: "ch4_q2",
    isBoss: true,
    bossId: "void_watcher",
    reward: {
      experience: 100000,
      currency: ["exalted_orb", "divine_orb", "exalted_orb"],
      itemLevel: 58,
    },
  },
  {
    id: "ch4_boss",
    name: "终焉之兽",
    description: "面对最终的敌人，终结这场噩梦。",
    chapter: 4,
    order: 4,
    requiredLevel: 58,
    prerequisiteQuest: "ch4_q3",
    isBoss: true,
    bossId: "final_boss",
    reward: {
      experience: 200000,
      currency: ["exalted_orb", "divine_orb", "chaos_orb"],
      itemLevel: 60,
    },
  },
];

// ===== 所有章节 =====

export const CHAPTERS: Chapter[] = [
  {
    id: "chapter_1",
    name: "平静小镇",
    description: "一切从这个被遗忘的小镇开始。黑暗的阴影正悄然逼近...",
    levelRange: [1, 15],
    quests: CHAPTER_1_QUESTS,
  },
  {
    id: "chapter_2",
    name: "荒野探索",
    description: "离开小镇，穿越危机四伏的荒野，探索王都废墟的秘密。",
    levelRange: [16, 30],
    quests: CHAPTER_2_QUESTS,
  },
  {
    id: "chapter_3",
    name: "要塞攻防",
    description: "加入联盟军队，向盘踞在要塞中的黑暗势力发起进攻。",
    levelRange: [31, 45],
    quests: CHAPTER_3_QUESTS,
  },
  {
    id: "chapter_4",
    name: "终局之门",
    description: "穿过终局之门，直面最终的敌人，终结这场噩梦。",
    levelRange: [46, 60],
    quests: CHAPTER_4_QUESTS,
    npcs: [
      {
        id: "gem_vendor",
        name: "虚空学者·艾琳",
        description: "来自远方的学者，掌握着失落的技能知识。她愿意以合理的价格出售技能宝石。",
        chapter: 4,
        currencyType: "chaos_orb",
        pricePerGem: 1,
        sells: [],  // 由 getNpcGemStock() 动态生成
      },
    ],
  },
];

// ===== 所有任务 =====

export const ALL_QUESTS: Quest[] = CHAPTERS.flatMap((ch) => ch.quests);

// ===== 工具函数 =====

export function getChapterById(id: string): Chapter | undefined {
  return CHAPTERS.find((ch) => ch.id === id);
}

export function getChapterByNumber(num: number): Chapter | undefined {
  return CHAPTERS[num - 1];
}

export function getQuestById(id: string): Quest | undefined {
  return ALL_QUESTS.find((q) => q.id === id);
}

export function getAvailableQuests(
  playerLevel: number,
  completedQuests: string[]
): Quest[] {
  return ALL_QUESTS.filter((q) => {
    if (playerLevel < q.requiredLevel) return false;
    if (q.prerequisiteQuest && !completedQuests.includes(q.prerequisiteQuest))
      return false;
    return true;
  });
}

export function getChapterQuests(chapterId: string): Quest[] {
  return ALL_QUESTS.filter((q) => q.chapter === CHAPTERS.findIndex((c) => c.id === chapterId) + 1);
}

export function generateQuestReward(quest: Quest): {
  experience: number;
  currencies: string[];
  itemLevel: number;
  gemId?: string;
} {
  const reward = quest.reward;
  
  return {
    experience: reward.experience,
    currencies: reward.currency,
    itemLevel: reward.itemLevel,
    gemId: reward.gemReward,
  };
}

// ===== NPC商店相关 =====

import { GemData, ACTIVE_GEMS, SUPPORT_GEMS } from "./gems";

/** 获取NPC出售的宝石列表（排除限定掉落） */
export function getNpcGemStock(npcId: string): GemData[] {
  const npc = CHAPTERS.flatMap(ch => ch.npcs ?? []).find(n => n.id === npcId);
  if (!npc) return [];

  // 过滤掉限定掉落的宝石
  const allGems = [...ACTIVE_GEMS, ...SUPPORT_GEMS];
  return allGems.filter(gem => !gem.limitedDrop);
}

/** 获取玩家可购买的宝石（需满足等级要求） */
export function getBuyableGems(npcId: string, playerLevel: number): GemData[] {
  return getNpcGemStock(npcId).filter(gem => playerLevel >= gem.requiredLevel);
}

/** 获取章节内所有NPC */
export function getChapterNpcs(chapterId: string): NpcShop[] {
  const chapter = getChapterById(chapterId);
  return chapter?.npcs ?? [];
}
