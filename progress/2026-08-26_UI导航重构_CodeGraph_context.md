# UI 导航重构 CodeGraph Context

- **生成时间**: 2026-08-26
- **范围**: `src/ui/controller.ts`、`src/index.html`、`src/style.css`、`src/mapstyles.css`
- **索引状态**: CodeGraph 0.9.3 已同步；133 个文件、5,331 个节点、8,387 条边

## 1. 总体结构

```text
src/main.ts
  -> new UIController()
  -> DOMContentLoaded
     -> controller.init()
        -> showMainMenu()

新游戏 / 继续游戏
  -> startNewGame() / loadGame()
  -> startGame()
  -> initGameUI()
     -> bindEvents()
     -> updateAllUI()
     -> updateZoneListUI()
     -> PassiveTreeUI.init()
     -> showUtilityPanel("character")
```

`UIController` 是当前 UI 的唯一编排层，负责：

- 创建和恢复玩家状态
- 将事件绑定到 HTML 中的固定 ID、class 和 `data-*` 属性
- 刷新顶部状态栏、角色属性、装备、技能、背包、任务、药剂和战斗状态
- 在主区域切换区域选择、探索、战斗和地图仪
- 控制左侧导航与悬浮抽屉
- 调用天赋树、地图仪、存档、战斗和通货系统

## 2. HTML DOM 关系

### 页面骨架

```text
#app
  #header
  #main
    #side-nav
    #game-area
      #zone-select-display
      #scene-display
      #combat-display
      #crafting-display
      #map-device-display
    #utility-drawer
      .drawer-header
      #utility-panel-content
        [data-panel-content="character"]
        [data-panel-content="equipment"]
        [data-panel-content="skills"]
        [data-panel-content="inventory"]
        #quest-panel[data-panel-content="quests"]
        #log-panel[data-panel-content="log"]
        [data-panel-content="save"]
  #footer
    #flask-bar
    #action-buttons
```

### 左侧导航

`#side-nav` 是一个固定在 `#main` 左侧的窄栏。普通面板按钮使用：

```html
<button class="nav-icon" data-panel="character">
<button class="nav-icon" data-panel="equipment">
<button class="nav-icon" data-panel="skills">
<button class="nav-icon" data-panel="inventory">
<button class="nav-icon" data-panel="quests">
<button class="nav-icon" data-panel="log">
<button class="nav-icon" data-panel="save">
```

特殊入口：

```html
<button class="nav-icon" data-panel="map">
<button class="nav-icon" data-panel="passive">
```

### 悬浮抽屉

`#utility-drawer` 默认隐藏。`showUtilityPanel(panel)` 做两件事：

1. 更新 `#drawer-title`
2. 只给匹配的 `[data-panel-content]` 增加 `.is-active`

抽屉关闭由 `#drawer-close` 调用 `closeUtilityPanel()`。普通导航按钮重复点击同一个面板时，也会关闭抽屉。

## 3. 导航调用链

```text
.nav-icon click
  -> handleNavPanel(panel)
     ├─ character/equipment/skills/inventory/quests/log
     │  -> showUtilityPanel(panel)
     │     -> setNavActive(panel)
     │     -> toggle [data-panel-content].is-active
     │     -> drawer.style.display = "block"
     │
     ├─ save
     │  -> showUtilityPanel("save")
     │  -> showSaveMenu()
     │     -> getSaveMenuElement()
     │     -> saveManager.getSaveSlots()
     │
     ├─ map
     │  -> closeUtilityPanel()
     │  -> setNavActive("map")
     │  -> openMapDevice()
     │     -> hide #zone-select-display / #scene-display
     │     -> show #map-device-display
     │     -> showMapList()
     │
     └─ passive
        -> closeUtilityPanel()
        -> setNavActive("passive")
        -> openPassiveTree()
           -> show #passive-modal
           -> PassiveTreeUI.setAllocatedNodes()
```

## 4. 状态更新关系

### 总刷新入口

```text
updateAllUI()
  -> updateStatusBars()
     -> updateCharacterPanel()
  -> updateEquipmentUI()
  -> updateSkillUI()
  -> updateFlaskUI()
  -> updateInventoryUI()
  -> updateQuestUI()
```

### 角色属性

`updateStatusBars()` 同时更新：

- 顶部生命、魔力、能量护盾进度条
- 顶部抗性摘要
- 抽屉内角色属性面板

`updateCharacterPanel()` 写入以下 ID：

```text
#character-level
#character-exp
#character-strength
#character-dexterity
#character-intelligence
#character-life
#character-mana
#character-armor
#character-evasion
#character-es
#character-fire-res
#character-cold-res
#character-light-res
#character-chaos-res
#character-damage
#character-speed
#character-crit
```

### 装备、技能、背包

```text
updateEquipmentUI()
  -> [data-slot="helmet|amulet|body|ring1|..."] .slot-content

updateSkillUI()
  -> [data-key="1|2|3"] .skill-content
  -> computeSkillGroup(skillGroup)

updateInventoryUI()
  -> #inventory-content
  -> .inventory-item click -> equipItem()
  -> .inventory-currency click -> useCurrency()
  -> .tab click -> switchTab()
```

### 任务和日志

```text
updateQuestUI()
  -> #quest-panel.innerHTML = rendered quest list
  -> .quest-claim-btn click -> claimQuestReward()

addLog(message)
  -> state.logMessages
  -> #log-content.appendChild(.log-entry)
```

