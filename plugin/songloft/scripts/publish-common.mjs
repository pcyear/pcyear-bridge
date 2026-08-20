// 发布逻辑公共模块（测试版 / 正式版共用）。
//
// 版本模型（见文档仓 development-documentation/README.md 第八章）：
//   正式版 = X.Y.Z（3 段）；测试版 = X.Y.Z.N（4 段，N≥1）。
//   主版本同步：平时发测试版 N 自增；发正式版时 base 末位 +1，测试版同步为 新base.1。
//   测试版 N 的权威来源 = 发布仓 manifest-beta.json 当前 version（本脚本是唯一写入者）。
//
// 流程：
//   beta    : 临时把源仓 plugin.json 改写为 base.N 构建 → 复制为 beta zip → 写 manifest-beta.json → 还原源仓 plugin.json（不残留）→ 提交并推送发布仓。
//   official: 源仓 plugin.json 改写为 base+1 构建 → 复制为 stable zip → 写 manifest.json + 同步发布仓 plugin.json（宿主商店版本）→ 源仓保留新版本并提交推送 master → 快进 dev 到 master。
//
// 用法：runPublish('beta' | 'official', { dryRun?: boolean })

import { readFileSync, writeFileSync, renameSync, copyFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');                 // .../pcyear-bridge/plugin/songloft
const SRC_REPO = resolve(ROOT, '..', '..');            // .../pcyear-bridge
const SRC_PLUGIN_JSON = join(ROOT, 'plugin.json');
const SRC_DIST = join(ROOT, 'dist');
const RELEASE_REPO_DIR = resolve(ROOT, '..', '..', '..', 'pcyear-bridge-release');
const RELEASE_PLUGIN_DIR = join(RELEASE_REPO_DIR, 'plugin', 'songloft');
const RELEASE_DIST = join(RELEASE_PLUGIN_DIR, 'dist');
const RELEASE_MANIFEST = join(RELEASE_PLUGIN_DIR, 'manifest.json');
const RELEASE_MANIFEST_BETA = join(RELEASE_PLUGIN_DIR, 'manifest-beta.json');
const RELEASE_PLUGIN_JSON = join(RELEASE_PLUGIN_DIR, 'plugin.json');

const PAT = '99c61e093cd44186aeb826e80b8db17b';
const SRC_REMOTE = `https://pcyear:${PAT}@gitee.com/pcyear/pcyear-bridge.git`;
const RELEASE_REMOTE = `https://pcyear:${PAT}@gitee.com/pcyear/pcyear-bridge-release.git`;
const RAW_BASE = 'https://raw.giteeusercontent.com/pcyear/pcyear-bridge-release/raw/master/plugin/songloft/dist';

// ---- 版本工具 ----
function computeBase(v) {
  const m = String(v).match(/^(\d+)\.(\d+)\.(\d+)(?:\.\d+)?$/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : v;
}
function bumpBase(v) {
  const m = String(v).match(/^(\d+)\.(\d+)\.(\d+)(?:\.\d+)?$/);
  if (!m) throw new Error('无法解析 base: ' + v);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

function readReleaseBetaVersion() {
  try {
    const m = JSON.parse(readFileSync(RELEASE_MANIFEST_BETA, 'utf8'));
    return String(m.version || '');
  } catch {
    return '';
  }
}

// 数字段比较（与 update.ts 的 cmpVer 对齐），用于自检是否会降级。
function cmpVer(a, b) {
  const pa = String(a || '').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '').split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

// 原子写 plugin.json（Windows 共享读锁兼容，参考 bump-version.mjs）
function writePluginJson(version) {
  const pj = JSON.parse(readFileSync(SRC_PLUGIN_JSON, 'utf8'));
  pj.version = version;
  const tmp = SRC_PLUGIN_JSON + '.tmp-' + process.pid;
  writeFileSync(tmp, JSON.stringify(pj, null, 2) + '\n', 'utf8');
  renameSync(tmp, SRC_PLUGIN_JSON);
}
function restorePluginJson(origText) {
  const tmp = SRC_PLUGIN_JSON + '.tmp-' + process.pid;
  writeFileSync(tmp, origText, 'utf8');
  renameSync(tmp, SRC_PLUGIN_JSON);
}

function run(cmd) {
  console.log('$ ' + cmd);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}
function git(repoDir, args) {
  const cmd = `git -C "${repoDir}" ${args}`;
  console.log('$ ' + cmd);
  execSync(cmd, { stdio: 'inherit' });
}

export async function runPublish(mode, { dryRun = false } = {}) {
  const isBeta = mode === 'beta';
  const origText = readFileSync(SRC_PLUGIN_JSON, 'utf8');
  const curVer = JSON.parse(origText).version;
  const base = computeBase(curVer);

  let newVer;
  if (isBeta) {
    const betaCur = readReleaseBetaVersion();
    const betaBase = computeBase(betaCur);
    const n = betaBase === base ? Number((betaCur.split('.')[3] || '0')) + 1 : 1;
    newVer = `${base}.${n}`;
  } else {
    newVer = bumpBase(curVer);
  }

  console.log(`\n[publish] mode=${mode} current=${curVer} base=${base} -> newVersion=${newVer}`);

  // 1) 临时改写版本并构建
  writePluginJson(newVer);
  let buildOk = false;
  try {
    run('npm run genui');
    run('node scripts/build.mjs');
    buildOk = true;
  } catch (e) {
    restorePluginJson(origText);
    throw e;
  }
  if (!buildOk) return;

  const builtZip = join(SRC_DIST, 'multisource-music.jsplugin.zip');
  if (!existsSync(builtZip)) {
    restorePluginJson(origText);
    throw new Error('构建产物缺失: ' + builtZip);
  }

  // 2) 复制产物到发布仓 dist
  const targetName = isBeta ? 'multisource-music-beta.jsplugin.zip' : 'multisource-music.jsplugin.zip';
  const targetZip = join(RELEASE_DIST, targetName);
  copyFileSync(builtZip, targetZip);

  // 3) 写 manifest
  const manifest = { version: newVer, download_url: `${RAW_BASE}/${targetName}` };
  const manifestPath = isBeta ? RELEASE_MANIFEST_BETA : RELEASE_MANIFEST;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  // 4) 正式版：同步发布仓 plugin.json（宿主插件商店版本 + 实时 hash）
  if (!isBeta) copyFileSync(SRC_PLUGIN_JSON, RELEASE_PLUGIN_JSON);

  // 5) 还原源仓 plugin.json：测试版还原（不残留）；正式版保留新版本（稍后提交）
  if (isBeta) restorePluginJson(origText);

  // 自检：是否会降级（与线上 1.4.53.7 比较）
  const cmp = cmpVer(newVer, '1.4.53.7');
  console.log(`[publish] 版本自检 cmpVer(${newVer}, 1.4.53.7) = ${cmp} （>0 表示是升级，安全）`);
  if (cmp <= 0) {
    console.error(`[publish] ⚠ 警告：${newVer} 不高于线上 1.4.53.7，会导致更新检测视为「无更新/降级」。已生成产物但未推送。`);
    if (isBeta) { /* 已还原 */ }
    return { newVer, base, manifest, skipped: true };
  }

  console.log(`[publish] 产物已写入发布仓：${targetName} / ${isBeta ? 'manifest-beta.json' : 'manifest.json'}` + (isBeta ? '' : ' / plugin.json'));

  if (dryRun) {
    console.log('[publish] DRY-RUN：未提交/未推送。源仓 plugin.json' + (isBeta ? ' 已还原。' : ' 保持为 ' + newVer + '（未提交）。'));
    return { newVer, base, manifest, dryRun: true };
  }

  // 6) 提交并推送发布仓
  const relAdd = isBeta
    ? `plugin/songloft/dist/multisource-music-beta.jsplugin.zip plugin/songloft/manifest-beta.json`
    : `plugin/songloft/dist/multisource-music.jsplugin.zip plugin/songloft/manifest.json plugin/songloft/plugin.json`;
  git(RELEASE_REPO_DIR, `add ${relAdd}`);
  git(RELEASE_REPO_DIR, `commit -m "${isBeta ? 'publish beta v' + newVer : 'publish official v' + newVer}"`);
  git(RELEASE_REPO_DIR, `-c credential.helper= push "${RELEASE_REMOTE}" master`);

  // 7) 正式版：提交源仓版本 + 推送 master + 快进 dev
  if (!isBeta) {
    git(SRC_REPO, `add plugin/songloft/plugin.json`);
    git(SRC_REPO, `commit -m "release: v${newVer}"`);
    git(SRC_REPO, `-c credential.helper= push "${SRC_REMOTE}" master`);
    try {
      git(SRC_REPO, `checkout dev`);
      git(SRC_REPO, `merge --ff-only master`);
      git(SRC_REPO, `-c credential.helper= push "${SRC_REMOTE}" dev`);
      git(SRC_REPO, `checkout master`);
    } catch (e) {
      console.warn('[publish] dev 同步失败（非致命）：', e && e.message ? e.message : e);
      try { git(SRC_REPO, `checkout master`); } catch { /* ignore */ }
    }
  }

  console.log(`\n[publish] 完成：${mode} v${newVer}`);
  return { newVer, base, manifest };
}
