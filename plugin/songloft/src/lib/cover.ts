// 封面解析与代理工具（从 main.ts 提取）

import { toBytes, getHeader, bytesToBase64, fetchWithTimeout } from './common';
import { getConfig, getAdapter, SONGLOFT_SOURCE_ID } from '../manager';

/** 与 plugin.json 的 entryPath 保持一致 */
export const ENTRY_PATH = 'multisource-music';

let lastHost = '';
let lastBase = '';   // 完整外部基址（含协议），如 https://mimusic.035151.xyz:1024
const INTERNAL_HOST_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|$)/i;
export function setLastHost(host: string): void {
  const h = String(host || '').replace(/\/$/, '').trim();
  if (!h) return;
  // 忽略宿主内部回环地址（localhost/127.0.0.1:58091 等）：宿主内部回调会把 Host 头改写成这类地址，
  // 若用它生成 source_cover_url，宿主服务端跨进程 fetch 拿不到图 → 404。只保留用户侧可访问的地址
  // （如 192.168.31.28:58091 / mimusic.035151.xyz:1024），避免被内部回调污染。
  if (INTERNAL_HOST_RE.test(h)) return;
  lastHost = h;
  lastBase = 'http://' + h;
}

/**
 * 用「用户侧可访问」的完整基址（含协议）覆盖 lastBase。
 * 远端站点在反代（nginx）后面，宿主 SDK 收到的 Host 头被内部改写成 localhost:58091，
 * 必须从 X-Forwarded-Proto/Host 或 Referer/Origin 等用户侧头解析（与 cast.ts 同方案）。
 */
export function setLastBase(base: string): void {
  const b = String(base || '').replace(/\/+$/, '').trim();
  if (!b) return;
  const m = b.match(/^https?:\/\/([^/]+)/i);
  if (!m) return;
  if (INTERNAL_HOST_RE.test(m[1])) return;
  lastBase = b;
  lastHost = m[1];
}

/**
 * 导入到 SongLoft 时写入的封面 URL：尽量用上游直链（宿主自己拉取）。
 * - subsonic / fnMusic：直链无需探测，直接给。
 * - webdav：封面文件名不定，需逐个 HEAD 探测，导入大批量时太慢，这里跳过
 *   （留空；浏览页封面走 /cover-data，宿主库封面由 /cover-search 兜底）。
 */
export async function coverUrlForImport(sourceId: string, coverId?: string): Promise<string> {
  if (!coverId) return '';
  try {
    const cfg = await getConfig(sourceId);
    if (!cfg || cfg.type === 'webdav') return '';
    const ad = await getAdapter(sourceId);
    const up = await ad.resolveCover(coverId);
    return up ? up.url : '';
  } catch { return ''; }
}

/** 把封面解析成可直接给宿主 <img> / coverUrl 的 base64 data URI，绕开宿主播放器 401/跨域问题 */
export async function coverDataUrlForImport(sourceId: string, coverId?: string): Promise<string> {
  if (!coverId) return '';
  try {
    const ad = await getAdapter(sourceId);
    const up = await ad.resolveCover(coverId);
    if (!up) return '';
    let buf: Uint8Array;
    let ct: string;
    if (up.inline && up.inline.data && up.inline.data.length) {
      buf = up.inline.data;
      ct = up.inline.contentType || 'image/jpeg';
    } else {
      const resp = await fetch(up.url, { method: 'GET', headers: up.headers });
      if (!resp.ok) return '';
      buf = await toBytes(resp);
      ct = getHeader(resp, 'Content-Type') || 'image/jpeg';
    }
    return `data:${ct};base64,${bytesToBase64(buf)}`;
  } catch { return ''; }
}

