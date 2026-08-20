// 导入 / 播放地址解析 / 批量展开路由（从 main.ts 提取）

import { createRouter, jsonResponse } from '@songloft/plugin-sdk';
import { readBody, q, fail, errMsg, embedBasicAuth } from '../lib/common';
import { getConfig, getAdapter, searchAllTracks } from '../manager';
import { coverProxyUrl } from '../lib/cover';
import { buildSourceData, resolveSongsBatch, fetchLyricForImport } from '../lib/import';
import { Track, SourceConfig, MusicSourceData } from '../types';

declare const songloft: any;

type Router = ReturnType<typeof createRouter>;

export function registerImportRoutes(router: Router): void {
  // 读取宿主 SongLoft 的歌单列表，供导入时选择
  router.get('/playlists/songloft', async () => {
    try {
      const list = await songloft.playlists.list();
      return jsonResponse({ ok: true, list });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 200);
    }
  });

  // 把选中的曲目写进宿主歌曲表；之后播放会走 /api/music/url，享受宿主的播放器与歌单能力
  router.post('/import', async (req) => {
    try {
      const body = readBody(req);
      const sid: string = body.sourceId;
      const trackIds: string[] = body.trackIds || [];
      const tracks: Track[] = body.tracks || [];
      if (!sid || (trackIds.length === 0 && tracks.length === 0)) return fail('缺少 sourceId 或 trackIds/tracks');

      const cfg = await getConfig(sid);
      if (!cfg) return fail('未找到音源', 404);

      let found: Track[] = [];

      // 优先使用前端传来的完整曲目数组（适用于专辑/艺术家/歌单整目录导入）
      if (tracks.length) {
        found = tracks;
      } else {
        // 兼容旧版单曲导入：从音源全部曲目里按 ID 查找
        const adapter = await getAdapter(sid);
        const wanted: Record<string, boolean> = {};
        for (const id of trackIds) wanted[id] = true;
        let offset = 0;
        while (found.length < trackIds.length && offset < 5000) {
          const page = await adapter.listTracks({ limit: 200, offset });
          if (page.list.length === 0) break;
          for (const t of page.list) if (wanted[t.id]) found.push(t);
          offset += page.list.length;
          if (page.list.length < 200) break;
        }
      }
      if (found.length === 0) return fail('未找到要导入的曲目');

      const inputs = await Promise.all(found.map(async (t) => {
        // 封面用「宿主可服务端 fetch 的代理 URL」（/cover-img），导入后媒体库与播放器都能显示；
        // 歌词直接写进歌曲 lyric 字段（songs.update 不支持 lyric，故只在 create 阶段写）。
        const coverUrl = await coverProxyUrl(sid, t.coverId);
        const lyric = await fetchLyricForImport(sid, t.id);
        const o: any = {
          title: t.title,
          artist: t.artist,
          album: t.album,
          duration: t.duration,
          sourceData: JSON.stringify(buildSourceData(cfg, t)),
          // 同一音源同一曲目只入库一次
          dedupKey: `multisource-music:${sid}:${t.id}`,
        };
        if (coverUrl) o.coverUrl = coverUrl;
        if (lyric) { o.lyric = lyric; o.lyricSource = 'embedded'; }
        return o;
      }));

      const created = await songloft.songs.create(inputs);
      songloft.log.info(`已导入 ${created.length} 首曲目到媒体库（音源：${cfg.name}）`);

      // 处理歌单：加入已有歌单，或新建歌单
      let playlistId: number | null = body.targetPlaylistId ? Number(body.targetPlaylistId) : null;
      const createName: string | undefined = body.createPlaylistName;
      if (createName && createName.trim()) {
        const pl = await songloft.playlists.create({ name: createName.trim() });
        playlistId = pl.id;
      }
      if (playlistId && created.length) {
        const songIds = created.map((s: any) => s.id).filter((id: any) => typeof id === 'number');
        if (songIds.length) {
          await songloft.playlists.addSongs(playlistId, songIds);
          songloft.log.info(`已将 ${songIds.length} 首曲目加入歌单 #${playlistId}`);
        }
      }

      return jsonResponse({ ok: true, imported: created.length, playlistId, songs: created });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 200);
    }
  });

  // 解析可播放地址：浏览器内联播放 or 走宿主播放器
  router.post('/play-url', async (req) => {
    const body = readBody(req) as any;
    const sid: string = body.sourceId;
    const trackId: string = body.trackId;
    const track: any = body.track || {};
    if (!sid || !trackId) return fail('缺少 sourceId 或 trackId');
    try {
      const cfg = await getConfig(sid);
      if (!cfg) return fail('未找到音源', 404);
      const adapter = await getAdapter(sid);
      const up = await adapter.resolveStream(trackId);

      if (cfg.type === 'webdav') {
        // 浏览器 <audio> 无法自定义请求头，把 Basic 鉴权以 user:pass@host 形式嵌入 URL
        const url = embedBasicAuth(up.url, cfg.username, cfg.password);
        return jsonResponse({ ok: true, scheme: 'direct', url, title: track.title, artist: track.artist });
      }
      if (cfg.type === 'subsonic') {
        // Subsonic 鉴权本就在 query 里（u=/p=/t=/s=），直链即可播放
        return jsonResponse({ ok: true, scheme: 'direct', url: up.url, title: track.title, artist: track.artist });
      }
      // fnMusic 等需要 Cookie/自定义头：浏览器无法带鉴权，交给宿主播放器
      // （宿主在播放导入后的歌曲时会调用 /api/music/url 并带上鉴权头）
      return jsonResponse({
        ok: true,
        scheme: 'host',
        title: track.title,
        artist: track.artist,
        sourceData: buildSourceData(cfg, track as Track),
      });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 200);
    }
  });

  // ============ 批量展开目录/艺术家/歌单为曲目 ============
  router.post('/batch/tracks', async (req) => {
    try {
      const body = readBody(req);
      const sourceId = body.sourceId;
      const items = body.items;
      if (!sourceId || !Array.isArray(items)) return fail('缺少 sourceId 或 items');
      const ad = await getAdapter(sourceId);
      const tracks: Track[] = [];
      for (const it of items) {
        if (!it.kind || !it.id) continue;
        let list: Track[] = [];
        if (it.kind === 'folder') {
          // 文件夹：优先 browseDeep 递归取目录树全部音频（含子目录），否则回退单层 browse
          //（path 由各源 browse 返回的 dirs[].path 直接回传，语义一致）
          const deep = (ad as any).browseDeep;
          if (typeof deep === 'function') {
            const br = await deep.call(ad, it.path || it.id);
            if (br && br.tracks) list = br.tracks;
          } else {
            const br = await (ad as any).browse(it.path || it.id, { limit: 500 });
            if (br && br.tracks) list = br.tracks;
          }
        } else {
          let res: { list: Track[]; total: number } | undefined;
          if (it.kind === 'album') res = await ad.albumTracks(it.id, { limit: 500 });
          else if (it.kind === 'artist') res = await ad.artistTracks(it.id, { limit: 500 });
          else if (it.kind === 'playlist') {
            if (!ad.playlistTracks) continue;
            res = await ad.playlistTracks(it.id, { limit: 500 });
          }
          if (res && res.list) list = res.list;
        }
        if (list.length) tracks.push(...list);
      }
      return jsonResponse({ ok: true, list: tracks });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 500);
    }
  });

  // ============ 播放器桥接：把曲目解析为宿主 SongLoft 歌曲 id ============
  //
  // 前端点击播放时调用本端点，拿到 songId 后用 window.SongloftPlugin.player
  // 把播放交给宿主原生播放器，并订阅 onStateChange 同步状态。
  // 支持单曲（sourceId/trackId/track）或批量（tracks:[{sourceId,trackId,track}]）。
  router.post('/ensure-songs', async (req) => {
    try {
      const body = readBody(req);
      // 诊断：记录 /ensure-songs 收到的原始入参（前端到底提交了什么 source_data）
      try {
        const itemsIn = Array.isArray(body.tracks) ? body.tracks : [{ sourceId: body.sourceId, trackId: body.trackId }];
        await songloft.storage.set('msm_ensuresongs', {
          t: new Date().toISOString().slice(11, 23),
          sourceId: body.sourceId,
          nItems: Array.isArray(body.tracks) ? body.tracks.length : 0,
          first: itemsIn[0] || null,
          raw: body,
        });
      } catch { /* ignore */ }
      const items: { sid: string; trackId: string; track?: any }[] = [];
      if (Array.isArray(body.tracks)) {
        for (const it of body.tracks) items.push({ sid: it.sourceId || body.sourceId, trackId: it.trackId, track: it.track });
      } else if (body.sourceId && body.trackId) {
        items.push({ sid: body.sourceId, trackId: body.trackId, track: body.track });
      } else {
        return fail('缺少 sourceId/trackId 或 tracks');
      }
      // ensure-songs 用于播放桥接：传入可 fetch 的封面代理 URL + 歌词，让宿主媒体库/播放器显示封面与歌词。
      // withCover / withLyric 可由前端控制（默认 true，向后兼容）：「加入播放」走快速路径时传 false，
      // 只解析 songId 不拉封面/歌词，尽快把歌曲加进队列；封面/歌词由前端另发一次请求后台补填。
      const withCover = body.withCover !== false;
      const withLyric = body.withLyric !== false;
      const results = await resolveSongsBatch(items, withCover, withLyric);
      return jsonResponse({ ok: true, results, songIds: results.map((r) => r.songId) });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 200);
    }
  });
}
