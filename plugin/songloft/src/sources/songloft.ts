// SongLoft 本地媒体库适配器：直接把宿主媒体库（songloft.songs / playlists）当做一个音源。
// 列表走宿主 songs.list；专辑/艺术家从全量歌曲聚合；歌单走宿主 playlists。
// 注意：此类歌曲本身已在宿主媒体库，播放时 ensure-songs 直接返回 songId，无需再入库。

import {
  SourceAdapter, SourceConfig, Track, Album, Artist, Playlist, SearchResults, UpstreamRef,
} from '../types';
import { hostBase } from '../lib/cover';
import { AUDIOBOOK_SOURCE_ID } from './audiobook';
import { parseAudioHeadFromUrl } from '../lib/audio-head';
import { fetchWithTimeout, toBytes, getHeader, normalizeLrc } from '../lib/common';

declare const songloft: any;

const PAGE = 500;

/**
 * 本地库封面（宿主 /songs/{id}/cover）下发宽度上限（像素）。
 * 宿主支持 ?w= 参数做服务端缩放压缩（宿主压缩接口），拼上后大封面（如 1.7MB PNG）
 * 会被压成小 JPEG（实测 ?w=200 由 1.7MB → 11KB），显著减小体积、加快加载。
 */
const COVER_MAX_WIDTH = 200;

/** 宿主本地库快照（全量歌曲 + 聚合的专辑/艺术家），带短 TTL 避免频繁全量拉取 */
let libCache: { tracks: Track[]; albums: Album[]; artists: Artist[]; ts: number } | null = null;
const LIB_TTL = 45 * 1000;
// 专辑/艺人封面候选：album.coverId(首歌 id) → 该专辑内有封面的歌 id 列表，供 resolveCoverBytes 缺封面时回退。
const albumCoverCandidatesMap = new Map<string, string[]>();
// 歌曲 → 所属专辑封面候选：song.coverId → 其所属专辑内有封面的歌 id 列表。
// 歌曲 child 在 Subsonic 里用自己的 coverId，无封面即空白；此映射让 resolveCoverBytes 也能回退到同专辑有封面的歌，
// 使 Subsonic 客户端的歌曲列表显示专辑封面（与专辑网格一致）。
const songToAlbumCandidates = new Map<string, string[]>();

// 本地库「排除导入的远程歌曲」开关：从 msm_local_opts 读取，带短缓存避免每次请求都查存储。
let cachedExcludeRemote: boolean | null = null;
let cachedExcludeRemoteTs = 0;
async function excludeRemoteEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cachedExcludeRemote !== null && now - cachedExcludeRemoteTs < LIB_TTL) return cachedExcludeRemote;
  try {
    const raw = await songloft.storage.get('msm_local_opts');
    cachedExcludeRemote = !!(raw && (raw as any).excludeRemote);
  } catch { /* 查询失败则维持上次值 */ }
  cachedExcludeRemoteTs = now;
  return cachedExcludeRemote || false;
}

/** 失效聚合缓存与选项缓存（切换「排除远程歌曲」开关时调用，确保立即生效） */
export function invalidateSongloftLib(): void {
  libCache = null;
  cachedExcludeRemote = null;
  cachedExcludeRemoteTs = 0;
  albumCoverCandidatesMap.clear();
  songToAlbumCandidates.clear();
  cachedLocalRoots = null;
  cachedLocalRootsTs = 0;
}

// 本地库「只显示指定文件夹」：localRootPaths 非空时，本地歌 path 不在这些前缀下的不显示。
let cachedLocalRoots: string[] | null = null;
let cachedLocalRootsTs = 0;
async function localRootPaths(): Promise<string[]> {
  const now = Date.now();
  if (cachedLocalRoots !== null && now - cachedLocalRootsTs < LIB_TTL) return cachedLocalRoots;
  try {
    const raw = await songloft.storage.get('msm_local_opts');
    const rp = raw && (raw as any).localRootPaths;
    cachedLocalRoots = Array.isArray(rp) ? rp.filter((x: any) => typeof x === 'string') : [];
  } catch { /* 查询失败则维持上次值 */ }
  cachedLocalRootsTs = now;
  return cachedLocalRoots || [];
}

