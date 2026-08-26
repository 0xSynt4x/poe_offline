import { Player, StatBreakdown, StatSource, StatSourceDetail, FlaskBonusDisplay, DamageType, Flask } from "../models/types";
import { computeSkillGroup, estimateDps } from "../systems/gemLink";
import { calculateStatBreakdown } from "../systems/statCalc";
import { getFlaskTypeLabel, getUtilityLabel, FLASK_SLOT_COUNT } from "../data/flasks";

/**
 * Right panel: real-time character stats + DPS analysis.
 * Mirrors PoB's always-visible right column.
 * Features: hover tooltips, crit/non-crit DPS split, element distribution, flask bonuses.
 */
export class RightPanel {
  private container: HTMLElement | null = null;
  private headingEl: HTMLElement | null = null;
  private panelEl: HTMLElement | null = null;
  private player: Player | null = null;
  private isCollapsed = false;
  private currentTooltip: HTMLElement | null = null;

  init() {
    this.container = document.getElementById("right-panel-content");
    this.panelEl = document.getElementById("right-panel");
    this.headingEl = this.panelEl?.querySelector(".rp-heading") ?? null;
    this.setupCollapseToggle();
  }

  setPlayer(player: Player) {
    this.player = player;
  }

  /** Toggle right panel collapse/expand. */
  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    if (this.panelEl) {
      this.panelEl.classList.toggle("rp-collapsed", this.isCollapsed);
    }
    // Update the toggle button label
    const btn = document.getElementById("rp-collapse-btn");
    if (btn) {
      btn.textContent = this.isCollapsed ? "◀ 展开" : "▶ 折叠";
      btn.title = this.isCollapsed ? "展开右栏" : "折叠右栏";
    }
  }

  private setupCollapseToggle() {
    // Create collapse button
    if (!this.panelEl || this.panelEl.querySelector("#rp-collapse-btn")) return;
    const btn = document.createElement("button");
    btn.id = "rp-collapse-btn";
    btn.className = "rp-collapse-btn";
    btn.textContent = "▶ 折叠";
    btn.title = "折叠右栏";
    btn.addEventListener("click", () => this.toggleCollapse());
    this.panelEl.prepend(btn);
  }

  /** Full refresh — call after any stat change. */
  update() {
    if (!this.container || !this.player) return;
    // Bug fix: hide any lingering tooltip before destroying DOM elements
    this.hideStatTooltip();
    const player = this.player;
    const bd = calculateStatBreakdown(player);
    player.statBreakdown = bd;

    const resClamp = (v: number) => v > 75 ? 75 : v;

    /** Safely encode a value for use in a single-quoted HTML attribute */
    const safeAttr = (val: unknown) => JSON.stringify(val).replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    /** Format a stat row with hover-capable details */
    const fmtDetailSrc = (s: StatSource, label: string, suffix?: string) => {
      const suffixStr = suffix || "";
      const parts: string[] = [];
      if (s.equipment) parts.push(`<span class="rp-equip">装备 ${s.equipment > 0 ? "+" : ""}${s.equipment}${suffixStr}</span>`);
      if (s.passive) parts.push(`<span class="rp-passive">天赋 ${s.passive > 0 ? "+" : ""}${s.passive}${suffixStr}</span>`);
      if (s.increased !== undefined && s.increased > 0) parts.push(`<span class="rp-increased">inc +${s.increased.toFixed(0)}%</span>`);
      if (s.more !== undefined && s.more > 1) parts.push(`<span class="rp-more">more ×${s.more.toFixed(2)}</span>`);
      const valStr = `${s.total}${suffixStr}`;
      return `<div class="rp-row" data-stat-details='${safeAttr(s.details || [])}'>
        <span class="rp-label">${label}</span>
        <span class="rp-value">${valStr}</span>
        ${parts.length > 0 ? `<span class="rp-sources">${parts.join(" ")}</span>` : ""}
      </div>`;
    };

    // ===== DPS per skill =====
    const dpsRows: string[] = [];
    for (let i = 0; i < 3; i++) {
      const group = player.skillGroups[i];
      if (!group) continue;
      const computed = computeSkillGroup(group);
      const totalDps = estimateDps(computed, player.offense.critChance, player.offense.critMultiplier, player.offense.attackSpeed);

      // Crit / non-crit breakdown
      // Clamp critChance to [0,100] for DPS display — negative crit (e.g. controlled_destruction) would break the formula
      const critChance = Math.max(0, Math.min(100, player.offense.critChance + computed.critChanceBonus));
      const critMult = (player.offense.critMultiplier + computed.critMultiplierBonus) / 100;
      const critDpsMultiplier = 1 + (critChance / 100) * (critMult - 1);
      const nonCritDps = Math.floor(critDpsMultiplier > 0 ? totalDps / critDpsMultiplier : totalDps);
      const critDps = Math.floor(nonCritDps * critMult);
      const hitDamage = computed.totalDamage;
      const critHitDamage = Math.floor(hitDamage * critMult);

      const pen = computed.firePenetration || computed.coldPenetration || computed.lightningPenetration || computed.chaosPenetration || 0;
      const penLabel = computed.firePenetration > 0 ? "🔥" : computed.coldPenetration > 0 ? "❄️" : computed.lightningPenetration > 0 ? "⚡" : computed.chaosPenetration > 0 ? "☠️" : "";

      // Element distribution bar: keep mixed damage visible instead of using only its dominant type.
      const damageTotal = computed.damageParts.reduce((sum, part) => sum + part.amount, 0) || 1;
      const elemColor = (type: DamageType) => type === DamageType.Physical ? "var(--damage-phys)"
        : type === DamageType.Fire ? "var(--damage-fire)"
        : type === DamageType.Cold ? "var(--damage-cold)"
        : type === DamageType.Lightning ? "var(--damage-lightning)"
        : "var(--damage-chaos)";
      const elemBar = `<div class="rp-elem-bar">${computed.damageParts.map(part =>
        `<div class="rp-elem-fill" style="width:${part.amount / damageTotal * 100}%;background:${elemColor(part.type)};" title="${part.type} ${Math.floor(part.amount)}"></div>`
      ).join("")}</div>`;

      dpsRows.push(`
        <div class="rp-dps-row">
          <div class="rp-dps-header">
            <span class="rp-dps-skill gem-${group.activeGem.color}">${group.activeGem.name}</span>
            <span class="rp-dps-total">≈${totalDps}</span>
          </div>
          <div class="rp-dps-split">
            <span class="rp-dps-crit">暴击 ${critDps} <small>(${critChance.toFixed(0)}%)</small></span>
            <span class="rp-dps-noncrit">非暴击 ${nonCritDps}</span>
          </div>
          <div class="rp-dps-detail">
            每击 ${hitDamage} / 暴击 ${critHitDamage}
            · ${(player.offense.attackSpeed * (1 + computed.attackSpeedBonus / 100)).toFixed(2)}攻速
            ${pen ? ` · ${penLabel}${pen}%穿` : ""}
          </div>
          ${elemBar}
        </div>
      `);
    }

    const allDps = dpsRows.length > 0
      ? dpsRows.join("")
      : `<div class="rp-dps-empty">无技能配置</div>`;

    // ===== Flask bonuses =====
    const flaskBonuses = this.buildFlaskBonuses();
    const flaskHtml = flaskBonuses.length > 0
      ? flaskBonuses.map(f => {
        const icon = f.flaskType === "life" ? "♥" : f.flaskType === "mana" ? "◆" : "✦";
        const statusClass = f.active ? "active" : "";
        return `<div class="rp-flask-row ${statusClass}">
          <span class="rp-flask-icon flask-${f.flaskType}">${icon}</span>
          <span class="rp-flask-name">${f.flaskName}</span>
          <span class="rp-flask-charges">${f.charges}/${f.maxCharges}</span>
          ${f.bonuses.map(b => `<span class="rp-flask-bonus">${b.label} ${b.value}</span>`).join("")}
        </div>`;
      }).join("")
      : `<div class="rp-flask-empty">无药剂</div>`;

    this.container.innerHTML = `
      <div class="rp-section">
        <div class="rp-title">🛡️ 防御</div>
        ${fmtDetailSrc(bd.defensive.life, "生命")}
        ${fmtDetailSrc(bd.defensive.mana, "魔力")}
        ${fmtDetailSrc(bd.defensive.armor, "护甲")}
        ${fmtDetailSrc(bd.defensive.evasion, "闪避")}
        ${fmtDetailSrc(bd.defensive.energyShield, "能量护盾")}
      </div>
      <div class="rp-section">
        <div class="rp-title">🔥 抗性</div>
        <div class="rp-row" data-stat-details='${safeAttr(bd.defensive.fireRes.details || [])}'>
          <span class="rp-label rp-fire">火焰</span>
          <span class="rp-value ${resClamp(bd.defensive.fireRes.total) >= 75 ? "rp-capped" : ""}">${bd.defensive.fireRes.total}%</span>
          <span class="rp-cap">/75</span>
        </div>
        <div class="rp-row" data-stat-details='${safeAttr(bd.defensive.coldRes.details || [])}'>
          <span class="rp-label rp-cold">冰霜</span>
          <span class="rp-value ${resClamp(bd.defensive.coldRes.total) >= 75 ? "rp-capped" : ""}">${bd.defensive.coldRes.total}%</span>
          <span class="rp-cap">/75</span>
        </div>
        <div class="rp-row" data-stat-details='${safeAttr(bd.defensive.lightningRes.details || [])}'>
          <span class="rp-label rp-lightning">闪电</span>
          <span class="rp-value ${resClamp(bd.defensive.lightningRes.total) >= 75 ? "rp-capped" : ""}">${bd.defensive.lightningRes.total}%</span>
          <span class="rp-cap">/75</span>
        </div>
        <div class="rp-row" data-stat-details='${safeAttr(bd.defensive.chaosRes.details || [])}'>
          <span class="rp-label rp-chaos">混沌</span>
          <span class="rp-value ${bd.defensive.chaosRes.total >= 75 ? "rp-capped" : bd.defensive.chaosRes.total < 0 ? "rp-negative" : ""}">${bd.defensive.chaosRes.total}%</span>
          <span class="rp-cap">/75</span>
        </div>
      </div>
      <div class="rp-section">
        <div class="rp-title">⚔️ 进攻</div>
        ${fmtDetailSrc(bd.offensive.increasedDamage, "伤害加成", "%")}
        ${fmtDetailSrc(bd.offensive.attackSpeed, "攻速")}
        ${fmtDetailSrc(bd.offensive.critChance, "暴击率", "%")}
        ${fmtDetailSrc(bd.offensive.critMultiplier, "暴击伤害", "%")}
      </div>
      <div class="rp-section">
        <div class="rp-title">🧪 药剂</div>
        ${flaskHtml}
      </div>
      <div class="rp-section">
        <div class="rp-title">📊 DPS 分析</div>
        ${allDps}
      </div>
    `;

    // Bind hover tooltips for stat details
    this.bindStatTooltips();
  }

  /** Build flask bonus display data */
  private buildFlaskBonuses(): FlaskBonusDisplay[] {
    if (!this.player) return [];
    const result: FlaskBonusDisplay[] = [];
    const flasks = this.player.flasks;
    for (let i = 0; i < Math.min(FLASK_SLOT_COUNT, flasks.length); i++) {
      const flask = flasks[i];
      if (!flask) continue;
      const isUtility = flask.effect.type === "utility";
      const bonuses: { label: string; value: string }[] = [];

      if (flask.effect.type === "life") {
        bonuses.push({ label: "恢复", value: `${flask.effect.amountPercent}% 最大生命` });
      } else if (flask.effect.type === "mana") {
        bonuses.push({ label: "恢复", value: `${flask.effect.amountPercent}% 最大魔力` });
      } else {
        const utilLabel = getUtilityLabel(flask.effect.utility);
        bonuses.push({ label: utilLabel, value: `+${flask.effect.value}% · ${flask.effect.duration}回合` });
      }

      result.push({
        flaskName: flask.name,
        flaskType: flask.type,
        isUtility,
        bonuses,
        active: flask.charges >= flask.chargesPerUse,
        charges: flask.charges,
        maxCharges: flask.maxCharges,
      });
    }
    return result;
  }

  /** Bind hover event listeners for stat detail tooltips */
  private bindStatTooltips() {
    if (!this.container) return;
    this.container.querySelectorAll<HTMLElement>("[data-stat-details]").forEach(el => {
      el.addEventListener("mouseenter", (e) => this.showStatTooltip(el, e));
      el.addEventListener("mouseleave", () => this.hideStatTooltip());
      el.addEventListener("mousemove", (e) => this.moveStatTooltip(e));
    });
  }

  private showStatTooltip(el: HTMLElement, e: MouseEvent) {
    this.hideStatTooltip();
    const raw = el.getAttribute("data-stat-details");
    if (!raw) return;
    let details: StatSourceDetail[];
    try { details = JSON.parse(raw); } catch { return; }
    if (!details || details.length === 0) return;

    const tooltip = document.createElement("div");
    tooltip.className = "rp-stat-tooltip";
    const grouped: Record<string, StatSourceDetail[]> = { base: [], equipment: [], passive: [], more: [], flask: [] };
    for (const d of details) {
      (grouped[d.type] || grouped.base).push(d);
    }

    const typeLabels: Record<string, string> = { base: "基础", equipment: "装备", passive: "天赋", more: "More", flask: "药剂" };
    const typeColors: Record<string, string> = { base: "#8b949e", equipment: "#388bfd", passive: "#3fb950", more: "#d29922", flask: "#a371f7" };

    let html = "";
    for (const [type, items] of Object.entries(grouped)) {
      if (items.length === 0) continue;
      const label = typeLabels[type] || type;
      const color = typeColors[type] || "#8b949e";
      html += `<div class="rp-tooltip-group"><span class="rp-tooltip-type" style="color:${color}">${label}</span>`;
      for (const item of items) {
        const sign = item.value > 0 ? "+" : "";
        html += `<div class="rp-tooltip-row"><span class="rp-tooltip-label">${item.label}</span><span class="rp-tooltip-value" style="color:${color}">${sign}${item.value}</span></div>`;
      }
      html += `</div>`;
    }

    tooltip.innerHTML = html;
    document.body.appendChild(tooltip);
    this.currentTooltip = tooltip;
    this.moveStatTooltip(e);
  }

  private moveStatTooltip(e: MouseEvent) {
    if (!this.currentTooltip) return;
    const x = Math.min(e.clientX + 14, window.innerWidth - this.currentTooltip.offsetWidth - 12);
    const y = Math.min(e.clientY + 14, window.innerHeight - this.currentTooltip.offsetHeight - 12);
    this.currentTooltip.style.left = `${x}px`;
    this.currentTooltip.style.top = `${y}px`;
  }

  private hideStatTooltip() {
    if (this.currentTooltip) {
      this.currentTooltip.remove();
      this.currentTooltip = null;
    }
  }
}
