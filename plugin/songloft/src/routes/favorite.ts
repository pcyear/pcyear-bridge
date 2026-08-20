// 收藏相关路由（从 main.ts 提取）
// 设计：每个音源独立的收藏存储。
//   - 本地库（songloft）：沿用宿主歌单「多源音乐桥·收藏」（真实宿主歌曲，便于播放/封面）。
//   - 其它音源（geak / fnMusic / webdav / subsonic 等）：收藏存于插件 KV（msm_fav2:<sourceId>），
//     按 sourceId + trackId 记录，互不串扰。
//   - 收藏选项卡：展示「当前音源」的收藏；若当前音源尚未收藏任何歌曲，则回退展示本地库收藏，
//     保证选项卡不为空、且符合「音源没有的就显示本地库的收藏」。

import { createRouter, jsonResponse } from '@songloft/plugin-sdk';
import { readBody, q, fail, errMsg } from '../lib/common';
import { resolveSongsBatch } from '../lib/import';
import { getAdapter, SONGLOFT_SOURCE_ID } from '../manager';

declare const songloft: any;

type Router = ReturnType<typeof createRouter>;

const FAV_PL_KEY = 'msm_fav_playlist';
const FAV_PL_NAME = '多源音乐桥·收藏';
const FAV_IDS_CACHE_KEY = 'msm_cache:fav_ids';
const FAV_SONGS_CACHE_KEY = 'msm_cache:fav_songs';
const FAV_CACHE_TTL = 10000; // 10s 过期（收藏视图后台静默刷新间隔 8s 命中）

interface FavEntry {
  sourceId: string;
  trackId: string;
  songId?: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverId?: string;
  addedAt: number;
}

function isLocalSource(sid?: string): boolean {
  return !sid || sid === SONGLOFT_SOURCE_ID;
}
function favKey(sourceId: string): string {
  return 'msm_fav2:' + sourceId;
}

// ---------------- 本地库收藏（宿主歌单）----------------
async function ensureFavPlaylist(): Promise<number | null> {
  try {
    const cached = await songloft.storage.get(FAV_PL_KEY);
    if (cached) {
      try { const id = Number((JSON.parse(String(cached)) as any).id); if (id) return id; } catch {}
    }
    try {
      const list = await songloft.playlists.search(FAV_PL_NAME);
      if (list && list.length) {
        const id = list[0].id;
        await songloft.storage.set(FAV_PL_KEY, JSON.stringify({ id }));
        return id;
      }
    } catch {}
    const pl = await songloft.playlists.create({ name: FAV_PL_NAME });
    await songloft.storage.set(FAV_PL_KEY, JSON.stringify({ id: pl.id }));
    return pl.id;
  } catch (e) {
    songloft.log.info('[fav] ensureFavPlaylist failed: ' + errMsg(e));
    return null;
  }
}

// ---------------- 其它音源收藏（插件 KV）----------------
async function getSourceFavs(sourceId: string): Promise<FavEntry[]> {
  try {
    const raw = await songloft.storage.get(favKey(sourceId));
    if (!raw) return [];
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(o) ? o : [];
  } catch { return []; }
}
async function setSourceFavs(sourceId: string, arr: FavEntry[]): Promise<void> {
  try { await songloft.storage.set(favKey(sourceId), JSON.stringify(arr)); } catch (e) {
    songloft.log.warn('[fav] setSourceFavs failed: ' + errMsg(e));
  }
}

// ---------------- 缓存（仅本地库歌单用，KV 读取极快无需缓存）----------------
async function favCacheGet(key: string): Promise<any | null> {
  try {
    const raw = await songloft.storage.get(key);
    if (!raw) return null;
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (o && typeof o.t === 'number' && Date.now() - o.t < FAV_CACHE_TTL) return o.v;
    return null;
  } catch { return null; }
}
async function favCacheSet(key: string, v: any) {
  try { await songloft.storage.set(key, JSON.stringify({ t: Date.now(), v })); } catch {}
}
async function favCacheDel(key: string) {
  try { await songloft.storage.set(key, null); } catch {}
}

