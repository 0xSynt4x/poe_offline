import { PassiveNode, ModType } from "../models/types";
import { PASSIVE_NODES, PASSIVE_CLUSTERS, canAllocateNode, allocateNode, deallocateNode, getNodeById } from "../data/passiveTree";
import { POE_PASSIVE_GROUPS } from "../data/poePassiveTree";

export class PassiveTreeUI {
  private container: HTMLElement | null = null;
  private allocatedNodes: string[] = [];
  private onAllocate: ((nodeId: string) => void) | null = null;
  private onDeallocate: ((nodeId: string) => void) | null = null;
  private selectedNode: string | null = null;
  private eventsBound = false;
  private boundContainer: HTMLElement | null = null;

  // Pan/Zoom state
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private isPanning = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private minZoom = 0.2;
  private maxZoom = 3;

  // Canvas
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private treeWorld: HTMLElement | null = null;

  // Starfield
  private stars: { x: number; y: number; r: number; brightness: number }[] = [];

  // Search
  private searchStr = "";
  private matchedNodes: Set<string> = new Set();

  // Minimap
  private minimapCanvas: HTMLCanvasElement | null = null;
  private minimapCtx: CanvasRenderingContext2D | null = null;

  // Touch state
  private lastTouchDist = 0;
  private lastTouchMidX = 0;
  private lastTouchMidY = 0;
  private touchMoved = false;
  private touchStartTime = 0;

  // Tooltip
  private tooltipEl: HTMLElement | null = null;

  // Layout constants (PoB-style coordinate mapping)
  private readonly SCALE = 58;

