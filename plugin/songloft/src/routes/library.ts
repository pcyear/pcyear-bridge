// 浏览 / 搜索列表路由与辅助函数（从 main.ts 提取）

import { createRouter, jsonResponse, type HTTPRequest, type HTTPResponse } from '@songloft/plugin-sdk';
import { q, intOf, errMsg, readBody, fail } from '../lib/common';
import { resolveSourceId } from '../core/context';
import { getAdapter, SONGLOFT_SOURCE_ID } from '../manager';
import { coverDataUrlForSongId } from '../lib/cover';
import { Track, SourceAdapter } from '../types';
import {
  fusedAdapters, encodeCollectionId, decodeCollectionId, getMerged,
} from '../lib/fuse';

declare const songloft: any;

type Router = ReturnType<typeof createRouter>;

/** 给前端的曲目：补上封面标识（实际封面由 /cover-data 直链返回，避免二进制代理） */
export function decorate(sourceId: string, t: Track) {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    duration: t.duration,
    trackNo: t.trackNo,
    year: t.year,
    codec: t.codec,
    size: t.size,
    sourceId,
    coverId: t.coverId,
    path: t.path,
    // SongLoft 本地库：直接给宿主 cover_url（相对路径）与原始 source_data，前端可反查原始音源封面
    coverUrl: t.coverUrl || '',
    _raw: (t._raw && t._raw.source_data) ? { source_data: t._raw.source_data, cover_url: t._raw.cover_url } : undefined,
  };
}

// ============ 列表缓存：首次慢、之后秒开；?refresh=1 时失效并重新拉取 ============
// 内存级缓存（插件进程存活期间有效）+ 持久化到 songloft.storage（跨打开/重载仍命中）
// 缓存前缀 v2：v1 缓存里混入了错误的「毫秒级 duration」（宿主 song.duration 单位不统一，
// 部分导入批次存毫秒），已于 toTrack 做归一化，旧缓存须整体失效以免继续展示几十小时的时长。
const LIST_CACHE_PREFIX = 'lc4v2:';
const listMemCache = new Map<string, any>();

async function listCacheGet(key: string): Promise<any | undefined> {
  if (listMemCache.has(key)) return listMemCache.get(key);
  try {
    const v = await songloft.storage.get(LIST_CACHE_PREFIX + key);
    if (v !== undefined && v !== null) { listMemCache.set(key, v); return v; }
  } catch { /* 缓存读取失败不阻断主流程 */ }
  return undefined;
}

async function listCacheSet(key: string, data: any): Promise<void> {
  listMemCache.set(key, data);
  try { await songloft.storage.set(LIST_CACHE_PREFIX + key, data); } catch { /* 持久化失败仅内存生效 */ }
}

export function fail(message: string, status = 400): HTTPResponse {
  // 局部复用，避免从 common 额外导入（common 的 fail 行为一致）
  return jsonResponse({ ok: false, message }, status);
}