// 仅用宿主歌曲 id 反查并解析封面为 data URL（供前端 /cover-data 与列表封面校验共用）。
// 解析规则：优先用 source_data（插件导入歌）反查原始音源 adapter；否则宿主原生歌走 SONGLOFT_SOURCE_ID 反查 cover_url。
export async function coverDataUrlForSongId(songId: string): Promise<string | null> {
  let sourceId: string | undefined, coverId: string | undefined;
  try {
    const song = await songloft.songs.getById(Number(songId));
    if (song) {
      const sd = song.source_data
        ? (typeof song.source_data === 'string' ? JSON.parse(song.source_data) : song.source_data)
        : null;
      if (sd && sd.provider === 'multisource-music') {
        sourceId = sd.sourceId; coverId = sd.coverId;
      } else if (song.cover_url) {
        sourceId = SONGLOFT_SOURCE_ID; coverId = String(song.id);
      }
    }
  } catch { /* 反查失败 */ }
  if (!sourceId || !coverId) return null;
  return await resolveCoverDataUrl(sourceId, coverId);
}

// 把指定音源的封面解析为真实图片字节（供 /cover-img 经 serveFile 返回给宿主取图）。
export async function resolveCoverBytes(sourceId: string, coverId?: string): Promise<{ buf: Uint8Array; ct: string; directUrl?: string } | null> {
  if (!coverId) return null;
  const withTimeout = <T>(p: Promise<T>, ms = 12000): Promise<T> =>
    Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('封面解析超时')), ms))]) as any;
  try {
    const main = await withTimeout(resolveCoverBytesInner(sourceId, coverId));
    // 主封面已有真实字节 → 直接返回（最高优先）。
    if (main && main.buf && main.buf.length) return main;
    // 主封面无字节（仅 directUrl 或 null）→ 回退到专辑/艺人封面候选（首歌可能恰好无封面，
    // 如文件损坏 size=0，而同专辑其他歌有封面）。优先返回有真实字节的候选；
    // 否则返回首个有 directUrl 的候选（含主），由 serveCover 实际 fetch 验证。
    const cands = await getAlbumCandidates(sourceId, coverId);
    if (cands && cands.length) {
      // 主封面若已有 directUrl（本地库宿主原生封面直链），优先作为兜底——
      // 否则无封面的候选（如文件损坏 size=0）会覆盖掉有封面的主封面，导致本该显示封面的歌反而空白。
      let directFallback: { buf: Uint8Array; ct: string; directUrl?: string } | null =
        (main && main.directUrl) ? main : null;
      for (const c of cands) {
        if (c === coverId) continue;
        let r: any = null;
        try { r = await withTimeout(resolveCoverBytesInner(sourceId, c)); } catch { continue; }
        if (r && r.buf && r.buf.length) return r;
        if (!directFallback && r && r.directUrl) directFallback = r;
      }
      if (directFallback) return directFallback;
    }
    return main;
  } catch { return null; }
}

// 取某封面 id 对应的专辑/艺人候选封面列表（数据源聚合时收集）。仅 SongLoft 本地库实现。
export async function getAlbumCandidates(sourceId: string, coverId?: string): Promise<string[] | undefined> {
  if (!coverId) return undefined;
  try {
    const adapter = await getAdapter(sourceId);
    const fn = (adapter as any).albumCoverCandidates;
    if (typeof fn !== 'function') return undefined;
    let cands = fn.call(adapter, coverId);
    if (!cands || !cands.length) {
      // 候选 map 尚未填充（尚未触发专辑聚合，例如客户端直接打 getCoverArt 而未先 getAlbumList2）。
      // 主动触发一次聚合以填充候选，避免专辑封面在边界调用路径下仍空白。lib() 自带 TTL 缓存，重复开销低。
      try {
        await Promise.race([
          (adapter as any).lib ? (adapter as any).lib() : Promise.resolve(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('agg timeout')), 8000)),
        ]);
      } catch { /* 忽略 */ }
      cands = fn.call(adapter, coverId);
    }
    // 歌曲 → 所属专辑候选回退：专辑/艺人映射查不到时，再查「歌曲自身 coverId → 同专辑候选」
    // （songAlbumCandidates）。这是飞牛式「从关联内容派生封面」的核心——歌曲无自身封面时，
    // resolveCoverBytes 据此回退到同专辑有封面的歌，使歌曲列表也能显示专辑封面。
    // 此前 getAlbumCandidates 只查 albumCoverCandidates，songAlbumCandidates 是死代码，
    // 导致「歌曲无自身封面即整片空白」——正是箭头音乐歌曲/收藏不显示封面的根因。
    if (!cands || !cands.length) {
      const fn2 = (adapter as any).songAlbumCandidates;
      if (typeof fn2 === 'function') cands = fn2.call(adapter, coverId);
    }
    return cands;
  } catch { /* ignore */ }
  return undefined;
}

