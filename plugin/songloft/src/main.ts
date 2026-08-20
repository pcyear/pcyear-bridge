// 多源音乐桥 —— SongLoft 插件入口
//
// 把飞牛音乐（fnOS Music）/ WebDAV / Subsonic 接入 SongLoft。
//
// 与宿主的两个关键契约（由 @songloft/plugin-sdk 提供）：
//   POST /api/search     宿主全局搜索时调用 → 返回 SearchResultItem[]
//   POST /api/music/url  宿主播放时调用     → 用 source_data 解析真实地址 + 鉴权头
// 这两个钩子让插件成为 SongLoft 的「真正音源」，而不只是一个自带播放器的网页。
//
// 插件自己的管理 UI 与浏览 API（/api/sources、/api/tracks 等）已拆分到 src/routes/。

import {
  createRouter, jsonResponse,
  createSearchHandler, createMusicUrlHandler,
  type HTTPRequest, type HTTPResponse, type SearchResultItem,
} from '@songloft/plugin-sdk';
import { loadConfigs, getAdapter, searchAllTracks, invalidate } from './manager';
import { INDEX_HTML } from './ui.generated';
import { registerSubsonicRoutes } from './subsonic-server';
import { coverProxyUrl, setLastHost, setLastBase, hostBase } from './lib/cover';
import { buildSourceData } from './lib/import';
import { classifyConnError, q, toBytes, bytesToBase64, getHeader } from './lib/common';
import { getEntryPath, setEntryPath, resolveEntryPathFromPath } from './lib/entry_path';
import { AUDIOBOOK_SOURCE_ID, isAudiobookSourceId } from './sources/audiobook';
import { MusicSourceData, Track, SourceConfig } from './types';
import { registerRoutes } from './routes';
import { metrics } from './core/metrics';

declare const songloft: any;

/** 与 plugin.json 的 entryPath 保持一致，用于拼出插件对外可访问的 URL 前缀 */
const ENTRY_PATH = 'multisource-music';
const PLUGIN_BASE = `/api/v1/jsplugin/${ENTRY_PATH}`;

const router = createRouter();
// Subsonic 服务端：/rest/:action（对第三方客户端公开）与 /subsonic-server-config（管理端）
registerSubsonicRoutes(router);

// ============ 有声书流基址（宿主服务端回环地址） ============
// 宿主服务端（Go 层）拿到 /api/music/url 返回的 URL 后会自行 fetch 取字节。
// 插件 HTTP 服务只绑在 LAN 地址（如 192.168.31.61:58091），并不绑 localhost，
// 故流基址必须是「宿主服务端能回环访问的 LAN 地址」，而非 getHostUrl() 的 localhost（连不上），
// 也非用户侧外网域名（NAT 回环/证书不通）。该基址在此显式配置，默认空。
const STREAM_BASE_KEY = 'msmStreamBase';
const RE_INTERNAL = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|$)/i;
function normBase(b: string): string {
  const s = String(b || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(s)) return '';
  const m = /^https?:\/\/([^/]+)/i.exec(s);
  if (m && RE_INTERNAL.test(m[1])) return ''; // 拒绝 localhost/回环
  return s;
}
async function getStreamBase(): Promise<string> {
  try {
    const raw = await songloft.storage.get(STREAM_BASE_KEY);
    const v = typeof raw === 'string' ? raw : (raw && (raw as any).base) || '';
    return normBase(v);
  } catch { return ''; }
}
async function setStreamBase(b: string): Promise<{ ok: boolean; base: string }> {
  const n = normBase(b);
  try { await songloft.storage.set(STREAM_BASE_KEY, n || null); } catch { /* ignore */ }
  return { ok: true, base: n };
}

// ============ 播放诊断日志（排查「no valid songs resolved」用） ============
// 把关键路径写入 storage 环形数组，供 /diag/playlog 远程读取。最多保留 40 条。
const DIAG_CAP = 40;
async function diagPush(key: string, obj: any): Promise<void> {
  try {
    const raw = await songloft.storage.get(key);
    const arr: any[] = Array.isArray(raw) ? raw : [];
    arr.push({ t: new Date().toISOString().slice(11, 23), ...obj });
    if (arr.length > DIAG_CAP) arr.splice(0, arr.length - DIAG_CAP);
    await songloft.storage.set(key, arr);
  } catch { /* ignore */ }
}

