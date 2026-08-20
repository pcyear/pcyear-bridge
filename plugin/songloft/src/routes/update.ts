// 更新检测路由
// 插件启动时前端调 /update-check 检测 Gitee 发布仓库 manifest.json 是否有新版本；
// 检测到更新后「立即更新」调 /update-fetch 把新版 zip 下载到插件 data 目录，
// 用户再到 SongLoft 插件管理页选择该文件更新（宿主无插件级更新 API，插件 token 无管理权限）。
// 注意：Gitee raw 无 CORS 头，前端不能直连，必须后端代拉（绕开 CORS）。

import { jsonResponse, type HTTPRequest, type HTTPResponse } from '@songloft/plugin-sdk';
import { fetchWithTimeout, toBytes, bytesToBase64, errMsg, q } from '../lib/common';
import { PLUGIN_VERSION } from '../version.generated';

declare const songloft: any;

type Router = ReturnType<typeof import('@songloft/plugin-sdk').createRouter>;

// 发布仓库 manifest（与发布仓 plugin.json 的 updateUrl 字段保持一致）
const MANIFEST_URL = 'https://gitee.com/pcyear/pcyear-bridge-release/raw/master/plugin/songloft/manifest.json';
const MANIFEST_BETA_URL = 'https://gitee.com/pcyear/pcyear-bridge-release/raw/master/plugin/songloft/manifest-beta.json';
// 当前版本：由 scripts/gen-ui.mjs 从 plugin.json 自动注入（单一来源，构建时生成 version.generated.ts）。
// 这样升级到新版本后 /update-check 的 current 永远等于打包版本，不会误报「有更新」。
const CURRENT_VERSION = PLUGIN_VERSION;
// 单次更新检查的 KV 缓存（避免每次打开都打 Gitee；10 分钟内复用结果）
const CHECK_CACHE_TTL = 10 * 60 * 1000;

function cmpVer(a: string, b: string): number {
  const pa = String(a || '').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '').split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

export function registerUpdateRoutes(router: Router): void {
  // 检测更新：拉取发布仓 manifest.json，返回最新版本与下载地址
  router.get('/update-check', async (req: HTTPRequest): Promise<HTTPResponse> => {
    const p = q(req);
    const beta = String(p.beta || '') === '1';
    const ck = beta ? 'msm_update_check_beta' : 'msm_update_check';
    const url = beta ? MANIFEST_BETA_URL : MANIFEST_URL;
    try {
      const s = (globalThis as any).songloft?.storage;
      if (!beta && s && s.get) {
        const cv = await s.get(ck);
        if (cv && cv.latest && Date.now() - (cv.ts || 0) < CHECK_CACHE_TTL) {
          return jsonResponse({
            ok: true, current: CURRENT_VERSION, latest: cv.latest,
            hasUpdate: cmpVer(cv.latest, CURRENT_VERSION) > 0,
            downloadUrl: cv.downloadUrl || '',
            cached: true,
          });
        }
      }
      const resp = await fetchWithTimeout(url, 8000);
      if (!resp || !resp.ok) return jsonResponse({ ok: false, message: '更新检查失败（HTTP ' + (resp && resp.status) + '）' }, 200);
      const text = await resp.text();
      const m = JSON.parse(text || '{}');
      const latest = String(m.version || '');
      const downloadUrl = String(m.download_url || '');
      if (!latest || !downloadUrl) return jsonResponse({ ok: false, message: '更新检查失败（manifest 缺少版本或下载地址）' }, 200);
      try { if (!beta && s && s.set) await s.set(ck, { latest, downloadUrl, ts: Date.now() }); } catch { /* ignore */ }
      return jsonResponse({
        ok: true, current: CURRENT_VERSION, latest,
        hasUpdate: cmpVer(latest, CURRENT_VERSION) > 0,
        downloadUrl, beta,
      });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: '更新检查失败：' + errMsg(e) }, 200);
    }
  });

  // 立即更新：把最新版 zip 下载到插件 data 目录（update/ 子目录），返回文件相对路径供用户到管理页安装
  router.get('/update-fetch', async (req: HTTPRequest): Promise<HTTPResponse> => {
    const p = q(req);
    const url = p.url || '';
    if (!url || !/^https:\/\//.test(url)) return jsonResponse({ ok: false, message: '缺少有效的下载地址' }, 400);
    try {
      const resp = await fetchWithTimeout(url, 60000);
      if (!resp || !resp.ok) return jsonResponse({ ok: false, message: '下载失败（HTTP ' + (resp && resp.status) + '）' }, 200);
      const buf = await toBytes(resp);
      if (!buf || buf.length < 1000) return jsonResponse({ ok: false, message: '下载内容异常' }, 200);
      // 热更新模式：把 zip 以 base64 返回给前端，由前端直接上传宿主完成安装+重载（不经插件管理页）
      if (String(p.hot || '') === '1') {
        return jsonResponse({ ok: true, size: Math.round(buf.length / 1024), dataB64: bytesToBase64(buf) });
      }
      const name = 'multisource-music-update.zip';
      const fname = 'update/' + name;
      try { await songloft.fs.mkdir('update', { recursive: true }); } catch { /* 已存在 */ }
      await songloft.fs.writeFile(fname, bytesToBase64(buf), { encoding: 'base64' });
      return jsonResponse({
        ok: true, file: fname, size: Math.round(buf.length / 1024),
        message: `已下载 ${fname}（${Math.round(buf.length / 1024)}KB），请到 SongLoft 插件管理页选择该文件更新`,
      });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: '下载失败：' + errMsg(e) }, 200);
    }
  });
}