export async function resolveCoverBytesInner(sourceId: string, coverId?: string, opts?: { forceEmbedded?: boolean }): Promise<{ buf: Uint8Array; ct: string; directUrl?: string } | null> {
  try {
    const adapter = await getAdapter(sourceId);
    const forceEmbedded = !!(opts && opts.forceEmbedded);
    // 拉封面带 token 自动重试：fnMusic 的 token 有时效，过期后 /static/cover 返回 401；
    // 这里检测 401 后调用 adapter.resetToken() 清 token，下次调用会重登。
    // 重试 1 次后仍失败则放弃（避免对宕机的上游持续重试）。
    const tryFetch = async (): Promise<{ buf: Uint8Array; ct: string; directUrl?: string } | null> => {
      const up = await adapter.resolveCover(coverId);
      if (!up) return null;
      if (up.directUrl) {
        // 宿主原生封面端点：插件直接 fetch 会经宿主代理回调插件自身路由而死锁 → 直连 URL 交给前端浏览器加载
        return { buf: new Uint8Array(0), ct: '', directUrl: up.directUrl };
      }
      if (up.inline && up.inline.data && up.inline.data.length) {
        return { buf: up.inline.data, ct: up.inline.contentType || 'image/jpeg' };
      }
      const resp = await fetchWithTimeout(up.url, 8000, up.headers);
      if (resp.status === 401) {
        // 通知适配器清 token，下次 resolveCover 会重登
        try { (adapter as any).resetToken?.(); } catch { /* ignore */ }
        return null;
      }
      if (!resp.ok) return null;
      return { buf: await toBytes(resp), ct: getHeader(resp, 'Content-Type') || 'image/jpeg' };
    };
    let first: { buf: Uint8Array; ct: string; directUrl?: string } | null = null;
    // forceEmbedded（Subsonic 服务端直链代拉失败后的兜底）：跳过 directUrl 快路径，直接试音频内嵌封面。
    // 默认快路径：任何非空结果（真实图片字节 或 本地库 directUrl 宿主原生封面直链）直接返回，
    // 不再强制内嵌解析（v1.4.53.3 性能修复：每次 Range 续抓大封面拖垮单线程后端）。
    if (!forceEmbedded) {
      first = await tryFetch();
      if (first) return first;
    }
    // resolveCover 返回 null（确认该 coverId 无自定义封面）或 forceEmbedded 时，
    // 回退用曲目流 URL 抓文件头解析内嵌封面（Range 150KB + APIC 二次抓取 + ID3）。
    // 仅当 adapter 支持 resolveEmbeddedCover 时触发。音源 API 提供的封面/标题/作者仍优先。
    try {
      const fb = await (adapter as any).resolveEmbeddedCover?.(coverId);
      if (fb && fb.data && fb.data.length >= 8) return { buf: fb.data, ct: fb.contentType || 'image/jpeg' };
    } catch { /* 忽略 */ }
    if (first) return first;
    // 重试一次（adapter 此时 token 已清，resolveCover 会重新登录）
    return await tryFetch();
  } catch { return null; }
}

