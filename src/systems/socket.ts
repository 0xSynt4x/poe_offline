import { Socket, GemColor, Item } from '../models/types';
import { getGemById, GemData } from '../data/gems';

/**
 * PoE1 Socket System
 * 
 * 1. 每件装备有1-6个孔（取决于装备类型）
 * 2. 孔有颜色：红（力量）、绿（敏捷）、蓝（智力）
 * 3. 相邻孔可以连接，形成链接组（Link）
 * 4. 同一链接组内的宝石互相配合
 * 5. 6孔6连（6-Link）是终极追求
 */

// PoE1 最大孔数规则
export const SOCKET_LIMITS: Record<string, { max: number; colors: GemColor[] }> = {
  // 武器
  'sword_1h': { max: 6, colors: [GemColor.Red, GemColor.Red, GemColor.Green] },
  'axe_1h': { max: 6, colors: [GemColor.Red, GemColor.Red, GemColor.Green] },
  'axe_2h': { max: 6, colors: [GemColor.Red, GemColor.Red, GemColor.Red] },
  'mace_1h': { max: 6, colors: [GemColor.Red, GemColor.Red, GemColor.Blue] },
  'claw': { max: 6, colors: [GemColor.Green, GemColor.Green, GemColor.Red] },
  'dagger': { max: 6, colors: [GemColor.Green, GemColor.Red, GemColor.Blue] },
  'sceptre': { max: 6, colors: [GemColor.Red, GemColor.Blue, GemColor.Blue] },
  'wand': { max: 6, colors: [GemColor.Blue, GemColor.Blue, GemColor.Blue] },
  'bow': { max: 6, colors: [GemColor.Green, GemColor.Green, GemColor.Green] },
  'staff': { max: 6, colors: [GemColor.Red, GemColor.Green, GemColor.Blue] },
  
  // 盾牌
  'shield': { max: 6, colors: [GemColor.Red, GemColor.Red, GemColor.Red] },
  
  // 防具
  'body': { max: 6, colors: [GemColor.Red, GemColor.Red, GemColor.Green] },
  'helmet': { max: 4, colors: [GemColor.Red, GemColor.Red, GemColor.Green] },
  'gloves': { max: 4, colors: [GemColor.Red, GemColor.Green, GemColor.Blue] },
  'boots': { max: 4, colors: [GemColor.Green, GemColor.Blue, GemColor.Blue] },
  
  // 首饰（无孔）
  'ring': { max: 0, colors: [] },
  'amulet': { max: 0, colors: [] },
  'belt': { max: 0, colors: [] },
};

// 链接组结构
export interface LinkGroup {
  id: string;
  socketIndices: number[];  // 组内的孔索引
  gems: (GemData | null)[];  // 镶嵌的宝石
}

// 宝石镶嵌结果
export interface SocketResult {
  success: boolean;
  message: string;
  socket?: Socket;
}

export interface LinkResult {
  success: boolean;
  message: string;
  linkCount?: number;
}

export interface GemResult {
  success: boolean;
  message: string;
}

/**
 * 根据装备类型获取最大孔数
 */
export function getMaxSockets(itemType: string): number {
  const config = SOCKET_LIMITS[itemType];
  return config ? config.max : 0;
}

/**
 * 生成随机孔数
 */
export function rollSocketCount(itemType: string, itemLevel: number, socketRange?: { min: number; max: number }): number {
  const max = Math.min(getMaxSockets(itemType), Math.max(0, socketRange?.max ?? getMaxSockets(itemType)));
  const min = Math.min(max, Math.max(0, socketRange?.min ?? (max > 0 ? 1 : 0)));
  if (max === 0) return 0;
  
  // PoE1规则：物品等级影响最大孔数
  // 1-27级：最多3孔，28-49级：最多4孔，50-79级：最多5孔，80+：最多6孔
  let maxBasedOnLevel = 3;
  if (itemLevel >= 80) maxBasedOnLevel = 6;
  else if (itemLevel >= 50) maxBasedOnLevel = 5;
  else if (itemLevel >= 28) maxBasedOnLevel = 4;
  
  const effectiveMax = Math.min(max, maxBasedOnLevel);
  const effectiveMin = Math.min(min, effectiveMax);
  
  // 权重：孔数越多概率越低
  const weights = [0, 0, 5, 20, 35, 30, 10]; // 0-6孔的权重
  const totalWeight = weights.slice(effectiveMin, effectiveMax + 1).reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = effectiveMin; i <= effectiveMax; i++) {
    random -= weights[i];
    if (random <= 0) return i;
  }
  
  return effectiveMax;
}