export async function listEndpoint(
  req: HTTPRequest,
  fn: (adapter: any, sid: string, limit: number, offset: number) => Promise<any>,
  // 仅「全部歌曲 / 搜索」依赖全量扫描，可能返回渐进的部分结果。
  // 浏览目录（专辑/艺术家/打开文件夹）走目录懒加载，结果本身就是完整的，
  // 若也按扫描完成度判定，会被永久标成 partial → 不缓存且前端反复补拉。
  progressive = false,
): Promise<HTTPResponse> {
  try {
    const sid = await resolveSourceId(req);
    if (!sid) return fail('尚未配置任何音源');
    const p = q(req);
    const wantRefresh = p.refresh === '1' || p.refresh === 'true';
    let fusedKey = '';
    if (sid === SONGLOFT_SOURCE_ID) {
      try { fusedKey = (await fusedAdapters()).map((f) => f.sid).sort().join(','); } catch { fusedKey = ''; }
    }
    const cacheKey = `list:${req.path}:${sid}:${fusedKey}:` + ['limit', 'offset', 'albumId', 'artistId', 'playlistId', 'q', 'dir']
      .filter((k) => p[k] !== undefined)
      .map((k) => `${k}=${p[k]}`)
      .join('&');
    if (!wantRefresh) {
      const cached = await listCacheGet(cacheKey);
      if (cached) return jsonResponse({ ok: true, sourceId: sid, ...cached, cached: true });
    }
    const adapter = await getAdapter(sid);
    // 显式刷新时穿透到音源：WebDAV 等内部有扫描缓存的 adapter 清缓存重扫（新加文件立即可见）
    if (wantRefresh && typeof (adapter as any).forceRefresh === 'function') {
      try { (adapter as any).forceRefresh(); } catch { /* ignore */ }
    }
    try {
      const r = await fn(adapter, sid, intOf(p.limit, 50), intOf(p.offset, 0));
      // 渐进扫描的音源（WebDAV 大库）在扫完之前返回的是「部分结果」。
      // 这种结果绝不能写进内存/持久化缓存，否则会被当成完整列表长期命中，用户永远只看到一半。
      let partial = false;
      if (progressive) {
        try {
          if (typeof (adapter as any).isScanComplete === 'function') partial = !(adapter as any).isScanComplete();
        } catch { /* 不支持则视为完整 */ }
      }
      if (!partial) await listCacheSet(cacheKey, r);
      return jsonResponse({ ok: true, sourceId: sid, ...r, ...(partial ? { partial: true } : {}) });
    } catch (e: any) {
      // 宿主 token 过期（仅影响绑宿主登录态的 songloft 源）：**源级降级**，
      // 返回空列表 + hostTokenExpired 标记，前端提示「请重新登录 SongLoft」，
      // 但绝不让这个源把整个接口拖成 ok:false（否则整页空白、其他音源也跟着不显示）。
      // 这正是「别的插件正常、只有本插件的 songloft 本地库报无效 token」的根因：
      // 本插件独有依赖宿主登录态的内置源，token 过期时若整页报错就会「连所有音乐源都不显示」。
      if (e && e.hostTokenExpired) {
        songloft.log.warn(`音源「${sid}」因宿主登录过期降级（不影响其他音源）：${errMsg(e)}`);
        return jsonResponse({
          ok: true,
          sourceId: sid,
          list: [],
          total: 0,
          hostTokenExpired: true,
          message: 'SongLoft 登录已过期，请刷新页面重新登录后再查看本地库',
        }, 200);
      }
      throw e;
    }
  } catch (e: any) {
    // 其它非 token 类错误：透传结构化标记，前端据此提示而非笼统报错。
    const extra: any = {};
    if (e && e.kind) extra.kind = e.kind;
    if (e && e.hostTokenExpired) extra.hostTokenExpired = true;
    return jsonResponse({ ok: false, message: errMsg(e), ...extra }, 200);
  }
}

// 校验文件夹封面真实可解析：优先用 coverId，失败则从 coverCandidates（同文件夹内有封面的歌，按序）挑第一首能解析的。
// 根因：toTrack 仅按宿主 cover_url 非空设 coverId，但导入歌的 cover_url 可能指向 404；聚合取首曲会抢到坏封面。
// 实测：皇后大道东专辑首曲「有声书2」cover_url 404，真正有封面的是第二首（经原始音源 adapter 解析成功）。
export async function pickResolvableCover(item: any, sidArg?: string): Promise<string | null> {
  const cands: string[] = [];
  if (item.coverId) cands.push(item.coverId);
  if (Array.isArray(item.coverCandidates)) for (const c of item.coverCandidates) if (!cands.includes(c)) cands.push(c);
  if (!cands.length) return null;
  // 关键：专辑/艺术家/歌单对象只带 _source（适配器写入），不保证带 sourceId；
  // 旧代码取 item.sourceId 恒为 '' → getAdapter('') 抛错 → 封面解析全失败（表现为「很多封面加载不出」）。
  const sid: string = sidArg || item.sourceId || (item._source as string) || '';
  // songloft 聚合源：coverId 是「宿主歌曲 id」，必须走宿主解析（coverDataUrlForSongId 按 source_data 反查原始音源封面）
  let adapterType = '';
  try { const ad = await getAdapter(sid); adapterType = (ad && (ad as any).type) || ''; } catch { /* ignore */ }
  if (adapterType === 'songloft') {
    for (const cid of cands) {
      const url = await coverDataUrlForSongId(cid);
      if (url) return cid;
    }
    return null;
  }
  // 其余源（webdav / fnMusic / subsonic）：绝不在列表端点里做网络封面探测。
  // 每个条目验证一次都要走远程（WebDAV 单个目录要试 21 个候选文件名，失败还要读音频文件头取内嵌封面），
  // 一页几十个条目串起来就是几十秒，必然被反向代理 10s 超时切断 → /albums、/artists 恒 502。
  // 封面改为前端按需请求 /cover-data 逐张解析：那里有目录级缓存、内嵌封面回落与并发限制，
  // 解析不到时前端自动回落默认封面图，列表本身则保持纯内存、毫秒级返回。
  return cands[0];
}

// coverCandidates 只供后端挑封面用，不下发前端：大库下一页几十个条目 × 十几个候选路径会把响应体撑大好几倍。
export function stripCands(o: any) {
  const { coverCandidates, ...rest } = o;
  return rest;
}

