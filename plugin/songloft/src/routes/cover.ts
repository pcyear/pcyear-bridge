// 封面相关路由（从 main.ts 提取）

import { createRouter, jsonResponse } from '@songloft/plugin-sdk';
import { q, errMsg, toBytes, bytesToBase64, fetchWithTimeout, CACHE_PREFIX } from '../lib/common';
import { getAdapter, searchAllTracks, SONGLOFT_SOURCE_ID } from '../manager';
import {
  coverDataUrlForSongId, resolveCoverDataUrl, resolveCoverBytes, coverProxyUrl, hostBase,
} from '../lib/cover';

declare const songloft: any;

type Router = ReturnType<typeof createRouter>;

export function registerCoverRoutes(router: Router): void {
  router.get('/cover-data', async (req) => {
    const p = q(req);
    let sourceId = p.sourceId, coverId = p.coverId;
    // 兜底：仅有宿主歌曲 id 时（如重新点入插件，currentSong 的 source_data 可能不带 coverId），
    // 用 getById 反查该曲 source_data 里的 coverId / sourceId。
    if ((!sourceId || !coverId) && p.songId) {
      const dataUrl = await coverDataUrlForSongId(p.songId);
      if (dataUrl) return jsonResponse({ ok: true, contentType: dataUrl.split(';')[0].replace('data:', ''), dataUrl });
      return jsonResponse({ ok: false, message: 'no cover' }, 200);
    }
    if (!sourceId || !coverId) return jsonResponse({ ok: false, message: '缺少 sourceId 或 coverId' }, 200);
    try {
      const dataUrl = await resolveCoverDataUrl(sourceId, coverId);
      if (!dataUrl) return jsonResponse({ ok: false, message: 'no cover' }, 200);
      // 被动目录封面：歌曲封面解析成功 → 把「歌曲封面」推到所属文件夹（持久 KV，见 dircover.ts）
      try {
        const ad: any = await getAdapter(sourceId);
        if (ad && typeof ad.recordDirCoverFromTrack === 'function') await ad.recordDirCoverFromTrack(coverId);
      } catch { /* 忽略 */ }
      return jsonResponse({ ok: true, contentType: dataUrl.split(';')[0].replace('data:', ''), dataUrl });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 200);
    }
  });

  // 真实封面字节出口：宿主封面端点（/songs/{id}/cover）会去 fetch 歌曲 source_cover_url，
  // 而上游封面（fnMusic 需 Cookie / WebDAV 需 Basic）宿主服务端拉不到。这里由插件代拉真实封面，
  // 写入插件数据目录后以 serveFile（Go 层直读盘返回字节）回传，绕开 QuickJS 二进制回传限制。
  // 导入时把歌曲 coverUrl 指向本路由，宿主即可服务端 fetch → 媒体库与播放器都显示封面。
  router.get('/cover-img', async (req) => {
    const p = q(req);
    if (!p.sourceId || !p.coverId) return jsonResponse({ ok: false, message: '缺少 sourceId 或 coverId' }, 400);
    try {
      const rb = await resolveCoverBytes(p.sourceId, p.coverId);
      if (!rb) return jsonResponse({ ok: false, message: 'no cover' }, 404);
      // 宿主原生封面直连 URL（如本地库 /songs/{id}/cover）：302 交给调用方（宿主代理/浏览器）跟随，
      // 插件自身不 fetch（防宿主代理回调插件路由死锁）
      if ((rb as any).directUrl) {
        return { statusCode: 302, headers: { Location: (rb as any).directUrl } };
      }
      const ct = rb.ct || 'image/jpeg';
      const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg';
      const hash = (p.sourceId + '_' + p.coverId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const fname = `cover_cache/${hash}.${ext}`;
      if (!(await songloft.fs.exists(fname))) {
        try { await songloft.fs.mkdir('cover_cache', { recursive: true }); } catch { /* 已存在 */ }
        await songloft.fs.writeFile(fname, bytesToBase64(rb.buf), { encoding: 'base64' });
      }
      return { statusCode: 200, headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=86400' }, serveFile: { filePath: fname } };
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 500);
    }
  });

  // 宿主封面提供者：当歌曲没有封面时，宿主会调用此端点。返回宿主服务端可直接 fetch 的图片 URL
  // （指向本插件的 /cover-img，由插件代拉上游封面并 serveFile 返回字节），避免 Cookie/跨域/鉴权问题。
  router.get('/cover-search', async (req) => {
    const p = q(req);
    let sd: any = null;
    try { sd = p.source_data ? JSON.parse(p.source_data) : null; } catch { /* ignore */ }
    const coverId = (sd && sd.coverId) || p.coverId;
    const sourceId = (sd && sd.sourceId) || p.sourceId;
    if (coverId && sourceId) {
      const url = await coverProxyUrl(sourceId, coverId);
      if (url) return jsonResponse({ ok: true, cover_url: url });
    }
    // 否则按 艺术家+专辑+标题 在已启用音源里搜
    const artist = p.artist || (sd && sd.artist) || '';
    const album = p.album || (sd && sd.album) || '';
    const title = p.title || (sd && sd.title) || '';
    if (title) {
      try {
        const hits = await searchAllTracks(title, 10);
        for (const { track, cfg: c } of hits) {
          if (!track.coverId) continue;
          if (artist && track.artist && track.artist.indexOf(artist) < 0 && artist.indexOf(track.artist) < 0) continue;
          const url = await coverProxyUrl(c.id, track.coverId);
          if (url) return jsonResponse({ ok: true, cover_url: url });
        }
      } catch { /* ignore */ }
    }
    return jsonResponse({ ok: false, message: '未找到封面' }, 200);
  });

  // 宿主封面代理：宿主本地库歌曲的 cover_url 是宿主内部路径（/api/v1/songs/{id}/cover），
  // 需要宿主登录态；前端不能拿宿主 token（合规要求），改由后端 songloft.plugin.getToken()
  // 代拉并回传 base64 data URL（与 /cover-data、/host-lyric 同模式）。返回 JSON 而非 serveFile，
  // 方便前端走 SDK apiGet/apiPost 通道（前端零接触 token）。
  router.get('/host-cover', async (req) => {
    const p = q(req);
    const url = p.url || p.coverUrl || '';
    if (!url) return jsonResponse({ ok: false, message: '缺少 url' }, 400);
    try {
      const base = await hostBase();
      let full = url.startsWith('http') ? url : (base + url);
      let token = '';
      try { token = await songloft.plugin.getToken(); } catch { /* ignore */ }
      if (token) {
        const sep = full.includes('?') ? '&' : '?';
        full += `${sep}access_token=${encodeURIComponent(token)}`;
      }
      songloft.log.info(`[host-cover] GET ${full.replace(/access_token=[^&]+/, 'access_token=***')}`);
      const resp = await fetchWithTimeout(full, 3000); // 3 秒超时：封面是锦上添花，不能卡死
      if (!resp.ok) {
        songloft.log.warn(`[host-cover] 抓取 ${url} 失败 status=${resp.status ?? resp.statusCode}`);
        return jsonResponse({ ok: false, message: `HTTP ${resp.status ?? resp.statusCode}` }, 404);
      }
      const buf = await toBytes(resp);
      if (!buf || buf.length === 0) return jsonResponse({ ok: false, message: 'empty body' }, 404);
      let ct = 'image/jpeg';
      try {
        const hdrs = resp.headers || {};
        const hct = hdrs['content-type'] || hdrs['Content-Type'] || hdrs['content_type'] || '';
        if (hct) ct = String(hct).split(';')[0].trim();
      } catch { /* ignore */ }
      const dataUrl = `data:${ct};base64,${bytesToBase64(buf)}`;
      return jsonResponse({ ok: true, dataUrl, contentType: ct });
    } catch (e: any) {
      songloft.log.warn('[host-cover] 抓取宿主封面失败: ' + errMsg(e));
      return jsonResponse({ ok: false, message: errMsg(e) }, 500);
    }
  });

  // 调试：检查某曲目是否真有可解析封面（目录封面文件 / 内嵌封面），用于定位「没封面」还是「抽不出」
  // 生产默认关闭：需先 POST /cache {"key":"debug_art","value":"1"} 开启（避免暴露调试入口）
  router.get('/debug-art', async (req) => {
    const p = q(req);
    try {
      const flag = await songloft.storage.get(CACHE_PREFIX + 'debug_art');
      if (String(flag ?? '') !== '1') return jsonResponse({ ok: false, message: 'debug-art disabled' }, 200);
    } catch {
      return jsonResponse({ ok: false, message: 'debug-art disabled' }, 200);
    }
    if (!p.sourceId || !p.coverId) return jsonResponse({ ok: false, message: '缺少 sourceId 或 coverId' }, 200);
    try {
      const adapter: any = await getAdapter(p.sourceId);
      // 1) 目录封面候选是否存在
      const dir = String(p.coverId).replace(/\/[^/]*$/, '');
      const cands = ['cover.jpg', 'folder.jpg', 'album.jpg', '封面.jpg', 'AlbumArtSmall.jpg'];
      const dirHits: string[] = [];
      for (const c of cands) {
        try {
          const u = (adapter.fullUrl ? adapter.fullUrl(`${adapter.basePath}/${dir ? dir + '/' : ''}${c}`) : '');
          if (!u) continue;
          const r = await fetch(u, { method: 'GET', headers: adapter.headers({ Range: 'bytes=0-0' }) });
          if (r.ok || r.status === 206) dirHits.push(c);
        } catch { /* ignore */ }
      }
      // 2) 内嵌封面：拉前 2MB 看魔数与是否含 ID3/APIC
      const art = await adapter.extractEmbeddedArt(p.coverId);
      let head = '';
      try {
        const buf = await adapter.fetchBytes(p.coverId, 64);
        if (buf) head = Array.from(buf.slice(0, 16)).map((x: number) => x.toString(16).padStart(2, '0')).join(' ');
      } catch { /* ignore */ }
      // 3) 诊断：ID3 版本/flags + 首 256KB 内 APIC 帧位置（区分「文件真没封面」vs「解析器漏读」）
      let tagVersion = 0;
      let tagFlags = 0;
      let apicHits: number[] = [];
      try {
        const big = await adapter.fetchBytes(p.coverId, 2 * 1024 * 1024);
        if (big && big.length > 10 && big[0] === 0x49 && big[1] === 0x44 && big[2] === 0x33) {
          tagVersion = big[3];
          tagFlags = big[5] || 0;
          const scanLen = Math.min(big.length, 262144);
          for (let k = 10; k + 4 <= scanLen; k++) {
            if (big[k] === 0x41 && big[k + 1] === 0x50 && big[k + 2] === 0x49 && big[k + 3] === 0x43) apicHits.push(k);
          }
        }
      } catch { /* ignore */ }
      return jsonResponse({
        ok: true,
        dirHits,
        embeddedArt: art ? { contentType: art.contentType, bytes: art.data.length } : null,
        fileHead: head,
        tagVersion,
        tagFlags,
        apicHits,
      });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 200);
    }
  });
}