/**
 * 根据装备基底颜色倾向生成孔颜色
 */
export function rollSocketColors(itemType: string, socketCount: number): GemColor[] {
  const config = SOCKET_LIMITS[itemType];
  if (!config || socketCount === 0) return [];
  
  const colors: GemColor[] = [];
  const baseColors = config.colors;
  
  for (let i = 0; i < socketCount; i++) {
    // 基础颜色倾向（70%概率）
    if (Math.random() < 0.7 && baseColors.length > 0) {
      colors.push(baseColors[i % baseColors.length]);
    } else {
      // 随机颜色
      const allColors = [GemColor.Red, GemColor.Green, GemColor.Blue];
      colors.push(allColors[Math.floor(Math.random() * allColors.length)]);
    }
  }
  
  return colors;
}

/**
 * 生成链接（PoE1规则：只有相邻孔可以链接）
 */
export function rollLinks(socketCount: number): number[][] {
  if (socketCount <= 1) return socketCount === 1 ? [[0]] : [];
  
  const links: number[][] = [];
  let currentGroup = [0];
  
  for (let i = 0; i < socketCount - 1; i++) {
    // 链接概率：与PoE1一致
    // 2连：~60%，3连：~30%，4连：~15%，5连：~5%，6连：~1%
    let linkChance = 0.6;
    if (currentGroup.length >= 2) linkChance = 0.3;
    if (currentGroup.length >= 3) linkChance = 0.15;
    if (currentGroup.length >= 4) linkChance = 0.05;
    if (currentGroup.length >= 5) linkChance = 0.01;
    
    if (Math.random() < linkChance) {
      currentGroup.push(i + 1);
    } else {
      links.push([...currentGroup]);
      currentGroup = [i + 1];
    }
  }
  links.push(currentGroup);
  
  return links;
}

/**
 * 创建Socket数组
 */
export function createSockets(itemType: string, itemLevel: number, socketRange?: { min: number; max: number }): Socket[] {
  const count = rollSocketCount(itemType, itemLevel, socketRange);
  const colors = rollSocketColors(itemType, count);
  const links = rollLinks(count);
  
  const sockets: Socket[] = [];
  
  for (let i = 0; i < count; i++) {
    sockets.push({
      color: colors[i],
      gemId: null,
      linkedTo: [],
    });
  }
  
  // 设置链接关系
  for (const group of links) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (!sockets[group[i]].linkedTo.includes(group[j])) {
          sockets[group[i]].linkedTo.push(group[j]);
        }
        if (!sockets[group[j]].linkedTo.includes(group[i])) {
          sockets[group[j]].linkedTo.push(group[i]);
        }
      }
    }
  }
  
  return sockets;
}

/**
 * 获取链接组（连接在一起的孔组）
 */
export function getLinkGroups(sockets: Socket[]): LinkGroup[] {
  const visited = new Set<number>();
  const groups: LinkGroup[] = [];
  
  for (let i = 0; i < sockets.length; i++) {
    if (visited.has(i)) continue;
    
    const group = new Set<number>();
    const queue = [i];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      group.add(current);
      
      for (const linked of sockets[current].linkedTo) {
        if (!visited.has(linked)) {
          queue.push(linked);
        }
      }
    }
    
    groups.push({
      id: `link_${groups.length}`,
      socketIndices: Array.from(group).sort((a, b) => a - b),
      gems: Array.from(group).sort((a, b) => a - b).map(i => 
        sockets[i].gemId ? getGemById(sockets[i].gemId!) || null : null
      ),
    });
  }
  
  return groups;
}

/**
 * 获取链接数（最大连续链接长度）
 */
export function getMaxLinkCount(sockets: Socket[]): number {
  const groups = getLinkGroups(sockets);
  if (groups.length === 0) return 0;
  return Math.max(...groups.map(g => g.socketIndices.length));
}

/**
 * 检查宝石是否可以放入指定孔
 */