// 把指定音源的封面解析为 base64 data URI，供前端 /cover-data 使用（浏览器内显示）。
// 结果缓存到 KV：小封面（<200KB）缓存 dataUrl，无封面缓存 6h，避免对慢 WebDAV 反复实时探测/并发超时。
// v1.4.4：增加 in-flight 单飞去重 —— 同一 sourceId+coverId 的并发请求共享同一次解析，
// 避免前端 3 并发队列中同 URL 重复排队导致后端重复解析（无封面目录每次都要 PROPFIND+拉文件头）。
// 无封面缓存：真无封面目录/曲目短期不重探（防反复探测拖垮后端）。
// v1.4.20：6h → 2h —— WebDAV 抖动期「解析失败被误判为无封面」的污染缓存最长 2h 自动失效自愈，
// 而真正的无封面库（目录级共享）重探成本很低（一次目录探测 + 首曲 150KB）。
const NONE_COVER_TTL = 2 * 3600_000;
const coverInflight = new Map<string, Promise<string | null>>();

export async function resolveCoverDataUrl(sourceId: string, coverId?: string): Promise<string | null> {
  if (!coverId) return null;
  // v1.4.18：key 升 cover3: —— v1.4.17 及以前缓存的封面图可能带 4 字节 00 前缀（MP4 covr 写入工具
  // 预留字段）导致浏览器破裂，且旧 dataUrl 缓存无过期。升级 key 强制全量重新解析。
  // v1.4.20：key 再升 cover4: —— 部署瞬间 WebDAV 抖动期「解析失败被误判无封面」污染了 cover3: 的
  // none 缓存（6h 锁死，此前正常的封面全部 no cover）。升级强制重解析，配合 none TTL 缩短自愈。
  // v1.4.53：key 升 cover5: —— songloft.resolveCover 曾用 getHostUrl()(localhost) 补宿主封面相对路径
  // → 插件 fetch localhost 挂起 → 本地库歌全部 no cover 并被写入 none 缓存。修复为 hostBase() 后升 key 清污染。
  // v1.4.54：key 再升 cover6: —— 改用 directUrl（前端直连宿主原生封面端点）前，cover5 的 none 缓存仍锁着本地库。
  // v1.4.55：key 升 cover7: —— resolveEmbeddedCover 改用 hostBase()（用户侧 LAN 基址）修复 localhost 挂起后，
  // 必须清掉 cover6 已写入的「dead 直链」缓存（无 TTL 永久锁死），否则仍回退 404 直链。
  // v1.4.53.1：key 升 cover16 —— 真正修复 MP4/m4a(ALAC) covr 大封面(>150KB)截断半截：covr 帧超出首抓缓冲时，
  // 旧代码把截断的 bodyEnd 直接喂解析 → 返回半截封面。本次新增 covr 截断检测 + 分段续抓循环（上限 16MB）。
  // cover15 锁存的半截图无 TTL，必须升 key 强制全量按新解析链路重新抓取。
  // v1.4.53.3：key 升 cover17 —— 修复「本地库封面反复全量重解析导致 10s+/502」：
  //   1) 大封面(≥200KB)不再丢弃缓存，改为返回 /cover-img 二进制代理 URL（浏览器直连，serveFile 走文件缓存）；
  //      旧逻辑只对 <200KB 缓存 dataUrl，大封面每次请求都重新抓文件头+base64，单线程后端排队超时。
  //   2) 本地库 directUrl（宿主原生封面直链）直接返回，不再强制内嵌解析（见 resolveCoverBytesInner 注释）。
  // v1.4.55.29：key 升 cover18 —— 本地库 directUrl 现拼宿主 ?w=200 压缩参数，旧 cover17 缓存锁存的
  //   是未压缩大图直链（如 1.7MB PNG），必须升 key 强制重新解析出新直链（带 &w=200），否则仍下发大图。
  // v1.4.56.45：key 升 cover19 —— FLAC 大内嵌封面(>150KB)此前缺失续抓（parseFlac 不标记
  // incomplete），被首抓 150KB 缓冲掐成半截 → base64 内联后 JPEG 解码失败显示损坏网格图。
  // 补齐 FLAC 续抓后必须升 key 清掉 cover18 已锁存的截断图（无 TTL）。
  const ck = 'cover19:' + sourceId + ':' + coverId;
  try {
    const s = (globalThis as any).songloft?.storage;
    if (s && s.get) {
      const cv = await s.get(ck);
      if (cv && cv.dataUrl) return cv.dataUrl;
      if (cv && cv.none && Date.now() - (cv.ts || 0) < NONE_COVER_TTL) return null;
    }
  } catch { /* ignore */ }
  // 并发去重：同一 coverId 在途时共享同一次解析
  const inflight = coverInflight.get(ck);
  if (inflight) return inflight;
  const p = (async (): Promise<string | null> => {
    const rb = await resolveCoverBytes(sourceId, coverId);
    if (!rb) {
      try { const s = (globalThis as any).songloft?.storage; if (s && s.set) await s.set(ck, { none: true, ts: Date.now() }); } catch {}
      return null;
    }
    if ((rb as any).directUrl) {
      // 宿主原生封面直连 URL：前端 img 直接加载（带 access_token），与宿主界面同链路
      try { const s = (globalThis as any).songloft?.storage; if (s && s.set) await s.set(ck, { dataUrl: (rb as any).directUrl, ct: 'direct' }); } catch {}
      return (rb as any).directUrl;
    }
    const dataUrl = `data:${rb.ct};base64,${bytesToBase64(rb.buf)}`;
    if (rb.buf.length < 200_000) {
      try { const s = (globalThis as any).songloft?.storage; if (s && s.set) await s.set(ck, { dataUrl, ct: rb.ct }); } catch {}
      return dataUrl;
    }
    // 大封面(≥200KB)：不缓存 base64（KV 单条容量受限 + base64 反复编码耗 CPU），
    // 改走 /cover-img 二进制代理 URL：浏览器直连，serveFile 走 cover_cache 文件缓存，二次访问秒级。
    // 前端 _coverReq 已支持 http 前缀作为 dataUrl，无需改前端。
    try {
      const imgUrl = await coverProxyUrl(sourceId, coverId);
      if (imgUrl) {
        try { const s = (globalThis as any).songloft?.storage; if (s && s.set) await s.set(ck, { dataUrl: imgUrl, ct: rb.ct }); } catch {}
        return imgUrl;
      }
    } catch { /* 兜底返回 dataUrl */ }
    return dataUrl;
  })();
  coverInflight.set(ck, p);
  try {
    return await p;
  } finally {
    coverInflight.delete(ck);
  }
}

