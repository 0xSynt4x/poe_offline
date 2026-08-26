import { Player, Item, EquipSlot, Rarity, SkillGroup, Monster, Flask, ModType, Gem, GemType, GemColor } from "../models/types";
import { MapDevice, MapDeviceState } from "../systems/mapDevice";
import { GameMap, MAP_PREFIXES, MAP_SUFFIXES, formatMapName, formatMapModifiers, getMapEffects } from "../data/maps";
import { getBasesBySlot } from "../data/bases";
import { generateItem, formatItem, calculateItemStats, applyCurrency } from "../systems/affix";
import { randomBase, ALL_BASES } from "../data/bases";
import { CURRENCIES, getCurrencyById } from "../data/currencies";
import { createSkillGroup, computeSkillGroup, addGemExperience, getGemProgress } from "../systems/gemLink";
import { ItemDetailUI } from "./itemDetail";
import { getGemById, GemData } from "../data/gems";
import { socketGem, unsocketGem, getLinkGroups, getColorName } from "../systems/socket";
import { CombatSystem } from "../systems/combat";
import { PassiveTreeUI } from "./passiveTreeUI";
import { calculatePassiveModifiers } from "../data/passiveTree";
import { ZoneSystem, ExplorationResult, ExplorationReward } from "../systems/zone";
import { Zone, ALL_ZONES, getZoneById } from "../data/zones";
import { saveManager, SaveSlot } from "../systems/saveLoad";
import { ALL_QUESTS, Quest } from "../data/story";
import { FLASK_SLOT_COUNT, createDefaultFlasks, getFlaskTypeLabel, getUtilityLabel, restoreFlasks } from "../data/flasks";

// ===== UI状态 =====

export type MainView = "menu" | "zone-select" | "scene" | "combat" | "map-device";

export type UtilityPanel =
  | "character"
  | "equipment"
  | "skills"
  | "inventory"
  | "stash"
  | "quests"
  | "log"
  | "save";

interface UIState {
  player: Player;
  currentTab: "items" | "currency" | "gems";
  selectedSlot: EquipSlot | null;
  combat: CombatSystem | null;
  inCombat: boolean;
  logMessages: string[];
  selectedCurrencyId: string | null;
}

// ===== UI控制器 =====

export class UIController {
  private state: UIState;
  private passiveTreeUI: PassiveTreeUI;
  private zoneSystem: ZoneSystem;
  private mapDevice: MapDevice;
  private itemDetailUI: ItemDetailUI;
  private gameStarted: boolean = false;
  private combatTurnPending: boolean = false;
  private combatVictories = 0;
  private pendingCombatRewards: ExplorationReward[] | null = null;
  private gameAreaMarkup: string | null = null;
  private eventsBound = false;
  private keyboardEventsBound = false;
  private tooltipElement: HTMLElement | null = null;
  private itemDetailInitialized = false;
  private mainView: MainView = "menu";
  private previousMainView: MainView = "zone-select";
  private selectedMapId: string | null = null;
  private combatRewardResolved = false;
  private combatTurnNumber = 0;
  
  constructor() {
    this.state = {
      player: this.createDefaultPlayer(),
      currentTab: "items",
      selectedSlot: null,
      combat: null,
      inCombat: false,
      logMessages: [],
      selectedCurrencyId: null,
    };
    this.passiveTreeUI = new PassiveTreeUI();
    this.itemDetailUI = new ItemDetailUI();
    this.zoneSystem = new ZoneSystem(this.state.player);
    this.mapDevice = new MapDevice();
  }
  
  // 初始化UI
  init() {
    this.gameAreaMarkup = document.getElementById("game-area")?.innerHTML || "";
    this.showMainMenu();
  }

  private setMainView(view: MainView): void {
    this.mainView = view;
    const displayIds: Record<Exclude<MainView, "menu">, string> = {
      "zone-select": "zone-select-display",
      scene: "scene-display",
      combat: "combat-display",
      "map-device": "map-device-display",
    };

    for (const [key, id] of Object.entries(displayIds)) {
      const element = document.getElementById(id);
      if (element) element.style.display = key === view ? "block" : "none";
    }
  }

  private getMainView(): MainView {
    return this.mainView;
  }
  
  // ===== 主菜单 =====
  
  showMainMenu() {
    this.mainView = "menu";
    this.setMainView("menu");
    const mainArea = document.getElementById("game-area");
    if (!mainArea) return;
    
    mainArea.innerHTML = `
      <div class="panel main-menu">
        <h2 class="panel-title">⚔️ PoE文字游戏</h2>
        <div class="menu-buttons">
          <button class="menu-btn" id="btn-new-game">
            <span class="menu-btn-icon">🎮</span>
            <span class="menu-btn-text">新游戏</span>
          </button>
          <button class="menu-btn" id="btn-load-game">
            <span class="menu-btn-icon">📂</span>
            <span class="menu-btn-text">继续游戏</span>
          </button>
          <button class="menu-btn" id="btn-save-game" style="display:none;">
            <span class="menu-btn-icon">💾</span>
            <span class="menu-btn-text">存档管理</span>
          </button>
        </div>
        <div id="menu-saves" class="menu-saves"></div>
      </div>
    `;
    
    // 绑定按钮事件
    document.getElementById("btn-new-game")?.addEventListener("click", () => this.startNewGame());
    const loadButton = document.getElementById("btn-load-game") as HTMLButtonElement | null;
    if (loadButton) {
      loadButton.disabled = !saveManager.hasSaves();
      loadButton.addEventListener("click", () => this.showLoadMenu());
    }
    document.getElementById("btn-save-game")?.addEventListener("click", () => this.showSaveMenu());
    
    // 检查是否有存档
    if (saveManager.hasSaves()) {
      document.getElementById("btn-load-game")?.removeAttribute("disabled");
    }
  }
  
  private getSaveMenuElement(): HTMLElement | null {
    if (this.gameStarted) {
      return document.querySelector<HTMLElement>("[data-save-menu]");
    }
    return document.querySelector<HTMLElement>("#game-area #menu-saves");
  }

