# 修改记录 - 修复TypeScript类型错误

- **时间**: 2026-08-26
- **修改类型**: 修复

## 修改内容

- 修复地图基底数据使用 `level` 而接口定义为 `itemLevel` 的不一致。
- 修复地图稀有度效果读取错误，统一使用 `MapModifierEffect.value`。
- 导出 `AffixData`，修复词缀系统的类型导入错误。
- 为 `BaseItem` 补齐实际数据已经使用的 `tags` 字段。
- 为 `SaveData` 增加可选 `mapDevice` 字段，并让手动存档和自动存档保存地图仪状态。
- 将战斗测试数据中的字符串 `"flat"` 改为 `ModType.Flat`。
- 修复地图品质索引缺少 `unique`、地图槽位内容和探索操作的 DOM 空值保护。
- 通过 CodeGraph 查询 `MapBase`、`MapModifierEffect`、`BaseItem`、`SaveData` 和 `UIController` 定位相关模块。

## 影响范围

- 修改 `src/data/maps.ts`
- 修改 `src/data/affixes.ts`
- 修改 `src/models/types.ts`
- 修改 `src/systems/saveLoad.ts`
- 修改 `src/systems/combat.ts`
- 修改 `src/ui/controller.ts`
- 更新 `.codegraph/codegraph.db` 本地索引缓存

## 验证

- `npx tsc --noEmit` 通过。
- `npm run build` 通过，生成 `dist.html`。
- `codegraph sync .` 通过：同步 9 个变更文件，新增/更新 255 个节点。

## 备注

- `.codegraph/codegraph.db` 被项目忽略规则排除，不应提交到版本库。