// 集合列表统一装配：只有 songloft 聚合源需要逐条反查宿主歌曲（coverId 是宿主歌曲 id）；
// 其余源的 coverId 已是可直接解析的源内标识，纯内存映射即可 —— 列表端点一次网络请求都不发。
export async function decorateCollections(ad: any, sid: string, items: any[]): Promise<any[]> {
  if ((ad && ad.type) === 'songloft') {
    return await Promise.all(items.map(async (a: any) => {
      const coverId = await pickResolvableCover(a, sid);
      return { ...stripCands(a), sourceId: sid, coverId: coverId || undefined, coverUrl: '' };
    }));
  }
  return items.map((a: any) => ({ ...stripCands(a), sourceId: sid, coverId: a.coverId || undefined, coverUrl: '' }));
}

// 批量获取集合（专辑/艺术家/歌单）的二次元数据：封面标识、歌手、曲目数等。
// 列表接口只返回骨架，前端按可见区域分批调用本接口，避免一次性在服务端拉取过多数据导致超时。
export async function collectionsInfoEndpoint(req: HTTPRequest): Promise<HTTPResponse> {
  try {
    const sid = await resolveSourceId(req);
    if (!sid) return fail('尚未配置任何音源');
    let body: any = {};
    try { body = JSON.parse(typeof req.body === 'string' ? req.body : '{}'); } catch { /* ignore */ }
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
    if (!ids.length) return jsonResponse({ ok: true, sourceId: sid, list: [] });
    // 按真实来源分组：本地原生 ID 归到当前 sid，融合前缀 ID 归到其来源
    const groups: Record<string, string[]> = {};
    for (const id of ids) {
      const dec = decodeCollectionId(id);
      const key = dec.sid || sid;
      (groups[key] ||= []).push(dec.realId);
    }
    const list: any[] = [];
    for (const [gsid, reals] of Object.entries(groups)) {
      const prefix = gsid !== sid;
      try {
        const adapter = await getAdapter(gsid);
        if (typeof (adapter as any).collectionInfo !== 'function') {
          for (const r of reals) list.push({ id: prefix ? encodeCollectionId(gsid, r) : r });
          continue;
        }
        const infos = await (adapter as any).collectionInfo(reals);
        for (const it of (infos || [])) {
          const realId = it && it.id != null ? String(it.id) : '';
          list.push({
            ...(it || { id: '' }),
            id: prefix ? encodeCollectionId(gsid, realId) : realId,
          });
        }
      } catch (e: any) {
        songloft.log.warn(`集合信息解析失败（${gsid}）：${errMsg(e)}`);
        for (const r of reals) list.push({ id: prefix ? encodeCollectionId(gsid, r) : r });
      }
    }
    return jsonResponse({ ok: true, sourceId: sid, list });
  } catch (e: any) {
    // 宿主 token 过期：透传结构化标记，前端据此提示「请重新登录 SongLoft」而非笼统报错，
    // 且不影响其他正常音源（各源各自 catch 跳过）。
    const extra: any = {};
    if (e && e.kind) extra.kind = e.kind;
    if (e && e.hostTokenExpired) extra.hostTokenExpired = true;
    return jsonResponse({ ok: false, message: errMsg(e), ...extra }, 200);
  }
}

// ============ 本地库融合：把其它音源并入「本地库」浏览 ============

/** 当前是否处于「本地库 + 融合其它源」模式 */
export async function isFuseActive(sid: string): Promise<boolean> {
  if (sid !== SONGLOFT_SOURCE_ID) return false;
  const fused = await fusedAdapters();
  return fused.length > 0;
}

/** 通用翻页：把适配器的分页列表一次性拉全（带上限保护，避免极端情况下死循环） */
async function fetchAll<T>(fn: (offset: number) => Promise<{ list: T[]; total: number }>): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;
  while (true) {
    const r = await fn(offset);
    if (r.list && r.list.length) out.push(...r.list);
    if (!r.list || r.list.length < 500) break;
    offset += r.list.length;
    if (offset > 200000) break; // 安全阀
  }
  return out;
}

/** 取某适配器某类集合（专辑/艺术家/歌单）的完整列表 */
async function fetchCollections(ad: SourceAdapter, kind: 'albums' | 'artists' | 'playlists'): Promise<any[]> {
  if (kind === 'playlists') {
    if (!ad.listPlaylists) return [];
    return fetchAll((o) => ad.listPlaylists!({ limit: 500, offset: o }));
  }
  return fetchAll((o) => (kind === 'albums' ? ad.listAlbums({ limit: 500, offset: o }) : ad.listArtists({ limit: 500, offset: o })));
}

