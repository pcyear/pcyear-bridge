// 歌词相关路由（从 main.ts 提取）

import { createRouter, jsonResponse } from '@songloft/plugin-sdk';
import { q, fail, errMsg, toBytes, fetchWithTimeout, stripLrcIdTags, normalizeLrc, normalizeLrcForPlayer } from '../lib/common';
import { resolveSourceId } from '../core/context';
import { getAdapter, searchAllTracks } from '../manager';
import { fetchLyricForImport } from '../lib/import';
import { hostBase } from '../lib/cover';

declare const songloft: any;

type Router = ReturnType<typeof createRouter>;

// host-lyric 内存缓存：成功结果缓存 10 分钟，失败/超时缓存 30 秒，避免慢 lyric_url 反复挂死后端。
const hostLyricCache = new Map<string, { lyric: string | null; lyricSource?: string; exp: number }>();
function hostLyricCacheKey(sid: string) { return `host-lyric:${sid}`; }
function hostLyricCacheGet(sid: string) {
  const v = hostLyricCache.get(hostLyricCacheKey(sid));
  if (!v) return undefined;
  if (Date.now() > v.exp) { hostLyricCache.delete(hostLyricCacheKey(sid)); return undefined; }
  return v;
}
function hostLyricCacheSet(sid: string, lyric: string | null, lyricSource?: string) {
  const ttl = lyric ? 1000 * 30 : 1000 * 5; // 短 TTL：兼顾减少重复抓远程，又不挡住用户改歌词后的刷新
  hostLyricCache.set(hostLyricCacheKey(sid), { lyric, lyricSource, exp: Date.now() + ttl });
}

// 取宿主原生歌词（song.lyric 直挂 或 抓 lyric_url），带短缓存。被 /lyric 与 /host-lyric 共用。
async function fetchHostLyric(songId: string, refresh = false): Promise<{ lyric: string | null; lyricSource?: string }> {
  const cached = refresh ? undefined : hostLyricCacheGet(songId);
  if (cached !== undefined) return { lyric: cached.lyric, lyricSource: cached.lyricSource };
  try {
    const song = await songloft.songs.getById(Number(songId));
    if (!song) { hostLyricCacheSet(songId, null); return { lyric: null }; }
    const sAny = song as any;
    if (sAny.lyric && String(sAny.lyric).trim()) {
      const clean = normalizeLrcForPlayer(String(sAny.lyric));
      hostLyricCacheSet(songId, clean, sAny.lyricSource || 'host');
      return { lyric: clean, lyricSource: sAny.lyricSource || 'host' };
    }
    const url = song.lyric_url || song.lyric_remote_url;
    if (url) {
      try {
        const base = await hostBase();
        let full = url.startsWith('http') ? url : (base + url);
        let token = '';
        try { token = await songloft.plugin.getToken(); } catch { /* ignore */ }
        if (token) {
          const sep = full.includes('?') ? '&' : '?';
          full += `${sep}access_token=${encodeURIComponent(token)}`;
        }
        songloft.log.info(`[host-lyric] GET ${full.replace(/access_token=[^&]+/, 'access_token=***')}`);
        const resp = await fetchWithTimeout(full, 2000);
        if (resp.ok) {
          const raw = typeof resp.text === 'function' ? await resp.text() : new TextDecoder().decode(await toBytes(resp));
          const trimmed = (raw || '').trim();
          let text = '';
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try { const j = JSON.parse(trimmed); text = j.lyric || j.data || j.content || ''; } catch { text = raw; }
          } else { text = raw; }
          if (text && text.trim()) {
            const clean = normalizeLrcForPlayer(text);
            hostLyricCacheSet(songId, clean, sAny.lyricSource || 'host');
            return { lyric: clean, lyricSource: sAny.lyricSource || 'host' };
          }
        } else {
          songloft.log.warn(`[host-lyric] 抓取 ${url} 失败 status=${resp.status ?? resp.statusCode}`);
        }
      } catch (e) {
        songloft.log.warn('[host-lyric] 抓取 lyric_url 失败: ' + errMsg(e));
      }
    }
  } catch (e) {
    songloft.log.warn('[host-lyric] 异常: ' + errMsg(e));
  }
  hostLyricCacheSet(songId, null);
  return { lyric: null };
}