export class SongloftAdapter implements SourceAdapter {
  readonly type = 'songloft' as const;
  readonly sourceId: string;

  constructor(cfg: SourceConfig) {
    this.sourceId = cfg.id;
  }

  private async fetchAllSongs(): Promise<Track[]> {
    const all: Track[] = [];
    const excl = await excludeRemoteEnabled();
    const roots = await localRootPaths();
    let offset = 0;
    while (true) {
      const page: any[] = await songloft.songs.list({ limit: PAGE, offset });
      for (const s of page || []) {
        // 「排除远程歌曲」开关：导入进服务端的远程歌曲（type=remote）不计入本地库
        if (excl && s && s.type === 'remote') continue;
        // 有声书桥接记录（type=remote + source_data.sourceId=有声书源）无条件屏蔽：无论开关如何，本地库都不显示有声书
        if (s && s.type === 'remote') {
          let sd: any = (s as any).source_data;
          if (typeof sd === 'string') { try { sd = JSON.parse(sd); } catch { sd = null; } }
          if (sd && sd.sourceId === AUDIOBOOK_SOURCE_ID) continue;
        }
        // 「只显示指定文件夹」：localRootPaths 非空时，本地歌 path 不匹配任一前缀的隐藏。
        // （宿主本地歌带 path 字段；远程歌无 path，不受文件夹过滤影响）
        if (roots.length && s && s.type !== 'remote') {
          const p = String((s as any).file_path || (s as any).path || (s as any).path_relative || (s as any).folder_path || '');
          if (p && !roots.some((rp) => p.startsWith(rp))) continue;
        }
        all.push(toTrack(s));
      }
      if (!page || page.length < PAGE) break;
      offset += page.length;
    }
    return all;
  }