// ---------------- 本地库收藏：详细曲目列表 ----------------
async function loadLocalFavSongs(): Promise<any[]> {
  const plCached = await songloft.storage.get(FAV_PL_KEY);
  if (!plCached) return [];
  const plId = Number((JSON.parse(String(plCached)) as any).id);
  if (!plId) return [];
  const songs = await songloft.playlists.getSongs(plId);
  return (songs || []).map((s: any) => {
    const cu = s.cover_url || s.coverUrl || '';
    let srcCover: { sourceId: string; coverId: string } | null = null;
    try {
      const sd = typeof s.source_data === 'string' ? JSON.parse(s.source_data) : (s.source_data || null);
      if (sd && sd.provider === 'multisource-music' && sd.sourceId && (sd.coverId || sd.trackId)) {
        srcCover = { sourceId: String(sd.sourceId), coverId: String(sd.coverId || sd.trackId) };
      }
    } catch { /* ignore */ }
    return {
      id: s.id,
      title: s.title || '',
      artist: s.artist || '',
      album: s.album || '',
      duration: Number(s.duration) || 0,
      coverUrl: cu,
      srcCover,
      _host: true,
    };
  });
}

// 把 KV 收藏条目映射为前端 track 形状（带 sourceId + coverId，封面走 /cover-data）。
function entryToTrack(e: FavEntry): any {
  return {
    id: e.trackId,
    title: e.title || '',
    artist: e.artist || '',
    album: e.album || '',
    duration: Number(e.duration) || 0,
    coverId: e.coverId || undefined,
    sourceId: e.sourceId,
    srcCover: e.coverId ? { sourceId: e.sourceId, coverId: e.coverId } : undefined,
    _remote: true,
  };
}

// 把平台原生收藏返回的 Track 映射为前端 track 形状（与 KV 条目同构）。
function entryToTrackNative(t: any, sid: string): any {
  return {
    id: String(t.id),
    title: t.title || '',
    artist: t.artist || '',
    album: t.album || '',
    duration: Number(t.duration) || 0,
    coverId: t.coverId || undefined,
    sourceId: sid,
    srcCover: t.coverId ? { sourceId: sid, coverId: t.coverId } : undefined,
    _remote: true,
  };
}

// 判断某音源收藏的存储模式：
//   - 'host'   ：本地库（songloft）→ 宿主歌单「多源音乐桥·收藏」
//   - 'native' ：适配器实现 listFavorites → 直接读写平台服务端收藏
//   - 'kv'     ：其余音源 → 插件 KV（msm_fav2:<sourceId>）
async function favMode(sid: string): Promise<'host' | 'native' | 'kv'> {
  if (isLocalSource(sid)) return 'host';
  try {
    const ad: any = await getAdapter(sid);
    if (ad && typeof ad.listFavorites === 'function') return 'native';
  } catch { /* ignore */ }
  return 'kv';
}