/**
 * 跨全源解析歌词（宿主 /lyric-search 与 Subsonic getLyrics* 共用的核心逻辑）。
 * 优先级：
 *  1) 已知 sourceId + trackId → 直接 fetchLyricForImport（拉该曲上游 LRC，最准，免搜索）。
 *  2) 仅有 title → searchAllTracks 跨全部启用音源搜索，按 artist 过滤后逐命中 fetchLyricForImport。
 * 关键：searchAllTracks 覆盖「外部音源」（GEAKOS / fn / WebDAV 等），而非仅本地库——
 * 这正是宿主能显示、而旧 Subsonic 歌词只搜本地库拿不到外源歌曲（如 天下乌鸦）的根因。
 */
const resolveLyricCache = new Map<string, { text: string | null; exp: number }>();

// 歌名归一化（用于跨源搜索兜底）：剥离括号内容及常见后缀词，提升「正式版 / 现场版 / 伴奏」
// 等后缀导致的匹配失败。例：「达拉崩吧正式版」→「达拉崩吧」，使其能命中同名 .lrc 副车文件。
function normalizeTitleForSearch(t: string): string {
  let s = String(t || '').trim();
  if (!s) return s;
  s = s.replace(/[\(\[（【〈《][^\)\]）】〉》]*[\)\]）】〉》]/g, ' '); // 括号及内容
  s = s.replace(/(正式版|现场版|伴奏|原版|完整版|官方版|高清版|翻唱|Demo|Cover|Remastered|Live|MV|版|版)$/gi, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export async function resolveLyric(opts: { sourceId?: string; trackId?: string; title?: string; artist?: string }): Promise<string | null> {
  const { sourceId, trackId, title, artist } = opts;
  const key = `rl:${sourceId || ''}:${trackId || ''}:${title || ''}:${artist || ''}`;
  const cached = resolveLyricCache.get(key);
  if (cached && Date.now() < cached.exp) return cached.text;
  let text: string | null = null;
  try {
    if (sourceId && trackId) {
      const l = await fetchLyricForImport(sourceId, trackId);
      if (l) text = l;
    }
    if (!text && title) {
      // 原始标题 + 归一化标题（剥离后缀）依次尝试；任一命中即采用。
      const titlesToTry = Array.from(new Set([title, normalizeTitleForSearch(title)].filter(Boolean)));
      outer:
      for (const tt of titlesToTry) {
        const hits = await searchAllTracks(tt, 10);
        for (const { track, cfg } of hits) {
          if (!track.id) continue;
          if (artist && track.artist && track.artist.indexOf(artist) < 0 && artist.indexOf(track.artist) < 0) continue;
          const l = await fetchLyricForImport(cfg.id, track.id);
          if (l) { text = l; break outer; }
        }
      }
    }
  } catch { /* ignore */ }
  text = text && text.trim() ? text : null;
  resolveLyricCache.set(key, { text, exp: Date.now() + (text ? 1000 * 60 * 10 : 1000 * 30) });
  return text;
}

export function registerLyricRoutes(router: Router): void {
  // 统一歌词接口：给定 songId（或 sourceId+trackId），后端内部按优先级兜底，前端只请求一次：
  //   1) 插件上游 / sidecar .lrc（最准，含用户在文件夹里改的歌词）
  //   2) 宿主原生歌词（可能含逐字 timing，更丰富时优先）
  router.get('/lyric', async (req) => {
    try {
      const p = q(req);
      const refresh = p.refresh === '1' || p.refresh === 'true';
      let sid = p.sourceId || (await resolveSourceId(req));
      let trackId = p.trackId;
      // 兜底：仅有宿主歌曲 id 时，用 getById 反查插件 source_data 里的 sourceId / trackId
      if ((!sid || !trackId) && p.songId) {
        try {
          const song = await songloft.songs.getById(Number(p.songId));
          if (song) {
            const sd = song.source_data
              ? (typeof song.source_data === 'string' ? JSON.parse(song.source_data) : song.source_data)
              : null;
            if (sd && sd.provider === 'multisource-music') {
              if (!sid) sid = sd.sourceId;
              if (!trackId) trackId = sd.trackId;
            }
          }
        } catch { /* 反查失败不阻断 */ }
      }
      // 1) 插件上游 / sidecar 歌词
      let sourceLyric: string | null = null;
      if (sid && trackId) {
        try {
          const adapter = await getAdapter(sid);
          if (adapter && adapter.lyric) sourceLyric = await adapter.lyric(trackId);
        } catch (e) { songloft.log.warn('[lyric] adapter.lyric 失败: ' + errMsg(e)); }
      }
      // 2) 宿主原生歌词
      let hostLyric: string | null = null, hostSource: string | undefined;
      if (p.songId) {
        const h = await fetchHostLyric(p.songId, refresh);
        hostLyric = h.lyric; hostSource = h.lyricSource;
      }
      // 选优：带逐字(word timing)者优先；否则优先插件源（含 sidecar），再宿主
      const hasWords = (s: string | null) => !!s && /<\d+,\d+>/.test(s);
      let lyric: string | null = null, lyricSource: string | undefined;
      if (hasWords(hostLyric) && !hasWords(sourceLyric)) { lyric = hostLyric; lyricSource = hostSource; }
      else if (sourceLyric) { lyric = sourceLyric; lyricSource = sid || 'source'; }
      else if (hostLyric) { lyric = hostLyric; lyricSource = hostSource; }
      if (lyric) {
        const fmt = /<\d{1,3}:\d{2}/.test(lyric) ? 'enhanced' : hasWords(lyric) ? 'yrc' : 'standard';
        songloft.log.info(`[lyric] 选优=${lyricSource} format=${fmt} len=${lyric.length} head=${lyric.slice(0, 80).replace(/\s+/g, ' ')}`);
      }
      const clean = lyric ? normalizeLrcForPlayer(lyric) : lyric;
      return jsonResponse({ ok: true, lyric: clean, lyricSource });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 200);
    }
  });

  // 兼容别名：直接取宿主原生歌词。统一 /lyric 已包含此逻辑，前端已改为只调 /lyric。
  router.get('/host-lyric', async (req) => {
    try {
      const p = q(req);
      if (!p.songId) return fail('缺少 songId');
      const h = await fetchHostLyric(p.songId, p.refresh === '1' || p.refresh === 'true');
      return jsonResponse({ ok: true, lyric: h.lyric, lyricSource: h.lyricSource });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 200);
    }
  });

  // 宿主歌词提供者：歌曲没有歌词时宿主会调用 /lyric-search。从 source_data 取回音源与曲目 id 拉取上游 LRC。
  // 导入/播放创建歌曲时已把 lyric 直接写进歌曲，本路由主要兜底已存在（无歌词）的歌曲。
  router.get('/lyric-search', async (req) => {
    const p = q(req);
    let sd: any = null;
    try { sd = p.source_data ? JSON.parse(p.source_data) : null; } catch { /* ignore */ }
    const sourceId = (sd && sd.sourceId) || p.sourceId;
    const trackId = (sd && sd.trackId) || p.trackId;
    const title = p.title || (sd && sd.title) || '';
    const artist = p.artist || (sd && sd.artist) || '';
    const l = await resolveLyric({ sourceId, trackId, title, artist });
    if (l) {
      const clean = normalizeLrcForPlayer(l);
      return jsonResponse({ ok: true, lyric: clean, lyrics: clean });
    }
    return jsonResponse({ ok: false, message: '未找到歌词' }, 200);
  });
}