  private async lib(): Promise<{ tracks: Track[]; albums: Album[]; artists: Artist[] }> {
    if (libCache && Date.now() - libCache.ts < LIB_TTL) return libCache;
    const tracks = await this.fetchAllSongs();
    const albums = new Map<string, Album>();
    const artists = new Map<string, Artist>();
    for (const t of tracks) {
      if (t.album) {
        const a = albums.get(t.album);
        if (a) {
          a.trackCount = (a.trackCount || 0) + 1;
          // 用第一首「有封面」的歌作专辑封面：聚合时首歌可能恰好无封面。
          if (!a.coverId && t.coverId) a.coverId = t.coverId;
          // 收集同专辑内有封面的歌 id 列表（按出现顺序），供后端校验封面真实可解析后择优。
          if (t.coverId && !(a as any).coverCandidates?.includes(t.coverId)) {
            ((a as any).coverCandidates ||= []).push(t.coverId);
          }
          // 首曲 host id 作代表封面回退（飞牛式：专辑/艺人无 coverId 时借首曲内嵌封面）。
          if (!(a as any)._rep) (a as any)._rep = t.id;
        } else {
          albums.set(t.album, {
            id: t.album, name: t.album, artist: t.artist,
            coverId: t.coverId, trackCount: 1, _source: this.sourceId, _raw: { from: 'aggregate' },
            ...(t.coverId ? { coverCandidates: [t.coverId] } : {}),
            _rep: t.id,
          } as any);
        }
      }
      if (t.artist) {
        const a = artists.get(t.artist);
        if (a) {
          a.trackCount = (a.trackCount || 0) + 1;
          if (!a.coverId && t.coverId) a.coverId = t.coverId;
          if (t.coverId && !(a as any).coverCandidates?.includes(t.coverId)) {
            ((a as any).coverCandidates ||= []).push(t.coverId);
          }
          // 首曲 host id 作代表封面回退（飞牛式：艺人无 coverId 时借首曲内嵌封面）。
          if (!(a as any)._rep) (a as any)._rep = t.id;
        } else {
          artists.set(t.artist, {
            id: t.artist, name: t.artist,
            coverId: t.coverId, trackCount: 1, _source: this.sourceId, _raw: { from: 'aggregate' },
            ...(t.coverId ? { coverCandidates: [t.coverId] } : {}),
            _rep: t.id,
          } as any);
        }
      }
    }
    // 收集专辑/艺人封面候选，供 resolveCoverBytes 首歌无封面时回退到同专辑有封面的歌。
    for (const a of albums.values()) {
      const cid = (a as any).coverId;
      const cands = (a as any).coverCandidates;
      if (cid && cands && cands.length) albumCoverCandidatesMap.set(String(cid), cands as string[]);
    }
    for (const a of artists.values()) {
      const cid = (a as any).coverId;
      const cands = (a as any).coverCandidates;
      if (cid && cands && cands.length) albumCoverCandidatesMap.set(String(cid), cands as string[]);
    }
    // 歌曲 → 所属专辑封面候选：遍历全量歌曲，把它映射到其专辑的完整候选列表。
    // resolveCoverBytes 对歌曲 coverId 解析无图时，可回退到同专辑有封面的歌，使歌曲列表显示专辑封面。
    const albumNameCands = new Map<string, string[]>();
    for (const a of albums.values()) {
      const cands = (a as any).coverCandidates;
      if (cands && cands.length) albumNameCands.set(a.name, cands as string[]);
    }
    for (const t of tracks) {
      if (t.coverId && t.album && albumNameCands.has(t.album)) {
        songToAlbumCandidates.set(String(t.coverId), albumNameCands.get(t.album)!);
      }
    }
    libCache = {
      tracks,
      albums: [...albums.values()],
      artists: [...artists.values()],
      ts: Date.now(),
    };
    return libCache;
  }

