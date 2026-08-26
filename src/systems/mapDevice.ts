import { GameMap, generateRandomMap, getMapModifiers, getMapEffects } from '../data/maps';
import { Monster } from '../models/types';

export interface MapDeviceState {
  currentMap: GameMap | null;
  mapInventory: GameMap[];
  completedMapIds: string[];
  totalMapsRun: number;
  bestTier: number;
  isMapActive: boolean;
}

export class MapDevice {
  private state: MapDeviceState;

  constructor() {
    this.state = {
      currentMap: null,
      mapInventory: [],
      completedMapIds: [],
      totalMapsRun: 0,
      bestTier: 0,
      isMapActive: false,
    };
  }

  getState(): MapDeviceState {
    return this.state;
  }

  // 初始化新手地图（10张T1）
  initWithStarterMaps() {
    this.state.mapInventory = [];
    for (let i = 0; i < 10; i++) {
      const map = generateRandomMap(2);
      this.state.mapInventory.push(map);
    }
  }

  // 恢复存档
  restoreState(state: MapDeviceState) {
    this.state = {
      ...state,
      mapInventory: state.mapInventory.map(m => ({...m})),
      completedMapIds: [...state.completedMapIds],
    };
  }

  // 拾取地图
  addMap(map: GameMap): void {
    this.state.mapInventory.push(map);
  }

  // 消耗地图（放入地图仪后消耗）
  consumeMap(mapId: string): GameMap | null {
    const idx = this.state.mapInventory.findIndex(m => m.id === mapId);
    if (idx === -1) return null;
    const map = this.state.mapInventory.splice(idx, 1)[0];
    return map;
  }

  // 打开地图
  openMap(mapId: string, playerLevel: number): { success: boolean; map?: GameMap; message: string } {
    const map = this.state.mapInventory.find(m => m.id === mapId);
    if (!map) {
      return { success: false, message: '地图不存在' };
    }

    if (map.itemLevel > playerLevel + 10) {
      return { success: false, message: `等级不足，需要等级 ${map.itemLevel - 10} 以上` };
    }

    // 消耗地图
    const consumed = this.consumeMap(mapId);
    if (!consumed) {
      return { success: false, message: '地图消耗失败' };
    }

    this.state.currentMap = consumed;
    this.state.isMapActive = true;
    this.state.totalMapsRun++;

    const mods = getMapModifiers(consumed);
    const modText = mods.map(m => m.description).join(', ');

    return {
      success: true,
      map: consumed,
      message: `开启地图: ${consumed.name} ${modText ? '(' + modText + ')' : ''}`,
    };
  }

  // 完成地图，获得掉落
  completeMap(playerLevel: number): {
    expReward: number;
    drops: GameMap[];
    droppedCurrency: { id: string; amount: number }[];
  } {
    const map = this.state.currentMap;
    if (!map) {
      return { expReward: 0, drops: [], droppedCurrency: [] };
    }

    // 标记完成
    this.state.completedMapIds.push(map.id);
    if (map.tier > this.state.bestTier) {
      this.state.bestTier = map.tier;
    }
    this.state.currentMap = null;
    this.state.isMapActive = false;

    // 计算经验奖励
    const baseExp = 50 + map.tier * 20;
    const effects = getMapEffects(map);
    const expBonus = 1 + effects.itemRarity / 100;
    const expReward = Math.floor(baseExp * expBonus);

    // 生成掉落地图（掉落等级：玩家等级±3）
    const drops: GameMap[] = [];
    const dropChance = Math.min(0.95, 0.3 + map.tier * 0.03 + effects.itemQuantity / 200);
    if (Math.random() < dropChance) {
      const newMap = generateRandomMap(playerLevel);
      drops.push(newMap);
    }
    // 高级地图有几率掉两张
    if (map.tier >= 10 && Math.random() < 0.2) {
      drops.push(generateRandomMap(playerLevel));
    }

    // 通货掉落
    const droppedCurrency: { id: string; amount: number }[] = [];
    const quantityMod = map.suffixes.reduce((sum, mod) => {
      const bonus = mod.effects.find(e => e.type === 'item_quantity');
      return sum + (bonus ? bonus.value : 0);
    }, 0);

    // 基础掉率 + 词缀加成
    const currencyChance = Math.min(0.95, 0.3 + quantityMod / 100);
    if (Math.random() < currencyChance) {
      const currencies = ['scroll_of_wisdom', 'orb_of_alteration', 'chromatic_orb', 'orb_of_scouring', 'orb_of_portal'];
      const rareCurrencies = ['orb_of_alchemy', 'orb_of_regret', 'chaos_orb', 'regal_orb'];

      if (Math.random() < 0.3 + map.tier * 0.03) {
        droppedCurrency.push({ id: rareCurrencies[Math.floor(Math.random() * rareCurrencies.length)], amount: 1 });
      } else {
        droppedCurrency.push({ id: currencies[Math.floor(Math.random() * currencies.length)], amount: 1 + Math.floor(Math.random() * 2) });
      }
    }

    return { expReward, drops, droppedCurrency };
  }

  // 放弃当前地图
  abandonMap(): boolean {
    if (this.state.currentMap) {
      this.state.currentMap = null;
      this.state.isMapActive = false;
      return true;
    }
    return false;
  }

  // 获取地图列表（按等级排序）
  getMapList(): GameMap[] {
    return [...this.state.mapInventory].sort((a, b) => b.tier - a.tier);
  }

  // 按等级获取地图数量统计
  getMapTierCounts(): Record<number, number> {
    const counts: Record<number, number> = {};
    for (let i = 1; i <= 16; i++) {
      counts[i] = 0;
    }
    for (const map of this.state.mapInventory) {
      counts[map.tier] = (counts[map.tier] || 0) + 1;
    }
    return counts;
  }

  // 获取当前地图信息
  getCurrentMapInfo(): { map: GameMap; effects: ReturnType<typeof getMapModifiers> } | null {
    if (!this.state.currentMap) return null;
    return {
      map: this.state.currentMap,
      effects: getMapModifiers(this.state.currentMap),
    };
  }
}