// ============ 宿主音源钩子 ============

// 1) 全局搜索：宿主搜索框会把关键词交给插件，结果并入 SongLoft 的搜索结果
router.post('/api/search', createSearchHandler({
  search: async (keyword, page, pageSize): Promise<SearchResultItem[]> => {
    const size = pageSize || 30;
    const p = page && page > 0 ? page : 1;
    const hits = await searchAllTracks(keyword, size);

    const items: SearchResultItem[] = await Promise.all(hits.map(async ({ track, cfg }) => ({
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration || 0,
      cover_url: await coverProxyUrl(cfg.id, track.coverId),
      source_data: buildSourceData(cfg, track) as unknown as Record<string, unknown>,
    })));

    // 多音源结果在这里统一分页
    const start = (p - 1) * size;
    return items.slice(start, start + size);
  },
}));

// 2) 播放解析：宿主拿 source_data 回来换真实播放地址（含鉴权头，由宿主代理时携带）
router.post('/api/music/url', createMusicUrlHandler({
  resolveUrl: async (sourceData) => {
    const sd = sourceData as unknown as MusicSourceData;
    // 诊断：宿主到底发来了什么 source_data（字段名/值是否如预期）
    await diagPush('msm_musicurl', {
      stage: 'entry',
      raw: sourceData,
      sourceId: sd && sd.sourceId,
      trackId: sd && sd.trackId,
      isAudiobook: sd ? isAudiobookSourceId(sd.sourceId) : false,
    });
    if (!sd || !sd.sourceId || !sd.trackId) {
      const err = 'source_data 缺少 sourceId 或 trackId';
      await diagPush('msm_musicurl', { stage: 'entry-error', error: err });
      throw new Error(err);
    }
    // SongLoft 有声书：无上游 HTTP 服务，返回插件自身 /stream 端点（serveFile 直读 fs:external 文件）。
    // 基址必须指向「宿主服务端能回环访问的 LAN 地址」（配置项 msmStreamBase），
    // 因为 /api/music/url 的返回 URL 由宿主服务端（Go 层）去 fetch：
    //   - getHostUrl() 返回 localhost，但本环境插件服务未绑 localhost → 连不上；
    //   - hostBase() 返回用户侧外网域名，宿主服务端 NAT 回环/证书不通 → 也拿不到。
    // 故优先用显式配置的 LAN 基址；其次若 hostBase 恰为内网 IP 也可用；都没有则交宿主相对解析。
    if (isAudiobookSourceId(sd.sourceId)) {
      let base = await getStreamBase();
      if (!base) {
        const hb = (await hostBase()).replace(/\/+$/, '');
        // 仅当 hostBase 是内网 IP（非 localhost、非公网域名）时才用，外网域名/回环地址一律放弃。
        if (hb && !RE_INTERNAL.test(hb) && !/^https?:\/\/[^/]+\.(?:[a-z]{2,})$/i.test(hb)) base = hb;
      }
      const entry = ENTRY_PATH; // 规范入口名（multisource-music）
      const path = '/api/v1/jsplugin/' + entry + '/stream'
        + '?sourceId=' + encodeURIComponent(sd.sourceId)
        + '&trackId=' + encodeURIComponent(sd.trackId);
      let url = base ? base + path : path;
      // 宿主服务端 fetch 该 URL 时不带 Authorization 头，故把 access_token 写入 query（与 subsonic absolutize 一致），
      // 让网关/插件在免头场景下仍以已认证上下文读取本地文件（否则 /stream 的 fs 读取会因未认证返回 404）。
      try {
        const tk = await songloft.plugin.getToken();
        if (tk) url += (url.includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(tk);
      } catch { /* ignore */ }
      await diagPush('msm_musicurl', {
        stage: 'resolve-ab',
        base: base || '(relative)',
        urlMasked: url.replace(/access_token=[^&]+/, 'access_token=***'),
        hasToken: url.includes('access_token='),
      });
      return { url, headers: {} };
    }
    let up: UpstreamRef;
    let adapter: any;
    try {
      adapter = await getAdapter(sd.sourceId);
      up = await adapter.resolveStream(sd.trackId);
    } catch (e: any) {
      await diagPush('msm_musicurl', { stage: 'resolve-adapter-error', sourceId: sd.sourceId, error: (e && e.message) || e });
      throw e;
    }
    await diagPush('msm_musicurl', { stage: 'resolve-other', sourceId: sd.sourceId, urlMasked: (up.url || '').slice(0, 120) });
    // GEAK / 标记 streamViaProxy 的音源：默认直连上游，起播即时。
    // 旧逻辑走插件 /api/upstream-stream 代理，会「整首下载 + 写盘后才返回 serveFile」，
    // 导致起播前长时间「正在缓存 / 请稍后」。现 GEAK 已是公网授信证书（ZeroSSL，*.035151.xyz），
    // 令牌在 query（yom_nas_authorization），宿主 Go 层可直接拉流并原生支持 Range/seek，无需插件缓冲。
    // 若个别宿主环境直连失败，把 FORCE_PROXY 置 true 即回退到插件代理。
    const FORCE_PROXY = false;
    if (((adapter as any).streamViaProxy || (sd && sd.sourceType === 'geak')) && FORCE_PROXY) {
      let base = await getStreamBase();
      if (!base) {
        const hb = (await hostBase()).replace(/\/+$/, '');
        if (hb && !RE_INTERNAL.test(hb) && !/^https?:\/\/[^/]+\.(?:[a-z]{2,})$/i.test(hb)) base = hb;
      }
      const path = PLUGIN_BASE + '/api/upstream-stream'
        + '?sourceId=' + encodeURIComponent(sd.sourceId)
        + '&trackId=' + encodeURIComponent(sd.trackId);
      let url = base ? base + path : path;
      try {
        const tk = await songloft.plugin.getToken();
        if (tk) url += (url.includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(tk);
      } catch { /* ignore */ }
      await diagPush('msm_musicurl', { stage: 'resolve-proxy', urlMasked: url.replace(/access_token=[^&]+/, 'access_token=***') });
      up = { url, headers: {} };
    }
    return { url: up.url, headers: up.headers };
  },

  // 主源失效（如曲目被删/音源下线）时，用标题+艺术家在其余音源里找一首最像的
  fallbackSearch: async (hint) => {
    if (!hint || !hint.title) return null;
    const hits = await searchAllTracks(hint.title, 20);
    if (hits.length === 0) return null;

    const wantTitle = (hint.title || '').toLowerCase().trim();
    const wantArtist = (hint.artist || '').toLowerCase().trim();

    let best: { score: number; track: Track; cfg: SourceConfig } | null = null;
    for (const { track, cfg } of hits) {
      const title = (track.title || '').toLowerCase().trim();
      const artist = (track.artist || '').toLowerCase().trim();
      let score = 0;
      if (title === wantTitle) score += 10;
      else if (title.indexOf(wantTitle) >= 0 || wantTitle.indexOf(title) >= 0) score += 5;
      if (wantArtist) {
        if (artist === wantArtist) score += 6;
        else if (artist.indexOf(wantArtist) >= 0 || wantArtist.indexOf(artist) >= 0) score += 3;
      }
      // 时长接近（±5 秒）加分
      if (hint.duration && track.duration && Math.abs(hint.duration - track.duration) <= 5) score += 4;
      if (score > 0 && (!best || score > best.score)) best = { score, track, cfg };
    }
    if (!best || best.score < 5) return null;

    return {
      source_data: buildSourceData(best.cfg, best.track) as unknown as Record<string, unknown>,
      title: best.track.title,
      artist: best.track.artist,
    };
  },
}));

// 有声书流基址配置：宿主服务端回环地址（如 http://192.168.31.61:58091）。
// 仅接受 http/https 且非 localhost/回环；置空则清除，回退到 hostBase 内网 IP 或相对路径。
router.get('/api/stream-base', async () => jsonResponse({ base: await getStreamBase() }));
router.post('/api/stream-base', async (req) => {
  let body: any = {};
  try { body = req.body ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : {}; } catch { /* ignore */ }
  return jsonResponse(await setStreamBase(body && body.base));
});

// ============ 静态页面 ============

// SongLoft 有声书流：serveFile 指令让 Go 层直读 /app/audiobook 下的文件（零拷贝，支持 Range/seek）。
// 仅允许有声书源；路径严格限定在 /app/audiobook 内（防穿越）。
// 按扩展名返回正确 MIME：宿主/浏览器据 Content-Type 选解码器，硬编码 audio/mpeg 会让 m4a/flac/wav/ogg/aac/opus 无法播放。
const AB_CONTENT_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', flac: 'audio/flac', wav: 'audio/wav',
  ogg: 'audio/ogg', opus: 'audio/ogg', aac: 'audio/aac',
};
router.get('/stream', async (req) => {
  try {
    const p = q(req);
    const sourceId = p.sourceId || '';
    const trackId = p.trackId || '';
    const hasToken = !!p.access_token;
    // 诊断：记录 /stream 是否真的被宿主 fetch 到，以及参数/鉴权/文件是否存在
    await diagPush('msm_stream', {
      stage: 'hit',
      sourceId,
      trackId,
      hasToken,
      hasAuthHeader: !!(req.headers && (req.headers.authorization || req.headers.Authorization)),
    });
    if (!isAudiobookSourceId(sourceId)) {
      await diagPush('msm_stream', { stage: 'reject', reason: 'bad-source', sourceId });
      return jsonResponse({ ok: false, message: '不支持的音源' }, 403);
    }
    const rel = (trackId.startsWith('ab:') ? trackId.slice(3) : trackId).replace(/^audiobook\//, '');
    if (!rel || rel.split('/').some((seg) => seg === '..' || seg === '')) {
      await diagPush('msm_stream', { stage: 'reject', reason: 'bad-path', trackId });
      return jsonResponse({ ok: false, message: '非法路径' }, 400);
    }
    const abs = '/app/audiobook/' + rel;
    const exists = await songloft.fs.exists(abs);
    if (!exists) {
      await diagPush('msm_stream', { stage: '404', abs });
      return jsonResponse({ ok: false, message: '文件不存在' }, 404);
    }
    const ext = abs.toLowerCase().includes('.') ? abs.toLowerCase().split('.').pop()! : '';
    const contentType = AB_CONTENT_TYPES[ext] || 'audio/mpeg';
    await diagPush('msm_stream', { stage: 'serve', abs, contentType });
    return {
      statusCode: 200,
      headers: { 'Content-Type': contentType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600' },
      serveFile: { filePath: abs },
    };
  } catch (e: any) {
    await diagPush('msm_stream', { stage: 'error', error: (e && e.message) || e });
    return jsonResponse({ ok: false, message: '流解析失败：' + classifyConnError((e && e.message) || e) }, 500);
  }
});

// 上游流代理：宿主媒体层直连上游失败（如 GEAK 自签证书/跨域/鉴权头）时，由本路由代拉上游音频，
// 落盘后以 serveFile 回传（强制 audio/mpeg + Accept-Ranges，支持 Range/seek）。宿主拉取的是同源插件 URL，
// 绕开宿主侧对上游的直连限制。文件按 sourceId+trackId 缓存，重复播放直接命中。
const STREAM_CACHE_DIR = 'stream_cache';
// 整首缓存落盘：宿主强制所有外部音源走本插件代理，且宿主 serveFile 的 Content-Range total
// 取决于落盘文件的真实大小。因此只有「落盘整首文件」宿主才能正确识别总时长并支持 Range/seek；
// 分段落盘会把 total 截断成分段大小（如 256KB），导致拖动到分段之外时宿主请求的 Range 超出落盘
// 文件 → 502 → 进度条跳回起点。故改为整首缓存：首次播放需等待整首下载（即「正在缓存」），
// 之后命中缓存秒开且可任意拖动 seek。并发下载用 CACHE_INFLIGHT 去重，避免重复拉流。
const CACHE_INFLIGHT = new Map<string, Promise<void>>();
router.get('/api/upstream-stream', async (req) => {
  try {
    const p = q(req);
    const sourceId = p.sourceId || '';
    const trackId = p.trackId || '';
    if (!sourceId || !trackId) return jsonResponse({ ok: false, message: '缺少参数' }, 400);
    const adapter = await getAdapter(sourceId);
    const up = await adapter.resolveStream(trackId);
    const hash = (sourceId + '_' + trackId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const em = /\.([a-zA-Z0-9]{2,4})(?:\?|$)/.exec(up.url || '');
    const ext = em ? em[1].toLowerCase() : 'mp3';
    const cacheFile = `${STREAM_CACHE_DIR}/${hash}.${ext}`;
    // 确保整首已落盘（并发请求复用同一下载 Promise，避免重复拉流）
    let inflight = CACHE_INFLIGHT.get(cacheFile);
    if (!inflight) {
      inflight = (async () => {
        let st: any = null;
        try { st = await songloft.fs.stat(cacheFile); } catch { /* 未缓存 */ }
        if (st && st.size) return;
        const fh: Record<string, string> = {};
        if (up.headers) for (const k of Object.keys(up.headers as any)) fh[k] = (up.headers as any)[k];
        const resp = await fetch(up.url, { method: 'GET', headers: fh });
        if (!resp.ok && resp.status !== 206) {
          const ct = getHeader(resp, 'content-type') || '';
          const snip = await toBytes(resp).then(b => { let s = ''; for (let i = 0; i < b.length && i < 200; i++) s += String.fromCharCode(b[i]); return s; }).catch(() => '');
          await diagPush('msm_stream', { stage: 'proxy-upstream-error', sourceId, trackId, status: resp.status, contentType: ct, url: String(up.url), body: snip });
          throw new Error(`上游返回 ${resp.status}`);
        }
        const buf = await toBytes(resp);
        if (!buf || !buf.length) throw new Error('上游返回空音频');
        try { await songloft.fs.mkdir(STREAM_CACHE_DIR, { recursive: true }); } catch { /* 已存在 */ }
        await songloft.fs.writeFile(cacheFile, bytesToBase64(buf), { encoding: 'base64' });
        await diagPush('msm_stream', { stage: 'proxy-cache', sourceId, trackId, bytes: buf.length });
      })();
      CACHE_INFLIGHT.set(cacheFile, inflight);
      try { await inflight; } finally { CACHE_INFLIGHT.delete(cacheFile); }
    } else {
      await inflight;
    }
    const st2: any = await songloft.fs.stat(cacheFile).catch(() => null);
    if (!st2 || !st2.size) return jsonResponse({ ok: false, message: '整首缓存失败' }, 502);
    const ct = (up.headers && (((up.headers as any)['Content-Type']) || ((up.headers as any)['content-type']))) || 'audio/mpeg';
    // 不自己处理 Range：直接 serveFile 整首文件，由 Go 层按宿主下发的 Range 正确返回
    // 206/200（total=整首文件大小），宿主据此识别总时长并支持任意位置拖动 seek。
    await diagPush('msm_stream', { stage: 'proxy-serve', sourceId, trackId, bytes: st2.size });
    return { statusCode: 200, headers: { 'Content-Type': ct, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' }, serveFile: { filePath: cacheFile } };
  } catch (e: any) {
    await diagPush('msm_stream', { stage: 'proxy-error', error: (e && e.message) || e });
    return jsonResponse({ ok: false, message: '流代理失败：' + ((e && e.message) || String(e)) }, 500);
  }
});

// 播放诊断日志只读端点：返回 /api/music/url 与 /stream 的关键路径记录，供远程分析「no valid songs resolved」。
router.post('/diag/clear', async (req) => {
  let body: any = {};
  try { body = req.body ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : {}; } catch { /* ignore */ }
  const key = body && body.key;
  if (key && typeof key === 'string') {
    try { await songloft.storage.set(key, null); } catch { /* ignore */ }
  }
  return jsonResponse({ ok: true });
});
// 前端播放诊断：前端把 setQueue 实参 / 宿主报错打到此处，便于远程定位「队列空 + no valid songs resolved」。
router.post('/diag/frontend', async (req) => {
  let body: any = {};
  try { body = req.body ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : {}; } catch { /* ignore */ }
  await diagPush('msm_fe', body && typeof body === 'object' ? body : { raw: String(body) });
  return jsonResponse({ ok: true });
});
router.get('/diag/playlog', async () => {
  const musicurl = (await songloft.storage.get('msm_musicurl')) as any[] || [];
  const stream = (await songloft.storage.get('msm_stream')) as any[] || [];
  const reqlog = (await songloft.storage.get('reqlog')) as any[] || [];
  const ensuresongs = await songloft.storage.get('msm_ensuresongs');
  const createInput = await songloft.storage.get('msm_create_input');
  const createResult = await songloft.storage.get('msm_create_result');
  const createError = await songloft.storage.get('msm_create_error');
  const fe = (await songloft.storage.get('msm_fe')) as any[] || [];
  return jsonResponse({ ok: true, musicurl, stream, reqlog, ensuresongs, createInput, createResult, createError, fe, streamBase: await getStreamBase() });
});

async function serveIndex(): Promise<HTTPResponse> {
  let html = INDEX_HTML;
  // 优先读打包进来的 static/，读不到就用内联副本兜底
  try {
    const fromFs = await songloft.fs.readFile('static/index.html', { encoding: 'utf8' });
    if (fromFs && fromFs.length > 0) html = fromFs;
  } catch { /* 用内联副本 */ }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
    body: html,
  };
}

router.get('/', serveIndex);
router.get('/index.html', serveIndex);

// ============ 业务路由注册 ============
registerRoutes(router);

// ============ 生命周期 ============

export async function onInit(): Promise<void> {
  const configs = await loadConfigs();
  if (configs.length === 0) {
    songloft.log.info('PcyearBridge（多源音乐桥）已启动：尚未配置音源，请在插件页面添加（飞牛音乐 / WebDAV / Subsonic）');
  } else {
    const names = configs.map((c) => `${c.name}[${c.type}]`).join('、');
    songloft.log.info(`PcyearBridge（多源音乐桥）已启动，已加载 ${configs.length} 个音源：${names}`);
  }
  // 注册为封面提供者：宿主在歌曲缺封面时会调用 /cover-search 找直链
  try {
    songloft.covers.registerProvider();
    songloft.log.info('已注册封面提供者（/cover-search）');
  } catch (e: any) {
    songloft.log.warn('注册封面提供者失败（不影响播放）：' + ((e && e.message) || e));
  }
  // 注册为歌词提供者：宿主在歌曲缺歌词时会调用 /lyric-search
  try {
    songloft.lyrics.registerProvider();
    songloft.log.info('已注册歌词提供者（/lyric-search）');
  } catch (e: any) {
    songloft.log.warn('注册歌词提供者失败（不影响播放）：' + ((e && e.message) || e));
  }
  // 预热：后台并发建立各音源连接（登录/握手），把首次切换音源的等待
  // 从「切的时候才连」挪到「打开插件时」。不 await，避免阻塞插件 UI 加载；
  // 失败/成功都写状态到 KV（前端 /sources/status 拿取，侧边栏显示+启动 toast）
  for (const c of configs) {
    if (c.enabled === false) continue;
    getAdapter(c.id)
      .then(async (ad) => {
        try {
          if (typeof (ad as any).warmup === 'function') await (ad as any).warmup();
          else await ad.testConnection();
          try { await songloft.storage.set(`msm_src_status:${c.id}`, { ok: true, kind: 'ok', message: '预热成功', ts: Date.now() }); } catch {}
        } catch (e: any) {
          songloft.log.warn(`预热音源「${c.name}」失败：${(e && e.message) || e}`);
          const msg = (e && e.message) || e;
          try { await songloft.storage.set(`msm_src_status:${c.id}`, { ok: false, kind: classifyConnError(msg), message: msg, ts: Date.now() }); } catch {}
        }
      })
      .catch((e: any) => {
        songloft.log.warn(`预热音源「${c.name}」失败：${(e && e.message) || e}`);
        const msg = (e && e.message) || e;
        try { void songloft.storage.set(`msm_src_status:${c.id}`, { ok: false, kind: classifyConnError(msg), message: msg, ts: Date.now() }); } catch {}
      });
  }
}

export async function onDeinit(): Promise<void> {
  invalidate();
  songloft.log.info('PcyearBridge（多源音乐桥）已卸载');
}

export async function onHTTPRequest(req: HTTPRequest): Promise<HTTPResponse> {
  const t0 = Date.now();
  // 记录当前插件被宿主安装成的真实 entryPath（规范 multisource-music），
  // 供 /api/music/url 拼接插件自身流端点等场景使用。
  try { setEntryPath(resolveEntryPathFromPath(req.path || '')); } catch { /* ignore */ }
  // 宿主可能传入完整路径（含 /api/v1/jsplugin/<entry> 前缀）或带 query 字符串，
  // 统一规整成 router 期望的「相对路径」，避免匹配失败。
  const BASE = `/api/v1/jsplugin/${ENTRY_PATH}`;
  let path = req.path || '/';
  if (path.startsWith(BASE)) path = path.slice(BASE.length) || '/';
  const qi = path.indexOf('?');
  if (qi >= 0) path = path.slice(0, qi);
  // 按路由段聚合指标，避免 query 参数爆炸
  const metricPath = path.split('/').slice(0, 3).join('/') || 'index';
  metrics.inc(`req:${metricPath}`);
  try {
    const hdrs: any = (req.headers || {});
    // 用户侧基址解析（2026-08-06 修复）：宿主 SDK 收到的 Host 头常被内部改写成回环地址 localhost:58091，
    // 绝不能直接用。优先级：X-Forwarded-Proto+X-Forwarded-Host（反代透传）→ 原始 Host（非回环）→ Referer/Origin。
    const fproto = String(hdrs['x-forwarded-proto'] || hdrs['X-Forwarded-Proto'] || '');
    const fhost = String(hdrs['x-forwarded-host'] || hdrs['X-Forwarded-Host'] || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
    let userBase = '';
    if (fproto && fhost) userBase = `${fproto}://${fhost}`;
    else {
      const rawHost = String(hdrs.host || hdrs.Host || '');
      if (rawHost && !/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|$)/i.test(rawHost)) userBase = 'http://' + rawHost.replace(/\/+$/, '');
    }
    if (!userBase) {
      const ref = String(hdrs.referer || hdrs.Referer || hdrs.origin || hdrs.Origin || '');
      if (ref) {
        const m = ref.match(/^https?:\/\/[^/]+/i);
        if (m) userBase = m[0];
      }
    }
    if (userBase) setLastBase(userBase);
    else { const hh = String(hdrs.host || hdrs.Host || ''); if (hh) setLastHost(String(hh)); }
    // HEAD 兼容：Amcfy 等客户端播放前会先 HEAD stream 探测（只要响应头）。SDK 路由只注册了
    // GET/POST，HEAD 会 404 → 客户端报 520。把 HEAD 当 GET 处理，Go 层 serveFile 对 HEAD 请求
    // 自动只回响应头（标准 HTTP 语义）。
    const method = req.method === 'HEAD' ? 'GET' : req.method;
    const mod: HTTPRequest = { ...req, path, method };
    // 诊断：记录所有到达插件的「播放相关」请求路径（含 SDK 路由未匹配的 404 路径），
    // 重点确认宿主是否真的来回呼 /api/music/url（排查「no valid songs resolved」）。
    try {
      if (path.startsWith('/api') || path.startsWith('/rest') || path === '/stream') {
        const qs = String(req.query || '');
        let bodyStr = '';
        try {
          const b = (req as any).body;
          if (typeof b === 'string') bodyStr = b.slice(0, 300);
          else if (b instanceof Uint8Array) bodyStr = 'Uint8Array[' + b.length + ']';
          else if (b) bodyStr = String(b).slice(0, 300);
        } catch { /* ignore */ }
        const entry = `${new Date().toISOString().slice(11, 23)} ${req.method} ${path}${qs ? '?' + qs.slice(0, 120) : ''}${bodyStr ? ' BODY=' + bodyStr : ''}`;
        let arr: string[] = [];
        try { const raw = await songloft.storage.get('reqlog'); if (Array.isArray(raw)) arr = raw; } catch { /* ignore */ }
        arr.push(entry);
        if (arr.length > 60) arr = arr.slice(-60);
        await songloft.storage.set('reqlog', arr).catch(() => {});
      }
    } catch { /* ignore */ }
    const resp = await router.handle(mod);
    metrics.record(`time:${metricPath}`, Date.now() - t0);
    return resp;
  } catch (e: any) {
    metrics.inc(`err:${metricPath}`);
    metrics.record(`time:${metricPath}`, Date.now() - t0);
    songloft.log.error(`请求处理失败 ${req.method} ${req.path}：${(e && e.message) || e}`);
    return jsonResponse({ ok: false, message: (e && e.message) || e }, 500);
  }
}

// SongLoft 宿主通过 globalThis 读取生命周期钩子；jsc 编译后 ESM export 可能不可见，
// 所以显式挂载到 globalThis（与官方 subsonic 插件做法一致）。
(globalThis as any).onInit = onInit;
(globalThis as any).onDeinit = onDeinit;
(globalThis as any).onHTTPRequest = onHTTPRequest;
