import { build } from "esbuild";
import { readFileSync, writeFileSync, copyFileSync } from "fs";

async function buildHTML() {
  const startTime = Date.now();

  // 1. Bundle & Minify TypeScript → JS
  const result = await build({
    entryPoints: ["src/main.ts"],
    bundle: true,
    minify: true,
    write: false,
    format: "iife",
    target: "es2020",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
  });

  const jsCode = result.outputFiles[0].text;
  const cssBase = readFileSync("src/style.css", "utf-8");
  const cssMap = readFileSync("src/mapstyles.css", "utf-8");
  const cssCode = cssBase + '\n' + cssMap;
  const htmlTemplate = readFileSync("src/index.html", "utf-8");

  // 2. 内联注入
  // 从模板结构拼接注入内容，避免替换 bundle 内可能出现的相同注释文本。
  const cssMarker = "  <!-- CSS_INLINE -->";
  const jsMarker = "  <!-- JS_INLINE -->";
  const cssIndex = htmlTemplate.indexOf(cssMarker);
  const jsIndex = htmlTemplate.indexOf(jsMarker);
  if (cssIndex < 0 || jsIndex < 0 || cssIndex > jsIndex) {
    throw new Error("HTML injection markers are missing or out of order");
  }
  const beforeCss = htmlTemplate.slice(0, cssIndex);
  const betweenMarkers = htmlTemplate.slice(cssIndex + cssMarker.length, jsIndex);
  const afterJs = htmlTemplate.slice(jsIndex + jsMarker.length);
  const finalHTML = `${beforeCss}  <style>\n${cssCode}\n</style>${betweenMarkers}  <script>\n${jsCode}\n</script>${afterJs}`;

  // 3. 输出
  writeFileSync("dist.html", finalHTML);

  const size = (Buffer.byteLength(finalHTML) / 1024).toFixed(1);
  const elapsed = Date.now() - startTime;
  console.log(`✅ dist.html  ${size} KB  (${elapsed}ms)`);
}

buildHTML().catch((e) => {
  console.error("❌ Build failed:", e.message);
  process.exit(1);
});
