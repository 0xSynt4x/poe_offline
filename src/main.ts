// PoE文字游戏 - 主入口
import { UIController } from "./ui/controller";
import { validateGemCatalog, GEM_DATA_SOURCE } from "./data/gems";

// 启动游戏
const controller = new UIController();

// 等待DOM加载完成
document.addEventListener("DOMContentLoaded", () => {
  const gemErrors = validateGemCatalog();
  if (gemErrors.length > 0) {
    console.error(`技能石目录校验失败（PoB ${GEM_DATA_SOURCE.gameVersion}）：`, gemErrors);
  }

  // 初始化游戏
  controller.init();
  
  // 暴露给控制台测试
  (window as any).game = controller;
  
  // 显示欢迎信息
  console.log("🎮 PoE文字游戏已启动！");
  console.log("命令列表：");
  console.log("  game.startTestCombat() - 开始测试战斗");
  console.log("  game.getPlayer() - 查看玩家信息");
  console.log("  game.isInCombat() - 检查是否在战斗中");
  console.log("  game.showSaveMenu() - 打开存档菜单");
});
