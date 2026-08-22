// 导入/入库到 SongLoft 媒体库的工具函数（从 main.ts 提取）

import { errMsg, normalizeLrc } from './common';
import { coverProxyUrl } from './cover';
import { getConfig, getAdapter, SONGLOFT_SOURCE_ID } from '../manager';
import { SourceConfig, MusicSourceData, Track } from '../types';

declare const songloft: any;

/** 组装写入宿主 Song.source_data 的载荷 */
export function buildSourceData(cfg: SourceConfig, t: Track): MusicSourceData {
  return {
    provider: 'multisource-music',
    sourceId: cfg.id,
    sourceType: cfg.type,
    trackId: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    coverId: t.coverId,
    path: t.path,
  };
}

/**
 * 把曲目确保为 SongLoft 歌曲并返回其 songId（用于交给宿主播放器播放）。
 * 用 songloft.storage 维护 sourceId:trackId -> songId 映射，避免重复入库；
 * 一次批量只读写一次 storage。
 */
export async function resolveSongsBatch(
  items: { sid: string; trackId: string; track?: any }[],
  withCover = false,
  withLyric = false,
): Promise<{ trackId: string; songId: number; coverUrl?: string }[]> {
  let map: Record<string, number> = {};
  let mapDirty = false;
  try {
    const raw = await songloft.storage.get('songMap');
    if (raw) {
      const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (p && typeof p === 'object') map = p as Record<string, number>;
    }
  } catch { /* ignore */ }

  // 预先把可能用到的封面代理 URL 算出来。
  // 注意：这里必须并行（Promise.all），否则勾选多首时会逐首串行 await coverProxyUrl，
  // 几十首就是几十次串行网络往返，导致「加入播放」要等很久才提示成功。
  // （内置 songloft 源虽然歌曲本身秒回 songId，但旧逻辑仍对每首串行调封面代理、结果还被丢弃，纯浪费。）
  const coverMap: Record<string, string> = {};
  if (withCover) {
    await Promise.all(items.map(async (it) => {
      const key = `${it.sid}:${it.trackId}`;
      if (coverMap[key]) return;
      const t = it.track;
      if (t && t.coverId) {
        try { coverMap[key] = await coverProxyUrl(it.sid, t.coverId); } catch { /* ignore */ }
      }
    }));
  }

  const out: { trackId: string; songId: number; coverUrl?: string }[] = [];
  const needCreate: { key: string; sid: string; trackId: string; track?: any; coverUrl?: string }[] = [];
  const needUpdate: { key: string; sid: string; trackId: string; songId: number; coverUrl?: string }[] = [];
  const cached: { key: string; sid: string; trackId: string; songId: number; coverUrl?: string; track?: any }[] = [];
  for (const it of items) {
    // SongLoft 本地库：歌曲本身就是宿主媒体库记录，trackId 即 songId，直接返回（不重复入库）
    const nid = Number(it.trackId);
    if (it.sid === SONGLOFT_SOURCE_ID && nid > 0) {
      out.push({ trackId: it.trackId, songId: nid });
      continue;
    }
    const key = `${it.sid}:${it.trackId}`;
    const coverUrl = coverMap[key];
    if (typeof map[key] === 'number') {
      cached.push({ key, sid: it.sid, trackId: it.trackId, songId: map[key], coverUrl, track: it.track });
    } else {
      needCreate.push({ key, sid: it.sid, trackId: it.trackId, track: it.track, coverUrl });
    }
  }

  // 验证缓存的 songId 是否仍存在于宿主媒体库（用户可能在 SongLoft 里手动删过歌）
  if (cached.length) {
    // 分块并发验证（每批 8 个）：几十上百首一次 Promise.all 全发会打爆宿主歌曲查询，
    // 且验证是纯本地宿主查询，分小批串行处理即可，避免瞬时大并发。
    const CHUNK = 8;
    const needUpdateChunk: typeof cached = [];
    for (let i = 0; i < cached.length; i += CHUNK) {
      const chunk = cached.slice(i, i + CHUNK);
      const res = await Promise.all(chunk.map(async (c) => {
        try {
          const song = await songloft.songs.getById(c.songId);
          if (song && song.id === c.songId) return { ok: true as const, c };
        } catch (e) {
          songloft.log.warn(`验证歌曲 ${c.songId} 失败：${errMsg(e)}`);
        }
        // 已失效：从缓存移除，稍后重新创建
        delete map[c.key];
        mapDirty = true;
        needCreate.push({ key: c.key, sid: c.sid, trackId: c.trackId, track: c.track, coverUrl: c.coverUrl });
        return { ok: false as const, c };
      }));
      for (const v of res) if (v.ok) needUpdateChunk.push(v.c);
    }
    for (const c of needUpdateChunk) needUpdate.push(c);
  }

  // 对已有 songId 补封面（旧数据可能没有 coverUrl，导致宿主播放器去 /api/v1/songs/{id}/cover 拿图而 401）
  if (needUpdate.length) {
    await Promise.all(needUpdate.map(async (u) => {
      if (!u.coverUrl) return;
      try {
        await songloft.songs.update(u.songId, { coverUrl: u.coverUrl });
      } catch (e) {
        songloft.log.warn(`更新歌曲 ${u.songId} 封面失败：${errMsg(e)}`);
      }
      out.push({ trackId: u.trackId, songId: u.songId, coverUrl: u.coverUrl });
    }));
    // 没有 coverUrl 的也返回结果
    for (const u of needUpdate) {
      if (!out.find(o => o.trackId === u.trackId)) out.push({ trackId: u.trackId, songId: u.songId });
    }
  }

  if (needCreate.length) {
    const created = await Promise.all(needCreate.map(async (n) => {
      const cfg = await getConfig(n.sid);
      if (!cfg) throw new Error('未找到音源：' + n.sid);
      let t = n.track;
      // 关键修复：调用方传入的 track 对象其 id 可能为 null（例如有声书「窗口外」队列项 id 尚未解析时，
      // 前端把队列项本身作为 track 传入，而该项的 id 字段为 null）。若用 track.id 构建 dedupKey / sourceData，
      // 会导致所有集 dedupe 到同一个 key（null）而复用同一首歌的 songId —— 表现为「传给宿主相同的 id、有进度无声音」。
      // 因此这里的 id 一律回退为后端收到的源 trackId（n.trackId，来自前端入参，始终正确）。
      if (t && t.id == null) t = { ...t, id: n.trackId };
      if (!t || !t.title) {
        const adapter = await getAdapter(n.sid);
        // 未命中缓存且调用方没给曲目信息：按 trackId 分页反查。
        // 限制扫描页数：本地库一般在前几页；全量 5000 条是极端情况，
        // 优先用 adapter.search 按标题/ID 精确找（一次往返），找不到才分页兜底。
        let hit: Track | null = null;
        try {
          if (adapter.search) {
            const sr = await adapter.search(String(n.trackId), { limit: 20 });
            hit = (sr.tracks || []).find((x: Track) => x.id === n.trackId) || null;
          }
        } catch { /* 降级分页 */ }
        let offset = 0;
        while (!hit && offset < 5000) {
          const page = await adapter.listTracks({ limit: 200, offset });
          hit = page.list.find((x: Track) => x.id === n.trackId) || null;
          if (hit) break;
          if (page.list.length < 200) break;
          offset += page.list.length;
        }
        if (hit) t = hit;
      }
      if (!t) throw new Error('未在音源中找到曲目：' + n.trackId);
      // 封面：给宿主一个它能在服务端 fetch 的真实图片 URL（指向 /cover-img，由插件代拉上游封面并返回字节）。
      // 不能用 data URI —— 宿主封面端点会去 fetch source_cover_url，data URI 无法 HTTP 拉取（实测 404 cover fetch failed）。
      const coverUrl = n.coverUrl || (withCover ? await coverProxyUrl(n.sid, t.coverId) : '');
      const lyric = withLyric ? await fetchLyricForImport(n.sid, t.id) : '';
      const inputs: any = [{
        title: t.title,
        artist: t.artist,
        album: t.album,
        duration: t.duration,
        sourceData: JSON.stringify(buildSourceData(cfg, t)),
        dedupKey: `multisource-music:${n.sid}:${n.trackId}`,
      }];
      if (coverUrl) inputs[0].coverUrl = coverUrl;
      if (lyric) { inputs[0].lyric = lyric; inputs[0].lyricSource = 'embedded'; }
      let createdSongs: any;
      try {
        createdSongs = await songloft.songs.create(inputs);
      } catch (ce: any) {
        // 诊断：宿主在 songs.create 时回呼解析失败（典型 "no valid songs resolved"）会在这里抛出
        try {
          await songloft.storage.set('msm_create_error', {
            t: new Date().toISOString().slice(11, 23),
            key: n.key,
            sourceId: n.sid,
            error: (ce && ce.message) || String(ce),
            stack: (ce && ce.stack) ? String(ce.stack).slice(0, 400) : '',
          });
        } catch { /* ignore */ }
        throw ce;
      }
      const song = createdSongs && createdSongs[0];
      const songId = song && typeof song.id === 'number' ? song.id : null;
      if (songId == null) throw new Error('入库失败：' + n.trackId);
      map[n.key] = songId;
      mapDirty = true;
      return { trackId: n.trackId, songId, coverUrl };
    }));
    for (const c of created) out.push(c);
  }

  // 仅当映射有变化（新增/失效重建）时才写回 KV，避免每次都全量序列化。
  // 变化发生在：needCreate 入库成功写入 map、缓存失效时 delete map[key]。
  if (mapDirty) {
    await songloft.storage.set('songMap', JSON.stringify(map));
  }
  return out;
}

// 导入时抓取上游歌词文本（直接写进宿主歌曲 lyric 字段；songs.update 不支持 lyric，故只在 create 阶段写）。
export async function fetchLyricForImport(sourceId: string, trackId: string): Promise<string> {
  try {
    const ad: any = await getAdapter(sourceId);
    if (ad && typeof ad.lyric === 'function') {
      const l = await ad.lyric(trackId);
      if (typeof l === 'string' && l.trim()) return normalizeLrc(l);
    }
  } catch { /* ignore */ }
  return '';
}
