import { Item, GemColor, EquipSlot } from '../models/types';
import { getSocketStats, getLinkGroups, getColorEmoji, getColorName, canSocketGem, socketGem, unsocketGem, changeSocketColor } from '../systems/socket';
import { getGemById, GemData } from '../data/gems';

export class ItemDetailUI {
  private currentItem: Item | null = null;
  private onEquip: ((item: Item) => void) | null = null;
  private onUnequip: ((slot: EquipSlot) => void) | null = null;
  private onSocketGem: ((item: Item, socketIndex: number, gem: GemData) => void) | null = null;
  private onUnsocketGem: ((item: Item, socketIndex: number) => void) | null = null;
  
  init(
    onEquip: (item: Item) => void,
    onUnequip: (slot: EquipSlot) => void,
    onSocketGem: (item: Item, socketIndex: number, gem: GemData) => void,
    onUnsocketGem: (item: Item, socketIndex: number) => void
  ) {
    this.onEquip = onEquip;
    this.onUnequip = onUnequip;
    this.onSocketGem = onSocketGem;
    this.onUnsocketGem = onUnsocketGem;
    
    // 绑定关闭按钮
    document.querySelector('.item-modal-close')?.addEventListener('click', () => {
      this.hide();
    });
  }
  
  show(item: Item, isEquipped: boolean = false, availableGems: GemData[] = []) {
    this.currentItem = item;
    
    const modal = document.getElementById('item-modal');
    const content = document.getElementById('item-detail-content');
    const footer = document.getElementById('item-modal-footer');
    const title = document.getElementById('item-modal-title');
    
    if (!modal || !content || !footer || !title) return;
    
    // 设置标题
    title.textContent = '装备详情';
    
    // 生成详情内容
    content.innerHTML = this.renderItemDetail(item, availableGems);
    
    // 生成操作按钮
    let footerHtml = '';
    if (isEquipped) {
      footerHtml = `
        <div class="item-actions">
          <button class="item-action-btn unequip" data-slot="${item.slot}">卸下</button>
          <button class="item-action-btn close">关闭</button>
        </div>
      `;
    } else {
      footerHtml = `
        <div class="item-actions">
          <button class="item-action-btn equip" data-item-id="${item.id}">装备</button>
          <button class="item-action-btn close">关闭</button>
        </div>
      `;
    }
    footer.innerHTML = footerHtml;
    
    // 绑定按钮事件
    footer.querySelector('.equip')?.addEventListener('click', (e) => {
      const itemId = (e.target as HTMLElement).dataset.itemId;
      if (itemId && this.onEquip) {
        // 找到当前物品
        this.onEquip(item);
        this.hide();
      }
    });
    
    footer.querySelector('.unequip')?.addEventListener('click', (e) => {
      const slot = (e.target as HTMLElement).dataset.slot as EquipSlot;
      if (slot && this.onUnequip) {
        this.onUnequip(slot);
        this.hide();
      }
    });
    
    footer.querySelector('.close')?.addEventListener('click', () => {
      this.hide();
    });
    
    // 绑定孔点击事件
    this.bindSocketEvents(content, item, availableGems, isEquipped);
    
    // 显示模态框
    modal.style.display = 'flex';
  }
  
