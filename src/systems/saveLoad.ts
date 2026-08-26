import { Player, Item, EquipSlot, SkillGroup, Flask } from '../models/types';
import { MapDeviceState } from './mapDevice';

// ===== 存档数据结构 =====

export interface SaveData {
  version: string;
  timestamp: number;
  playTime: number;  // 游戏时间（秒）
  slotName: string;
  player: {
    name: string;
    level: number;
    experience: number;
    stats: { strength: number; dexterity: number; intelligence: number };
    life: number;
    maxLife: number;
    mana: number;
    maxMana: number;
    manaReserved: number;
    energyShield: number;
    defenses: {
      armor: number;
      evasion: number;
      energyShield: number;
      fireRes: number;
      coldRes: number;
      lightningRes: number;
      chaosRes: number;
      blockChance: number;
    };
    offense: {
      increasedDamage: number;
      moreDamage: number;
      attackSpeed: number;
      critChance: number;
      critMultiplier: number;
      accuracy: number;
    };
    passivePoints: number;
    allocatedNodes: string[];
    equipment: Partial<Record<EquipSlot, Item>>;
    skillGroups: SkillGroup[];
    flasks: (Flask | null)[];
    inventory: {
      items: Item[];
      gems: any[];
      currencies: Record<string, number>;
      maxSlots: number;
      stash: {
        items: Item[];
        gems: any[];
        currencies: Record<string, number>;
        maxSlots: number;
      };
    };
  };
  zoneProgress: {
    currentZone: string | null;
    completedZones: string[];
    currentChapter: number;
    completedQuests: string[];
    pendingRewards: string[];
    activeQuests: string[];
    currentZoneResolved: boolean;
  };
  mapDevice: MapDeviceState;
  settings: {
    autoSave: boolean;
    autoSaveInterval: number;
  };
}

export interface SaveSlot {
  id: string;
  exists: boolean;
  slotName: string;
  timestamp: number;
  playTime: number;
  level: number;
  chapter: number;
}

// ===== 存档管理器 =====

const SAVE_KEY_PREFIX = 'poe_text_game_save_';
const MAX_SLOTS = 5;

export class SaveManager {
  private lastSaveTime: number = 0;
  private autoSaveInterval: number = 300000; // 5分钟
  private autoSaveTimer: number | null = null;
  private currentSlot: number = -1;
  private playTimeStart: number = 0;
  
  constructor() {
    this.playTimeStart = Date.now();
  }
  
  // 获取所有存档槽位信息
  getSaveSlots(): SaveSlot[] {
    const slots: SaveSlot[] = [];
    
    for (let i = 0; i < MAX_SLOTS; i++) {
      const key = SAVE_KEY_PREFIX + i;
      const data = localStorage.getItem(key);
      
      if (data) {
        try {
          const save: SaveData = JSON.parse(data);
          slots.push({
            id: String(i),
            exists: true,
            slotName: save.slotName,
            timestamp: save.timestamp,
            playTime: save.playTime,
            level: save.player.level,
            chapter: save.zoneProgress.currentChapter,
          });
        } catch {
          slots.push({
            id: String(i),
            exists: false,
            slotName: `存档 ${i + 1}`,
            timestamp: 0,
            playTime: 0,
            level: 0,
            chapter: 0,
          });
        }
      } else {
        slots.push({
          id: String(i),
          exists: false,
          slotName: `存档 ${i + 1}`,
          timestamp: 0,
          playTime: 0,
          level: 0,
          chapter: 0,
        });
      }
    }
    
    return slots;
  }
  