// 宿主封面端点（/songs/{id}/cover）会去 HTTP fetch 歌曲的 source_cover_url 取图并缓存/转码，
// 因此 coverUrl 必须是「宿主服务端能拉到的真实图片 URL」，不能是 data URI（实测 data URI 会 404 cover fetch failed）。
// 这里构造一个指向本插件 /cover-img 的绝对 URL：宿主服务端 fetch 它 → 插件代拉上游封面 → serveFile 返回字节。
export async function hostBase(): Promise<string> {
  // 关键修复（2026-08-04 实测确诊）：songloft.plugin.getHostUrl() 返回 http://localhost:58091，
  // 宿主 QuickJS fetch localhost 走隔离网络极慢/挂起（实测 5s+ 不返回 → 超时/阻塞调度）。
  // 必须优先用用户侧可访问的完整基址（setLastBase 优先于 setLastHost），走正常网络路径毫秒级可达。
  if (lastBase) return lastBase;
  if (lastHost) return 'http://' + lastHost.replace(/\/$/, '');
  try {
    const u = await songloft.plugin.getHostUrl();
    if (u) return u.replace(/\/$/, '');
  } catch { /* ignore */ }
  return '';
}

export async function coverProxyUrl(sourceId: string, coverId?: string): Promise<string> {
  if (!coverId) return '';
  const base = await hostBase();
  if (!base) return '';
  return `${base}/api/v1/jsplugin/${ENTRY_PATH}/cover-img?sourceId=${encodeURIComponent(sourceId)}&coverId=${encodeURIComponent(coverId)}`;
}

declare const songloft: any;