  private slice<T>(list: T[], opts: { limit?: number; offset?: number }): { list: T[]; total: number } {
    const off = opts.offset || 0;
    const lim = opts.limit == null ? list.length : opts.limit;
    return { list: list.slice(off, off + lim), total: list.length };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const r = await songloft.songs.list({ limit: 1 });
      return { ok: true, message: `SongLoft 媒体库可用（${(r || []).length ? '已读取' : '空库'}）` };
    } catch (e: any) {
      return { ok: false, message: (e && e.message) || String(e) };
    }
  }

  async listTracks(opts: { limit?: number; offset?: number }): Promise<{ list: Track[]; total: number }> {
    // 统一走聚合库（已应用「排除远程歌曲」过滤），分页准确、总数真实，
    // 且与专辑/艺术家/搜索三处口径一致；聚合缓存 45s 由 invalidateSongloftLib 强制失效。
    const lib = await this.lib();
    return this.slice(lib.tracks, opts);
  }

  async listAlbums(opts: { limit?: number; offset?: number }): Promise<{ list: Album[]; total: number }> {
    const lib = await this.lib();
    return this.slice(lib.albums, opts);
  }

  async listArtists(opts: { limit?: number; offset?: number }): Promise<{ list: Artist[]; total: number }> {
    const lib = await this.lib();
    return this.slice(lib.artists, opts);
  }

  async listPlaylists(opts: { limit?: number; offset?: number }): Promise<{ list: Playlist[]; total: number }> {
    const pls: any[] = await songloft.playlists.list();
    const list = await Promise.all((pls || []).map(async (p: any) => {
      const item: Playlist = {
        id: String(p.id), name: p.name || '未命名', description: p.description,
        trackCount: p.song_count, _source: this.sourceId, _raw: p,
      };
      // 封面：取播放列表内「封面真实可解析」的歌作歌单封面。download 等本地库歌单的封面是内嵌的，
      // 宿主 /songs/{id}/cover 对无内嵌封面的歌返回 404；旧逻辑只认 cover_url（首曲）会抢到裂图/空候选，
      // 导致歌单封面空白。改为逐首探 host 端点 200+图片类型，挑第一首能出图的（仅探前 12 首，命中即停）。
      try {
        const raw: any = await songloft.playlists.getSongs(Number(p.id));
        const songs: any[] = Array.isArray(raw) ? raw : (raw && (raw.list || raw.songs || raw.data || [])) || [];
        const cid = await this.pickFirstDrawableCoverSong(songs);
        if (cid) item.coverId = cid;
      } catch { /* 封面缺失不阻断列表 */ }
      return item;
    }));
    return this.slice(list, opts);
  }

  /** 在歌单/文件夹的歌曲里挑第一首「封面真实可解析」的歌作封面源（仅本地库歌走 HEAD 探，避免回环死锁）。
   *  本地库歌的封面是内嵌的，宿主 /songs/{id}/cover 对无内嵌封面的歌返回 404；并行探前 limit 首的
   *  200+图片类型，挑第一首（按下标序）能出图的，把墙钟压到单次探测量级，避免列表接口冷加载超时。
   *  兜底退化为首曲（不阻断列表）。 */
  private async pickFirstDrawableCoverSong(songs: any[], limit = 12): Promise<string | undefined> {
    const list = (songs || []).filter((s: any) => s && s.id).slice(0, limit);
    if (!list.length) return undefined;
    // 导入歌（有 source_data 或 type=remote）封面指向外部源/CDN，可信，直接用首曲（不外探，避免回环死锁）。
    const locals = list.filter((s: any) => !s.source_data && s.type !== 'remote');
    if (!locals.length) return String(list[0].id);
    let base = '';
    try { base = (await hostBase()) || ''; } catch { /* ignore */ }
    if (!base) return String(locals[0].id);
    let tk = '';
    try { tk = (await songloft.plugin.getToken()) || ''; } catch { /* ignore */ }
    const checks = locals.map(async (s: any) => {
      const id = String(s.id);
      const url = `${base.replace(/\/+$/, '')}/api/v1/songs/${encodeURIComponent(id)}/cover?access_token=${encodeURIComponent(tk)}`;
      try {
        const h: any = await fetchWithTimeout(url, 2500, { Range: 'bytes=0-0' });
        const ct = getHeader(h, 'Content-Type') || '';
        try { h.body && h.body.cancel && h.body.cancel(); } catch { /* ignore */ }
        return (h.ok && /image\//i.test(ct)) ? id : null;
      } catch { return null; }
    });
    const res = await Promise.all(checks);
    for (let i = 0; i < res.length; i++) if (res[i]) return res[i];
    return String(locals[0].id);
  }

  /** 递归取目录内全部音频（文件夹播放/加入播放列表用，内存全量零成本） */
  async browseDeep(dirPath: string): Promise<{ tracks: Track[] }> {
    const { tracks } = await this.lib();
    const prefix = dirPath ? String(dirPath).replace(/\/+$/, '') + '/' : '';
    const list = prefix
      ? tracks.filter((t) => { const p = String((t as any)._raw?.file_path || t.path || ''); return !!p && p.startsWith(prefix); })
      : tracks;
    return { tracks: list };
  }

  /** 文件夹浏览：返回指定路径（相对宿主曲库根，如 music 或 music/流行）下的子目录与直接音频文件。
   *  dirs 带集合 id（=目录路径）→ 前端 folderCard 走 collections/info 懒加载封面+数量（与有声书/WebDAV 一致） */
  async browse(dirPath: string, opts?: { limit?: number; offset?: number }): Promise<{ dirs: { path: string; name: string; id?: string }[]; tracks: Track[]; total?: number }> {
    const { tracks } = await this.lib();
    const prefix = dirPath ? String(dirPath).replace(/\/+$/, '') + '/' : '';
    const dirMap = new Map<string, string>();
    const files: Track[] = [];
    for (const t of tracks) {
      const p = String((t as any)._raw?.file_path || t.path || '');
      if (!p) continue;
      if (prefix && !p.startsWith(prefix)) continue;
      const rest = prefix ? p.slice(prefix.length) : p;
      const slash = rest.indexOf('/');
      if (slash >= 0) {
        const d = rest.slice(0, slash);
        const full = (prefix + d).replace(/\/+$/, '');
        if (!dirMap.has(d)) dirMap.set(d, full);
      } else if (rest) {
        files.push(t);
      }
    }
    const dirs = [...dirMap.entries()].map(([nm, path]) => ({ name: nm, path, id: path }))
      .sort((x, y) => x.name.localeCompare(y.name));
    // 铁律㉒懒加载：内存过滤后按 limit/offset 切片（dirs 目录少不切片）
    const total = files.length;
    const limit = (opts && opts.limit) || total;
    const offset = (opts && opts.offset) || 0;
    return { dirs, tracks: files.slice(offset, offset + limit), total };
  }

  /** 集合元数据（本地库文件夹卡片懒加载，与有声书/WebDAV 同款）：按 file_path 前缀统计目录内歌曲数 + 取第一首有封面的歌作封面 */
  async collectionInfo(ids: string[]): Promise<Array<{ id: string; name?: string; trackCount?: number; coverId?: string } | null>> {
    const unique = Array.from(new Set((ids || []).filter(Boolean)));
    const { tracks } = await this.lib();
    const out: any[] = [];
    for (const id of unique) {
      try {
        const prefix = String(id).replace(/\/+$/, '') + '/';
        let count = 0;
        let coverId: string | undefined;
        for (const t of tracks) {
          const p = String((t as any)._raw?.file_path || t.path || '');
          if (!p || !p.startsWith(prefix)) continue;
          count++;
          if (!coverId && t.coverId) coverId = t.coverId;
        }
        out.push({ id, name: String(id).split('/').pop() || '', trackCount: count || undefined, coverId });
      } catch { out.push({ id }); }
    }
    return out;
  }

  async albumTracks(albumId: string, opts: { limit?: number; offset?: number }): Promise<{ list: Track[]; total: number }> {
    const lib = await this.lib();
    return this.slice(lib.tracks.filter((t) => t.album === albumId), opts);
  }

  async artistTracks(artistId: string, opts: { limit?: number; offset?: number }): Promise<{ list: Track[]; total: number }> {
    const lib = await this.lib();
    return this.slice(lib.tracks.filter((t) => t.artist === artistId), opts);
  }

  async playlistTracks(playlistId: string, opts: { limit?: number; offset?: number }): Promise<{ list: Track[]; total: number }> {
    const songs: any[] = await songloft.playlists.getSongs(Number(playlistId));
    return this.slice((songs || []).map((s: any) => toTrack(s)), opts);
  }

  async search(query: string, opts: { limit?: number; dir?: string }): Promise<SearchResults> {
    const lim = opts.limit || 30;
    const excl = await excludeRemoteEnabled();
    let tracks: Track[] = [];
    try {
      const hits: any[] = await songloft.songs.search(query);
      tracks = (hits || []).slice(0, lim)
        .filter((s: any) => !(excl && s && s.type === 'remote'))
        .map((s: any) => toTrack(s));
    } catch { /* 宿主搜索失败不阻断，降级为聚合过滤 */ }
    const lib = await this.lib();
    const q = String(query || '').toLowerCase();
    const albums = lib.albums.filter((a) => a.name.toLowerCase().includes(q)).slice(0, lim);
    const artists = lib.artists.filter((a) => a.name.toLowerCase().includes(q)).slice(0, lim);
    return { tracks, albums, artists };
  }

  async resolveStream(trackId: string): Promise<UpstreamRef> {
    const song: any = await songloft.songs.getById(Number(trackId));
    const url = (song && (song.url || song.source_url)) || '';
    return { url, headers: {} };
  }

  async resolveCover(coverId?: string): Promise<UpstreamRef | null> {
    if (!coverId) return null;
    try {
      const song: any = await songloft.songs.getById(Number(coverId));
      // 优先用 source_cover_url（外部源公开封面，如 B 站 CDN，插件可直接 fetch 无需宿主 token）。
      // 注意：宿主可能把 source_cover_url 指回本插件 /cover-img（宿主封面委托），此时跳过避免循环。
      const srcCover = song && song.source_cover_url;
      if (srcCover && /^https?:\/\//i.test(srcCover) && !srcCover.includes('/jsplugin/')) {
        return { url: srcCover, headers: {} };
      }
      let url = song && song.cover_url;
      if (!url) return null;
      // 宿主 cover_url 可能是相对路径（/api/v1/songs/{id}/cover?v=…），补全为绝对地址。
      // 必须用 hostBase()（用户侧可访问基址，lastBase 优先）而非 getHostUrl()（返回 localhost，
      // 宿主 QuickJS fetch localhost 极慢/挂起 → 封面解析超时 no cover）。
      if (url.startsWith('/')) {
        try {
          const host = await hostBase();
          if (host) url = host.replace(/\/+$/, '') + url;
        } catch { /* 保持原样 */ }
      }
      // 宿主 /songs/{id}/cover 是 Go 层代理：CoverURL 指向插件 /cover-img 时宿主会回调插件自身路由，
      // 插件 fetch 它 → 单 worker + env.mu 死锁（实测 10s 超时）。改用 directUrl 让前端浏览器直接加载
      // （带插件 access_token，与宿主界面完全同链路），插件自身不 fetch。
      let tk = '';
      try { tk = (await songloft.plugin.getToken()) || ''; } catch { /* 忽略 */ }
      const sep = url.includes('?') ? '&' : '?';
      // 宿主 /songs/{id}/cover 支持 ?w= 宽度参数做服务端缩放压缩（宿主压缩接口），
      // 拼上宽度上限，避免大封面（如 1.7MB PNG）原样下发，显著减小体积、提速。
      const directUrl = `${url}${sep}access_token=${encodeURIComponent(tk)}&w=${COVER_MAX_WIDTH}`;
      return { url: '', headers: {}, directUrl };
    } catch {
      return null;
    }
  }

  // 封面候选回退：给定某专辑/艺人封面 id（通常是首歌 id），返回同专辑内有封面的歌 id 列表。
  // 当首歌本身无封面（如文件损坏 size=0）时，resolveCoverBytes 可遍历候选择优，避免专辑封面整片空白。
  albumCoverCandidates(coverId?: string): string[] | undefined {
    return coverId ? albumCoverCandidatesMap.get(String(coverId)) : undefined;
  }

  // 歌曲封面候选回退：给定某歌曲封面 id（通常是该歌自身 id），返回其所属专辑内有封面的歌 id 列表。
  // 当该歌曲本身无封面（如文件损坏 size=0）时，resolveCoverBytes 可遍历候选取同专辑其他歌的封面，
  // 使 Subsonic 客户端的歌曲列表也能显示专辑封面，而非整片空白。
  songAlbumCandidates(coverId?: string): string[] | undefined {
    return coverId ? songToAlbumCandidates.get(String(coverId)) : undefined;
  }

  // v1.4.55：本地库歌曲宿主侧无独立封面文件（host /songs/{id}/cover 多返回 404），
  // 故「宿主封面」实为不可用的直链。按封面原则「宿主优先、无则取音频内嵌」，这里实现
  // 内嵌封面提取：从曲目流前 150KB 解析 ID3/FLAC/MP4 内嵌图（与 WebDAV / fnMusic 同款）。
  // 用 localhost 基址让插件同机自取流（可靠、且流是宿主媒体不回环插件，不会死锁；
  // 规避公网 hairpin NAT 导致插件取不到自身公网域名的问题），并带宿主 token 以通过鉴权。
  async resolveEmbeddedCover(trackId?: string): Promise<{ contentType: string; data: Uint8Array } | null> {
    if (!trackId) return null;
    try {
      const song: any = await songloft.songs.getById(Number(trackId));
      let url = (song && (song.url || song.source_url)) || '';
      if (!url) return null;
      // 绝对化：优先用「用户侧基址」hostBase()（如 http://192.168.31.61:58091），
      // 规避 localhost 隔离网络挂起（v1.4.53 已确诊插件 fetch localhost 卡死）与公网 hairpin NAT 超时。
      // 仅当 hostBase 取不到时才回退 127.0.0.1（极端兜底）。
      let base = '';
      try { base = (await hostBase()) || ''; } catch { /* ignore */ }
      if (url.startsWith('/')) {
        if (!base) base = 'http://127.0.0.1:58091';
        url = base.replace(/\/+$/, '') + url;
      } else {
        try {
          const u = new URL(url);
          if (u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '0.0.0.0') {
            if (!base) base = 'http://127.0.0.1:58091';
            url = base.replace(/\/+$/, '') + u.pathname + u.search;
          }
          // 其他绝对地址（已是用户侧可访问域名）保持原样
        } catch { /* 保持原样 */ }
      }
      let tk = '';
      try { tk = (await songloft.plugin.getToken()) || ''; } catch { /* 忽略 */ }
      if (tk) { const sep = url.includes('?') ? '&' : '?'; url += sep + 'access_token=' + encodeURIComponent(tk); }
      const info = await parseAudioHeadFromUrl(url, {});
      return info.art || null;
    } catch {
      return null;
    }
  }

  dispose(): void {
    libCache = null;
  }

  // 歌词：宿主 Song 记录不直接暴露歌词文本，只给 lyric_url / lyric_remote_url（歌词文本地址），
  // 须带宿主 token 再 HTTP 抓取。供 Subsonic getLyricsBySongId / getLyrics 使用，
  // 使箭头音乐等客户端能显示本地库歌曲的歌词（此前 SongloftAdapter 未实现 lyric -> 永远返回空）。
  // v1.4.59.3：补充「同目录同名 .lrc」读取；并把 [ti:]/[ar:]/[al:]/[by:] 等 ID 标签剥掉再返回，
  // 避免客户端（宿主 UI / 箭头音乐）把 ID 标签当普通行显示。
  private lyricCache = new Map<string, { text: string | null; exp: number }>();
  async lyric(trackId: string): Promise<string | null> {
    if (!trackId) return null;
    const now = Date.now();
    const c = this.lyricCache.get(trackId);
    if (c && now < c.exp) return c.text;
    let raw: string | null = null;
    try {
      const song: any = await songloft.songs.getById(Number(trackId));
      if (song) {
        const sAny = song as any;
        // 1) 兜底：个别宿主版本可能直接把歌词文本挂在 song.lyric 上（SDK 类型未声明）
        if (sAny.lyric && String(sAny.lyric).trim()) raw = String(sAny.lyric);
        // 2) 宿主歌词 URL（sidecar .lrc 通常也会被宿主 lyric_url 指向，但部分宿主版本不会）
        if (!raw) {
          const url = song.lyric_url || song.lyric_remote_url;
          if (url) {
            const base = await hostBase();
            const full = url.startsWith('http') ? url : (base + url);
            let token = '';
            try { token = (await songloft.plugin.getToken()) || ''; } catch { /* ignore */ }
            let finalUrl = full;
            if (token) { const sep = finalUrl.includes('?') ? '&' : '?'; finalUrl += `${sep}access_token=${encodeURIComponent(token)}`; }
            const resp = await fetchWithTimeout(finalUrl, 4000);
            if (resp && resp.ok) {
              const text = typeof resp.text === 'function' ? await resp.text() : new TextDecoder().decode(await toBytes(resp));
              const trimmed = (text || '').trim();
              // 兼容 JSON（{lyric:...} / {data:...} / {content:...}）与纯文本两种返回形态
              if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try { const j = JSON.parse(trimmed); raw = j.lyric || j.data || j.content || ''; } catch { raw = text; }
              } else { raw = text; }
            }
          }
        }
        // 3) 同目录同名 .lrc 侧车文件（宿主未索引时兜底读取）
        if (!raw) {
          const lrcPath = this.deriveSidecarLrcPath(song);
          if (lrcPath) {
            try {
              const data = await songloft.fs.readFile(lrcPath, { encoding: 'utf8' });
              if (data && String(data).trim()) raw = String(data);
            } catch { /* 无权限/不存在则忽略 */ }
          }
        }
      }
    } catch { /* ignore */ }
    const text = raw && raw.trim() ? normalizeLrc(raw) : null;
    // 命中缓存 10 分钟，未命中缓存 30 秒，避免慢 lyric_url 反复挂死后端
    this.lyricCache.set(trackId, { text, exp: now + (text ? 1000 * 60 * 10 : 1000 * 30) });
    return text;
  }

  /** 从宿主歌曲的音频路径推导同目录同名 .lrc 文件绝对路径。 */
  private deriveSidecarLrcPath(song: any): string | null {
    if (!song) return null;
    const sAny = song as any;
    let audioPath = String(sAny.file_path || sAny.path || sAny.path_relative || '').trim();
    // 若宿主给的是 file:// URL，转成绝对路径
    if (!audioPath) {
      const src = String(sAny.url || sAny.source_url || '');
      if (src.startsWith('file://')) audioPath = decodeURIComponent(src.slice(7));
    }
    if (!audioPath) return null;
    const dot = audioPath.lastIndexOf('.');
    const lrcPath = (dot > 0 && !audioPath.slice(dot).includes('/')) ? audioPath.slice(0, dot) + '.lrc' : audioPath + '.lrc';
    return lrcPath;
  }

  /** 清除聚合缓存，使用户点「刷新」后重新拉取全量歌曲并重新聚合（封面/统计等） */
  forceRefresh(): void {
    libCache = null;
  }
}