  private worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: wx * this.SCALE * this.zoom + this.panX,
      y: wy * this.SCALE * this.zoom + this.panY,
    };
  }

  /**
   * GGG's `in`/`out` graph also contains allocation-rule links for Ascendant
   * paths. PoB only draws connectors within the same ascendancy group.
   */
  private isRenderableConnection(node: PassiveNode, connNode: PassiveNode): boolean {
    return (node.ascendancyName || null) === (connNode.ascendancyName || null);
  }

  private getNodeGlyph(node: PassiveNode): string {
    if (node.isJewelSocket) return "◇";
    if (node.type === "keystone") return "◆";
    if (node.type === "notable") return "✦";
    if (node.type === "ascendancy") return "✧";
    return "";
  }

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

    this.buildStructure();
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

  setSearch(str: string) {
    this.searchStr = str.trim().toLowerCase();
    this.matchedNodes.clear();
    if (this.searchStr) {
      for (const node of PASSIVE_NODES) {
        if (node.name.toLowerCase().includes(this.searchStr)) {
          this.matchedNodes.add(node.id);
        }
      }
    }
    this.render();
  }

  private buildStructure() {
    if (!this.container) return;

    this.container.innerHTML = "";
    this.container.classList.add("pob-tree-wrap");

    // Tree canvas + world container
    const treeArea = document.createElement("div");
    treeArea.className = "pob-tree-area";

    // Canvas for connections & starfield
    this.canvas = document.createElement("canvas");
    this.canvas.className = "pob-tree-canvas";
    treeArea.appendChild(this.canvas);

    // World div (holds nodes, transformed by pan/zoom)
    this.treeWorld = document.createElement("div");
    this.treeWorld.className = "pob-tree-world";
    treeArea.appendChild(this.treeWorld);

    this.container.appendChild(treeArea);

    // Top toolbar
    const toolbar = document.createElement("div");
    toolbar.className = "pob-toolbar";
    toolbar.innerHTML = `
      <div class="pob-search-wrap">
        <input type="text" class="pob-search" placeholder="搜索天赋..." />
        <span class="pob-search-icon">🔍</span>
      </div>
      <div class="pob-toolbar-right">
        <span id="passive-points" class="pob-points-display">天赋点: 0</span>
        <button id="btn-reset-passive" class="pob-reset-btn">重置</button>
        <div class="pob-zoom-controls">
          <button class="pob-zoom-btn" data-zoom="in" title="放大">＋</button>
          <button class="pob-zoom-btn" data-zoom="out" title="缩小">－</button>
          <button class="pob-zoom-btn" data-zoom="reset" title="重置视角">⌂</button>
        </div>
      </div>
    `;
    this.container.appendChild(toolbar);

    // Stats sidebar
    const sidebar = document.createElement("div");
    sidebar.className = "pob-stats-sidebar";
    sidebar.id = "pob-stats-sidebar";
    sidebar.innerHTML = `
      <div class="pob-stats-title">已分配天赋</div>
      <div class="pob-stats-list" id="pob-stats-list"></div>
    `;
    this.container.appendChild(sidebar);

    // Minimap
    const minimapWrap = document.createElement("div");
    minimapWrap.className = "pob-minimap-wrap";
    this.minimapCanvas = document.createElement("canvas");
    this.minimapCanvas.className = "pob-minimap";
    this.minimapCanvas.width = 160;
    this.minimapCanvas.height = 120;
    minimapWrap.appendChild(this.minimapCanvas);
    this.container.appendChild(minimapWrap);

    this.minimapCtx = this.minimapCanvas.getContext("2d");

    // Resize canvas on first render
    requestAnimationFrame(() => this.resizeCanvas());
  }

  resizeCanvas() {
    if (!this.canvas || !this.container) return;
    const area = this.container.querySelector(".pob-tree-area") as HTMLElement;
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + "px";
    this.canvas.style.height = rect.height + "px";
    this.ctx = this.canvas.getContext("2d");
    if (this.ctx) this.ctx.scale(dpr, dpr);
    this.drawCanvas();
    this.drawMinimap();
  }

  /** Center the tree viewport on the center of the tree data (world coords). */
  centerTree() {
    if (!this.container) return;
    const area = this.container.querySelector(".pob-tree-area") as HTMLElement;
    if (!area) return;
    const rect = area.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    // Compute bounding box of all nodes in world space
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of PASSIVE_NODES) {
      if (node.x < minX) minX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.x > maxX) maxX = node.x;
      if (node.y > maxY) maxY = node.y;
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    // Fit the tree in the viewport with some padding
    const treeW = (maxX - minX) * this.SCALE;
    const treeH = (maxY - minY) * this.SCALE;
    const pad = 0.8;
    if (treeW > 0 && treeH > 0) {
      this.zoom = Math.min(pad * rect.width / treeW, pad * rect.height / treeH, 2);
    }
    this.panX = rect.width / 2 - cx * this.SCALE * this.zoom;
    this.panY = rect.height / 2 - cy * this.SCALE * this.zoom;
    this.render();
    this.drawCanvas();
    this.drawMinimap();
  }

  private drawStars(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Generate stars if needed
    if (this.stars.length === 0) {
      for (let i = 0; i < 300; i++) {
        this.stars.push({
          x: Math.random() * 2000 - 500,
          y: Math.random() * 2000 - 500,
          r: Math.random() * 1.2 + 0.3,
          brightness: Math.random() * 0.4 + 0.1,
        });
      }
    }
    for (const star of this.stars) {
      const sx = star.x * this.zoom * 0.4 + this.panX * 0.3;
      const sy = star.y * this.zoom * 0.4 + this.panY * 0.3;
      if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;
      ctx.beginPath();
      ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,200,255,${star.brightness})`;
      ctx.fill();
    }
  }

  private drawGroupBackgrounds(ctx: CanvasRenderingContext2D, w: number, h: number) {
    for (const group of POE_PASSIVE_GROUPS) {
      if (group.orbitRadii.length === 0) continue;

      const center = this.worldToScreen(group.x, group.y);
      const outerRadius = group.radius * this.SCALE * this.zoom;
      if (center.x + outerRadius < -20 || center.x - outerRadius > w + 20
        || center.y + outerRadius < -20 || center.y - outerRadius > h + 20) continue;

      if (!group.hasBackground) continue;
      const isAscendancy = !!group.ascendancyName;
      const fill = isAscendancy ? "rgba(133, 92, 210, 0.075)" : "rgba(62, 95, 130, 0.06)";
      const stroke = isAscendancy ? "rgba(167, 139, 250, 0.30)" : "rgba(105, 139, 177, 0.22)";

      ctx.beginPath();
      ctx.arc(center.x, center.y, outerRadius, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(0.5, this.zoom * 0.9);
      ctx.setLineDash([Math.max(1, this.zoom * 3), Math.max(2, this.zoom * 5)]);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const orbitRadius of group.orbitRadii) {
        ctx.beginPath();
        ctx.arc(center.x, center.y, orbitRadius * this.SCALE * this.zoom, 0, Math.PI * 2);
        ctx.strokeStyle = isAscendancy ? "rgba(167, 139, 250, 0.13)" : "rgba(105, 139, 177, 0.10)";
        ctx.lineWidth = Math.max(0.35, this.zoom * 0.65);
        ctx.stroke();
      }
    }
  }

  private drawCanvas() {
    if (!this.ctx || !this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;

    this.ctx.clearRect(0, 0, w, h);

    // Background gradient (PoB-style dark blue)
    const grad = this.ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    grad.addColorStop(0, "#0c1220");
    grad.addColorStop(0.5, "#080e18");
    grad.addColorStop(1, "#040810");
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);

    // Stars
    this.drawStars(this.ctx, w, h);

    // Group backgrounds and orbit guides sit below the connectors.
    this.drawGroupBackgrounds(this.ctx, w, h);

    // Connection lines
    const drawn = new Set<string>();
    for (const node of PASSIVE_NODES) {
      for (const connId of node.connections) {
        const key = [node.id, connId].sort().join("|");
        if (drawn.has(key)) continue;
        drawn.add(key);

        const connNode = getNodeById(connId);
        if (!connNode || !this.isRenderableConnection(node, connNode)) continue;

        const p1 = this.worldToScreen(node.x, node.y);
        const p2 = this.worldToScreen(connNode.x, connNode.y);

        const isActive = this.allocatedNodes.includes(node.id) && this.allocatedNodes.includes(connId);
        const isSearchMatch = this.matchedNodes.has(node.id) || this.matchedNodes.has(connId);

        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);

        if (isActive) {
          this.ctx.strokeStyle = "#4ade80";
          this.ctx.lineWidth = 3 * this.zoom;
          this.ctx.shadowColor = "rgba(74, 222, 128, 0.6)";
          this.ctx.shadowBlur = 6 * this.zoom;
        } else if (isSearchMatch) {
          this.ctx.strokeStyle = "#fbbf24";
          this.ctx.lineWidth = 2.5 * this.zoom;
          this.ctx.shadowColor = "rgba(251, 191, 36, 0.5)";
          this.ctx.shadowBlur = 5 * this.zoom;
        } else {
          this.ctx.strokeStyle = "#2a3040";
          this.ctx.lineWidth = 1.2 * this.zoom;
          this.ctx.shadowColor = "transparent";
          this.ctx.shadowBlur = 0;
        }
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
      }
    }
  }

  private render() {
    if (!this.treeWorld) return;

    // Compute viewport bounds in world coords for culling
    const area = this.container?.querySelector(".pob-tree-area") as HTMLElement;
    const viewW = area ? area.clientWidth : 1200;
    const viewH = area ? area.clientHeight : 800;
    const worldLeft = (0 - this.panX) / (this.SCALE * this.zoom);
    const worldTop = (0 - this.panY) / (this.SCALE * this.zoom);
    const worldRight = (viewW - this.panX) / (this.SCALE * this.zoom);
    const worldBottom = (viewH - this.panY) / (this.SCALE * this.zoom);
    // Expand bounds slightly for node overflow
    const margin = 30 / this.SCALE;
    const vl = worldLeft - margin;
    const vt = worldTop - margin;
    const vr = worldRight + margin;
    const vb = worldBottom + margin;

    // Render nodes (viewport culled)
    let html = "";
    for (const node of PASSIVE_NODES) {
      // Viewport culling: skip nodes far outside the viewport
      const inView = node.x >= vl && node.x <= vr && node.y >= vt && node.y <= vb;
      const isAllocated = this.allocatedNodes.includes(node.id);
      const isMatch = this.matchedNodes.has(node.id);
      // Only render non-visible nodes if they're allocated, matched, or a notable/keystone
      if (!inView && !isAllocated && !isMatch && node.type === "normal" && !node.isJewelSocket) continue;

      const canAlloc = canAllocateNode(node.id, this.allocatedNodes);

      let cls = "pob-node";
      if (isAllocated) cls += " allocated";
      if (canAlloc && !isAllocated) cls += " available";
      if (isMatch) cls += " search-match";
      cls += ` type-${node.type}`;
      if (node.isJewelSocket) cls += " jewel-socket";

      let fillColor = "#1a2030";
      let borderColor = "#3a4a60";
      let glowColor = "transparent";
      let glowSize = 0;

      if (isAllocated) {
        fillColor = "#1a3a2a";
        borderColor = "#4ade80";
        glowColor = "rgba(74, 222, 128, 0.6)";
        glowSize = 10;
      } else if (canAlloc) {
        fillColor = "#1a2a3a";
        borderColor = "#60a5fa";
        glowColor = "rgba(96, 165, 250, 0.5)";
        glowSize = 8;
      } else if (isMatch) {
        fillColor = "#2a2a1a";
        borderColor = "#fbbf24";
        glowColor = "rgba(251, 191, 36, 0.6)";
        glowSize = 8;
      }

      // Node type specific styling
      if (node.type === "notable") {
        borderColor = isAllocated ? "#fbbf24" : isMatch ? "#fbbf24" : canAlloc ? "#fbbf24" : "#8a7020";
        if (isAllocated) {
          fillColor = "#2a2a1a";
          glowColor = "rgba(251, 191, 36, 0.5)";
          glowSize = 12;
        }
      } else if (node.type === "keystone") {
        borderColor = isAllocated ? "#f87171" : isMatch ? "#f87171" : canAlloc ? "#f87171" : "#6a2020";
        if (isAllocated) {
          fillColor = "#2a1a1a";
          glowColor = "rgba(248, 113, 113, 0.5)";
          glowSize = 14;
        }
      } else if (node.type === "ascendancy") {
        borderColor = isAllocated ? "#a78bfa" : isMatch ? "#a78bfa" : canAlloc ? "#a78bfa" : "#4a3a6a";
        if (isAllocated) {
          fillColor = "#1a1a2a";
          glowColor = "rgba(167, 139, 250, 0.5)";
          glowSize = 10;
        }
      }

      const size = node.isJewelSocket ? 18 : node.type === "keystone" ? 24 : node.type === "notable" ? 18 : node.type === "ascendancy" ? 14 : 12;
      const borderW = node.type === "keystone" ? 3 : node.type === "notable" ? 2.5 : node.isJewelSocket ? 2 : 2;
      const glyph = this.getNodeGlyph(node);
      const pos = this.worldToScreen(node.x, node.y);

      // Skip labels for normal nodes when zoomed out
      const showLabel = this.zoom > 0.72 || isMatch || isAllocated;

      html += `<div class="${cls}" data-node-id="${node.id}"
        style="left:${pos.x}px;top:${pos.y}px;width:${size}px;height:${size}px;
        background:${fillColor};border:${borderW}px solid ${borderColor};
        ${glowSize > 0 ? `box-shadow:0 0 ${glowSize}px ${glowColor};` : ""}">`;
      if (node.type === "keystone" || node.type === "notable" || node.isJewelSocket) {
        html += `<div class="pob-node-inner-ring"></div>`;
      }
      if (glyph) {
        html += `<span class="pob-node-glyph" aria-hidden="true">${glyph}</span>`;
      }
      if (showLabel) {
        html += `<span class="pob-node-label">${node.name}</span>`;
      }
      html += `</div>`;
    }

    // Cluster labels (ascendancy)
    for (const cluster of PASSIVE_CLUSTERS) {
      if (this.zoom < 0.58) continue;
      const pos = this.worldToScreen(cluster.center.x, cluster.center.y - 0.8);
      if (pos.x > -200 && pos.x < viewW + 200 && pos.y > -100 && pos.y < viewH + 100) {
        html += `<div class="pob-cluster-label" style="left:${pos.x}px;top:${pos.y}px;">${cluster.name}</div>`;
      }
    }

    this.treeWorld.innerHTML = html;
    this.drawCanvas();
    this.drawMinimap();
    this.updateStatsPanel();
  }

  private drawMinimap() {
    if (!this.minimapCtx || !this.minimapCanvas) return;
    const ctx = this.minimapCtx;
    const mw = this.minimapCanvas.width;
    const mh = this.minimapCanvas.height;

    ctx.clearRect(0, 0, mw, mh);

    // Background
    ctx.fillStyle = "#0a0e18";
    ctx.fillRect(0, 0, mw, mh);

    // Find bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of PASSIVE_NODES) {
      if (node.x < minX) minX = node.x;
      if (node.x > maxX) maxX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.y > maxY) maxY = node.y;
    }

    const padding = 2;
    const rangeX = maxX - minX + padding * 2;
    const rangeY = maxY - minY + padding * 2;
    const scale = Math.min(mw / rangeX, mh / rangeY);
    const offX = (mw - rangeX * scale) / 2;
    const offY = (mh - rangeY * scale) / 2;

    const toMiniX = (x: number) => (x - minX + padding) * scale + offX;
    const toMiniY = (y: number) => (y - minY + padding) * scale + offY;

    // Draw connections
    const drawn = new Set<string>();
    ctx.lineWidth = 1;
    for (const node of PASSIVE_NODES) {
      for (const connId of node.connections) {
        const key = [node.id, connId].sort().join("|");
        if (drawn.has(key)) continue;
        drawn.add(key);
        const connNode = getNodeById(connId);
        if (!connNode || !this.isRenderableConnection(node, connNode)) continue;
        const isActive = this.allocatedNodes.includes(node.id) && this.allocatedNodes.includes(connId);
        ctx.beginPath();
        ctx.moveTo(toMiniX(node.x), toMiniY(node.y));
        ctx.lineTo(toMiniX(connNode.x), toMiniY(connNode.y));
        ctx.strokeStyle = isActive ? "#4ade80" : "#1a2535";
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const node of PASSIVE_NODES) {
      const isAlloc = this.allocatedNodes.includes(node.id);
      const r = node.type === "keystone" ? 3 : node.type === "notable" ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(toMiniX(node.x), toMiniY(node.y), r, 0, Math.PI * 2);
      if (isAlloc) {
        ctx.fillStyle = "#4ade80";
      } else if (node.type === "keystone") {
        ctx.fillStyle = "#f87171";
      } else if (node.type === "notable") {
        ctx.fillStyle = "#fbbf24";
      } else {
        ctx.fillStyle = "#3a4a60";
      }
      ctx.fill();
    }

    // Draw viewport rectangle
    const area = this.container?.querySelector(".pob-tree-area") as HTMLElement;
    if (area) {
      const rect = area.getBoundingClientRect();
      // Convert viewport corners to world coords
      const worldLeft = (0 - this.panX) / (this.SCALE * this.zoom);
      const worldTop = (0 - this.panY) / (this.SCALE * this.zoom);
      const worldRight = (rect.width - this.panX) / (this.SCALE * this.zoom);
      const worldBottom = (rect.height - this.panY) / (this.SCALE * this.zoom);

      const vx1 = toMiniX(worldLeft);
      const vy1 = toMiniY(worldTop);
      const vx2 = toMiniX(worldRight);
      const vy2 = toMiniY(worldBottom);

      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(vx1, vy1, vx2 - vx1, vy2 - vy1);
    }
  }

  private updateStatsPanel() {
    const listEl = document.getElementById("pob-stats-list");
    if (!listEl) return;

    if (this.allocatedNodes.length === 0) {
      listEl.innerHTML = `<div class="pob-stats-empty">暂无已分配天赋</div>`;
      return;
    }

    let html = `<div class="pob-stats-summary">已分配 ${this.allocatedNodes.length} 个天赋节点</div>`;

    // Show each allocated node with its stats
    for (const nodeId of this.allocatedNodes) {
      const node = getNodeById(nodeId);
      if (!node) continue;

      let headerColor = "#c8c8c8";
      if (node.type === "notable") headerColor = "#fbbf24";
      else if (node.type === "keystone") headerColor = "#f87171";
      else if (node.type === "ascendancy") headerColor = "#a78bfa";

      html += `<div class="pob-stat-node" style="border-left: 2px solid ${headerColor}; padding-left: 6px; margin-bottom: 6px;">`;
      html += `<div class="pob-stat-node-name" style="color:${headerColor};font-size:11px;">${node.name}</div>`;

      // Show displayStats (raw text)
      if (node.displayStats && node.displayStats.length > 0) {
        for (const statText of node.displayStats) {
          const lines = statText.split("\n");
          for (const line of lines) {
            if (line.trim()) {
              html += `<div class="pob-stat-row" style="font-size:10px;"><span class="pob-stat-value">${line}</span></div>`;
            }
          }
        }
      }

      html += `</div>`;
    }

    listEl.innerHTML = html;
  }

  private bindEvents() {
    if (!this.container || this.eventsBound) return;
    this.eventsBound = true;

    const treeArea = this.container.querySelector(".pob-tree-area") as HTMLElement;
    if (!treeArea) return;

    // === Pan: mouse drag ===
    treeArea.addEventListener("mousedown", (e) => {
      if ((e.target as HTMLElement).closest(".pob-node")) return;
      this.isPanning = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      treeArea.style.cursor = "grabbing";
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.isPanning) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.panX += dx;
      this.panY += dy;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.render();
    });

    window.addEventListener("mouseup", () => {
      this.isPanning = false;
      if (treeArea) treeArea.style.cursor = "";
    });

    // === Zoom: scroll wheel ===
    treeArea.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      const factor = 1 + delta * 0.1;
      const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));

      // Zoom toward cursor
      const rect = treeArea.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      this.panX = cx - (cx - this.panX) * (newZoom / this.zoom);
      this.panY = cy - (cy - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;
      this.render();
    }, { passive: false });

    // === Touch: pinch-to-zoom & drag-to-pan ===
    treeArea.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        // Pinch start
        const t0 = e.touches[0], t1 = e.touches[1];
        this.lastTouchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const midX = (t0.clientX + t1.clientX) / 2;
        const midY = (t0.clientY + t1.clientY) / 2;
        const rect = treeArea.getBoundingClientRect();
        this.lastTouchMidX = midX - rect.left;
        this.lastTouchMidY = midY - rect.top;
        e.preventDefault();
      } else if (e.touches.length === 1) {
        this.isPanning = true;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
        this.touchMoved = false;
        this.touchStartTime = Date.now();
        e.preventDefault();
      }
    }, { passive: false });

    treeArea.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2) {
        // Pinch move
        const t0 = e.touches[0], t1 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const midX = (t0.clientX + t1.clientX) / 2;
        const midY = (t0.clientY + t1.clientY) / 2;
        const rect = treeArea.getBoundingClientRect();
        const cmx = midX - rect.left;
        const cmy = midY - rect.top;

        if (this.lastTouchDist > 0) {
          const factor = dist / this.lastTouchDist;
          const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
          // Zoom toward pinch center
          this.panX = cmx - (cmx - this.panX) * (newZoom / this.zoom);
          this.panY = cmy - (cmy - this.panY) * (newZoom / this.zoom);
          this.zoom = newZoom;
        }

        // Pan from pinch center movement
        this.panX += cmx - this.lastTouchMidX;
        this.panY += cmy - this.lastTouchMidY;
        this.lastTouchDist = dist;
        this.lastTouchMidX = cmx;
        this.lastTouchMidY = cmy;
        this.render();
        e.preventDefault();
      } else if (e.touches.length === 1 && this.isPanning) {
        const dx = e.touches[0].clientX - this.lastMouseX;
        const dy = e.touches[0].clientY - this.lastMouseY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.touchMoved = true;
        this.panX += dx;
        this.panY += dy;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
        this.render();
        e.preventDefault();
      }
    }, { passive: false });

    treeArea.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) {
        this.lastTouchDist = 0;
      }
      if (e.touches.length === 0) {
        // Detect tap (short touch without movement)
        const elapsed = Date.now() - this.touchStartTime;
        if (!this.touchMoved && elapsed < 300 && e.changedTouches.length > 0) {
          const touch = e.changedTouches[0];
          const rect = treeArea.getBoundingClientRect();
          const tx = touch.clientX - rect.left;
          const ty = touch.clientY - rect.top;
          // Find node under touch point
          const el = document.elementFromPoint(touch.clientX, touch.clientY);
          const nodeEl = el?.closest(".pob-node") as HTMLElement;
          if (nodeEl) {
            const nodeId = nodeEl.dataset.nodeId;
            if (nodeId) this.handleNodeClick(nodeId);
          }
        }
        this.isPanning = false;
      }
    });

    // === Node click ===
    this.treeWorld!.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const nodeEl = target.closest(".pob-node") as HTMLElement;
      if (nodeEl) {
        const nodeId = nodeEl.dataset.nodeId;
        if (nodeId) this.handleNodeClick(nodeId);
      }
    });

    // === Node hover tooltip ===
    this.treeWorld!.addEventListener("mouseover", (e) => {
      const target = e.target as HTMLElement;
      const nodeEl = target.closest(".pob-node") as HTMLElement;
      if (nodeEl) {
        const nodeId = nodeEl.dataset.nodeId;
        if (nodeId) this.showTooltip(nodeId, e as MouseEvent);
      }
    });

    this.treeWorld!.addEventListener("mouseout", (e) => {
      const target = e.target as HTMLElement;
      const nodeEl = target.closest(".pob-node") as HTMLElement;
      if (nodeEl) this.hideTooltip();
    });

    // === Zoom buttons ===
    this.container.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".pob-zoom-btn") as HTMLElement;
      if (!btn) return;
      const action = btn.dataset.zoom;
      if (action === "in") {
        this.zoom = Math.min(this.maxZoom, this.zoom * 1.3);
      } else if (action === "out") {
        this.zoom = Math.max(this.minZoom, this.zoom / 1.3);
      } else if (action === "reset") {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
      }
      this.render();
    });

    // === Search ===
    const searchInput = this.container.querySelector(".pob-search") as HTMLInputElement;
    if (searchInput) {
      let debounceTimer: ReturnType<typeof setTimeout>;
      searchInput.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.setSearch(searchInput.value);
        }, 150);
      });
    }

    // === Window resize ===
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  private handleNodeClick(nodeId: string) {
    const node = getNodeById(nodeId);
    if (!node) return;

    const isAllocated = this.allocatedNodes.includes(nodeId);
    const canAlloc = canAllocateNode(nodeId, this.allocatedNodes);

    if (isAllocated) {
      this.allocatedNodes = deallocateNode(nodeId, this.allocatedNodes);
      this.onDeallocate?.(nodeId);
    } else if (canAlloc) {
      this.allocatedNodes = allocateNode(nodeId, this.allocatedNodes);
      this.onAllocate?.(nodeId);
    }

    this.render();
  }

  private showTooltip(nodeId: string, event: MouseEvent) {
    const node = getNodeById(nodeId);
    if (!node) return;
    this.hideTooltip();

    const tooltip = document.createElement("div");
    tooltip.className = "pob-tooltip";

    let headerColor = "#c8c8c8";
    if (node.type === "notable") headerColor = "#fbbf24";
    else if (node.type === "keystone") headerColor = "#f87171";
    else if (node.type === "ascendancy") headerColor = "#a78bfa";

    let html = `<div class="pob-tooltip-header" style="color:${headerColor}">${node.name}</div>`;
    const typeLabels: Record<string, string> = {
      normal: "普通天赋", notable: "重要天赋", keystone: "关键天赋", ascendancy: "升华天赋",
    };
    html += `<div class="pob-tooltip-type">${typeLabels[node.type] || node.type}</div>`;
    if (node.ascendancyName) {
      html += `<div class="pob-tooltip-ascendancy">${node.ascendancyName}</div>`;
    }
    html += `<div class="pob-tooltip-divider"></div>`;
    html += `<div class="pob-tooltip-stats">`;

    // Show raw displayStats text (from GGG data)
    if (node.displayStats && node.displayStats.length > 0) {
      for (const statText of node.displayStats) {
        // Split multi-line stats (\n-separated in original data)
        const lines = statText.split("\n");
        for (const line of lines) {
          if (line.trim()) {
            html += `<div class="pob-tooltip-mod">${line}</div>`;
          }
        }
      }
    }

    // Also show structured stats if any
    for (const stat of node.stats) {
      const value = (stat.min + stat.max) / 2;
      let modStr = "";
      if (stat.modType === ModType.Flat) {
        modStr = `${value >= 0 ? "+" : ""}${value}`;
      } else if (stat.modType === ModType.Increased) {
        modStr = `${value >= 0 ? "+" : ""}${value}% increased`;
      } else if (stat.modType === ModType.More) {
        modStr = `${value >= 0 ? "+" : ""}${value}% more`;
      }
      const statNames: Record<string, string> = {
        strength: "力量", dexterity: "敏捷", intelligence: "智力",
        maxLife: "最大生命", maxMana: "最大魔力",
        armor: "护甲", evasion: "闪避", energyShield: "能量护盾",
        physicalDamage: "物理伤害", fireDamage: "火焰伤害",
        coldDamage: "冰冷伤害", lightningDamage: "闪电伤害",
        elementalDamage: "元素伤害", attackSpeed: "攻击速度",
        castSpeed: "施法速度", critChance: "暴击几率",
        critMultiplier: "暴击伤害", accuracy: "命中值",
        fireResistance: "火焰抗性", coldResistance: "冰冷抗性",
        lightningResistance: "闪电抗性", chaosResistance: "混沌抗性",
        stunImmune: "眩晕免疫",
      };
      html += `<div class="pob-tooltip-mod">${modStr} ${statNames[stat.stat] || stat.stat}</div>`;
    }
    html += `</div>`;

    // Flavor text
    if (node.flavourText && node.flavourText.length > 0) {
      html += `<div class="pob-tooltip-divider"></div>`;
      for (const ft of node.flavourText) {
        html += `<div class="pob-tooltip-flavour">${ft}</div>`;
      }
    }

    if (node.requires.length > 0) {
      const isAlloc = this.allocatedNodes.includes(nodeId);
      const canAlloc = canAllocateNode(nodeId, this.allocatedNodes);
      html += `<div class="pob-tooltip-divider"></div>`;
      if (isAlloc) {
        html += `<div class="pob-tooltip-action">已分配</div>`;
      } else if (canAlloc) {
        html += `<div class="pob-tooltip-action pob-can-allocate">可分配</div>`;
      } else {
        html += `<div class="pob-tooltip-action pob-cannot-allocate">需要前置天赋</div>`;
      }
    }

    tooltip.innerHTML = html;
    document.body.appendChild(tooltip);

    const rect = (event.target as HTMLElement).getBoundingClientRect();
    let left = rect.left + rect.width / 2;
    let top = rect.top - 10;

    // Keep tooltip on screen
    requestAnimationFrame(() => {
      const tr = tooltip.getBoundingClientRect();
      if (left + tr.width / 2 > window.innerWidth) left = window.innerWidth - tr.width / 2 - 8;
      if (left - tr.width / 2 < 0) left = tr.width / 2 + 8;
      if (top - tr.height < 0) top = rect.bottom + 10;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    });

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    this.tooltipEl = tooltip;
  }

  private hideTooltip() {
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
    }
  }
}
