// 插件 UI 搜索路由（从 main.ts 提取）

import { createRouter, jsonResponse } from '@songloft/plugin-sdk';
import { q } from '../lib/common';
import { listEndpoint, decorate, stripCands, decorateCollections, pickResolvableCover } from './library';
import { Track } from '../types';

type Router = ReturnType<typeof createRouter>;

export function registerSearchRoutes(router: Router): void {
  router.get('/search', (req) => listEndpoint(req, async (ad, sid, limit) => {
    const kw = q(req).q;
    if (!kw) throw new Error('缺少查询关键词 q');
    const dir = q(req).dir || '';
    const r = await ad.search(kw, { limit, dir });
    // 专辑/艺术家集合封面：songloft 聚合源 coverId 是宿主歌曲 id，须逐条反查宿主；
    // 其余源 coverId 即集合 id（目录路径，webdav 用「艺术家||专辑」、fnMusic/subsonic 用各自 id），
    // 直接当 coverId 下发，由前端按需请求 /cover-data 解析，列表阶段零网络。
    const isSongloft = (ad && ad.type) === 'songloft';
    const albums = isSongloft
      ? await Promise.all(r.albums.map(async (a: any) => ({ ...stripCands(a), sourceId: sid, coverId: (await pickResolvableCover(a, sid)) || undefined, coverUrl: '' })))
      : r.albums.map((a: any) => ({ ...stripCands(a), sourceId: sid, coverId: a.coverId || a.id || undefined, coverUrl: '' }));
    const artists = isSongloft
      ? await Promise.all(r.artists.map(async (a: any) => ({ ...stripCands(a), sourceId: sid, coverId: (await pickResolvableCover(a, sid)) || undefined, coverUrl: '' })))
      : r.artists.map((a: any) => ({ ...stripCands(a), sourceId: sid, coverId: a.coverId || a.id || undefined, coverUrl: '' }));
    return {
      tracks: r.tracks.map((t: Track) => decorate(sid, t)),
      albums,
      artists,
    };
  }, true));
}