  hide() {
    const modal = document.getElementById('item-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    this.currentItem = null;
  }
  
  private renderItemDetail(item: Item, availableGems: GemData[]): string {
    let html = '<div class="item-detail">';
    
    // 头部：名称、基底、等级
    html += `
      <div class="item-header">
        <div class="item-name rarity-${item.rarity}">${item.name}</div>
        <div class="item-base">${this.getBaseName(item.baseId)}</div>
        <div class="item-level">物品等级: ${item.itemLevel}</div>
      </div>
    `;
    
    // 品质
    if (item.quality > 0) {
      html += `
        <div class="item-section">
          <div class="item-section-title">品质</div>
          <div class="item-stat quality">+${item.quality}% 品质</div>
        </div>
      `;
    }
    
    // 固有属性（Implicit）
    if (item.implicit.length > 0) {
      html += `
        <div class="item-section">
          <div class="item-section-title">固有属性</div>
          ${item.implicit.map(affix => 
            affix.stats.map(stat => {
              const value = stat.rolled !== undefined ? stat.rolled : (stat.min + stat.max) / 2;
              const modStr = stat.modType === 'flat' ? `+${value}` : `+${value}%`;
              return `<div class="item-stat implicit">${modStr} ${this.getStatName(stat.stat)}</div>`;
            }).join('')
          ).join('')}
        </div>
      `;
    }
    
    // 孔和链接
    if (item.sockets.length > 0) {
      html += this.renderSockets(item, availableGems);
    }
    
    // 前缀词缀
    if (item.prefixes.length > 0) {
      html += `
        <div class="item-section">
          <div class="item-section-title">前缀词缀</div>
          ${item.prefixes.map(affix => 
            affix.stats.map(stat => {
              const value = stat.rolled !== undefined ? stat.rolled : (stat.min + stat.max) / 2;
              const modStr = stat.modType === 'flat' ? `+${value}` : `+${value}%`;
              return `<div class="item-stat prefix">${modStr} ${this.getStatName(stat.stat)}</div>`;
            }).join('')
          ).join('')}
        </div>
      `;
    }
    
    // 后缀词缀
    if (item.suffixes.length > 0) {
      html += `
        <div class="item-section">
          <div class="item-section-title">后缀词缀</div>
          ${item.suffixes.map(affix => 
            affix.stats.map(stat => {
              const value = stat.rolled !== undefined ? stat.rolled : (stat.min + stat.max) / 2;
              const modStr = stat.modType === 'flat' ? `+${value}` : `+${value}%`;
              return `<div class="item-stat suffix">${modStr} ${this.getStatName(stat.stat)}</div>`;
            }).join('')
          ).join('')}
        </div>
      `;
    }
    
    // 需求
    const requirements = this.getRequirements(item);
    if (requirements.length > 0) {
      html += `
        <div class="item-section">
          <div class="item-section-title">需求</div>
          ${requirements.map(req => `<div class="item-stat requirement">${req}</div>`).join('')}
        </div>
      `;
    }
    
    html += '</div>';
    return html;
  }
  
  private renderSockets(item: Item, availableGems: GemData[]): string {
    const linkGroups = getLinkGroups(item.sockets);
    
    let html = `
      <div class="item-section">
        <div class="item-section-title">孔与链接</div>
        <div class="socket-visual">
    `;
    
    for (const group of linkGroups) {
      html += `<div class="socket-group ${group.socketIndices.length > 1 ? 'connected' : ''}">`;
      
      for (let i = 0; i < group.socketIndices.length; i++) {
        const idx = group.socketIndices[i];
        const socket = item.sockets[idx];
        const gem = socket.gemId ? getGemById(socket.gemId) : null;
        
        let dotClass = `socket-dot ${socket.color}`;
        if (gem) dotClass += ' filled';
        else dotClass += ' empty';
        
        html += `
          <div class="${dotClass}" data-socket-index="${idx}" data-item-id="${item.id}">
            ${gem ? `<span class="gem-in-socket">${gem.name.charAt(0)}</span>` : ''}
          </div>
        `;
        
        // 连接线
        if (i < group.socketIndices.length - 1) {
          html += '<div class="socket-connector"></div>';
        }
      }
      
      html += '</div>';
    }
    
    html += '</div>';
    
    // 链接统计
    const stats = getSocketStats(item.sockets);
    html += `
      <div class="socket-label">
        ${stats.total} 孔 · ${stats.maxLink} 链接 · 
        <span style="color:#ef4444">●${stats.colors.red}</span>
        <span style="color:#22c55e">●${stats.colors.green}</span>
        <span style="color:#3b82f6">●${stats.colors.blue}</span>
      </div>
    `;
    
    return html;
  }
  
  private bindSocketEvents(container: HTMLElement, item: Item, availableGems: GemData[], isEquipped: boolean) {
    container.querySelectorAll('.socket-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.socketIndex || '0');
        const socket = item.sockets[idx];
        
        if (socket.gemId) {
          // 取出宝石
          if (this.onUnsocketGem) {
            this.onUnsocketGem(item, idx);
            this.hide();
          }
        } else {
          // 镶嵌宝石
          this.showGemSelection(item, idx, availableGems, isEquipped);
        }
      });
    });
  }
  
  private showGemSelection(item: Item, socketIndex: number, availableGems: GemData[], isEquipped: boolean) {
    const socket = item.sockets[socketIndex];
    
    // 过滤可镶嵌的宝石
    const filterGems = availableGems.filter(gem => canSocketGem(socket, gem));
    const allGems = [...filterGems];
    
    // 添加不匹配颜色的宝石（禁用状态）
    for (const gem of availableGems) {
      if (!filterGems.includes(gem)) {
        allGems.push(gem);
      }
    }
    
    if (allGems.length === 0) {
      this.showToast('没有可用的宝石');
      return;
    }
    
    // 创建宝石选择模态框
    const modal = document.createElement('div');
    modal.className = 'socket-select-modal';
    modal.innerHTML = `
      <div class="socket-select-content">
        <div class="socket-select-title">
          选择宝石 - ${getColorName(socket.color)}孔
        </div>
        <div class="socket-select-list">
          ${allGems.map(gem => {
            const canUse = canSocketGem(socket, gem);
            const colorClass = gem.color;
            return `
              <div class="socket-select-item ${canUse ? '' : 'disabled'}" data-gem-id="${gem.id}" data-can-use="${canUse}">
                <div class="gem-color ${colorClass}"></div>
                <div class="gem-info">
                  <div class="gem-name">${gem.name}</div>
                  <div class="gem-desc">${gem.description || ''}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <button class="socket-select-cancel">取消</button>
      </div>
    `;
    
    // 绑定事件
    modal.querySelectorAll('.socket-select-item:not(.disabled)').forEach(el => {
      el.addEventListener('click', () => {
        const gemId = (el as HTMLElement).dataset.gemId;
        const gem = getGemById(gemId || '');
        if (gem && this.onSocketGem) {
          this.onSocketGem(item, socketIndex, gem);
          modal.remove();
        }
        modal.remove();
      });
    });
    
    modal.querySelector('.socket-select-cancel')?.addEventListener('click', () => {
      modal.remove();
    });
    
    document.body.appendChild(modal);
  }
  
  private getBaseName(baseId: string): string {
    const baseNames: Record<string, string> = {
      'rift_blade': '裂隙之刃',
      'eternal_sword': '永恒之剑',
      'labrys': '双刃巨斧',
      'imperial_claw': '帝国之爪',
      'crude_bow': '粗糙之弓',
      'thicket_bow': '密林之弓',
      'driftwood_wand': '浮木魔杖',
      'crystal_sceptre': '水晶权杖',
      'gothic_shield': '哥特之盾',
      'tower_shield': '高塔之盾',
      'iron_helmet': '铁盔',
      'scholar_hat': '学者之帽',
      'lion_pelt': '狮鹫之盔',
      'plate_vest': '板甲背心',
      'woven_garb': '编织外衣',
      'cloth_robe': '布袍',
      'iron_gauntlets': '铁手套',
      'silk_gloves': '丝绸手套',
      'iron_greaves': '铁胫甲',
      'slippers': '软底鞋',
      'heavy_belt': '重腰带',
      'scholar_belt': '学者腰带',
      'jade_amulet': '翡翠项链',
      'ruby_amulet': '红宝石项链',
      'iron_ring': '铁戒指',
      'ruby_ring': '红宝石戒指',
      'sapphire_ring': '蓝宝石戒指',
      'topaz_ring': '黄玉戒指',
    };
    return baseNames[baseId] || baseId;
  }
  
  private getStatName(stat: string): string {
    const statNames: Record<string, string> = {
      'strength': '力量',
      'dexterity': '敏捷',
      'intelligence': '智力',
      'maxLife': '最大生命',
      'maxMana': '最大魔力',
      'armor': '护甲',
      'evasion': '闪避',
      'energyShield': '能量护盾',
      'physicalDamage': '物理伤害',
      'fireDamage': '火焰伤害',
      'coldDamage': '冰冷伤害',
      'lightningDamage': '闪电伤害',
      'elementalDamage': '元素伤害',
      'attackSpeed': '攻击速度',
      'castSpeed': '施法速度',
      'critChance': '暴击几率',
      'critMultiplier': '暴击伤害',
      'accuracy': '命中值',
      'fireResistance': '火焰抗性',
      'coldResistance': '冰冷抗性',
      'lightningResistance': '闪电抗性',
      'chaosResistance': '混沌抗性',
      'physicalDamage increased': '物理伤害',
      'fireDamage increased': '火焰伤害',
      'coldDamage increased': '冰冷伤害',
      'lightningDamage increased': '闪电伤害',
      'elementalDamage increased': '元素伤害',
      'attackSpeed increased': '攻击速度',
      'castSpeed increased': '施法速度',
      'critChance increased': '暴击几率',
      'critMultiplier increased': '暴击伤害',
      'accuracy increased': '命中值',
      'fireResistance increased': '火焰抗性',
      'coldResistance increased': '冰冷抗性',
      'lightningResistance increased': '闪电抗性',
      'chaosResistance increased': '混沌抗性',
      'maxLife increased': '最大生命',
      'maxMana increased': '最大魔力',
      'armor increased': '护甲',
      'evasion increased': '闪避',
      'energyShield increased': '能量护盾',
    };
    return statNames[stat] || stat;
  }
  
  private getRequirements(item: Item): string[] {
    const requirements: string[] = [];
    
    if (item.itemLevel > 1) {
      requirements.push(`等级: ${item.itemLevel}`);
    }
    
    // 根据装备类型添加属性需求
    const slot = item.slot;
    if (['weapon', 'body', 'gloves', 'boots'].includes(slot)) {
      requirements.push('力量: 30');
    }
    if (['weapon', 'gloves'].includes(slot)) {
      requirements.push('敏捷: 20');
    }
    if (['weapon'].includes(slot)) {
      requirements.push('智力: 15');
    }
    
    return requirements;
  }
  
  private showToast(message: string) {
    // 简单的toast提示
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #ef4444;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      z-index: 3000;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 2000);
  }
}
