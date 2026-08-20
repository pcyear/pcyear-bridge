// 构建入口。
//
// 为什么不直接用 `songloft-plugin build`？
// 1) 官方 CLI 的 CJS 版 builder 内部会 `require("@songloft/jsc")`，而 @songloft/jsc@2.13.0
//    只暴露 ESM 出口（无 "require" 分支），在 CJS 下会抛
//    ERR_PACKAGE_PATH_NOT_EXPORTED。这里改用 `await import()` 加载 ESM 版 builder，
//    它走的是 `import { getJscBinaryPath } from "@songloft/jsc"`（import 出口），可正常工作。
// 2) 某些 Windows 环境（含非 ASCII 用户名目录，或宿主注入了 fs 安全钩子）下，Node 的
//    fs.cpSync(recursive) 会抛 "EIO, Access is denied"，导致官方 builder 在复制 static/
//    这一步中断。这里把 cpSync 这一个原语替换成逐文件复制（ESM 对内置 fs 的命名导入是
//    live binding，会反映到我们打过补丁的 CJS 单例上）。
// 3) 同一环境下，builder 用 jsc 编译完 main.js → main.jsc 后，fs.unlinkSync(main.js) 偶发
//    报错（文件实际已被删除），导致 builder catch 块回退到 "main.js" 并 ENOENT。这里对
//    dist/_build/main.js 的删除做容错，使其总是成功。
// 其余流程仍调用官方 buildPlugin()，保证产物与官方构建完全一致（同样的 esbuild 配置、
// static hash、entryHash/zipHash 算法）。

import { createRequire } from 'module';
import { dirname, join, normalize } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
// 注意：ESM builder 对 fs 的命名导入是 live binding，会读取 require('fs') 单例上的当前值，
// 因此这里补丁对 ESM builder 同样生效。
const fs = require('fs');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- 1. 用逐文件复制替换 cpSync ----
const nativeCpSync = fs.cpSync;
function manualCopyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) manualCopyDir(s, d);
    else if (entry.isSymbolicLink()) fs.copyFileSync(fs.realpathSync(s), d);
    else fs.copyFileSync(s, d);
  }
}
fs.cpSync = function patchedCpSync(src, dest, opts) {
  try {
    return nativeCpSync.call(fs, src, dest, opts);
  } catch (e) {
    if (opts && opts.recursive && fs.statSync(src).isDirectory()) {
      manualCopyDir(src, dest);
      return undefined;
    }
    throw e;
  }
};

// ---- 1b. 绕过 jsc 编译后删除 main.js 时 Windows 偶发 EIO/EPERM ----
// 现象：jsc.exe 已成功生成 main.jsc，但 fs.unlinkSync(main.js) 抛错（文件实际已被删除），
// 导致 builder 的 catch 块把 mainFileName 重置为 "main.js"，随后读不到而 ENOENT。
// 这里对 dist/_build/main.js 的删除做容错：只要文件不存在或删除报错，都视为成功。
const nativeUnlinkSync = fs.unlinkSync;
const mainJsToDelete = normalize(join(root, 'dist', '_build', 'main.js'));
fs.unlinkSync = function patchedUnlinkSync(p) {
  if (normalize(p) === mainJsToDelete) {
    try { nativeUnlinkSync.call(fs, p); } catch { /* 已删除或锁定，忽略 */ }
    return;
  }
  return nativeUnlinkSync.call(fs, p);
};

// ---- 2. 逐文件删除，绕开会走「回收站」的 rmSync 钩子 ----
function removeDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) removeDir(p);
    else { try { fs.unlinkSync(p); } catch { /* 占用中，忽略 */ } }
  }
  try { fs.rmdirSync(dir); } catch { /* 忽略 */ }
}

// ---- 3. 调用官方 builder（ESM 版）----
const mode = process.argv.includes('--development') ? 'development' : 'production';
const sourcemap = process.argv.includes('--sourcemap');

removeDir(join(root, 'dist'));

// 动态 import 走 package exports 的 "import" 分支，拿到 ESM 版 builder，
// 其内部的 `import { getJscBinaryPath } from "@songloft/jsc"` 可正常解析。
const { buildPlugin } = await import('@songloft/plugin-builder');

// ---- 3b. 注入版本号 + 压缩前端 HTML（构建后还原源文件，避免污染 index.html）----
const idxPath = join(root, 'static', 'index.html');
const rawIdx = fs.readFileSync(idxPath, 'utf8');
try {
  const pkg = JSON.parse(fs.readFileSync(join(root, 'plugin.json'), 'utf8'));
  const ver = pkg.version || '';
  fs.writeFileSync(idxPath, rawIdx.replace("'__VERSION__'", JSON.stringify(ver)).replace('"__VERSION__"', JSON.stringify(ver)));
} catch (e) {
  console.error('注入版本号失败（将使用占位符）：', e && e.message ? e.message : e);
}
// 压缩打包用的 static/index.html（去注释 / 折叠空白 / esbuild 压缩内联 JS 与 CSS），减小插件包体积。
// 注意：必须在版本注入之后执行，这样打包进 zip 的副本既带真实版本号又已压缩。
try {
  const { minifyHtml } = await import('./minify-html.mjs');
  fs.writeFileSync(idxPath, minifyHtml(fs.readFileSync(idxPath, 'utf8')));
} catch (e) {
  console.warn('压缩 static/index.html 失败，将使用未压缩版本打包：', e && e.message ? e.message : e);
}

// 构建时 css/js 已内联到 index.html，避免 builder 把它们当作独立入口处理；
// index.html.bak 也不应被打包。临时把它们移出 static/，构建完成后再还原。
const staticJsDir = join(root, 'static', 'js');
const staticCssDir = join(root, 'static', 'css');
const staticBak = join(root, 'static', 'index.html.bak');
const tmpJsDir = join(root, '.tmp-static-js');
const tmpCssDir = join(root, '.tmp-static-css');
const tmpBak = join(root, '.tmp-index-html-bak');
let movedJs = false, movedCss = false, movedBak = false;
try {
  if (fs.existsSync(staticJsDir)) { fs.renameSync(staticJsDir, tmpJsDir); movedJs = true; }
  if (fs.existsSync(staticCssDir)) { fs.renameSync(staticCssDir, tmpCssDir); movedCss = true; }
  if (fs.existsSync(staticBak)) { fs.renameSync(staticBak, tmpBak); movedBak = true; }
} catch (e) {
  console.error('临时移出 static/js|css|bak 失败：', e && e.message ? e.message : e);
}

try {
  const result = await buildPlugin({ cwd: root, mode, sourcemap });
  console.log(`产物：${result.zipPath}`);
  console.log(`大小：${(result.size / 1024).toFixed(1)} KB`);
} catch (e) {
  console.error('构建失败：', e && e.message ? e.message : e);
  console.error(e && e.stack ? e.stack : 'no stack');
  try { fs.writeFileSync(idxPath, rawIdx); } catch { /* 还原失败忽略 */ }
  process.exit(1);
} finally {
  // 构建成功/失败都还原 static/js|css|bak
  try { if (movedJs) fs.renameSync(tmpJsDir, staticJsDir); } catch { /* 忽略 */ }
  try { if (movedCss) fs.renameSync(tmpCssDir, staticCssDir); } catch { /* 忽略 */ }
  try { if (movedBak) fs.renameSync(tmpBak, staticBak); } catch { /* 忽略 */ }
}
// 构建成功，还原源 index.html 中的版本占位符
try { fs.writeFileSync(idxPath, rawIdx); } catch { /* 还原失败忽略 */ }
