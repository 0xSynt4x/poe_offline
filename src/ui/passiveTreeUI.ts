import { PassiveNode, ModType } from "../models/types";
import { PASSIVE_NODES, PASSIVE_CLUSTERS, canAllocateNode, allocateNode, deallocateNode, getNodeById } from "../data/passiveTree";

export class PassiveTreeUI {
  private container: HTMLElement | null = null;
  private allocatedNodes: string[] = [];
  private onAllocate: ((nodeId: string) => void) | null = null;
  private onDeallocate: ((nodeId: string) => void) | null = null;
  private selectedNode: string | null = null;
  private tooltipEl: HTMLElement | null = null;
  private eventsBound = false;
  private boundContainer: HTMLElement | null = null;
  
  init(containerId: string, onAllocate: (nodeId: string) => void, onDeallocate: (nodeId: string) => void) {
    const nextContainer = document.getElementById(containerId);
    if (nextContainer !== this.boundContainer) {
      this.eventsBound = false;
      this.boundContainer = nextContainer;
    }
    this.container = nextContainer;
    this.onAllocate = onAllocate;
    this.onDeallocate = onDeallocate;
    
    if (!this.container) {
      console.error("Passive tree container not found:", containerId);
      return;
    }
    
    this.render();
    this.bindEvents();
  }
  
  setAllocatedNodes(nodes: string[]) {
    this.allocatedNodes = [...nodes];
    this.render();
  }
  
  getAllocatedNodes(): string[] {
    return [...this.allocatedNodes];
  }
  
  private render() {
    if (!this.container) return;
    
    let html = '<div class="passive-tree">';
    
    // 绘制连接线
    html += '<svg class="passive-connections" viewBox="0 0 600 500">';
    for (const node of PASSIVE_NODES) {
      for (const connId of node.connections) {
        const connNode = getNodeById(connId);
        if (!connNode) continue;
        
        const x1 = node.x * 80 + 50;
        const y1 = node.y * 50 + 50;
        const x2 = connNode.x * 80 + 50;
        const y2 = connNode.y * 50 + 50;
        
        const isActive = this.allocatedNodes.includes(node.id) && this.allocatedNodes.includes(connId);
        const strokeColor = isActive ? "#4ade80" : "#30363d";
        const strokeWidth = isActive ? 3 : 1;
        
        html += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
      }
    }
    html += '</svg>';
    
    // 绘制节点
    for (const node of PASSIVE_NODES) {
      const x = node.x * 80 + 50;
      const y = node.y * 50 + 50;
      const isAllocated = this.allocatedNodes.includes(node.id);
      const canAlloc = canAllocateNode(node.id, this.allocatedNodes);
      
      let nodeClass = "passive-node";
      if (isAllocated) nodeClass += " allocated";
      if (canAlloc) nodeClass += " available";
      if (node.type === "notable") nodeClass += " notable";
      if (node.type === "keystone") nodeClass += " keystone";
      
      let nodeColor = "#484f58";
      if (isAllocated) nodeColor = "#4ade80";
      else if (canAlloc) nodeColor = "#60a5fa";
      else if (node.type === "notable") nodeColor = "#fbbf24";
      else if (node.type === "keystone") nodeColor = "#f87171";
      
      const size = node.type === "keystone" ? 16 : node.type === "notable" ? 14 : 10;
      
      html += `<div class="${nodeClass}" style="left:${x}px;top:${y}px;" data-node-id="${node.id}">`;
      html += `<div class="node-circle" style="width:${size * 2}px;height:${size * 2}px;background:${nodeColor};"></div>`;
      html += `<span class="node-name">${node.name}</span>`;
      html += '</div>';
    }
    
    // 区域标签
    for (const cluster of PASSIVE_CLUSTERS) {
      const x = cluster.center.x * 80 + 50;
      const y = cluster.center.y * 50 - 20;
      html += `<div class="cluster-label" style="left:${x}px;top:${y}px;">${cluster.name}</div>`;
    }
    
    html += '</div>';
    
    // 详情面板
    html += '<div class="passive-detail" id="passive-detail">';
    html += '<h3>天赋详情</h3>';
    html += '<p class="detail-hint">点击节点查看详情</p>';
    html += '</div>';
    
    this.container.innerHTML = html;
  }
  
