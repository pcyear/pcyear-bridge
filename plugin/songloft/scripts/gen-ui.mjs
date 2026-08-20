// 把 static/index.html 及其拆分的 CSS/JS 模块内联成 TS 模块，作为 songloft.fs.readFile 失败时的兜底。
// 开发时 CSS/JS 拆分为独立文件便于维护；构建时合并回单个 HTML，保持宿主环境兼容性最好。
// 同时注入版本号并压缩 HTML（去注释 / 折叠空白 / 用 esbuild 压缩内联 JS 与 CSS），减小插件包体积。
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { minifyHtml } from './minify-html.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// 提前读取插件版本（单一来源：plugin.json），供 HTML / JS / 后端共用注入，避免版本号散落多处手工同步。
let ver = '';
try {
  const pkg = JSON.parse(readFileSync(join(root, 'plugin.json'), 'utf8'));
  ver = pkg.version || '';
} catch (e) {
  console.error('读取版本号失败（将使用占位符）：', e && e.message ? e.message : e);
}

// 模板独立文件优先：static/index.template.html 是开发源（含 CSS_PLACEHOLDER / MAIN_JS_PLACEHOLDER），
// static/index.html 是构建产物。若模板不存在（老工程），回退把 index.html 当模板。
let html;
try {
  html = readFileSync(join(root, 'static', 'index.template.html'), 'utf8');
} catch {
  html = readFileSync(join(root, 'static', 'index.html'), 'utf8');
}

// 合并 CSS
const css = readFileSync(join(root, 'static', 'css', 'app.css'), 'utf8');
html = html.replace('/* CSS_PLACEHOLDER */', css.trimEnd());

// 合并主 JS（body 底部），并注入版本号（app.js 用 '__VERSION__' 占位，避免手工同步散落）
const js = readFileSync(join(root, 'static', 'js', 'app.js'), 'utf8').replace("'__VERSION__'", JSON.stringify(ver)).replace('"__VERSION__"', JSON.stringify(ver));
html = html.replace('<!-- MAIN_JS_PLACEHOLDER -->', `<script>\n${js.trimEnd()}\n</script>`);

// 注入版本号到 HTML（避免打包后兜底 UI 显示占位符）
html = html.replace("'__VERSION__'", JSON.stringify(ver)).replace('"__VERSION__"', JSON.stringify(ver));

// 生成版本常量模块（单一来源：plugin.json → 后端 update.ts / 前端共用）。
// 这样 /update-check 的 CURRENT_VERSION 与打包版本永远一致，避免手工同步散落 3 处导致升级后误报「有更新」。
try {
  const verOut = `// 该文件由 scripts/gen-ui.mjs 自动生成，请勿手动编辑。
// 版本号单一来源：fnmusic-bridge/plugin.json
export const PLUGIN_VERSION = ${JSON.stringify(ver)};
`;
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'version.generated.ts'), verOut, 'utf8');
  console.log(`  ✓ src/version.generated.ts 已生成（版本 ${ver}）`);
} catch (e) {
  console.error('生成 version.generated.ts 失败：', e && e.message ? e.message : e);
}

// 压缩前端 HTML，减小产物体积（铁律：打包压缩、源码保持可读）
const min = minifyHtml(html);

// 把合并后的完整 HTML 也写回 static/index.html，因为宿主运行时会优先读取打包进来的 static/index.html，
// 如果它里面还包含占位符，用户就会看到没有样式/脚本的裸页面。
// 真正的开发源文件是 static/css/app.css 和 static/js/app.js；static/index.html 视为构建产物。
// 产物必须压缩（铁律：打包压缩、源码保持可读）——故此处写入压缩后的 min，而非未压缩的 html。
const indexOut = `<!-- 该文件由 scripts/gen-ui.mjs 自动生成，请勿直接编辑。修改 static/css/app.css 或 static/js/app.js 后运行 npm run genui。 -->\n${min}`;
writeFileSync(join(root, 'static', 'index.html'), indexOut, 'utf8');

// 用 JSON.stringify 转义，保证任何引号/反斜杠/换行都安全
const out = `// 该文件由 scripts/gen-ui.mjs 自动生成，请勿手动编辑。
// 源文件：static/index.html + static/css/app.css + static/js/app.js（已压缩）
export const INDEX_HTML: string = ${JSON.stringify(min)};
`;

mkdirSync(join(root, 'src'), { recursive: true });
writeFileSync(join(root, 'src', 'ui.generated.ts'), out, 'utf8');
console.log(`  ✓ static/index.html 与 src/ui.generated.ts 已生成（压缩后 ${(min.length / 1024).toFixed(1)} KB，原 HTML ${(html.length / 1024).toFixed(1)} KB）`);