/** 把适配器返回的集合项按来源装饰，融合源再加前缀以区分来源 */
async function decorateFusedCollections(ad: SourceAdapter, asid: string, baseSid: string, items: any[]): Promise<any[]> {
  let deco = await decorateCollections(ad, asid, items);
  if (asid !== baseSid) deco = deco.map((it: any) => ({ ...it, id: encodeCollectionId(asid, it.id), sourceId: asid }));
  return deco;
}

/** 合并曲目（本地库 + 各融合源），返回完整数组（已缓存），由 listEndpoint 负责分页 */
async function mergeTracks(sid: string): Promise<any[]> {
  return getMerged(`tracks:${sid}`, async () => {
    const localAd = await getAdapter(sid);
    const fused = await fusedAdapters();
    const out: any[] = [];
    const pull = async (ad: SourceAdapter, asid: string) => {
      try {
        const tracks = await fetchAll((o) => ad.listTracks({ limit: 500, offset: o }));
        for (const t of tracks) out.push(decorate(asid, t));
      } catch (e: any) {
        songloft.log.warn(`融合源 ${asid} 曲目拉取失败（已跳过）：${errMsg(e)}`);
      }
    };
    await pull(localAd, sid);
    for (const f of fused) await pull(f.ad, f.sid);
    return out;
  });
}

/** 合并集合（专辑/艺术家/歌单），返回完整数组（已缓存） */
async function mergeCollections(kind: 'albums' | 'artists' | 'playlists', sid: string): Promise<any[]> {
  return getMerged(`${kind}:${sid}`, async () => {
    const localAd = await getAdapter(sid);
    const fused = await fusedAdapters();
    const out: any[] = [];
    const pull = async (ad: SourceAdapter, asid: string) => {
      try {
        const items = await fetchCollections(ad, kind);
        const deco = await decorateFusedCollections(ad, asid, sid, items);
        out.push(...deco);
      } catch (e: any) {
        songloft.log.warn(`融合源 ${asid} ${kind} 拉取失败（已跳过）：${errMsg(e)}`);
      }
    };
    await pull(localAd, sid);
    for (const f of fused) await pull(f.ad, f.sid);
    return out;
  });
}

/** 本地库搜索：跨本地 + 融合源聚合（供 search.ts 调用） */
export async function mergeSearch(
  sid: string, kw: string, dir: string, limit: number,
): Promise<{ tracks: any[]; albums: any[]; artists: any[] }> {
  const localAd = await getAdapter(sid);
  const fused = await fusedAdapters();
  const entries = [{ ad: localAd, asid: sid }, ...fused.map((f) => ({ ad: f.ad, asid: f.sid }))];
  const tracks: any[] = [];
  const albums: any[] = [];
  const artists: any[] = [];
  await Promise.all(entries.map(async ({ ad, asid }) => {
    try {
      const r: any = await ad.search(kw, { limit, dir });
      for (const t of (r.tracks || [])) tracks.push(decorate(asid, t));
      const isSongloft = (ad && ad.type) === 'songloft';
      const mapCol = (a: any) => {
        const item: any = isSongloft
          ? { ...stripCands(a), sourceId: asid, coverId: undefined, coverUrl: '' }
          : { ...stripCands(a), sourceId: asid, coverId: a.coverId || a.id || undefined, coverUrl: '' };
        return item;
      };
      for (const a of (r.albums || [])) {
        const item = mapCol(a);
        if (isSongloft) item.coverId = (await pickResolvableCover(a, asid)) || undefined;
        if (asid !== sid) item.id = encodeCollectionId(asid, item.id);
        albums.push(item);
      }
      for (const a of (r.artists || [])) {
        const item = mapCol(a);
        if (isSongloft) item.coverId = (await pickResolvableCover(a, asid)) || undefined;
        if (asid !== sid) item.id = encodeCollectionId(asid, item.id);
        artists.push(item);
      }
    } catch (e: any) {
      songloft.log.warn(`融合源 ${asid} 搜索失败（已跳过）：${errMsg(e)}`);
    }
  }));
  return { tracks, albums, artists };
}