function toTrack(s: any): Track {
  // 宿主本地库 song.duration 单位不统一：常规歌为秒，部分导入批次误存为毫秒
  // （如 204878ms ≈ 205s，实测列表前若干首被渲染成几十小时）。启发式归一化：
  // >10000 秒（≈2.78h）几乎不可能是真实单曲时长，判定为毫秒并 ÷1000。当前库正常秒值
  // 上限远小于此（≤4669s），故不会误伤正常歌曲；极长音频（有声书等）本身不在歌曲列表场景。
  let duration = s.duration;
  if (typeof duration === 'number' && duration > 10000) duration = duration / 1000;
  const t: Track = {
    id: String(s.id),
    // 文件路径：供前端文件夹卡片示波图按「歌曲路径前缀」点亮其所在（及祖先）文件夹。
    // 不携带则文件夹卡片永远匹配不上（path 前缀匹配失效，activeFolderId 兜底又被 applyState 覆盖）。
    path: (s as any).file_path || (s as any).path || (s as any).path_relative || (s as any).folder_path || undefined,
    title: s.title || '未知标题',
    artist: s.artist || '',
    album: s.album || undefined,
    duration: (typeof duration === 'number' && duration > 0) ? duration : undefined,
    year: s.year || undefined,
    coverUrl: s.cover_url || undefined,
    coverId: s.cover_url ? String(s.id) : undefined,
    size: s.file_size || undefined,
    bitrate: s.bit_rate || undefined,
    codec: s.format || undefined,
    _raw: s,
  };
  return t;
}