任务面板已经固定在抽屉中，因此 `updateQuestUI()` 不再需要把它插入日志面板之前；如果找不到既有面板，仍保留了回退插入逻辑。

## 5. 样式关系

### 主布局

`src/style.css` 的重构追加段覆盖基础布局：

```text
#main
  position: relative
  padding-left: 44px

#side-nav
  position: absolute
  left: 0
  top: 0
  bottom: 0
  width: 36px

#utility-drawer
  position: absolute
  left: 52px
  top: 0
  bottom: 0
  width: min(360px, calc(100% - 60px))

#game-area
  width: 100%
  flex: 1 1 auto
```

### 抽屉面板显示

```text
.utility-panel-section
  display: none

.utility-panel-section.is-active
  display: block
```

抽屉内部滚动由：

```text
#utility-panel-content
  height: calc(100% - 58px)
  overflow-y: auto
```

任务和日志取消了旧的固定高度限制：

```text
#utility-drawer #quest-panel,
#utility-drawer #log-panel
  max-height: none
```

### 响应式

`@media (max-width: 700px)` 会缩小：

- `#main` 左侧预留空间从 44px 调整为 40px
- 抽屉从 360px 调整为最多 320px
- 隐藏顶部抗性摘要
- 底部操作按钮横向滚动

### 地图样式

`src/mapstyles.css` 管理地图仪独有内容：

```text
#map-device-display
.map-slot
.map-info
.map-mods
.map-list-panel
.map-list
.map-list-item
.map-action-btn
```

地图列表当前渲染到 `#map-list-content`；`showMapList()` 保留了回退目标 `#inventory-content`，用于兼容旧布局或存档恢复场景。

## 6. 关键交互边界

| 入口 | DOM 目标 | 控制器方法 | 结果 |
|---|---|---|---|
| 角色 | `data-panel="character"` | `showUtilityPanel` | 打开属性抽屉 |
| 装备 | `data-panel="equipment"` | `showUtilityPanel` | 打开装备抽屉 |
| 技能 | `data-panel="skills"` | `showUtilityPanel` | 打开技能抽屉；点击技能可战斗 |
| 背包 | `data-panel="inventory"` | `showUtilityPanel` | 打开背包抽屉 |
| 任务 | `data-panel="quests"` | `showUtilityPanel` | 打开任务抽屉 |
| 日志 | `data-panel="log"` | `showUtilityPanel` | 打开日志抽屉 |
| 存档 | `data-panel="save"` | `showSaveMenu` | 填充存档抽屉 |
| 地图 | `data-panel="map"` | `openMapDevice` | 切换地图仪主区域 |
| 天赋 | `data-panel="passive"` | `openPassiveTree` | 打开天赋树模态框 |
| 抽屉关闭 | `#drawer-close` | `closeUtilityPanel` | 隐藏抽屉并取消导航激活态 |
| 地图关闭 | `#btn-close-map-device` | `closeMapDevice` | 返回区域选择 |

## 7. 潜在重复和回归点

### P1：数据选择器范围过宽

`updateEquipmentUI()` 使用全局选择器：

```typescript
document.querySelector(`[data-slot="${slot}"] .slot-content`)
```

当前只有抽屉里保留装备槽，因此工作正常；如果未来在战斗 HUD 或装备比较面板增加同名 `data-slot`，需要限定到装备面板容器。

同样，`updateSkillUI()` 和技能事件使用全局 `[data-key]`，未来增加第二套技能栏时会产生更新/点击冲突。

### P1：存档菜单有两种宿主

- 主菜单动态生成 `#game-area #menu-saves`
- 游戏内使用 `[data-save-menu]`

`getSaveMenuElement()` 已通过：

```typescript
#game-area #menu-saves, [data-save-menu]
```

兼容两种宿主，但后续最好统一为一个 `data-save-menu` 容器，减少 DOM 分支。

### P1：地图仪是主区域模式，不是抽屉面板

地图导航会关闭抽屉并隐藏区域/场景面板，再显示 `#map-device-display`。因此地图入口和普通信息面板的生命周期不同；若未来增加地图抽屉预览，需要避免同时修改 `#map-device-display` 的显示状态。

### P1：天赋树仍是旧式全屏模态框

左侧天赋图标已经接入，但它不会打开抽屉，而是显示 `#passive-modal`。这是有意保留的交互差异，因为天赋树需要更大画布；如果统一成抽屉，需要同步调整 `PassiveTreeUI` 的固定 600×500 画布和详情面板。

### P2：底部快捷键与左侧导航存在职责边界

当前底部只保留 1、2、3 技能按钮和药剂，查看/天赋/存档已移除。`handleAction()` 仍保留 Q/W/S 分支，属于兼容旧快捷键的逻辑，不再有对应的底部按钮。

### P2：CodeGraph 对 HTML/CSS 关系有限

CodeGraph 能准确索引 `UIController`、方法和 TypeScript 引用，但不会完整解析 HTML 的 `id`、`class`、`data-*` 与 CSS 选择器关系。因此本 context 将：

- TypeScript 调用链视为 CodeGraph 结构化关系
- HTML/CSS 选择器关系视为模板审查结果

## 8. 后续建议

1. 给 UI 面板建立统一的 `PanelId` 类型，替代 `panel: string`。
2. 将装备、技能、背包更新查询限定在各自面板容器内。
3. 统一主菜单和游戏内存档容器的标识方式。
4. 将地图仪和天赋树的入口状态统一纳入一个 UI 层状态机。
5. 后续引入图标库时，只替换 `.nav-icon-glyph` 内容，不改 `data-panel` 和事件链。