export function registerLibraryRoutes(router: Router): void {
  router.get('/tracks', (req) => listEndpoint(req, async (ad, sid, limit, offset) => {
    if (await isFuseActive(sid)) {
      const all = await mergeTracks(sid);
      return { list: all.slice(offset, offset + limit), total: all.length };
    }
    const r = await ad.listTracks({ limit, offset });
    return { list: r.list.map((t: Track) => decorate(sid, t)), total: r.total };
  }, true));

  router.get('/albums', (req) => listEndpoint(req, async (ad, sid, limit, offset) => {
    if (await isFuseActive(sid)) {
      const all = await mergeCollections('albums', sid);
      return { list: all.slice(offset, offset + limit), total: all.length };
    }
    const r = await ad.listAlbums({ limit, offset });
    return { list: await decorateCollections(ad, sid, r.list), total: r.total };
  }));

  router.get('/artists', (req) => listEndpoint(req, async (ad, sid, limit, offset) => {
    if (await isFuseActive(sid)) {
      const all = await mergeCollections('artists', sid);
      return { list: all.slice(offset, offset + limit), total: all.length };
    }
    const r = await ad.listArtists({ limit, offset });
    return { list: await decorateCollections(ad, sid, r.list), total: r.total };
  }));

  router.get('/playlists', (req) => listEndpoint(req, async (ad, sid, limit, offset) => {
    if (await isFuseActive(sid)) {
      const all = await mergeCollections('playlists', sid);
      return { list: all.slice(offset, offset + limit), total: all.length };
    }
    if (!ad.listPlaylists) return { list: [], total: 0 };
    const r = await ad.listPlaylists({ limit, offset });
    return { list: await decorateCollections(ad, sid, r.list), total: r.total };
  }));

  // ============ 上游歌单增改删（仅 Subsonic 等实现写操作的音源；其余音源留空 → 前端隐藏写按钮）============
  // 统一用 POST + op 区分，避免 DELETE 请求体被各层代理剥离的传输风险。
  router.post('/upstream-playlist', async (req) => {
    try {
      const body = readBody(req);
      const op = body.op;
      const sid = body.sourceId;
      if (!sid) return fail('缺少 sourceId');
      const ad = await getAdapter(sid);
      if (op === 'create') {
        if (!ad.createPlaylist) return fail('该音源不支持创建歌单');
        const pl = await ad.createPlaylist(body.name || '未命名歌单', (body.trackIds || []).map(String));
        return jsonResponse({ ok: true, playlist: pl });
      }
      if (op === 'update') {
        if (!ad.updatePlaylist) return fail('该音源不支持修改歌单');
        await ad.updatePlaylist(String(body.playlistId), {
          name: body.name,
          trackIdsToAdd: (body.trackIdsToAdd || []).map(String),
          trackIdsToRemove: (body.trackIdsToRemove || []).map(String),
        });
        return jsonResponse({ ok: true });
      }
      if (op === 'delete') {
        if (!ad.deletePlaylist) return fail('该音源不支持删除歌单');
        await ad.deletePlaylist(String(body.playlistId));
        return jsonResponse({ ok: true });
      }
      return fail('未知操作：' + op);
    } catch (e: any) {
      return fail(errMsg(e));
    }
  });

  router.get('/album/tracks', (req) => listEndpoint(req, async (ad, sid, limit, offset) => {
    const albumId = q(req).albumId;
    if (!albumId) throw new Error('缺少 albumId');
    const dec = decodeCollectionId(albumId);
    const adapter = dec.sid ? await getAdapter(dec.sid) : ad;
    const r = await adapter.albumTracks(dec.realId, { limit, offset });
    return { list: r.list.map((t: Track) => decorate(dec.sid || sid, t)), total: r.total };
  }));

  router.get('/artist/tracks', (req) => listEndpoint(req, async (ad, sid, limit, offset) => {
    const artistId = q(req).artistId;
    if (!artistId) throw new Error('缺少 artistId');
    const dec = decodeCollectionId(artistId);
    const adapter = dec.sid ? await getAdapter(dec.sid) : ad;
    const r = await adapter.artistTracks(dec.realId, { limit, offset });
    return { list: r.list.map((t: Track) => decorate(dec.sid || sid, t)), total: r.total };
  }));

  router.get('/playlist/tracks', (req) => listEndpoint(req, async (ad, sid, limit, offset) => {
    const playlistId = q(req).playlistId;
    if (!playlistId) throw new Error('缺少 playlistId');
    const dec = decodeCollectionId(playlistId);
    const adapter = dec.sid ? await getAdapter(dec.sid) : ad;
    if (!adapter.playlistTracks) throw new Error('该音源不支持读取歌单内歌曲');
    const r = await adapter.playlistTracks(dec.realId, { limit, offset });
    return { list: r.list.map((t: Track) => decorate(dec.sid || sid, t)), total: r.total };
  }));

  // 集合二次元数据：前端列表拿到骨架后，按可见区域分批请求封面/歌手/曲目数
  router.post('/collections/info', (req) => collectionsInfoEndpoint(req));
}