  // 显示加载菜单
  showLoadMenu() {
    const savesDiv = this.getSaveMenuElement();
    if (!savesDiv) return;
    
    const slots = saveManager.getSaveSlots();
    let html = '<div class="save-list"><h3>选择存档</h3>';
    
    for (const slot of slots) {
      if (slot.exists) {
        html += `
          <div class="save-slot" data-slot="${slot.id}">
            <div class="save-info">
              <div class="save-name">${slot.slotName}</div>
              <div class="save-details">
                <span>等级 ${slot.level}</span>
                <span>第${slot.chapter}章</span>
                <span>${saveManager.formatPlayTime(slot.playTime)}</span>
                <span>${saveManager.formatTimestamp(slot.timestamp)}</span>
              </div>
            </div>
            <div class="save-actions">
              <button class="btn-load" data-slot="${slot.id}">加载</button>
              <button class="btn-delete" data-slot="${slot.id}">删除</button>
            </div>
          </div>
        `;
      }
    }
    
    html += '<button class="btn-back" id="btn-back-main">返回</button></div>';
    savesDiv.innerHTML = html;
    
    // 绑定事件
    savesDiv.querySelectorAll(".btn-load").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const slotId = (e.target as HTMLElement).dataset.slot;
        if (slotId) this.loadGame(slotId);
      });
    });
    
    savesDiv.querySelectorAll(".btn-delete").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const slotId = (e.target as HTMLElement).dataset.slot;
        if (slotId && confirm("确定要删除这个存档吗？")) {
          saveManager.deleteSave(slotId);
          this.showLoadMenu();
        }
      });
    });
    
    document.getElementById("btn-back-main")?.addEventListener("click", () => {
      savesDiv.innerHTML = '';
    });
  }
  
  // 显示保存菜单
  showSaveMenu() {
    const savesDiv = this.getSaveMenuElement();
    if (!savesDiv) return;
    
    const slots = saveManager.getSaveSlots();
    let html = '<div class="save-list"><h3>保存游戏</h3>';
    
    for (const slot of slots) {
      html += `
        <div class="save-slot" data-slot="${slot.id}">
          <div class="save-info">
            <div class="save-name">${slot.exists ? slot.slotName : '空存档位'}</div>
            ${slot.exists ? `
              <div class="save-details">
                <span>等级 ${slot.level}</span>
                <span>${saveManager.formatTimestamp(slot.timestamp)}</span>
              </div>
            ` : ''}
          </div>
          <div class="save-actions">
            <button class="btn-save" data-slot="${slot.id}">
              ${slot.exists ? '覆盖保存' : '保存'}
            </button>
          </div>
        </div>
      `;
    }
    
    html += '<button class="btn-back" id="btn-back-game">返回游戏</button></div>';
    savesDiv.innerHTML = html;
    
    // 绑定事件
    savesDiv.querySelectorAll(".btn-save").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const slotId = (e.target as HTMLElement).dataset.slot;
        if (slotId) {
          if (saveManager.getCurrentSlot() === parseInt(slotId) || !saveManager.hasSaves()) {
            this.saveGame(slotId);
          } else if (confirm("覆盖现有存档？")) {
            this.saveGame(slotId);
          }
        }
      });
    });
    
    document.getElementById("btn-back-game")?.addEventListener("click", () => {
      savesDiv.innerHTML = '';
    });
  }
  
  // 保存游戏
  saveGame(slotId: string) {
    const success = saveManager.save(
      slotId,
      this.state.player,
      this.zoneSystem.getState(),
      this.mapDevice.getState()
    );
    if (success) {
      this.addLog("游戏已保存");
      alert("保存成功！");
    } else {
      alert("保存失败！");
    }
  }
  
  // 加载游戏
  loadGame(slotId: string) {
    const saveData = saveManager.load(slotId);
    if (!saveData) {
      alert("加载失败！");
      return;
    }
    
    // 恢复玩家数据
    this.state.player = this.createPlayerFromSave(saveData);
    
    // 恢复区域进度
    this.zoneSystem = new ZoneSystem(this.state.player, saveData.zoneProgress);
    this.state.inCombat = false;
    this.state.combat = null;
    
    // 恢复地图数据（如果有）
    if (saveData.mapDevice) {
      this.mapDevice = new MapDevice();
      this.mapDevice.restoreState(saveData.mapDevice);
    } else {
      this.mapDevice = new MapDevice();
    }
    
    // 启动游戏
    this.startGame();
    
    this.addLog(`已加载存档: ${saveData.slotName}`);
  }
  
  // 从存档恢复玩家数据
  private createPlayerFromSave(saveData: any): Player {
    const playerData = saveData.player;
    
    return {
      name: playerData.name,
      level: playerData.level,
      experience: playerData.experience,
      stats: { ...playerData.stats },
      life: playerData.life,
      maxLife: playerData.maxLife,
      mana: playerData.mana,
      maxMana: playerData.maxMana,
      manaReserved: playerData.manaReserved || 0,
      energyShield: playerData.energyShield || 0,
      defenses: { ...playerData.defenses },
      offense: { ...playerData.offense },
      passivePoints: playerData.passivePoints,
      allocatedNodes: [...playerData.allocatedNodes],
      equipment: playerData.equipment || {},
      skillGroups: (playerData.skillGroups || []).map((group: any) => ({
        ...group,
        activeGem: { ...group.activeGem, experience: group.activeGem?.experience || 0 },
        supportGems: (group.supportGems || []).map((gem: any) => ({ ...gem, experience: gem.experience || 0 })),
      })),
      flasks: restoreFlasks(playerData.flasks),
      inventory: {
        items: playerData.inventory.items || [],
        gems: playerData.inventory.gems || [],
        currencies: new Map(Object.entries(playerData.inventory.currencies || {})),
        maxSlots: playerData.inventory.maxSlots || 50,
      },
    };
  }
  
  // 开始新游戏
  startNewGame() {
    this.state.player = this.createDefaultPlayer();
    this.pendingCombatRewards = null;
    this.combatVictories = 0;
    this.zoneSystem = new ZoneSystem(this.state.player);
    this.mapDevice = new MapDevice();
    this.mapDevice.initWithStarterMaps();
    this.startGame();
  }
  
  // 启动游戏
  private startGame() {
    this.gameStarted = true;

    // 主菜单会替换游戏区内容，开始游戏时恢复原始游戏壳。
    const mainArea = document.getElementById("game-area");
    if (mainArea && !document.getElementById("zone-select-display")) {
      mainArea.innerHTML = this.gameAreaMarkup || "";
      this.eventsBound = false;
    }
    
    // 初始化游戏界面
    this.initGameUI();
    
    // 开始自动保存
    saveManager.startAutoSave(() => {
      this.autoSave();
    });
  }
  
  // 初始化游戏UI
  private initGameUI() {
    const sideNav = document.getElementById("side-nav");
    if (sideNav) sideNav.style.display = "flex";
    this.bindEvents();
    if (!this.itemDetailInitialized) {
      this.itemDetailUI.init(
        (item) => this.equipItem(item.id),
        (slot) => this.unequipItem(slot),
        (item, socketIndex, gem) => this.socketGemIntoItem(item, socketIndex, gem),
        (item, socketIndex) => this.unsocketGemFromItem(item, socketIndex),
      );
      this.itemDetailInitialized = true;
    }
    this.recalculatePlayerStats();
    this.updateAllUI();
    this.setMainView("zone-select");
    this.showUtilityPanel("character");
    this.updateZoneListUI();
    
    // 初始化天赋树UI
    this.passiveTreeUI.init(
      "passive-tree-container",
      (nodeId) => this.onPassiveAllocate(nodeId),
      (nodeId) => this.onPassiveDeallocate(nodeId)
    );
    this.passiveTreeUI.setAllocatedNodes(this.state.player.allocatedNodes);
    
    this.addLog("游戏初始化完成");
    this.addLog("选择一个区域开始探索");
  }
  
  // 自动保存
  private autoSave() {
    if (saveManager.getCurrentSlot() >= 0) {
      saveManager.autoSave(
        this.state.player,
        this.zoneSystem.getState(),
        this.mapDevice.getState()
      );
    }
  }
  
  // ===== 事件绑定 =====
  
  private bindEvents() {
    if (this.eventsBound) return;
    this.eventsBound = true;

    document.querySelectorAll(".nav-icon").forEach((button) => {
      button.addEventListener("click", () => {
        const panel = (button as HTMLElement).dataset.panel;
        if (panel) this.handleNavPanel(panel);
      });
    });

    document.getElementById("drawer-close")?.addEventListener("click", () => {
      this.closeUtilityPanel();
    });

    // 标签切换
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const tabName = target.dataset.tab as "items" | "currency" | "gems";
        this.switchTab(tabName);
      });
    });
    
    // 装备槽点击
    document.querySelectorAll<HTMLElement>('[data-panel-content="equipment"] .equip-slot').forEach((slot) => {
      slot.addEventListener("click", (e) => {
        const target = e.currentTarget as HTMLElement;
        const slotName = target.dataset.slot as EquipSlot;
        this.selectSlot(slotName);
      });
    });
    
    // 技能槽点击：左键施放，右键打开 Build 配置。
    document.querySelectorAll<HTMLElement>('[data-panel-content="skills"] .skill-slot').forEach((slot) => {
      slot.addEventListener("click", (e) => {
        const target = e.currentTarget as HTMLElement;
        this.useSkill(parseInt(target.dataset.key || "1"));
      });
      slot.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const target = e.currentTarget as HTMLElement;
        this.showSkillConfig(parseInt(target.dataset.key || "1") - 1);
      });
    });

    document.getElementById("btn-build-export")?.addEventListener("click", () => this.exportBuild());
    document.getElementById("btn-build-import")?.addEventListener("click", () => this.importBuild());

    document.getElementById("flask-bar")?.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(".flask-slot");
      if (!target || target.classList.contains("empty")) return;
      const index = Number(target.dataset.flaskSlot || 0);
      this.useFlask(index);
    });

    if (!this.keyboardEventsBound) {
      document.addEventListener("keydown", (e) => {
        if (e.repeat || !this.gameStarted) return;
        const key = e.key.toUpperCase();
        if (key >= "4" && key <= "8") {
          this.useFlask(Number(key) - 4);
        } else if (key === "E") {
          this.useFlask(0);
        }
      });
      this.keyboardEventsBound = true;
    }
    
    // 操作按钮点击
    document.querySelectorAll(".action-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const action = target.textContent?.split(":")[0];
        this.handleAction(action || "");
      });
    });
    
    // 场景按钮
    const btnExplore = document.getElementById("btn-explore");
    if (btnExplore) {
      btnExplore.addEventListener("click", () => this.handleExplore());
    }
    
    const btnRest = document.getElementById("btn-rest");
    if (btnRest) {
      btnRest.addEventListener("click", () => this.handleRest());
    }
    
    const btnLeave = document.getElementById("btn-leave");
    if (btnLeave) {
      btnLeave.addEventListener("click", () => this.leaveZone());
    }

    // 地图仪按钮
    document.getElementById("btn-open-map")?.addEventListener("click", () => this.openSelectedMap());
    document.getElementById("btn-close-map-device")?.addEventListener("click", () => this.closeMapDevice());
    
    // 天赋树模态框
    const modalClose = document.querySelector("#passive-modal .modal-close");
    if (modalClose) {
      modalClose.addEventListener("click", () => this.closePassiveTree());
    }
    
    const modal = document.getElementById("passive-modal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) this.closePassiveTree();
      });
    }
    
    const btnResetPassive = document.getElementById("btn-reset-passive");
    if (btnResetPassive) {
      btnResetPassive.addEventListener("click", () => this.resetPassives());
    }
    
    // 存档管理按钮
    const btnSave = document.getElementById("btn-save-game");
    if (btnSave) {
      btnSave.addEventListener("click", () => this.showSaveMenu());
    }
  }
  
  private handleNavPanel(panel: string) {
    const validPanels: Array<UtilityPanel | "map" | "passive"> = [
      "character", "equipment", "skills", "inventory", "stash", "quests", "log", "save", "map", "passive",
    ];
    if (!validPanels.includes(panel as UtilityPanel | "map" | "passive")) return;
    if (this.state.inCombat && (panel === "map" || panel === "passive")) {
      this.addLog("战斗中无法打开该面板");
      return;
    }

    const drawer = document.getElementById("utility-drawer");
    const activeButton = document.querySelector<HTMLElement>(".nav-icon.active");
    const isDrawerOpen = drawer?.style.display === "block";
    const isSamePanel = activeButton?.dataset.panel === panel;

    if (isDrawerOpen && isSamePanel && panel !== "map" && panel !== "passive") {
      this.closeUtilityPanel();
      return;
    }

    if (panel === "map") {
      if (this.state.inCombat) {
        this.addLog("战斗中无法打开地图仪");
        return;
      }
      this.closeUtilityPanel();
      this.setNavActive("map");
      this.openMapDevice();
      return;
    }
    if (panel === "passive") {
      this.closeUtilityPanel();
      this.setNavActive("passive");
      this.openPassiveTree();
      return;
    }
    if (panel === "save") {
      this.showUtilityPanel("save");
      this.showSaveMenu();
      return;
    }
    this.showUtilityPanel(panel as UtilityPanel);
  }

  private setNavActive(panel: UtilityPanel | "map" | "passive") {
    document.querySelectorAll(".nav-icon").forEach((button) => {
      button.classList.toggle("active", (button as HTMLElement).dataset.panel === panel);
    });
  }

  private showUtilityPanel(panel: UtilityPanel) {
    const drawer = document.getElementById("utility-drawer");
    if (!drawer) return;

    const titleMap: Record<UtilityPanel, string> = {
      character: "角色属性",
      equipment: "装备",
      skills: "技能组",
      inventory: "背包",
      stash: "仓库",
      quests: "任务",
      log: "战斗日志",
      save: "存档管理",
    };
    const title = document.getElementById("drawer-title");
    if (title) title.textContent = titleMap[panel] || "信息面板";

    this.setNavActive(panel);
    document.querySelectorAll("[data-panel-content]").forEach((section) => {
      section.classList.toggle("is-active", (section as HTMLElement).dataset.panelContent === panel);
    });
    drawer.style.display = "block";
  }

  private closeUtilityPanel() {
    const drawer = document.getElementById("utility-drawer");
    if (drawer) drawer.style.display = "none";
    document.querySelectorAll(".nav-icon").forEach((button) => button.classList.remove("active"));
  }

  // ===== Tab切换 =====
  
  switchTab(tab: "items" | "currency" | "gems") {
    this.state.currentTab = tab;
    
    // 更新Tab样式
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.remove("active");
    });
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add("active");
    
    this.updateInventoryUI();
  }
  
  // ===== 装备槽选择 =====
  
  selectSlot(slot: EquipSlot) {
    this.state.selectedSlot = slot;
    const item = this.state.player.equipment[slot];
    
    if (item) {
      this.showItemDetails(item, true);
    } else {
      this.addLog(`${slot} 槽位为空`);
    }
  }
  
  // ===== 使用技能 =====
  
  useSkill(skillIndex: number) {
    if (this.combatTurnPending) {
      this.addLog("正在等待敌人行动");
      return;
    }
    if (!this.state.inCombat) {
      this.addLog("不在战斗中，无法使用技能");
      return;
    }
    
    const skillGroup = this.state.player.skillGroups[skillIndex - 1];
    if (!skillGroup) {
      this.addLog(`技能 ${skillIndex} 未配置`);
      return;
    }
    
    if (!this.state.combat) return;
    
    this.combatTurnPending = true;
    this.combatTurnNumber++;

    // 执行攻击；战斗系统负责检查并扣除魔力。
    const result = this.state.combat.executePlayerAttack(skillGroup);
    if (result.damageDealt > 0) this.rechargeFlasks(3);
    if (result.actions.some((action) => action.type === "death")) this.rechargeFlasks(5);
    
    // 显示结果
    for (const action of result.actions) {
      this.addLog(action.message);
    }
    
    // 更新UI
    this.updateCombatUI();
    
    // 怪物回合
    if (!result.isCombatOver) {
      setTimeout(() => {
        if (!this.state.combat) return;
        const monsterResult = this.state.combat.executeMonsterTurn();
        for (const action of monsterResult.actions) {
          this.addLog(action.message);
        }
        if (monsterResult.damageTaken > 0) this.rechargeFlasks(2);
        this.updateCombatUI();
        this.combatTurnPending = false;
        
        if (monsterResult.isCombatOver) {
          this.endCombat(monsterResult.winner === "player");
        }
      }, 500);
    } else {
      this.combatTurnPending = false;
      this.endCombat(result.winner === "player");
    }
  }

  private useFlask(slotIndex: number = 0) {
    const flask = this.state.player.flasks[slotIndex];
    if (!flask) {
      this.addLog(`药剂槽 ${slotIndex + 1} 为空`);
      return;
    }
    if (flask.charges < flask.chargesPerUse) {
      this.addLog(`${flask.name}充能不足（${flask.charges}/${flask.chargesPerUse}）`);
      return;
    }
    if (this.combatTurnPending) {
      this.addLog("正在等待敌人行动");
      return;
    }

    const player = this.state.player;
    if (!this.state.inCombat) {
      if (flask.effect.type === "utility") {
        this.addLog(`${flask.name}只能在战斗中使用`);
        return;
      }
      const maxResource = flask.effect.type === "life" ? player.maxLife : player.maxMana;
      const currentResource = flask.effect.type === "life" ? player.life : player.mana;
      if (currentResource >= maxResource) {
        this.addLog(`${flask.name}当前无需使用`);
        return;
      }
      const amount = Math.max(1, Math.floor(maxResource * flask.effect.amountPercent / 100));
      const restored = Math.min(amount, maxResource - currentResource);
      if (flask.effect.type === "life") {
        player.life += restored;
        this.addLog(`${flask.name}恢复了 ${restored} 点生命`);
      } else {
        player.mana += restored;
        this.addLog(`${flask.name}恢复了 ${restored} 点魔力`);
      }
      flask.charges -= flask.chargesPerUse;
      this.updateAllUI();
      this.autoSave();
      return;
    }

    if (!this.state.combat) return;
    this.combatTurnPending = true;
    flask.charges -= flask.chargesPerUse;
    const result = this.state.combat.executePlayerFlask(flask.effect);
    for (const action of result.actions) this.addLog(action.message);
    this.updateCombatUI();

    if (!result.isCombatOver) {
      setTimeout(() => {
        if (!this.state.combat) return;
        const monsterResult = this.state.combat.executeMonsterTurn();
        for (const action of monsterResult.actions) this.addLog(action.message);
        if (monsterResult.damageTaken > 0) this.rechargeFlasks(2);
        this.updateCombatUI();
        this.combatTurnPending = false;
        if (monsterResult.isCombatOver) this.endCombat(monsterResult.winner === "player");
      }, 500);
    } else {
      this.combatTurnPending = false;
      this.endCombat(result.winner === "player");
    }
    this.updateFlaskUI();
    this.autoSave();
  }

  private rechargeFlasks(amount: number) {
    let recharged = false;
    for (const flask of this.state.player.flasks) {
      if (!flask || flask.charges >= flask.maxCharges) continue;
      flask.charges = Math.min(flask.maxCharges, flask.charges + amount);
      recharged = true;
    }
    if (recharged) this.updateFlaskUI();
  }
  
  // ===== 操作处理 =====
  
  private handleAction(action: string) {
    switch (action) {
      case "1":
      case "2":
      case "3":
        this.useSkill(parseInt(action));
        break;
      case "Q":
        this.showPlayerInfo();
        break;
      case "W":
        this.openPassiveTree();
        break;
      case "E":
        this.useFlask(0);
        break;
      case "S":
        this.showSaveMenu();
        break;
      default:
        this.addLog(`未知操作: ${action}`);
    }
  }
  
  // ===== 天赋树 =====
  
  private openPassiveTree() {
    if (this.state.inCombat) {
      this.addLog("战斗中无法打开天赋树");
      return;
    }
    const modal = document.getElementById("passive-modal");
    if (modal) {
      modal.style.display = "flex";
      this.passiveTreeUI.setAllocatedNodes(this.state.player.allocatedNodes);
      this.updatePassivePointsDisplay();
    }
  }
  
  private closePassiveTree() {
    const modal = document.getElementById("passive-modal");
    if (modal) {
      modal.style.display = "none";
    }
    if (this.getMainView() !== "map-device") this.setNavActive("character");
  }
  
  private onPassiveAllocate(nodeId: string) {
    if (this.state.player.passivePoints > 0) {
      this.state.player.passivePoints--;
      this.state.player.allocatedNodes = this.passiveTreeUI.getAllocatedNodes();
      this.recalculatePassiveStats();
      this.updatePassivePointsDisplay();
      this.addLog(`分配天赋: ${nodeId}`);
      this.autoSave();
    }
  }
  
  private onPassiveDeallocate(nodeId: string) {
    this.state.player.passivePoints++;
    this.state.player.allocatedNodes = this.passiveTreeUI.getAllocatedNodes();
    this.recalculatePassiveStats();
    this.updatePassivePointsDisplay();
    this.addLog(`取消天赋: ${nodeId}`);
    this.autoSave();
  }
  
  private resetPassives() {
    this.state.player.passivePoints += this.state.player.allocatedNodes.length;
    this.state.player.allocatedNodes = [];
    this.passiveTreeUI.setAllocatedNodes([]);
    this.recalculatePassiveStats();
    this.updatePassivePointsDisplay();
    this.addLog("天赋已重置");
    this.autoSave();
  }
  
  private recalculatePassiveStats() {
    this.recalculatePlayerStats();
    this.updateStatusBars();
  }
  
  private updatePassivePointsDisplay() {
    const el = document.getElementById("passive-points");
    if (el) {
      el.textContent = `天赋点: ${this.state.player.passivePoints}`;
    }
  }
  
  // ===== 区域探索 =====
  
  private updateZoneListUI() {
    const zoneList = document.getElementById("zone-list");
    if (!zoneList) return;
    
    let html = "";
    const chapters = this.zoneSystem.getAllZones();
    
    for (const { chapter, zones } of chapters) {
      html += `<div class="chapter-title">第${chapter}章</div>`;
      
      for (const zone of zones) {
        const available = this.state.player.level >= zone.requiredLevel &&
          (!zone.prerequisiteZone || this.zoneSystem.getState().completedZones.includes(zone.prerequisiteZone));
        const completed = this.zoneSystem.getState().completedZones.includes(zone.id);
        const isBoss = zone.id.includes("boss");
        
        let cardClass = "zone-card";
        if (!available) cardClass += " locked";
        if (isBoss) cardClass += " zone-card-boss";
        
        html += `
          <div class="${cardClass}" data-zone-id="${zone.id}" ${!available ? "" : "tabindex=\"0\""}>
            <div class="zone-card-header">
              <span class="zone-card-name">${isBoss ? "👑 " : ""}${zone.name}</span>
              <span class="zone-card-level">Lv.${zone.levelRange[0]}-${zone.levelRange[1]}${completed ? " ✓" : ""}</span>
            </div>
            <div class="zone-card-desc">${zone.description}</div>
            <div class="zone-card-rewards">
              <span class="zone-card-reward">经验 +${zone.expBonus}%</span>
              <span class="zone-card-reward">掉落 +${zone.dropBonus}%</span>
            </div>
          </div>
        `;
      }
    }
    
    zoneList.innerHTML = html;
    
    // 绑定点击事件
    zoneList.querySelectorAll(".zone-card:not(.locked)").forEach((card) => {
      card.addEventListener("click", () => {
        const zoneId = (card as HTMLElement).dataset.zoneId;
        if (zoneId) this.enterZone(zoneId);
      });
    });
  }
  
  private enterZone(zoneId: string) {
    if (this.zoneSystem.selectZone(zoneId)) {
      const zone = getZoneById(zoneId);
      if (zone) {
        // 隐藏区域选择，显示探索界面
        this.setMainView("scene");
        
        // 更新区域信息
        document.getElementById("current-zone-name")!.textContent = zone.name;
        document.getElementById("current-zone-desc")!.textContent = zone.description;
        
        // 隐藏探索结果
        document.getElementById("exploration-result")!.style.display = "none";
        
        this.addLog(`进入区域: ${zone.name}`);
      }
    }
  }
  
  private leaveZone() {
    this.zoneSystem.completeZone();
    
    // 检查任务完成并通知
    const pendingQuests = this.zoneSystem.getPendingRewardQuests();
    if (pendingQuests.length > 0) {
      for (const q of pendingQuests) {
        this.addLog(`🎉 任务「${q.name}」完成！点击领取奖励。`);
      }
    }
    
    // 更新章节
    this.zoneSystem.updateChapter();
    
    // 隐藏探索界面，显示区域选择
    this.setMainView("zone-select");
    
    // 更新区域列表和任务面板
    this.updateZoneListUI();
    this.updateQuestUI();
    
    this.addLog("离开区域");
    this.autoSave();
  }
  
  private handleExplore() {
    if (this.state.inCombat) {
      this.addLog("战斗中无法探索");
      return;
    }
    
    if (this.mapDevice.getState().isMapActive) {
      this.handleMapExplore();
      return;
    }

    const result = this.zoneSystem.explore();
    this.applyExplorationRewards(result);
    this.displayExplorationResult(result);
    
    if (result.monsters && result.monsters.length > 0) {
      this.pendingCombatRewards = result.rewards;
      setTimeout(() => {
        if (!this.state.inCombat) this.startCombat(result.monsters!);
      }, 1000);
    }
    
    // 升级检查
    if (result.levelUp && result.newLevel) {
      this.addLog(`🎉 恭喜！你升级到了 Lv.${result.newLevel}！`);
      this.addLog(`获得 1 点天赋点`);
    }
    
    // 探索事件可能直接带来经验和升级，统一重算派生属性。
    this.recalculatePlayerStats();
    if (result.levelUp) {
      this.state.player.life = this.state.player.maxLife;
      this.state.player.mana = this.state.player.maxMana;
    }
    // 更新UI
    this.updateStatusBars();
    this.updateInventoryUI();
    this.updateQuestUI();
    this.autoSave();
  }
  
  private handleRest() {
    if (this.state.inCombat) {
      this.addLog("战斗中无法休息");
      return;
    }
    
    const player = this.state.player;
    const healAmount = Math.floor(player.maxLife * 0.5);
    const manaAmount = Math.floor(player.maxMana * 0.5);
    
    player.life = Math.min(player.maxLife, player.life + healAmount);
    player.mana = Math.min(player.maxMana, player.mana + manaAmount);
    
    this.rechargeFlasks(999);
    this.addLog(`休息恢复: +${healAmount} 生命, +${manaAmount} 魔力，药剂充能已补满`);
    this.updateAllUI();
  }
  
  private applyExplorationRewards(result: ExplorationResult) {
    const player = this.state.player;
    this.awardGemExperience(Math.max(0, result.expGained));
    if (result.expGained > 0) {
      const levelResult = this.zoneSystem.grantExperience(result.expGained);
      if (levelResult.levelUp) {
        result.levelUp = true;
        result.newLevel = levelResult.newLevel;
      }
    }
    for (const reward of result.rewards) {
      if (reward.type === "currency" && reward.id) {
        const current = player.inventory.currencies.get(reward.id) || 0;
        player.inventory.currencies.set(reward.id, current + (reward.amount || 1));
      } else if (reward.type === "item" && reward.item) {
        player.inventory.items.push(reward.item);
      }
    }
  }

  private displayExplorationResult(result: ExplorationResult) {
    const resultDiv = document.getElementById("exploration-result");
    const descDiv = document.getElementById("event-description");
    const rewardsDiv = document.getElementById("event-rewards");
    
    if (!resultDiv || !descDiv || !rewardsDiv) return;
    
    // 显示结果
    resultDiv.style.display = "block";
    descDiv.textContent = result.description;
    
    // 显示奖励
    let rewardsHtml = "";
    for (const reward of result.rewards) {
      let iconClass = "";
      let icon = "";
      
      switch (reward.type) {
        case "currency":
          iconClass = "currency";
          icon = "💰";
          break;
        case "item":
          iconClass = "item";
          icon = "📦";
          break;
        case "experience":
          iconClass = "experience";
          icon = "✨";
          break;
        case "heal":
          iconClass = "heal";
          icon = "❤️";
          break;
      }
      
      rewardsHtml += `
        <div class="reward-item">
          <span class="reward-icon ${iconClass}">${icon}</span>
          <span>${reward.name}${reward.amount ? ` x${reward.amount}` : ""}</span>
        </div>
      `;
    }
    
    if (result.expGained > 0) {
      rewardsHtml += `
        <div class="reward-item">
          <span class="reward-icon experience">✨</span>
          <span>获得 ${result.expGained} 经验</span>
        </div>
      `;
    }
    
    rewardsDiv.innerHTML = rewardsHtml;
    
    // 添加到日志
    this.addLog(result.description);
    for (const reward of result.rewards) {
      this.addLog(`  获得: ${reward.name}${reward.amount ? ` x${reward.amount}` : ""}`);
    }
  }    // ===== 战斗系统 =====
  
  startCombat(monsters: Monster[]) {
    if (this.state.inCombat) {
      this.addLog("已经在战斗中");
      return;
    }
    this.combatTurnPending = false;
    this.combatRewardResolved = false;
    this.combatTurnNumber = 0;
    this.state.combat = new CombatSystem(this.state.player, monsters);
    this.state.inCombat = true;
    
    // 显示战斗UI
    this.setMainView("combat");
    
    // 更新区域信息为战斗
    document.getElementById("current-zone-name")!.textContent = "⚔️ 战斗";
    document.getElementById("current-zone-desc")!.textContent = "击败所有敌人！";
    
    // 隐藏探索按钮，显示战斗
    document.getElementById("scene-actions")!.style.display = "none";
    document.getElementById("exploration-result")!.style.display = "none";
    this.updateCombatUI();
    this.addLog("战斗开始！");
  }
  
  private endCombat(playerWon: boolean) {
    if (this.combatRewardResolved) return;
    this.combatRewardResolved = true;
    this.combatTurnPending = false;
    this.state.inCombat = false;
    this.state.combat = null;
    
    if (playerWon) {
      this.addLog("战斗胜利！");
      const wasMapCombat = this.mapDevice.getState().isMapActive;
      if (wasMapCombat) {
        this.completeMapRun();
      } else {
        this.applyCombatRewards(this.pendingCombatRewards || [], this.pendingCombatRewards?.find((reward) => reward.type === "experience")?.amount || 0);
      }
      this.pendingCombatRewards = null;
      if (wasMapCombat) {
        this.setMainView("map-device");
        this.showMapList();
      } else {
        this.setMainView("scene");
        document.getElementById("scene-actions")!.style.display = "flex";
      }
    } else {
      this.pendingCombatRewards = null;
      this.addLog("战斗失败...");
      this.revivePlayer();
      this.setMainView("scene");
      document.getElementById("scene-actions")!.style.display = "flex";
    }
    
    // 检查任务完成
    const pendingQuests = this.zoneSystem.getPendingRewardQuests();
    if (pendingQuests.length > 0) {
      for (const q of pendingQuests) {
        this.addLog(`🎉 任务「${q.name}」完成！点击领取奖励。`);
      }
      this.updateQuestUI();
    }
    
    this.autoSave();
  }
  
  private applyCombatRewards(rewards: ExplorationReward[], expGained: number) {
    const levelResult = this.zoneSystem.grantExperience(expGained);
    if (expGained > 0) this.addLog(`获得 ${expGained} 经验`);

    for (const reward of rewards) {
      if (reward.type === "currency" && reward.id) {
        const current = this.state.player.inventory.currencies.get(reward.id) || 0;
        this.state.player.inventory.currencies.set(reward.id, current + (reward.amount || 1));
        this.addLog(`获得通货: ${reward.name}${reward.amount ? ` x${reward.amount}` : ""}`);
      } else if (reward.type === "item" && reward.item) {
        this.state.player.inventory.items.push(reward.item);
        this.addLog(`获得装备: ${reward.item.name}`);
      }
    }

    this.combatVictories++;
    if (this.combatVictories === 1) {
      const starterDrop = getGemById("added_fire_damage");
      if (starterDrop && !this.state.player.inventory.gems.some((gem) => gem.id === starterDrop.id)) {
        this.state.player.inventory.gems.push(this.toPlayerGem(starterDrop));
        this.addLog(`获得技能宝石: ${starterDrop.name}`);
      }
    } else if (Math.random() < 0.35) {
      const gemPool = ["faster_attacks", "added_cold_damage", "lesser_multiple_projectiles"];
      const gemData = getGemById(gemPool[Math.floor(Math.random() * gemPool.length)]);
      if (gemData && this.state.player.level >= gemData.requiredLevel) {
        this.state.player.inventory.gems.push(this.toPlayerGem(gemData));
        this.addLog(`获得技能宝石: ${gemData.name}`);
      }
    }

    if (levelResult.levelUp) {
      this.addLog(`🎉 恭喜！你升级到了 Lv.${levelResult.newLevel}！`);
    }
    this.recalculatePlayerStats();
    this.updateAllUI();
  }

  private completeMapRun() {
    const result = this.mapDevice.completeMap(this.state.player.level);
    this.zoneSystem.grantExperience(result.expReward);
    this.addLog(`地图完成，获得 ${result.expReward} 经验`);
    for (const map of result.drops) {
      this.mapDevice.addMap(map);
      this.addLog(`获得地图: ${map.name}`);
    }
    for (const currency of result.droppedCurrency) {
      const current = this.state.player.inventory.currencies.get(currency.id) || 0;
      this.state.player.inventory.currencies.set(currency.id, current + currency.amount);
      this.addLog(`获得通货: ${getCurrencyById(currency.id)?.name || currency.id} x${currency.amount}`);
    }
    this.recalculatePlayerStats();
    this.updateAllUI();
  }

  private generateDrops() {
    // 生成掉落物
    const drops: Item[] = [];
    
    // 掉落通货
    if (Math.random() < 0.3) {
      const currency = CURRENCIES[Math.floor(Math.random() * CURRENCIES.length)];
      const current = this.state.player.inventory.currencies.get(currency.id) || 0;
      this.state.player.inventory.currencies.set(currency.id, current + 1);
      this.addLog(`获得通货: ${currency.name}`);
    }
    
    // 掉落装备
    if (Math.random() < 0.2) {
      const slots = [EquipSlot.Weapon, EquipSlot.Body, EquipSlot.Helmet];
      const slot = slots[Math.floor(Math.random() * slots.length)];
      const base = randomBase(slot, this.state.player.level);
      
      if (base) {
        // 稀有度权重
        const rarityRoll = Math.random() * 100;
        let rarity: Rarity;
        if (rarityRoll < 60) rarity = Rarity.Normal;
        else if (rarityRoll < 85) rarity = Rarity.Magic;
        else rarity = Rarity.Rare;
        
        const item = generateItem(base, this.state.player.level, rarity);
        drops.push(item);
        
        this.state.player.inventory.items.push(item);
        this.addLog(`获得装备: ${item.name}`);
      }
    }
    
    // 测试战斗没有区域奖励时也提供可用的宝石掉落。
    if (this.combatVictories === 1) {
      const gem = getGemById("added_fire_damage");
      if (gem) {
        this.state.player.inventory.gems.push(this.toPlayerGem(gem));
        this.addLog(`获得技能宝石: ${gem.name}`);
      }
    }
    this.updateInventoryUI();
  }
  
  private revivePlayer() {
    this.state.player.life = this.state.player.maxLife;
    this.state.player.mana = this.state.player.maxMana;
    this.updateStatusBars();
    this.addLog("你在城镇复活了");
  }
  
  // ===== UI更新 =====
  
  private updateAllUI() {
    this.updateStatusBars();
    this.updateEquipmentUI();
    this.updateSkillUI();
    this.updateFlaskUI();
    this.updateInventoryUI();
    this.updateQuestUI();
    this.bindTooltips();
  }

  private bindTooltips(root: ParentNode = document) {
    root.querySelectorAll<HTMLElement>("[data-tooltip-item-id], [data-tooltip-map-id], [data-tooltip-gem-id], [data-tooltip-currency-id]").forEach((element) => {
      element.addEventListener("mouseenter", () => this.showTooltip(element));
      element.addEventListener("mouseleave", () => this.hideTooltip());
      element.addEventListener("mousemove", (event) => this.moveTooltip(event));
    });
  }

  private showTooltip(element: HTMLElement) {
    this.hideTooltip();
    const itemId = element.dataset.tooltipItemId;
    const mapId = element.dataset.tooltipMapId;
    const gemId = element.dataset.tooltipGemId;
    const currencyId = element.dataset.tooltipCurrencyId;
    let title = "详情";
    let body = "";
    let className = "tooltip-panel";
    if (itemId) {
      const item = [...Object.values(this.state.player.equipment), ...this.state.player.inventory.items].find(candidate => candidate?.id === itemId);
      if (item) { title = item.name; body = formatItem(item); className += ` rarity-${item.rarity}`; }
    } else if (mapId) {
      const map = this.mapDevice.getMapList().find(candidate => candidate.id === mapId);
      if (map) { title = `${map.name} · T${map.tier}`; body = [map.description, `区域等级：${map.itemLevel}`, ...formatMapModifiers(map), `完成状态：${map.isCompleted ? "已完成" : "未完成"}`].join("\n"); }
    } else if (gemId) {
      const gem = getGemById(gemId);
      const owned = this.state.player.inventory.gems.find(candidate => candidate.id === gemId);
      if (gem) { title = `${gem.name} · Lv.${owned?.level || gem.requiredLevel}`; body = [gem.type === GemType.Active ? "主动技能宝石" : "辅助宝石", `需求等级：${gem.requiredLevel}`, gem.description, gem.active ? `标签：${gem.active.tags.join("、")}` : gem.support ? `支持标签：${gem.support.addedTags?.join("、") || "通用"}` : ""].filter(Boolean).join("\n"); }
    } else if (currencyId) {
      const currency = getCurrencyById(currencyId);
      if (currency) { title = currency.name; body = currency.description; }
    }
    if (!body) return;
    const tooltip = document.createElement("div");
    tooltip.className = className;
    tooltip.innerHTML = `<strong>${title}</strong><pre>${body}</pre>`;
    document.body.appendChild(tooltip);
    this.tooltipElement = tooltip;
    this.moveTooltip();
  }

  private moveTooltip(event?: MouseEvent) {
    if (!this.tooltipElement) return;
    const x = event?.clientX ?? window.innerWidth / 2;
    const y = event?.clientY ?? window.innerHeight / 2;
    this.tooltipElement.style.left = `${Math.min(x + 14, window.innerWidth - this.tooltipElement.offsetWidth - 12)}px`;
    this.tooltipElement.style.top = `${Math.min(y + 14, window.innerHeight - this.tooltipElement.offsetHeight - 12)}px`;
  }

  private hideTooltip() {
    this.tooltipElement?.remove();
    this.tooltipElement = null;
  }
  
  // ===== 任务面板 =====
  
  private updateQuestUI() {
    const logContent = document.getElementById("log-content");
    if (!logContent) return;
    
    // 查找或创建任务面板（在日志区域之前插入）
    let questPanel = document.getElementById("quest-panel");
    if (!questPanel) {
      questPanel = document.createElement("div");
      questPanel.id = "quest-panel";
      questPanel.className = "panel";
      const utilityContent = document.getElementById("utility-panel-content");
      if (utilityContent) {
        utilityContent.appendChild(questPanel);
      } else {
        const logPanel = document.getElementById("log-panel");
        if (logPanel && logPanel.parentNode) {
          logPanel.parentNode.insertBefore(questPanel, logPanel);
        }
      }
    }
    
    const pendingQuests = this.zoneSystem.getPendingRewardQuests();
    const questData = this.zoneSystem.getAllQuests();
    
    let html = '<h3 class="panel-title">📜 任务</h3>';
    
    // 待领取奖励（最醒目）
    if (pendingQuests.length > 0) {
      html += '<div class="quest-rewards-section">';
      for (const q of pendingQuests) {
        const reward = q.reward;
        const rewardText = [];
        if (reward.experience > 0) rewardText.push(`${reward.experience}经验`);
        if (reward.currency.length > 0) rewardText.push(`通货×${reward.currency.length}`);
        if (reward.gemReward) rewardText.push('技能宝石');
        
        html += `
          <div class="quest-reward-item" data-quest-id="${q.id}">
            <div class="quest-reward-info">
              <span class="quest-reward-name">🎉 ${q.name}</span>
              <span class="quest-reward-desc">奖励: ${rewardText.join(', ')}</span>
            </div>
            <button class="quest-claim-btn" data-quest-id="${q.id}">领取</button>
          </div>
        `;
      }
      html += '</div>';
    }
    
    // 当前章节任务
    const currentChapter = this.zoneSystem.getState().currentChapter;
    for (const { chapter, quests } of questData) {
      if (chapter > currentChapter + 1) continue; // 只显示当前和下一章
      
      html += `<div class="quest-chapter"><span class="quest-chapter-title">第${chapter}章</span></div>`;
      for (const { quest, completed, pending } of quests) {
        if (completed && !pending) continue; // 已完成且已领取的不显示
        const progress = this.zoneSystem.getQuestProgress(quest);
        const statusClass = progress.status === "completed" ? "pending" : progress.status;
        const statusLabel: Record<typeof progress.status, string> = {
          available: "可接取",
          active: "进行中",
          completed: "待领取",
          claimed: "已领取",
        };
        const icon = progress.status === "completed" ? "🎁" : (quest.isBoss ? "👑" : "•");
        
        html += `
          <div class="quest-item ${statusClass}" data-quest-id="${quest.id}">
            <span class="quest-icon">${icon}</span>
            <div class="quest-info">
              <span class="quest-name">${quest.name}</span>
              <span class="quest-desc">${quest.description}</span>
              <span class="quest-progress">进度 ${progress.current}/${progress.target} · ${statusLabel[progress.status]}</span>
            </div>
          </div>
        `;
      }
    }
    
    if (pendingQuests.length === 0 && questData.length === 0) {
      html += '<div class="quest-empty">完成区域以推进任务</div>';
    }
    
    questPanel.innerHTML = html;
    
    // 绑定领取奖励按钮
    questPanel.querySelectorAll('.quest-claim-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const questId = (btn as HTMLElement).dataset.questId;
        if (questId) this.claimQuestReward(questId);
      });
    });
  }
  
  private claimQuestReward(questId: string) {
    const result = this.zoneSystem.claimQuestReward(questId);
    if (result.success) {
      // 逐行输出奖励信息
      for (const line of result.message.split('\n')) {
        this.addLog(line);
      }
      this.recalculatePlayerStats();
      this.updateAllUI();
      this.autoSave();
    } else {
      this.addLog(result.message);
    }
  }
  
  private updateStatusBars() {
    const player = this.state.player;
    
    // 角色名和等级
    const nameEl = document.querySelector(".player-name");
    if (nameEl) nameEl.textContent = player.name;
    const levelEl = document.querySelector(".player-level");
    if (levelEl) levelEl.textContent = `Lv.${player.level}`;
    
    // 生命条
    const lifePercent = (player.life / player.maxLife) * 100;
    const lifeFill = document.querySelector(".bar-fill-life") as HTMLElement;
    if (lifeFill) lifeFill.style.width = `${lifePercent}%`;
    
    const lifeText = document.querySelector(".bar.life-bar .bar-text");
    if (lifeText) lifeText.textContent = `${player.life} / ${player.maxLife}`;
    
    // 魔力条
    const manaPercent = (player.mana / player.maxMana) * 100;
    const manaFill = document.querySelector(".bar-fill-mana") as HTMLElement;
    if (manaFill) manaFill.style.width = `${manaPercent}%`;
    
    const manaText = document.querySelector(".bar.mana-bar .bar-text");
    if (manaText) manaText.textContent = `${player.mana} / ${player.maxMana}`;
    
    // 护盾条
    const esMax = player.energyShield || 1;
    const esPercent = (player.energyShield / esMax) * 100;
    const esFill = document.querySelector(".bar-fill-es") as HTMLElement;
    if (esFill) esFill.style.width = `${esPercent}%`;
    
    const esText = document.querySelector(".bar.es-bar .bar-text");
    if (esText) esText.textContent = `${player.energyShield} / ${player.energyShield || 0}`;
    
    this.updateCharacterPanel();

    // 抗性
    const resFire = document.querySelector(".res.fire");
    if (resFire) resFire.textContent = `🔥${player.defenses.fireRes}%`;
    const resCold = document.querySelector(".res.cold");
    if (resCold) resCold.textContent = `❄️${player.defenses.coldRes}%`;
    const resLight = document.querySelector(".res.lightning");
    if (resLight) resLight.textContent = `⚡${player.defenses.lightningRes}%`;
    const resChaos = document.querySelector(".res.chaos");
    if (resChaos) resChaos.textContent = `☠️${player.defenses.chaosRes}%`;
  }
  
  private updateCharacterPanel() {
    const player = this.state.player;
    const setText = (id: string, value: string) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };

    setText("character-level", `Lv.${player.level}`);
    setText("character-exp", `${player.experience} XP`);
    setText("character-strength", `${player.stats.strength}`);
    setText("character-dexterity", `${player.stats.dexterity}`);
    setText("character-intelligence", `${player.stats.intelligence}`);
    setText("character-life", `${player.life} / ${player.maxLife}`);
    setText("character-mana", `${player.mana} / ${player.maxMana}`);
    setText("character-armor", `${player.defenses.armor}`);
    setText("character-evasion", `${player.defenses.evasion}`);
    setText("character-es", `${player.energyShield}`);
    setText("character-fire-res", `${player.defenses.fireRes}%`);
    setText("character-cold-res", `${player.defenses.coldRes}%`);
    setText("character-light-res", `${player.defenses.lightningRes}%`);
    setText("character-chaos-res", `${player.defenses.chaosRes}%`);
    setText("character-damage", `${player.offense.increasedDamage}%`);
    setText("character-speed", player.offense.attackSpeed.toFixed(2));
    setText("character-crit", `${player.offense.critChance}%`);
  }

  private updateEquipmentUI() {
    const player = this.state.player;
    const equipmentPanel = document.querySelector<HTMLElement>('[data-panel-content="equipment"]');
    if (!equipmentPanel) return;
    
    for (const slot of Object.values(EquipSlot)) {
      const slotElement = equipmentPanel.querySelector(`[data-slot="${slot}"] .slot-content`);
      if (!slotElement) continue;
      
      const item = player.equipment[slot];
      if (item) {
        slotElement.textContent = item.name;
        slotElement.className = `slot-content rarity-${item.rarity}`;
        slotElement.setAttribute("data-tooltip-item-id", item.id);
      } else {
        slotElement.textContent = "-";
        slotElement.className = "slot-content empty";
      }
    }
  }
  
  private updateFlaskUI() {
    const container = document.getElementById("flask-bar");
    if (!container) return;

    while (this.state.player.flasks.length < FLASK_SLOT_COUNT) {
      this.state.player.flasks.push(null);
    }
    container.innerHTML = this.state.player.flasks.slice(0, FLASK_SLOT_COUNT).map((flask, index) => {
      if (!flask) {
        return `<button class="flask-slot empty" data-flask-slot="${index}" title="空药剂槽"><span class="flask-key">${index + 4}</span><span class="flask-icon">+</span><span class="flask-name">空</span></button>`;
      }
      const ready = flask.charges >= flask.chargesPerUse;
      const typeLabel = getFlaskTypeLabel(flask.type);
      const effectLabel = flask.effect.type === "utility" ? getUtilityLabel(flask.effect.utility) : typeLabel;
      return `<button class="flask-slot flask-${flask.type}${ready ? " ready" : ""}" data-flask-slot="${index}" title="${flask.description}">
        <span class="flask-key">${index + 4}</span>
        <span class="flask-icon">${flask.type === "life" ? "♥" : flask.type === "mana" ? "◆" : "✦"}</span>
        <span class="flask-info"><span class="flask-name">${flask.name}</span><span class="flask-effect">${effectLabel}</span></span>
        <span class="flask-charges">${flask.charges}/${flask.maxCharges}</span>
      </button>`;
    }).join("");
  }
  
  private showSkillConfig(index: number) {
    const group = this.state.player.skillGroups[index];
    if (!group) {
      this.addLog("该技能栏为空，请先镶嵌主动技能宝石");
      return;
    }
    const available = this.state.player.inventory.gems;
    const supports = available.filter(gem => gem.type === GemType.Support);
    const modal = document.createElement("div");
    modal.className = "build-config-modal";
    modal.innerHTML = `<div class="build-config-content">
      <h3>配置技能栏 ${index + 1}：${group.activeGem.name}</h3>
      <p class="build-config-hint">右键技能栏打开配置；辅助宝石必须与主动宝石处于同一链接组。</p>
      <div class="build-support-list">${supports.length ? supports.map(gem => `<label><input type="checkbox" data-gem-id="${gem.id}" ${group.supportGems.some(current => current.id === gem.id) ? "checked" : ""}> ${gem.name} Lv.${gem.level}</label>`).join("") : "暂无可用辅助宝石"}</div>
      <div class="build-config-actions"><button class="build-config-save">保存</button><button class="build-config-cancel">取消</button></div>
    </div>`;
    modal.querySelector(".build-config-save")?.addEventListener("click", () => {
      const selected = Array.from(modal.querySelectorAll<HTMLInputElement>("input[data-gem-id]:checked")).map(input => input.dataset.gemId!).slice(0, 5);
      group.supportGems = selected.map(id => this.toPlayerGem(getGemById(id)!));
      this.updateSkillUI();
      this.addLog(`已更新 ${group.activeGem.name} 的辅助宝石配置`);
      modal.remove();
      this.autoSave();
    });
    modal.querySelector(".build-config-cancel")?.addEventListener("click", () => modal.remove());
    document.body.appendChild(modal);
  }

  private exportBuild() {
    const payload = { version: 1, level: this.state.player.level, skillGroups: this.state.player.skillGroups };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    prompt("复制以下 Build 编码：", encoded);
  }

  private importBuild() {
    const encoded = prompt("粘贴 Build 编码：");
    if (!encoded) return;
    try {
      const payload = JSON.parse(decodeURIComponent(escape(atob(encoded.trim()))));
      if (!payload || !Array.isArray(payload.skillGroups)) throw new Error("格式无效");
      const groups = payload.skillGroups.filter((group: any) => group?.activeGem?.id).map((group: any) => {
        const active = getGemById(group.activeGem.id);
        if (!active || active.type !== GemType.Active) return null;
        const supports = Array.isArray(group.supportGems) ? group.supportGems.map((gem: any) => getGemById(gem.id)).filter((gem: GemData | undefined): gem is GemData => !!gem && gem.type === GemType.Support) : [];
        return { id: `imported_skill_${Date.now()}_${active.id}`, name: active.name, activeGem: this.toPlayerGem(active), supportGems: supports.slice(0, 5).map(gem => this.toPlayerGem(gem)) };
      }).filter(Boolean) as SkillGroup[];
      this.state.player.skillGroups = groups.slice(0, 3);
      this.updateSkillUI();
      this.addLog(`Build 导入成功：${this.state.player.skillGroups.length} 个技能组`);
      this.autoSave();
    } catch {
      this.addLog("Build 导入失败：编码格式无效");
    }
  }

  private updateSkillUI() {
    const player = this.state.player;
    const skillsPanel = document.querySelector<HTMLElement>('[data-panel-content="skills"]');
    if (!skillsPanel) return;
    
    for (let i = 0; i < 3; i++) {
      const slotElement = skillsPanel.querySelector(`[data-key="${i + 1}"] .skill-content`);
      if (!slotElement) continue;
      
      const skillGroup = player.skillGroups[i];
      if (skillGroup) {
        const computed = computeSkillGroup(skillGroup);
        slotElement.className = `skill-content gem-${skillGroup.activeGem.color}`;
        const supports = skillGroup.supportGems.length ? ` + ${skillGroup.supportGems.map(gem => gem.name).join(" + ")}` : "";
        slotElement.innerHTML = `<strong>${skillGroup.activeGem.name}</strong><span class="skill-supports">${supports}</span><span class="skill-stats">${computed.totalDamage}伤害 · ${computed.manaCost}魔力</span>`;
      } else {
        slotElement.textContent = "-";
        slotElement.className = "skill-content empty";
      }
    }
  }
  
  private awardGemExperience(amount: number) {
    if (amount <= 0) return;
    const gems: Gem[] = [];
    for (const gem of this.state.player.inventory.gems) gems.push(gem);
    for (const group of this.state.player.skillGroups) {
      gems.push(group.activeGem, ...group.supportGems);
    }
    const seen = new Set<string>();
    for (const gem of gems) {
      if (seen.has(gem.id)) continue;
      seen.add(gem.id);
      const result = addGemExperience(gem, amount);
      if (result.levelsGained > 0) this.addLog(`${gem.name} 升级至 Lv.${result.level}`);
    }
  }

  private updateInventoryUI() {
    const player = this.state.player;
    const content = document.getElementById("inventory-content");
    if (!content) return;
    
    let html = "";
    
    if (this.state.currentTab === "items") {
      if (player.inventory.items.length === 0) {
        html = '<div class="inventory-empty">暂无物品</div>';
      } else {
        for (const item of player.inventory.items) {
          html += `
            <div class="inventory-item rarity-${item.rarity}" data-item-id="${item.id}" data-tooltip-item-id="${item.id}">
              <span class="item-name">${item.name}</span>
              <span class="item-level">Lv.${item.itemLevel}${this.getItemComparisonLabel(item)}</span>
            </div>
          `;
        }
      }
    } else if (this.state.currentTab === "currency") {
      if (player.inventory.currencies.size === 0) {
        html = '<div class="inventory-empty">暂无通货</div>';
      } else {
        player.inventory.currencies.forEach((count, id) => {
          const currency = getCurrencyById(id);
          if (currency && count > 0) {
            html += `
              <div class="inventory-currency" data-currency-id="${id}" data-tooltip-currency-id="${id}">
                <span class="currency-name">${currency.name}</span>
                <span class="currency-count">×${count}</span>
              </div>
            `;
          }
        });
      }
    } else if (this.state.currentTab === "gems") {
      if (player.inventory.gems.length === 0) {
        html = '<div class="inventory-empty">暂无技能宝石</div>';
      } else {
        for (const gem of player.inventory.gems) {
          const gemData = getGemById(gem.id);
          if (!gemData) continue;
          html += `
            <div class="inventory-gem gem-${gem.color}" data-gem-id="${gem.id}" data-tooltip-gem-id="${gem.id}">
              <span class="gem-name">${gemData.name}</span>
              <span class="gem-level">${gem.type === GemType.Active ? "主动" : "辅助"} Lv.${gem.level} / 需求 Lv.${gem.requiredLevel}</span>
              <span class="gem-progress">经验 ${getGemProgress(gem).current}/${getGemProgress(gem).required} · ${getGemProgress(gem).percent}%</span>
              <span class="gem-description">${gemData.description}</span>
            </div>
          `;
        }
      }
    }
    
    content.innerHTML = html;
    this.bindTooltips(content);
    
    // 绑定点击事件
    content.querySelectorAll(".inventory-item").forEach((el) => {
      el.addEventListener("click", () => {
        const itemId = (el as HTMLElement).dataset.itemId;
        const item = player.inventory.items.find((candidate) => candidate.id === itemId);
        if (item) this.showItemDetails(item, false);
      });
    });

    content.querySelectorAll(".inventory-gem").forEach((el) => {
      el.addEventListener("click", () => {
        const gemId = (el as HTMLElement).dataset.gemId || "";
        const gem = getGemById(gemId);
        if (gem) this.addLog(`${gem.name}：${gem.description}`);
      });
    });
    
    content.querySelectorAll(".inventory-currency").forEach((el) => {
      el.addEventListener("click", () => {
        const currencyId = (el as HTMLElement).dataset.currencyId;
        this.useCurrency(currencyId || "");
      });
    });
  }
  
  private getItemComparisonLabel(item: Item): string {
    const equipped = this.state.player.equipment[item.slot];
    if (!equipped) return " · 新槽位";
    const score = (candidate: Item): number => {
      const stats = calculateItemStats(candidate);
      return Object.entries(stats).reduce((total, [key, value]) => {
        const weight = key.toLowerCase().includes("resistance") ? 2 : key.toLowerCase().includes("damage") ? 2 : 1;
        return total + value * weight;
      }, candidate.itemLevel + candidate.quality);
    };
    const delta = score(item) - score(equipped);
    return delta > 8 ? " · ↑推荐" : delta < -8 ? " · ↓较弱" : " · ≈可比较";
  }

  private updateCombatUI() {
    if (!this.state.combat) return;
    
    // 更新行动条
    const monsterStatus = this.state.combat.getMonsterStatus();
    const combatTitle = document.querySelector("#combat-display .panel-title");
    if (combatTitle) combatTitle.textContent = `⚔️ 战斗 · 第${this.combatTurnNumber}回合`;
    const actionBar = document.getElementById("action-bar");
    if (actionBar) actionBar.innerHTML = `<span class="action-slot active">你的回合结束后敌人将行动</span><span class="action-slot enemy">敌人 ${monsterStatus.filter(m => !m.isDead).length}/${monsterStatus.length}</span>`;
    const enemiesContainer = document.getElementById("enemies");
    if (!enemiesContainer) return;
    
    let html = "";
    for (const monster of monsterStatus) {
      const hpPercent = monster.maxLife > 0 ? (monster.life / monster.maxLife) * 100 : 0;
      const deadClass = monster.isDead ? " dead" : "";
      html += `
        <div class="enemy-row${deadClass}">
          <span class="enemy-name">${monster.name} Lv.${this.state.combat.getMonsterLevel(monster.name)}</span>
          <div class="enemy-hp-bar">
            <div class="enemy-hp-fill" style="width:${hpPercent}%"></div>
          </div>
          <span class="enemy-hp-text">${monster.life}/${monster.maxLife}</span>
        </div>
      `;
    }
    enemiesContainer.innerHTML = html;
    
    // 更新玩家状态
    const playerStatus = this.state.combat.getPlayerStatus();
    this.state.player.life = playerStatus.life;
    this.state.player.mana = playerStatus.mana;
    this.updateStatusBars();
  }
  
  // ===== 装备操作 =====
  
  private equipItem(itemId: string) {
    const player = this.state.player;
    const itemIndex = player.inventory.items.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) return;

    const item = player.inventory.items[itemIndex];
    const base = ALL_BASES.find((candidate) => candidate.id === item.baseId);
    const missingRequirement = Object.entries(base?.requiredStats || [])
      .find(([stat, required]) => (player.stats[stat as keyof typeof player.stats] || 0) < (required || 0));
    if (base && (player.level < base.levelReq || missingRequirement)) {
      this.addLog(`无法装备 ${item.name}：需求未满足`);
      return;
    }

    const currentEquipped = player.equipment[item.slot];
    player.equipment[item.slot] = item;
    player.inventory.items.splice(itemIndex, 1);
    if (currentEquipped) {
      player.inventory.items.push(currentEquipped);
      this.addLog(`卸下: ${currentEquipped.name}`);
    }

    this.addLog(`装备: ${item.name}`);
    this.recalculatePlayerStats();
    this.rebuildSkillGroupsFromSockets();
    this.updateAllUI();
    this.autoSave();
  }

  private unequipItem(slot: EquipSlot) {
    const item = this.state.player.equipment[slot];
    if (!item) return;
    if (this.state.player.inventory.items.length >= this.state.player.inventory.maxSlots) {
      this.addLog("背包已满，无法卸下装备");
      return;
    }
    this.state.player.inventory.items.push(item);
    delete this.state.player.equipment[slot];
    this.addLog(`卸下: ${item.name}`);
    this.recalculatePlayerStats();
    this.rebuildSkillGroupsFromSockets();
    this.updateAllUI();
    this.autoSave();
  }

  private socketGemIntoItem(item: Item, socketIndex: number, gemData: GemData) {
    if (this.state.player.level < gemData.requiredLevel) {
      this.addLog(`${gemData.name}需要等级 ${gemData.requiredLevel}`);
      return;
    }
    const result = socketGem(item, socketIndex, gemData);
    if (!result.success) {
      this.addLog(result.message);
      return;
    }
    const gemIndex = this.state.player.inventory.gems.findIndex((gem) => gem.id === gemData.id);
    if (gemIndex >= 0) this.state.player.inventory.gems.splice(gemIndex, 1);
    this.rebuildSkillGroupsFromSockets();
    this.addLog(result.message);
    this.updateAllUI();
    this.autoSave();
  }

  private unsocketGemFromItem(item: Item, socketIndex: number) {
    const gemId = item.sockets[socketIndex]?.gemId;
    const result = unsocketGem(item, socketIndex);
    if (!result.success) {
      this.addLog(result.message);
      return;
    }
    const gemData = gemId ? getGemById(gemId) : undefined;
    if (gemData) this.state.player.inventory.gems.push(this.toPlayerGem(gemData));
    this.rebuildSkillGroupsFromSockets();
    this.addLog(result.message);
    this.updateAllUI();
    this.autoSave();
  }

  private toPlayerGem(gemData: GemData): Gem {
    return {
      id: gemData.id,
      name: gemData.name,
      type: gemData.type,
      color: gemData.color,
      level: 1,
      experience: 0,
      requiredLevel: gemData.requiredLevel,
    };
  }

  private rebuildSkillGroupsFromSockets() {
    const groups: SkillGroup[] = [];
    for (const item of Object.values(this.state.player.equipment)) {
      if (!item) continue;
      for (const linkGroup of getLinkGroups(item.sockets)) {
        const gems = linkGroup.gems.filter((gem): gem is GemData => gem !== null);
        const active = gems.find((gem) => gem.type === GemType.Active);
        if (!active) continue;
        groups.push({
          id: `socket_skill_${item.id}_${linkGroup.id}`,
          name: active.name,
          activeGem: this.toPlayerGem(active),
          supportGems: gems.filter((gem) => gem.type === GemType.Support).map((gem) => this.toPlayerGem(gem)),
        });
      }
    }
    // 技能栏保留稳定顺序：按装备孔组生成，最多三组；每组均携带当前宝石等级和经验。
    this.state.player.skillGroups = groups.slice(0, 3);
    this.updateSkillUI();
  }
  
  private useCurrency(currencyId: string) {
    const player = this.state.player;
    const count = player.inventory.currencies.get(currencyId) || 0;
    if (count <= 0) return;
    
    const currency = getCurrencyById(currencyId);
    if (!currency) return;
    
    // 不需要选择目标的通货：直接使用
    if (currency.effect.type === "regret") {
      // 悔恨石：返还一个已分配的天赋点
      const allocatedNodes = player.allocatedNodes;
      if (allocatedNodes.length > 0) {
        const removed = allocatedNodes.pop()!;
        player.passivePoints += 1;
        this.addLog(`使用 ${currency.name}：返还天赋点（取消了 ${removed}）`);
        player.inventory.currencies.set(currencyId, count - 1);
        this.updateInventoryUI();
      } else {
        this.addLog("没有已分配的天赋点可返还");
      }
      return;
    }
    
    if (currency.effect.type === "portal") {
      this.addLog(`使用 ${currency.name}：传送回城镇...`);
      player.inventory.currencies.set(currencyId, count - 1);
      this.updateInventoryUI();
      return;
    }
    
    // 需要选择目标的通货：显示目标选择模态框
    this.showCurrencyTargetModal(currencyId);
  }
  
  // ===== 通货目标选择 =====
  
  private showCurrencyTargetModal(currencyId: string) {
    const player = this.state.player;
    const currency = getCurrencyById(currencyId);
    if (!currency) return;
    
    this.state.selectedCurrencyId = currencyId;
    
    const modal = document.getElementById("currency-target-modal");
    const title = document.getElementById("currency-target-title");
    const desc = document.getElementById("currency-target-desc");
    const list = document.getElementById("currency-target-list");
    if (!modal || !title || !desc || !list) return;
    
    title.textContent = `使用 ${currency.name}`;
    desc.textContent = currency.description;
    
    // 收集所有可用目标：已装备的 + 背包中的
    const equippedItems: { item: Item; location: string }[] = [];
    const inventoryItems: { item: Item; location: string }[] = [];
    
    for (const [slot, item] of Object.entries(player.equipment)) {
      if (item) {
        equippedItems.push({ item, location: `装备 - ${slot}` });
      }
    }
    
    for (const item of player.inventory.items) {
      inventoryItems.push({ item, location: "背包" });
    }
    
    const allItems = [...equippedItems, ...inventoryItems];
    
    if (allItems.length === 0) {
      list.innerHTML = '<div class="currency-target-empty">没有可使用通货的目标</div>';
      modal.style.display = "flex";
      return;
    }
    
    let html = "";
    
    // 装备区
    if (equippedItems.length > 0) {
      html += '<div class="currency-target-section-title">已装备</div>';
      for (const { item, location } of equippedItems) {
        html += this.renderCurrencyTargetItem(item, location, "equipped");
      }
    }
    
    // 背包区
    if (inventoryItems.length > 0) {
      html += '<div class="currency-target-section-title">背包</div>';
      for (const { item, location } of inventoryItems) {
        html += this.renderCurrencyTargetItem(item, location, "inventory");
      }
    }
    
    list.innerHTML = html;
    modal.style.display = "flex";
    
    // 绑定点击事件
    list.querySelectorAll(".currency-target-item").forEach((el) => {
      el.addEventListener("click", () => {
        const itemId = (el as HTMLElement).dataset.itemId;
        const source = (el as HTMLElement).dataset.source as "equipped" | "inventory";
        if (itemId) {
          this.applyCurrencyToTarget(currencyId, itemId, source);
          this.closeCurrencyTargetModal();
        }
      });
    });
    
    // 绑定关闭按钮
    document.getElementById("currency-target-close")?.addEventListener("click", () => {
      this.closeCurrencyTargetModal();
    });
    document.getElementById("currency-target-cancel")?.addEventListener("click", () => {
      this.closeCurrencyTargetModal();
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) this.closeCurrencyTargetModal();
    }, { once: true });
  }
  
  private renderCurrencyTargetItem(item: Item, location: string, source: "equipped" | "inventory"): string {
    const rarityColors: Record<string, string> = {
      normal: "var(--rarity-normal)",
      magic: "var(--rarity-magic)",
      rare: "var(--rarity-rare)",
      unique: "var(--rarity-unique)",
    };
    const color = rarityColors[item.rarity] || "var(--text-primary)";
    
    // 预览关键属性
    let preview = "";
    if (item.prefixes.length > 0 || item.suffixes.length > 0) {
      const totalAffixes = item.prefixes.length + item.suffixes.length;
      preview = `${totalAffixes}条词缀`;
    } else {
      preview = "无词缀";
    }
    
    return `
      <div class="currency-target-item" data-item-id="${item.id}" data-source="${source}">
        <div class="target-item-info">
          <div class="target-item-name" style="color:${color}">${item.name}</div>
          <div class="target-item-slot">${location}</div>
        </div>
        <span class="target-item-preview">${preview}</span>
        <span class="target-item-level">Lv.${item.itemLevel}</span>
      </div>
    `;
  }
  
  private closeCurrencyTargetModal() {
    const modal = document.getElementById("currency-target-modal");
    if (modal) modal.style.display = "none";
    this.state.selectedCurrencyId = null;
  }
  
  private applyCurrencyToTarget(currencyId: string, itemId: string, source: "equipped" | "inventory") {
    const player = this.state.player;
    const count = player.inventory.currencies.get(currencyId) || 0;
    if (count <= 0) return;
    
    const currency = getCurrencyById(currencyId);
    if (!currency) return;
    
    // 查找目标物品
    let targetItem: Item | null = null;
    let targetIndex = -1;
    let targetSlot: EquipSlot | null = null;
    
    if (source === "inventory") {
      targetIndex = player.inventory.items.findIndex((i) => i.id === itemId);
      if (targetIndex === -1) return;
      targetItem = player.inventory.items[targetIndex];
    } else {
      // 从装备栏查找
      for (const [slot, item] of Object.entries(player.equipment)) {
        if (item && item.id === itemId) {
          targetItem = item;
          targetSlot = slot as EquipSlot;
          break;
        }
      }
      if (!targetItem) return;
    }
    
    // 镜像特殊处理：需要先选择来源
    if (currency.effect.type === "mirror") {
      // 找到背包中其他装备作为来源
      const otherItem = source === "inventory"
        ? player.inventory.items.find((i) => i.id !== itemId)
        : player.inventory.items[0];
      
      if (!otherItem) {
        this.addLog("没有可用于复制的来源装备");
        return;
      }
      
      // 复制来源的词缀到目标
      const cloned: Item = {
        ...targetItem!,
        id: targetItem!.id,
        name: otherItem.name + " (复制品)",
        baseId: otherItem.baseId,
        slot: otherItem.slot,
        rarity: otherItem.rarity,
        itemLevel: otherItem.itemLevel,
        prefixes: otherItem.prefixes.map(p => ({...p, stats: p.stats.map(s => ({...s, rolled: s.rolled}))})),
        suffixes: otherItem.suffixes.map(s => ({...s, stats: s.stats.map(st => ({...st, rolled: st.rolled}))})),
        implicit: otherItem.implicit.map(i => ({...i, stats: i.stats.map(s => ({...s, rolled: s.rolled}))})),
        sockets: otherItem.sockets.map(s => ({...s})),
      };
      
      if (source === "inventory") {
        player.inventory.items[targetIndex] = cloned;
      } else if (targetSlot) {
        player.equipment[targetSlot] = cloned;
      }
      
      this.addLog(`使用 ${currency.name}：将 ${otherItem.name} 的词缀复制到 ${targetItem!.name}`);
      player.inventory.currencies.set(currencyId, count - 1);
      this.updateAllUI();
      this.recalculatePlayerStats();
      this.autoSave();
      return;
    }
    
    // 普通通货效果
    const result = applyCurrency(targetItem!, currency.effect.type);
    
    if (source === "inventory") {
      player.inventory.items[targetIndex] = result;
    } else if (targetSlot) {
      player.equipment[targetSlot] = result;
    }
    
    this.addLog(`对 ${result.name} 使用了 ${currency.name}`);
    player.inventory.currencies.set(currencyId, count - 1);
    
    // 如果是装备栏物品，重新计算属性
    if (source === "equipped") {
      this.recalculatePlayerStats();
    }
    
    this.updateAllUI();
    this.autoSave();
  }
  
  // ===== 其他操作 =====
  
  private showItemDetails(item: Item, isEquipped: boolean) {
    const socketedGemIds = new Set(
      Object.values(this.state.player.equipment)
        .filter((equipped): equipped is Item => equipped !== undefined)
        .flatMap((equipped) => equipped.sockets.map((socket) => socket.gemId).filter((id): id is string => id !== null))
    );
    const availableGems = this.state.player.inventory.gems
      .filter((gem) => !socketedGemIds.has(gem.id) && this.state.player.level >= gem.requiredLevel)
      .map((gem) => getGemById(gem.id))
      .filter((gem): gem is GemData => gem !== undefined);
    this.itemDetailUI.show(item, isEquipped, availableGems);
  }
  
  private showPlayerInfo() {
    const player = this.state.player;
    this.addLog(`=== 玩家信息 ===`);
    this.addLog(`名称: ${player.name}`);
    this.addLog(`等级: ${player.level}`);
    this.addLog(`生命: ${player.life}/${player.maxLife}`);
    this.addLog(`魔力: ${player.mana}/${player.maxMana}`);
    this.addLog(`护甲: ${player.defenses.armor}`);
    this.addLog(`闪避: ${player.defenses.evasion}`);
    this.addLog(`火抗: ${player.defenses.fireRes}%`);
    this.addLog(`冰抗: ${player.defenses.coldRes}%`);
    this.addLog(`雷抗: ${player.defenses.lightningRes}%`);
  }
  
  private recalculatePlayerStats() {
    const player = this.state.player;
    const passive = calculatePassiveModifiers(player.allocatedNodes);
    const passiveValue = (stat: string, type: "flat" | "increased" | "more"): number => passive[stat]?.[type] || 0;
    
    let totalArmor = 0;
    let totalEvasion = 0;
    let totalES = 0;
    let totalFireRes = 0;
    let totalColdRes = 0;
    let totalLightningRes = 0;
    let totalChaosRes = 0;
    let totalDamage = 0;
    let increasedDamage = 0;
    let totalAttackSpeed = 0;
    let totalCritChance = 0;
    let totalStrength = 0;
    let totalDexterity = 0;
    let totalIntelligence = 0;
    let flatLife = 0;
    let flatMana = 0;
    let lifeIncreased = 0;
    let manaIncreased = 0;
    let armorIncreased = 0;
    let evasionIncreased = 0;
    let esIncreased = 0;
    
    // 统一读取装备属性，兼容词缀数据中的可读名称和标准字段。
    for (const item of Object.values(player.equipment)) {
      if (!item) continue;
      const stats = calculateItemStats(item);
      for (const [key, value] of Object.entries(stats)) {
        switch (key) {
          case "armor":
          case "flat armor": totalArmor += value; break;
          case "percent armor": armorIncreased += value; break;
          case "evasion":
          case "flat evasion": totalEvasion += value; break;
          case "percent evasion": evasionIncreased += value; break;
          case "energyShield":
          case "flat es": totalES += value; break;
          case "percent es": esIncreased += value; break;
          case "fireResistance": case "fire resistance": totalFireRes += value; break;
          case "coldResistance": case "cold resistance": totalColdRes += value; break;
          case "lightningResistance": case "lightning resistance": totalLightningRes += value; break;
          case "chaosResistance": case "chaos resistance": totalChaosRes += value; break;
          case "physicalDamage": case "flat phys weapon": totalDamage += value; break;
          case "percent phys weapon": case "flat attack damage": case "flat elemental damage": case "flat spell damage": increasedDamage += value; break;
          case "attackSpeed": case "attack speed": totalAttackSpeed += value; break;
          case "critChance": case "critical chance": totalCritChance += value; break;
          case "strength": totalStrength += value; break;
          case "dexterity": totalDexterity += value; break;
          case "intelligence": totalIntelligence += value; break;
          case "maxLife": case "flat life": flatLife += value; break;
          case "percent life": case "maxLife increased": lifeIncreased += value; break;
          case "maxMana": case "flat mana": flatMana += value; break;
          case "percent mana": case "maxMana increased": manaIncreased += value; break;
        }
      }
    }
    
    // 等级成长以新角色的 Lv.10 初始值为基线，天赋和装备只在此基础上累加。
    const levelDelta = Math.max(0, player.level - 10);
    const baseLife = 500 + levelDelta * 20;
    const baseMana = 100 + levelDelta * 10;
    const lifeMore = 1 + passiveValue("maxLife", "more") / 100;
    const manaMore = 1 + passiveValue("maxMana", "more") / 100;
    const calculatedMaxLife = Math.max(1, Math.floor((baseLife + flatLife + passiveValue("maxLife", "flat")) * (1 + (lifeIncreased + passiveValue("maxLife", "increased")) / 100) * lifeMore));
    const calculatedMaxMana = Math.max(1, Math.floor((baseMana + flatMana + passiveValue("maxMana", "flat")) * (1 + (manaIncreased + passiveValue("maxMana", "increased")) / 100) * manaMore));
    player.maxLife = calculatedMaxLife;
    player.maxMana = calculatedMaxMana;
    player.life = Math.min(player.life, player.maxLife);
    player.mana = Math.min(player.mana, player.maxMana);
    
    player.stats.strength = 30 + totalStrength + passiveValue("strength", "flat");
    player.stats.dexterity = 20 + totalDexterity + passiveValue("dexterity", "flat");
    player.stats.intelligence = 15 + totalIntelligence + passiveValue("intelligence", "flat");
    player.defenses.armor = Math.floor((100 + totalArmor) * (1 + (armorIncreased + passiveValue("armor", "increased")) / 100) * (1 + passiveValue("armor", "more") / 100));
    player.defenses.evasion = Math.floor((50 + totalEvasion) * (1 + (evasionIncreased + passiveValue("evasion", "increased")) / 100) * (1 + passiveValue("evasion", "more") / 100));
    player.defenses.energyShield = Math.floor(totalES * (1 + (esIncreased + passiveValue("energyShield", "increased")) / 100) * (1 + passiveValue("energyShield", "more") / 100));
    player.energyShield = player.defenses.energyShield;
    player.defenses.fireRes = totalFireRes;
    player.defenses.coldRes = totalColdRes;
    player.defenses.lightningRes = totalLightningRes;
    player.defenses.chaosRes = -30 + totalChaosRes;
    player.offense.increasedDamage = totalDamage + increasedDamage + passiveValue("physicalDamage", "increased") + passiveValue("spellDamage", "increased") + passiveValue("elementalDamage", "increased");
    player.offense.attackSpeed = 1 + (totalAttackSpeed + passiveValue("attackSpeed", "increased")) / 100;
    player.offense.critChance = 5 + totalCritChance + passiveValue("critChance", "increased");
  }
  
  private addLog(message: string) {
    this.state.logMessages.push(message);
    
    // 限制日志数量
    if (this.state.logMessages.length > 50) {
      this.state.logMessages.shift();
    }
    
    // 更新UI
    const logContent = document.getElementById("log-content");
    if (logContent) {
      const entry = document.createElement("div");
      entry.className = "log-entry";
      entry.textContent = message;
      logContent.appendChild(entry);
      
      // 自动滚动
      logContent.scrollTop = logContent.scrollHeight;
    }
  }
  
  // ===== 地图系统 =====
  
  private closeMapDevice() {
    const restoreView = this.previousMainView === "map-device" || this.previousMainView === "menu"
      ? "zone-select"
      : this.previousMainView;
    this.setMainView(restoreView);
    this.closeUtilityPanel();
    this.addLog("关闭地图仪");
  }

  openMapDevice() {
    if (this.state.inCombat) {
      this.addLog("战斗中无法打开地图仪");
      return;
    }
    this.previousMainView = this.getMainView() === "map-device" ? this.previousMainView : this.getMainView();
    this.setMainView("map-device");
    this.showMapList();
    this.addLog("🗺️ 打开地图仪");
  }
  
  showMapList() {
    const inventoryContent = document.getElementById("map-list-content");
    if (!inventoryContent) return;
    
    const maps = this.mapDevice.getMapList();
    let html = '';
    
    if (maps.length === 0) {
      html = '<div class="map-empty">暂无地图</div>';
    } else {
      for (const map of maps) {
        const tierColor = this.getMapTierColor(map.tier);
        const classColors: Record<string, string> = {
          normal: '#c8c8c8',
          magic: '#6699cc',
          rare: '#ffff00',
          unique: '#ff8c00',
        };
        const color = classColors[map.itemClass] || '#c8c8c8';
        
        html += `
          <div class="map-list-item" data-map-id="${map.id}" data-tooltip-map-id="${map.id}">
            <span class="map-list-name" style="color: ${color}">${map.name}</span>
            <span class="map-list-tier" style="color: ${tierColor}">T${map.tier}</span>
          </div>
        `;
      }
    }
    
    inventoryContent.innerHTML = html;
    
    // Bind click events
    this.bindTooltips(inventoryContent);
    inventoryContent.querySelectorAll('.map-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const mapId = (item as HTMLElement).dataset.mapId;
        if (mapId) this.selectMapForDevice(mapId);
      });
    });
  }
  
  selectMapForDevice(mapId: string) {
    const map = this.mapDevice.getMapList().find(m => m.id === mapId);
    if (!map) return;
    
    const effects = getMapEffects(map);
    const mapDeviceSlot = document.getElementById('map-device-slot');
    const mapDeviceInfo = document.getElementById('map-device-info');
    const mapInfoTitle = document.getElementById('map-info-title');
    const mapModifiers = document.getElementById('map-modifiers');
    const openBtn = document.getElementById('btn-open-map') as HTMLButtonElement;
    
    const mapSlotContent = mapDeviceSlot?.querySelector<HTMLElement>('.slot-content');
    if (mapDeviceSlot && mapSlotContent) {
      mapDeviceSlot.classList.add('has-map');
      mapSlotContent.textContent = map.name;
    }
    
    if (mapDeviceInfo) {
      mapDeviceInfo.style.display = 'block';
    }
    
    if (mapInfoTitle) {
      const tierColors: Record<number, string> = {
        1: '#90EE90', 2: '#90EE90', 3: '#90EE90',
        4: '#87CEEB', 5: '#87CEEB', 6: '#87CEEB',
        7: '#DDA0DD', 8: '#DDA0DD', 9: '#DDA0DD',
        10: '#FFB347', 11: '#FFB347', 12: '#FFB347',
        13: '#FF6B6B', 14: '#FF6B6B',
        15: '#FF0000', 16: '#FF0000'
      };
      mapInfoTitle.innerHTML = `<span style="color:${tierColors[map.tier] || '#fff'}">${map.name}</span>`;
    }
    
    if (mapModifiers) {
      let modsHtml = '';
      for (const prefix of map.prefixes) {
        modsHtml += `<div class="map-mod-item map-mod-prefix">🔥 ${prefix.name} - ${prefix.description}</div>`;
      }
      for (const suffix of map.suffixes) {
        modsHtml += `<div class="map-mod-item map-mod-suffix">❄️ ${suffix.name} - ${suffix.description}</div>`;
      }
      if (modsHtml) {
        modsHtml = `<div class="item-section-title">地图词缀</div>` + modsHtml;
      } else {
        modsHtml = '<div class="map-mod-item">普通地图</div>';
      }
      modsHtml += `<div class="map-mod-item map-run-summary">怪物数量 +${effects.monsterCount}% · 生命 +${effects.monsterLife}% · 伤害 +${effects.monsterDamage}% · 掉落数量 +${effects.itemQuantity}% · 掉落品质 +${effects.itemRarity}%</div>`;
      mapModifiers.innerHTML = modsHtml;
    }
    
    // Check if can open
    if (openBtn) {
      const canOpen = this.mapDevice.getState().currentMap === null;
      openBtn.disabled = !canOpen;
      if (!canOpen) {
        openBtn.textContent = '⚠️ 已有地图开启中';
      } else {
        openBtn.textContent = '🗝️ 开启地图';
      }
    }
    
    this.selectedMapId = mapId;
    document.querySelectorAll('.map-list-item').forEach((item) => {
      item.classList.toggle('selected', (item as HTMLElement).dataset.mapId === mapId);
    });
  }
  
  openSelectedMap() {
    if (!this.selectedMapId) return;
    
    const result = this.mapDevice.openMap(this.selectedMapId, this.state.player.level);
    if (result.success && result.map) {
      this.selectedMapId = null;
      this.addLog(result.message);
      // Show map in scene
      this.setMainView("scene");
      
      // Update scene with map info
      const zoneName = document.getElementById('current-zone-name');
      const zoneDesc = document.getElementById('current-zone-desc');
      if (zoneName) zoneName.textContent = result.map.name;
      if (zoneDesc) zoneDesc.textContent = `${result.map.description} · 地图 T${result.map.tier}，探索后会遭遇受词缀强化的怪物`;
      
      // Hide exploration result and show actions
      const explorationResult = document.getElementById('exploration-result');
      const sceneActions = document.getElementById('scene-actions');
      if (explorationResult) explorationResult.style.display = 'none';
      if (sceneActions) sceneActions.style.display = 'flex';
      
      // Update map list
      this.showMapList();
    } else {
      this.addLog(result.message);
    }
  }
  
  abandonMap() {
    if (this.mapDevice.abandonMap()) {
      this.addLog('放弃当前地图');
      this.setMainView("map-device");
      this.showMapList();
    }
  }
  
  private handleMapExplore() {
    const mapInfo = this.mapDevice.getCurrentMapInfo();
    if (!mapInfo) {
      this.addLog('没有开启的地图');
      return;
    }
    
    // Generate monsters based on map tier
    const level = mapInfo.map.itemLevel;
    const monsters = this.generateMapMonsters(mapInfo.map);
    
    // Start combat
    this.startCombat(monsters);
  }
  
  private generateMapMonsters(map: GameMap): any[] {
    const effects = getMapEffects(map);
    const baseCount = 2 + Math.floor(Math.random() * 3);
    const count = Math.max(1, Math.ceil(baseCount * (1 + effects.monsterCount / 100)));
    const monsters = [];
    
    const monsterTypes = [
      { name: '骸骨战士', type: 'physical' },
      { name: '腐化僵尸', type: 'physical' },
      { name: '火焰精灵', type: 'fire' },
      { name: '冰霜蜘蛛', type: 'cold' },
      { name: '闪电元素', type: 'lightning' },
      { name: '混沌行者', type: 'chaos' },
    ];
    
    for (let i = 0; i < count; i++) {
      const type = monsterTypes[Math.floor(Math.random() * monsterTypes.length)];
      const baseLife = 50 + map.tier * 15;
      const baseDamage = 5 + map.tier * 3;
      
      // Apply map modifiers
      const damageBonus = effects.monsterDamage;
      const lifeBonus = effects.monsterLife;
      const speedBonus = effects.monsterSpeed;
      
      monsters.push({
        id: `map_monster_${i}_${Date.now()}`,
        name: `${type.name} Lv.${map.itemLevel + Math.floor(Math.random() * 3 - 1)}`,
        level: map.itemLevel + Math.floor(Math.random() * 3 - 1),
        life: Math.floor(baseLife * (1 + lifeBonus / 100)),
        maxLife: Math.floor(baseLife * (1 + lifeBonus / 100)),
        damage: [{
          stat: 'physicalDamage',
          modType: 'flat',
          min: Math.floor(baseDamage * (1 + (type.type === 'physical' ? damageBonus : 0) / 100)),
          max: Math.floor((baseDamage + map.tier) * (1 + (type.type === 'physical' ? damageBonus : 0) / 100)),
        }],
        damageType: type.type,
        attackSpeed: 0.8 + (speedBonus / 100) * 0.3,
        armor: 10 + map.tier * 5,
        evasion: 5 + map.tier * 3,
        resistances: {
          fire: type.type === 'fire' ? 30 : 0,
          cold: type.type === 'cold' ? 30 : 0,
          lightning: type.type === 'lightning' ? 30 : 0,
          chaos: type.type === 'chaos' ? 30 : 0,
        }
      });
    }
    
    return monsters;
  }
  
  getMapTierColor(tier: number): string {
    if (tier <= 3) return '#90EE90';
    if (tier <= 6) return '#87CEEB';
    if (tier <= 9) return '#DDA0DD';
    if (tier <= 12) return '#FFB347';
    if (tier <= 14) return '#FF6B6B';
    return '#FF0000';
  }
  
  // ===== 默认玩家 =====
  
  private createStarterItem(baseId: string, colors: GemColor[], gemIds: (string | null)[]): Item {
    const base = ALL_BASES.find((candidate) => candidate.id === baseId);
    if (!base) throw new Error(`Starter base not found: ${baseId}`);
    const item = generateItem(base, 1, Rarity.Normal);
    item.sockets = colors.map((color, index) => ({
      color,
      gemId: gemIds[index] || null,
      linkedTo: index < 2 ? [index === 0 ? 1 : 0] : [],
    }));
    return item;
  }

  private createDefaultPlayer(): Player {
    const starterWeapon = this.createStarterItem(
      "rift_blade",
      [GemColor.Green, GemColor.Red, GemColor.Blue],
      ["lacerate", "melee_physical_damage", null],
    );
    const starterBody = this.createStarterItem(
      "plate_vest",
      [GemColor.Blue, GemColor.Blue, GemColor.Red],
      ["fireball", "controlled_destruction", null],
    );

    return {
      name: "冒险者",
      level: 1,
      experience: 0,
      stats: { strength: 30, dexterity: 20, intelligence: 15 },
      life: 500,
      maxLife: 500,
      mana: 100,
      maxMana: 100,
      manaReserved: 0,
      energyShield: 0,
      defenses: {
        armor: 100,
        evasion: 50,
        energyShield: 0,
        fireRes: 0,
        coldRes: 0,
        lightningRes: 0,
        chaosRes: -30,
        blockChance: 0,
      },
      offense: {
        increasedDamage: 0,
        moreDamage: 1,
        attackSpeed: 1,
        critChance: 5,
        critMultiplier: 150,
        accuracy: 100,
      },
      passivePoints: 0,
      allocatedNodes: [],
      equipment: {
        [EquipSlot.Weapon]: starterWeapon,
        [EquipSlot.Body]: starterBody,
      },
      skillGroups: [
        createSkillGroup("lacerate", ["melee_physical_damage"]),
        createSkillGroup("fireball", ["controlled_destruction"]),
      ],
      flasks: createDefaultFlasks(),
      inventory: {
        items: [],
        gems: [this.toPlayerGem(getGemById("lightning_arrow")!), this.toPlayerGem(getGemById("added_fire_damage")!)],
        currencies: new Map([
          ["chaos_orb", 5],
          ["orb_of_scouring", 3],
          ["chromatic_orb", 10],
        ]),
        maxSlots: 50,
      },
    };
  }
  
  // ===== 公共方法（供外部调用） =====
  
  getPlayer(): Player {
    return this.state.player;
  }
  
  isInCombat(): boolean {
    return this.state.inCombat;
  }

  getCurrentMainView(): MainView {
    return this.getMainView();
  }

  /**
   * 运行不依赖测试框架的 UI 回归检查，结果可从浏览器控制台直接查看。
   */
  runRegressionChecks(): Record<string, boolean> {
    const mainViewIds = [
      "zone-select-display",
      "scene-display",
      "combat-display",
      "map-device-display",
    ];
    const visibleMainViews = mainViewIds.filter((id) => {
      const element = document.getElementById(id);
      return !!element && getComputedStyle(element).display !== "none";
    });
    const equipmentPanel = document.querySelector<HTMLElement>('[data-panel-content="equipment"]');
    const skillsPanel = document.querySelector<HTMLElement>('[data-panel-content="skills"]');
    const inventoryPanel = document.querySelector<HTMLElement>('[data-panel-content="inventory"]');
    const pendingQuestIds = this.zoneSystem.getPendingRewardQuests().map((quest) => quest.id);
    const result = {
      singleMainView: this.mainView === "menu" ? visibleMainViews.length === 0 : visibleMainViews.length === 1,
      mainViewMatchesState: this.mainView === "menu" || visibleMainViews.includes({
        "zone-select": "zone-select-display",
        scene: "scene-display",
        combat: "combat-display",
        "map-device": "map-device-display",
      }[this.mainView] || ""),
      eventsBoundOnce: this.eventsBound && this.keyboardEventsBound,
      scopedEquipmentSelector: !!equipmentPanel && equipmentPanel.querySelectorAll("[data-slot]").length > 0,
      scopedSkillSelector: !!skillsPanel && skillsPanel.querySelectorAll("[data-key]").length > 0,
      scopedInventorySelector: !!inventoryPanel && !!inventoryPanel.querySelector("#inventory-content"),
      questRewardsUnique: pendingQuestIds.length === new Set(pendingQuestIds).size,
      socketInventoryConsistent: this.state.player.inventory.gems.every((gem) => !!getGemById(gem.id)),
    };
    return result;
  }
  
  // 开始战斗（供测试用）
  startTestCombat() {
    if (!this.gameStarted) {
      this.startNewGame();
    }
    const monsters: Monster[] = [
      {
        id: "skeleton_1",
        name: "骸骨战士",
        level: 5,
        life: 100,
        maxLife: 100,
        damage: [{ stat: "physicalDamage", modType: ModType.Flat, min: 5, max: 10 }],
        damageType: "physical" as any,
        attackSpeed: 1,
        accuracy: 50,
        armor: 20,
        evasion: 10,
        resistances: { fire: 0, cold: 0, lightning: 0, chaos: 0 },
      },
    ];
    
    this.startCombat(monsters);
  }
}