  // 保存游戏
  save(slotId: string, player: Player, zoneProgress: any, mapDevice: MapDeviceState): boolean {
    try {
      const playTime = this.getPlayTime();
      
      const saveData: SaveData = {
        version: '1.0.0',
        timestamp: Date.now(),
        playTime,
        slotName: this.generateSlotName(player, zoneProgress),
        player: {
          name: player.name,
          level: player.level,
          experience: player.experience,
          stats: { ...player.stats },
          life: player.life,
          maxLife: player.maxLife,
          mana: player.mana,
          maxMana: player.maxMana,
          manaReserved: player.manaReserved,
          energyShield: player.energyShield,
          defenses: { ...player.defenses },
          offense: { ...player.offense },
          passivePoints: player.passivePoints,
          allocatedNodes: [...player.allocatedNodes],
          equipment: JSON.parse(JSON.stringify(player.equipment)),
          skillGroups: JSON.parse(JSON.stringify(player.skillGroups)),
          flasks: JSON.parse(JSON.stringify(player.flasks)),
          inventory: {
            items: JSON.parse(JSON.stringify(player.inventory.items)),
            gems: JSON.parse(JSON.stringify(player.inventory.gems)),
            currencies: Object.fromEntries(player.inventory.currencies),
            maxSlots: player.inventory.maxSlots,
            stash: player.inventory.stash ? {
              items: JSON.parse(JSON.stringify(player.inventory.stash.items)),
              gems: JSON.parse(JSON.stringify(player.inventory.stash.gems)),
              currencies: Object.fromEntries(player.inventory.stash.currencies),
              maxSlots: player.inventory.stash.maxSlots,
            } : { items: [], gems: [], currencies: {}, maxSlots: 0 },
          },
        },
        zoneProgress: {
          currentZone: zoneProgress.currentZone,
          completedZones: [...zoneProgress.completedZones],
          currentChapter: zoneProgress.currentChapter,
          completedQuests: [...(zoneProgress.completedQuests || [])],
          pendingRewards: [...(zoneProgress.pendingRewards || [])],
          activeQuests: [...(zoneProgress.activeQuests || [])],
          currentZoneResolved: !!zoneProgress.currentZoneResolved,
        },
        mapDevice: {
          ...mapDevice,
          currentMap: mapDevice.currentMap ? { ...mapDevice.currentMap } : null,
          mapInventory: mapDevice.mapInventory.map(map => ({ ...map })),
          completedMapIds: [...mapDevice.completedMapIds],
        },
        settings: {
          autoSave: true,
          autoSaveInterval: this.autoSaveInterval,
        },
      };
      
      localStorage.setItem(SAVE_KEY_PREFIX + slotId, JSON.stringify(saveData));
      this.lastSaveTime = Date.now();
      this.currentSlot = parseInt(slotId);
      
      return true;
    } catch (error) {
      console.error('保存失败:', error);
      return false;
    }
  }
  
  // 加载游戏
  load(slotId: string): SaveData | null {
    try {
      const key = SAVE_KEY_PREFIX + slotId;
      const data = localStorage.getItem(key);
      
      if (!data) return null;
      
      const save: SaveData = JSON.parse(data);
      
      this.currentSlot = parseInt(slotId);
      this.playTimeStart = Date.now() - (save.playTime * 1000);
      
      return save;
    } catch (error) {
      console.error('加载失败:', error);
      return null;
    }
  }
  
  // 删除存档
  deleteSave(slotId: string): boolean {
    try {
      localStorage.removeItem(SAVE_KEY_PREFIX + slotId);
      return true;
    } catch (error) {
      console.error('删除失败:', error);
      return false;
    }
  }
  
  // 自动保存
  autoSave(player: Player, zoneProgress: any, mapDevice?: MapDeviceState): boolean {
    if (this.currentSlot < 0) return false;
    
    const now = Date.now();
    if (now - this.lastSaveTime < this.autoSaveInterval) {
      return false;
    }
    
    return this.save(String(this.currentSlot), player, zoneProgress, mapDevice!);
  }
  
  // 开始自动保存计时器
  startAutoSave(callback: () => void): void {
    this.stopAutoSave();
    this.autoSaveTimer = window.setInterval(() => {
      callback();
    }, this.autoSaveInterval);
  }
  
  // 停止自动保存
  stopAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
  
  // 获取当前存档槽
  getCurrentSlot(): number {
    return this.currentSlot;
  }
  
  // 设置当前存档槽
  setCurrentSlot(slotId: number): void {
    this.currentSlot = slotId;
  }
  
  // 获取游戏时间（秒）
  getPlayTime(): number {
    const elapsed = (Date.now() - this.playTimeStart) / 1000;
    return Math.floor(elapsed);
  }
  
  // 格式化时间
  formatPlayTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${secs}秒`;
    }
    return `${secs}秒`;
  }
  
  // 格式化日期
  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
  
  // 生成存档名
  private generateSlotName(player: Player, zoneProgress: any): string {
    const chapterNames: Record<number, string> = {
      1: '荒芜之地',
      2: '王都废墟',
      3: '冰封山脉',
      4: '暗影森林',
    };
    
    const zoneName = zoneProgress.currentZone ? 
      zoneProgress.currentZone.replace(/ch\d+_/, '') : '城镇';
    const chapterName = chapterNames[zoneProgress.currentChapter] || '未知';
    
    return `${player.name} - ${chapterName} Lv.${player.level}`;
  }
  
  // 检查是否有存档
  hasSaves(): boolean {
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (localStorage.getItem(SAVE_KEY_PREFIX + i)) {
        return true;
      }
    }
    return false;
  }
  
  // 获取最新存档
  getLatestSave(): SaveSlot | null {
    const slots = this.getSaveSlots();
    const validSlots = slots.filter(s => s.exists);
    
    if (validSlots.length === 0) return null;
    
    return validSlots.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
  }
  
  // 导出存档（字符串）
  exportSave(slotId: string): string | null {
    return localStorage.getItem(SAVE_KEY_PREFIX + slotId);
  }
  
  // 导入存档
  importSave(slotId: string, data: string): boolean {
    try {
      const parsed = JSON.parse(data) as SaveData;
      localStorage.setItem(SAVE_KEY_PREFIX + slotId, data);
      return true;
    } catch {
      return false;
    }
  }
}

// 创建单例
export const saveManager = new SaveManager();