export function registerFavoriteRoutes(router: Router): void {
  router.get('/favorite-ids', async (req) => {
    try {
      const p = q(req);
      const sid = String(p.sourceId || '');
      const mode = await favMode(sid);
      if (mode === 'host') {
        const cached = await favCacheGet(FAV_IDS_CACHE_KEY);
        if (cached && cached.ids) return jsonResponse({ ok: true, ids: cached.ids, remote: cached.remote || [] });
        const plCached = await songloft.storage.get(FAV_PL_KEY);
        if (!plCached) return jsonResponse({ ok: true, ids: [], remote: [] });
        const plId = Number((JSON.parse(String(plCached)) as any).id);
        if (!plId) return jsonResponse({ ok: true, ids: [], remote: [] });
        const songs = await songloft.playlists.getSongs(plId);
        const ids: number[] = [];
        const remote: { sourceId: string; trackId: string }[] = [];
        for (const s of (songs || [])) {
          const id = Number(s.id);
          if (typeof id === 'number' && id) ids.push(id);
          try {
            const sd = typeof s.source_data === 'string' ? JSON.parse(s.source_data) : (s.source_data || null);
            if (sd && sd.provider === 'multisource-music' && sd.sourceId && sd.trackId) {
              remote.push({ sourceId: String(sd.sourceId), trackId: String(sd.trackId) });
            }
          } catch { /* ignore */ }
        }
        const detailed = { ids, remote };
        await favCacheSet(FAV_IDS_CACHE_KEY, detailed);
        return jsonResponse({ ok: true, ids, remote });
      }
      if (mode === 'native') {
        const ad: any = await getAdapter(sid);
        const ids = (typeof ad.favoriteIds === 'function' ? await ad.favoriteIds() : []) as string[];
        return jsonResponse({ ok: true, ids: [], remote: ids.map((t) => ({ sourceId: sid, trackId: t })) });
      }
      // kv 模式：红心状态以 sourceId:trackId 表达
      const arr = await getSourceFavs(sid);
      return jsonResponse({ ok: true, ids: [], remote: arr.map((e) => ({ sourceId: e.sourceId, trackId: e.trackId })) });
    } catch (e: any) {
      return fail('读取收藏失败：' + errMsg(e));
    }
  });

  router.post('/favorite', async (req) => {
    try {
      const body = readBody(req);
      const fav = !!body.fav;
      const sid = String(body.sourceId || '');
      let songId = Number(body.songId);
      const trackId = body.trackId != null ? String(body.trackId) : undefined;
      const mode = await favMode(sid);
      if (mode === 'host') {
        // 本地库：沿用宿主歌单「多源音乐桥·收藏」
        if (!songId && sid && trackId) {
          try {
            const res = await resolveSongsBatch([{ sid: sid, trackId: trackId }], false, false);
            if (res && res.length && res[0].songId) songId = res[0].songId;
          } catch { /* ignore */ }
        }
        if (!songId) return fail('缺少有效的 songId 或 sourceId/trackId');
        const plId = await ensureFavPlaylist();
        if (!plId) return fail('无法创建收藏歌单（宿主可能未授权 playlists.write）');
        if (fav) await songloft.playlists.addSongs(plId, [songId]);
        else await songloft.playlists.removeSongs(plId, [songId]);
        await favCacheDel(FAV_IDS_CACHE_KEY);
        await favCacheDel(FAV_SONGS_CACHE_KEY);
        const songs = await songloft.playlists.getSongs(plId);
        const ids: number[] = [];
        const remote: { sourceId: string; trackId: string }[] = [];
        for (const s of (songs || [])) {
          const id = Number(s.id);
          if (typeof id === 'number' && id) ids.push(id);
          try {
            const sd = typeof s.source_data === 'string' ? JSON.parse(s.source_data) : (s.source_data || null);
            if (sd && sd.provider === 'multisource-music' && sd.sourceId && sd.trackId) {
              remote.push({ sourceId: String(sd.sourceId), trackId: String(sd.trackId) });
            }
          } catch { /* ignore */ }
        }
        return jsonResponse({ ok: true, fav, ids, remote });
      }
      if (mode === 'native') {
        if (!trackId) return fail('缺少 trackId（平台收藏需指定 sourceId + trackId）');
        const ad: any = await getAdapter(sid);
        await ad.setFavorite(trackId, fav);
        const ids = (typeof ad.favoriteIds === 'function' ? await ad.favoriteIds() : []) as string[];
        return jsonResponse({ ok: true, fav, ids: [], remote: ids.map((t: string) => ({ sourceId: sid, trackId: t })) });
      }
      // kv 模式：存于插件 KV（msm_fav2:<sourceId>），按 sourceId + trackId 去重
      if (!trackId) return fail('缺少 trackId（非本地音源收藏需指定 sourceId + trackId）');
      let arr = await getSourceFavs(sid);
      if (fav) {
        const entry: FavEntry = {
          sourceId: sid,
          trackId,
          songId: songId ? songId : undefined,
          title: body.title || '',
          artist: body.artist || '',
          album: body.album || '',
          duration: Number(body.duration) || 0,
          coverId: body.coverId || undefined,
          addedAt: Date.now(),
        };
        const i = arr.findIndex((e) => e.trackId === trackId);
        if (i >= 0) arr[i] = entry; else arr.push(entry);
      } else {
        const next = arr.filter((e) => e.trackId !== trackId);
        if (next.length === arr.length) {
          // 也尝试按 songId 兜底移除（收藏时可能只记了 songId）
          const bySong = arr.filter((e) => e.songId && songId && e.songId === songId);
          if (bySong.length) arr = arr.filter((e) => !(e.songId && songId && e.songId === songId));
        } else {
          arr = next;
        }
      }
      await setSourceFavs(sid, arr);
      return jsonResponse({
        ok: true,
        fav,
        ids: [],
        remote: arr.map((e) => ({ sourceId: e.sourceId, trackId: e.trackId })),
      });
    } catch (e: any) {
      return fail('收藏失败：' + errMsg(e));
    }
  });

  // 收藏歌曲完整列表（供前端「收藏」视图渲染）。
  //   - 本地库：宿主 SongLoft 歌单「多源音乐桥·收藏」。
  //   - 平台原生收藏（geak / fnMusic 等实现 listFavorites 的适配器）：直接读取服务端收藏列表。
  //   - 其余音源：插件 KV 中该音源的收藏。
  //   - 音源没有收藏时（以上均为空）→ 回退展示本地库收藏（符合「音源没有的就显示本地库的收藏」）。
  router.get('/favorite-songs', async (req) => {
    try {
      const p = q(req);
      const sid = String(p.sourceId || '');
      const refresh = p.refresh === '1';
      const limit = p.limit ? parseInt(String(p.limit), 10) || 0 : 0;
      const offset = p.offset ? parseInt(String(p.offset), 10) || 0 : 0;
      const slice = (arr: any[]) => (limit > 0 ? arr.slice(offset, offset + limit) : arr);

      if (isLocalSource(sid)) {
        if (!refresh) {
          const cached = await favCacheGet(FAV_SONGS_CACHE_KEY);
          if (cached) return jsonResponse({ ok: true, list: slice(cached), total: cached.length });
        }
        const all = await loadLocalFavSongs();
        await favCacheSet(FAV_SONGS_CACHE_KEY, all);
        return jsonResponse({ ok: true, list: slice(all), total: all.length });
      }

      const mode = await favMode(sid);
      if (mode === 'native') {
        const ad: any = await getAdapter(sid);
        const r = await ad.listFavorites({ limit, offset });
        const list = (r.list || []).map((t: any) => entryToTrackNative(t, sid));
        if (list.length) return jsonResponse({ ok: true, list: slice(list), total: r.total || list.length });
        // 平台无收藏 → 回退本地库
        if (!refresh) {
          const cached = await favCacheGet(FAV_SONGS_CACHE_KEY);
          if (cached) return jsonResponse({ ok: true, list: slice(cached), total: cached.length, fallback: true });
        }
        const all = await loadLocalFavSongs();
        await favCacheSet(FAV_SONGS_CACHE_KEY, all);
        return jsonResponse({ ok: true, list: slice(all), total: all.length, fallback: true });
      }

      // kv 模式
      const arr = await getSourceFavs(sid);
      if (arr.length) {
        const list = arr.map(entryToTrack);
        return jsonResponse({ ok: true, list: slice(list), total: list.length });
      }
      // 回退：当前音源无收藏 → 展示本地库收藏
      if (!refresh) {
        const cached = await favCacheGet(FAV_SONGS_CACHE_KEY);
        if (cached) return jsonResponse({ ok: true, list: slice(cached), total: cached.length, fallback: true });
      }
      const all = await loadLocalFavSongs();
      await favCacheSet(FAV_SONGS_CACHE_KEY, all);
      return jsonResponse({ ok: true, list: slice(all), total: all.length, fallback: true });
    } catch (e: any) {
      return fail('读取收藏失败：' + errMsg(e));
    }
  });
}