export function canSocketGem(socket: Socket, gem: GemData): boolean {
  // 检查孔是否为空
  if (socket.gemId !== null) return false;
  
  // 检查颜色匹配（白色孔可以放任何颜色）
  if (socket.color !== GemColor.White && socket.color !== gem.color) {
    return false;
  }
  
  return true;
}

/**
 * 将宝石放入孔中
 */
export function socketGem(item: Item, socketIndex: number, gem: GemData): GemResult {
  if (socketIndex < 0 || socketIndex >= item.sockets.length) {
    return { success: false, message: '无效的孔位' };
  }
  
  const socket = item.sockets[socketIndex];
  if (!canSocketGem(socket, gem)) {
    if (socket.gemId) {
      return { success: false, message: '该孔已被占用' };
    }
    if (socket.color !== GemColor.White && socket.color !== gem.color) {
      return { success: false, message: `颜色不匹配: 孔为${getColorName(socket.color)}, 宝石为${getColorName(gem.color)}` };
    }
    return { success: false, message: '无法镶嵌此宝石' };
  }
  
  socket.gemId = gem.id;
  return { success: true, message: `成功镶嵌 ${gem.name}` };
}

/**
 * 从孔中取出宝石
 */
export function unsocketGem(item: Item, socketIndex: number): GemResult {
  if (socketIndex < 0 || socketIndex >= item.sockets.length) {
    return { success: false, message: '无效的孔位' };
  }
  
  const socket = item.sockets[socketIndex];
  if (!socket.gemId) {
    return { success: false, message: '该孔没有宝石' };
  }
  
  const gemName = getGemById(socket.gemId)?.name || '未知宝石';
  socket.gemId = null;
  return { success: true, message: `取出了 ${gemName}` };
}

/**
 * 随机改变一个孔的颜色
 */
export function changeSocketColor(socket: Socket, itemType: string): void {
  const config = SOCKET_LIMITS[itemType];
  if (!config) return;
  
  const colors = [GemColor.Red, GemColor.Green, GemColor.Blue];
  
  // 70%概率变成基底颜色之一
  if (config.colors.length > 0 && Math.random() < 0.7) {
    socket.color = config.colors[Math.floor(Math.random() * config.colors.length)];
  } else {
    socket.color = colors[Math.floor(Math.random() * colors.length)];
  }
}

/**
 * 随机改变所有孔的颜色
 */
export function rerollSocketColors(sockets: Socket[], itemType: string): void {
  for (const socket of sockets) {
    changeSocketColor(socket, itemType);
  }
}

/**
 * 获取颜色名称
 */
export function getColorName(color: GemColor): string {
  switch (color) {
    case GemColor.Red: return '红';
    case GemColor.Green: return '绿';
    case GemColor.Blue: return '蓝';
    case GemColor.White: return '白';
    default: return '未知';
  }
}

/**
 * 获取链接显示字符串
 */
export function getLinkDisplayString(sockets: Socket[]): string {
  if (sockets.length === 0) return '';
  
  let display = '';
  for (let i = 0; i < sockets.length; i++) {
    const colorEmoji = getColorEmoji(sockets[i].color);
    display += colorEmoji;
    
    if (i < sockets.length - 1) {
      if (sockets[i].linkedTo.includes(i + 1)) {
        display += '—';
      } else {
        display += ' ';
      }
    }
  }
  
  return display;
}

/**
 * 获取颜色emoji
 */
export function getColorEmoji(color: GemColor): string {
  switch (color) {
    case GemColor.Red: return '🔴';
    case GemColor.Green: return '🟢';
    case GemColor.Blue: return '🔵';
    case GemColor.White: return '⚪';
    default: return '⚫';
  }
}

/**
 * 获取链接统计信息
 */
export function getSocketStats(sockets: Socket[]): {
  total: number;
  linked: number;
  maxLink: number;
  colors: Record<string, number>;
} {
  const colors: Record<string, number> = {
    red: 0,
    green: 0,
    blue: 0,
    white: 0,
  };
  
  for (const socket of sockets) {
    colors[socket.color]++;
  }
  
  return {
    total: sockets.length,
    linked: sockets.filter(s => s.linkedTo.length > 0).length,
    maxLink: getMaxLinkCount(sockets),
    colors,
  };
}