  private bindEvents() {
    if (!this.container || this.eventsBound) return;
    this.eventsBound = true;
    
    // 节点点击
    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const nodeEl = target.closest(".passive-node") as HTMLElement;
      
      if (nodeEl) {
        const nodeId = nodeEl.dataset.nodeId;
        if (nodeId) {
          this.handleNodeClick(nodeId);
        }
      }
    });
    
    // 节点悬停
    this.container.addEventListener("mouseover", (e) => {
      const target = e.target as HTMLElement;
      const nodeEl = target.closest(".passive-node") as HTMLElement;
      
      if (nodeEl) {
        const nodeId = nodeEl.dataset.nodeId;
        if (nodeId) {
          this.showTooltip(nodeId, e as MouseEvent);
        }
      }
    });
    
    this.container.addEventListener("mouseout", (e) => {
      const target = e.target as HTMLElement;
      const nodeEl = target.closest(".passive-node") as HTMLElement;
      
      if (nodeEl) {
        this.hideTooltip();
      }
    });
  }
  
  private handleNodeClick(nodeId: string) {
    const node = getNodeById(nodeId);
    if (!node) return;
    
    const isAllocated = this.allocatedNodes.includes(nodeId);
    const canAlloc = canAllocateNode(nodeId, this.allocatedNodes);
    
    if (isAllocated) {
      // 尝试取消分配
      this.allocatedNodes = deallocateNode(nodeId, this.allocatedNodes);
      this.onDeallocate?.(nodeId);
    } else if (canAlloc) {
      // 分配节点
      this.allocatedNodes = allocateNode(nodeId, this.allocatedNodes);
      this.onAllocate?.(nodeId);
    }
    
    this.render();
    this.updateDetail(nodeId);
  }
  
  private showTooltip(nodeId: string, event: MouseEvent) {
    const node = getNodeById(nodeId);
    if (!node) return;
    
    this.hideTooltip();
    
    const tooltip = document.createElement("div");
    tooltip.className = "passive-tooltip";
    
    let html = `<h4>${node.name}</h4>`;
    html += `<p class="tooltip-type">${this.getNodeTypeName(node.type)}</p>`;
    html += '<div class="tooltip-stats">';
    for (const stat of node.stats) {
      const value = (stat.min + stat.max) / 2;
      const modStr = stat.modType === ModType.Flat ? `+${value}` : `+${value}%`;
      html += `<p>${modStr} ${this.getStatName(stat.stat)}</p>`;
    }
    html += '</div>';
    
    if (node.requires.length > 0) {
      html += '<p class="tooltip-requires">需要: ';
      html += node.requires.map((req) => {
        const reqNode = getNodeById(req);
        return reqNode?.name || req;
      }).join(", ");
      html += '</p>';
    }
    
    tooltip.innerHTML = html;
    document.body.appendChild(tooltip);
    
    // 定位
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 10}px`;
    
    this.tooltipEl = tooltip;
  }
  
  private hideTooltip() {
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
    }
  }
  
  private updateDetail(nodeId: string) {
    const detail = document.getElementById("passive-detail");
    if (!detail) return;
    
    const node = getNodeById(nodeId);
    if (!node) return;
    
    const isAllocated = this.allocatedNodes.includes(nodeId);
    const canAlloc = canAllocateNode(nodeId, this.allocatedNodes);
    
    let html = `<h3>${node.name}</h3>`;
    html += `<p class="detail-type">${this.getNodeTypeName(node.type)}</p>`;
    
    html += '<div class="detail-stats">';
    for (const stat of node.stats) {
      const value = (stat.min + stat.max) / 2;
      const modStr = stat.modType === ModType.Flat ? `+${value}` : `+${value}%`;
      html += `<p>${modStr} ${this.getStatName(stat.stat)}</p>`;
    }
    html += '</div>';
    
    if (isAllocated) {
      html += '<button class="btn-deallocate">取消分配</button>';
    } else if (canAlloc) {
      html += '<button class="btn-allocate">分配天赋</button>';
    } else {
      html += '<p class="detail-locked">需要前置天赋</p>';
    }
    
    detail.innerHTML = html;
    
    // 绑定按钮事件
    const btnAllocate = detail.querySelector(".btn-allocate");
    if (btnAllocate) {
      btnAllocate.addEventListener("click", () => this.handleNodeClick(nodeId));
    }
    
    const btnDeallocate = detail.querySelector(".btn-deallocate");
    if (btnDeallocate) {
      btnDeallocate.addEventListener("click", () => this.handleNodeClick(nodeId));
    }
  }
  
  private getNodeTypeName(type: string): string {
    switch (type) {
      case "normal": return "普通天赋";
      case "notable": return "重要天赋";
      case "keystone": return "关键天赋";
      default: return "天赋";
    }
  }
  
  private getStatName(stat: string): string {
    const statNames: Record<string, string> = {
      "strength": "力量",
      "dexterity": "敏捷",
      "intelligence": "智力",
      "maxLife": "最大生命",
      "maxMana": "最大魔力",
      "armor": "护甲",
      "evasion": "闪避",
      "energyShield": "能量护盾",
      "physicalDamage": "物理伤害",
      "fireDamage": "火焰伤害",
      "coldDamage": "冰冷伤害",
      "lightningDamage": "闪电伤害",
      "elementalDamage": "元素伤害",
      "attackSpeed": "攻击速度",
      "castSpeed": "施法速度",
      "critChance": "暴击几率",
      "critMultiplier": "暴击伤害",
      "accuracy": "命中值",
      "fireResistance": "火焰抗性",
      "coldResistance": "冰冷抗性",
      "lightningResistance": "闪电抗性",
      "chaosResistance": "混沌抗性",
    };
    return statNames[stat] || stat;
  }
}
