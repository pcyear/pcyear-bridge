// 道理鱼（Daoliyu Music）适配器
// —— 接口契约据 Flutter 版 app/lib/data/sources/daoliyu/daoliyu_adapter.dart（已真机 192.168.31.28:4000 验证）。
//
// 已实测确认的协议细节：
//  - 登录：POST {root}/api/auth/login  body { username, password } → { token }
//  - 鉴权：所有接口带 Authorization: Bearer <token>（JWT 无 exp，长期有效；401 自动重登）
//  - 数据（base {root}/api）：
//      /library/albums、/library/artists、/tracks
//      /library/albums/{id}（含 tracks[]）、/library/artists/{id}（含 tracks[]）
//      /tracks/{id}（含 lyrics）、/playlists、/playlists/{id}/tracks
//  - 分页：take（每页）/ skip（偏移）；搜索：列表接口加 search= 查询参数
//  - 流：  GET {root}/api/tracks/{id}/stream 需 Bearer（默认转码 mp3，无 Range）
//  - 封面：GET {root}/api/cover?path=<path> 可匿名访问（无需鉴权头）
//          封面字段条件出现：album/artist/track 带 coverArtPath / coverArtUrl，无封面则 null
//  - duration 单位是「秒」，这里与 Track.duration 语义一致（无需换算）
//  - 说明：本适配器为纯新增，不修改任何既有音源逻辑。

import {
  SourceAdapter, SourceConfig, Track, Album, Artist, Playlist, SearchResults, UpstreamRef,
} from '../types';

declare const songloft: any;

interface DyRawTrack {
  id?: string | number;
  title?: string;
  artist?: { id?: string | number; name?: string } | null;
  artistName?: string;
  artistId?: string | number;
  album?: { id?: string | number; title?: string; albumArtist?: string; trackCount?: number; coverArtPath?: string; coverArtUrl?: string } | null;
  albumId?: string | number;
  durationSeconds?: number;
  fileSize?: number;
  fileFormat?: string;
  detectedCodec?: string;
  coverArtPath?: string;
  coverArtUrl?: string;
}

export class DaoliyuAdapter implements SourceAdapter {
  readonly type = 'daoliyu' as const;
  readonly sourceId: string;

  /** 流需 Bearer 鉴权头 + 上游可能自签证书/跨域，统一走插件 /api/upstream-stream 代理（宿主 Go 层直连可能丢头/证书失败） */
  readonly streamViaProxy = true;

  private root: string;       // 服务根（去掉结尾 / 与 /api）
  private apiBase: string;    // root + /api
  private user: string;
  private pass: string;
  private token: string | null = null;
  private loginPromise: Promise<void> | null = null;

  constructor(cfg: SourceConfig) {
    this.sourceId = cfg.id;
    this.root = (cfg.baseUrl || '').replace(/\/api\/?$/, '').replace(/\/+$/, '');
    this.apiBase = this.root + '/api';
    this.user = cfg.username || '';
    this.pass = cfg.password || '';
  }

  // ---------------- 鉴权 ----------------
  private async ensureAuth(): Promise<void> {
    if (this.token) return;
    if (this.loginPromise) return this.loginPromise;
    this.loginPromise = this.login().finally(() => { this.loginPromise = null; });
    return this.loginPromise;
  }

  private async login(): Promise<void> {
    const resp = await fetch(`${this.apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.user, password: this.pass }),
    });
    if (resp.status !== 200) {
      throw new Error(`道理鱼登录失败（HTTP ${resp.status}）`);
    }
    const d: any = await resp.json().catch(() => ({}));
    const t = d && d.token;
    if (!t || typeof t !== 'string' || !t) {
      throw new Error('道理鱼登录未返回 token');
    }
    this.token = t;
  }

  /** 统一 GET：自动带 Bearer；遇 401 重登后重试一次 */
  private async get(path: string, query?: Record<string, any>): Promise<any> {
    await this.ensureAuth();
    for (let attempt = 0; attempt < 2; attempt++) {
      const url = this.buildUrl(path, query);
      const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + this.token } });
      if (resp.status === 401) {
        this.token = null;
        await this.login();
        continue;
      }
      if (resp.status !== 200) {
        throw new Error(`道理鱼请求失败 ${path}（HTTP ${resp.status}）`);
      }
      return resp.json();
    }
    throw new Error(`道理鱼请求失败 ${path}（鉴权重试后仍失败）`);
  }

  private buildUrl(path: string, query?: Record<string, any>): string {
    let url = `${this.apiBase}${path}`;
    if (query) {
      const q = Object.keys(query)
        .filter((k) => query[k] !== undefined && query[k] !== null && query[k] !== '')
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(query[k]))}`)
        .join('&');
      if (q) url += (url.indexOf('?') >= 0 ? '&' : '?') + q;
    }
    return url;
  }

  // ---------------- 封面 ----------------
  private coverPath(m: any): string | null {
    if (m && typeof m === 'object') {
      const p = m.coverArtPath;
      if (typeof p === 'string' && p) return p;
      const url = m.coverArtUrl;
      if (typeof url === 'string' && url) {
        try {
          const u = new URL(url);
          const pv = u.searchParams.get('path');
          if (pv) return pv;
        } catch { /* ignore */ }
      }
    }
    return null;
  }

  /** 把封面原始服务器路径转成可匿名访问的绝对 URL（封面端点无需鉴权） */
  private coverUrlFromPath(path: string | null): string | null {
    if (!path || !path.trim()) return null;
    return `${this.apiBase}/cover?path=${encodeURIComponent(path)}`;
  }

  // ---------------- 映射 ----------------
  private toTrack(m: DyRawTrack): Track {
    const album = m.album || null;
    const artistName = m.artistName
      || (m.artist && typeof m.artist === 'object' ? m.artist.name : null)
      || undefined;
    const coverPath = this.coverPath(m) || this.coverPath(album);
    return {
      id: String(m.id),
      title: m.title || '未知曲目',
      artist: artistName || '未知艺术家',
      album: album && album.title ? album.title : undefined,
      duration: typeof m.durationSeconds === 'number' ? m.durationSeconds : undefined,
      coverId: coverPath ? this.coverUrlFromPath(coverPath)! : undefined,
      size: m.fileSize,
      codec: m.fileFormat || m.detectedCodec,
      _source: this.sourceId,
    } as Track;
  }

  private toAlbum(m: any): Album {
    return {
      id: String(m.id),
      name: m.title || '未知专辑',
      artist: m.albumArtist || undefined,
      trackCount: typeof m.trackCount === 'number' ? m.trackCount : undefined,
      coverId: this.coverPath(m) ? this.coverUrlFromPath(this.coverPath(m)!)! : undefined,
      _source: this.sourceId,
    } as Album;
  }

  private toArtist(m: any): Artist {
    return {
      id: String(m.id),
      name: m.name || '未知艺术家',
      trackCount: typeof m.trackCount === 'number' ? m.trackCount : undefined,
      albumCount: typeof m.albumCount === 'number' ? m.albumCount : undefined,
      coverId: this.coverPath(m) ? this.coverUrlFromPath(this.coverPath(m)!)! : undefined,
      _source: this.sourceId,
    } as Artist;
  }

  private toPlaylist(m: any): Playlist {
    return {
      id: String(m.id),
      name: m.name || '未命名歌单',
      trackCount: typeof m.trackCount === 'number' ? m.trackCount : undefined,
      coverId: this.coverPath(m) ? this.coverUrlFromPath(this.coverPath(m)!)! : undefined,
      _source: this.sourceId,
    } as Playlist;
  }

  private unwrap(r: any, mapper: (x: any) => any): { list: any[]; total: number } {
    const list = (r && r.items) || [];
    const total = (r && typeof r.total === 'number') ? r.total : list.length;
    return { list: list.map(mapper), total };
  }

  // ---------------- 列表 ----------------
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      this.token = null;
      await this.get('/library/albums', { take: 1, skip: 0 });
      return { ok: true, message: '道理鱼连接成功' };
    } catch (e: any) {
      return { ok: false, message: (e && e.message) || String(e) };
    }
  }

  async listTracks(opts: { limit?: number; offset?: number }) {
    const r = await this.get('/tracks', { take: opts.limit || 50, skip: opts.offset || 0 });
    return this.unwrap(r, (t: DyRawTrack) => this.toTrack(t));
  }

  async listAlbums(opts: { limit?: number; offset?: number }) {
    const r = await this.get('/library/albums', { take: opts.limit || 50, skip: opts.offset || 0 });
    return this.unwrap(r, (a: any) => this.toAlbum(a));
  }

  async listArtists(opts: { limit?: number; offset?: number }) {
    const r = await this.get('/library/artists', { take: opts.limit || 50, skip: opts.offset || 0 });
    return this.unwrap(r, (a: any) => this.toArtist(a));
  }

  async listPlaylists(opts: { limit?: number; offset?: number }) {
    const r: any = await this.get('/playlists', { take: opts.limit || 50, skip: opts.offset || 0 });
    const list = Array.isArray(r) ? r : (r && r.items) || [];
    const total = (r && typeof r.total === 'number') ? r.total : list.length;
    return { list: list.map((p: any) => this.toPlaylist(p)), total };
  }

  async albumTracks(albumId: string, opts: { limit?: number; offset?: number }) {
    const r: any = await this.get(`/library/albums/${albumId}`);
    const raw = (r && r.tracks) || [];
    const total = (r && typeof r.trackCount === 'number') ? r.trackCount : raw.length;
    const list = raw.map((t: DyRawTrack) => this.toTrack(t));
    return { list, total };
  }

  async artistTracks(artistId: string, opts: { limit?: number; offset?: number }) {
    const r: any = await this.get(`/library/artists/${artistId}`);
    const raw = (r && r.tracks) || [];
    const total = (r && typeof r.trackCount === 'number') ? r.trackCount : raw.length;
    const list = raw.map((t: DyRawTrack) => this.toTrack(t));
    return { list, total };
  }

  async playlistTracks(playlistId: string, opts: { limit?: number; offset?: number }) {
    const r: any = await this.get(`/playlists/${playlistId}/tracks`, { take: opts.limit || 9999, skip: opts.offset || 0 });
    const list = (r && r.items) || (r && r.tracks) || [];
    const total = (r && typeof r.total === 'number') ? r.total : list.length;
    return { list: list.map((t: DyRawTrack) => this.toTrack(t)), total };
  }

  async search(query: string, opts: { limit?: number; dir?: string }): Promise<SearchResults> {
    const q = (query || '').trim();
    if (!q) return { tracks: [], albums: [], artists: [] };
    const lim = opts.limit || 30;
    const safe = async (p: string, qq: Record<string, any>) => {
      try { return await this.get(p, qq); } catch { return null; }
    };
    const [t, a, ar] = await Promise.all([
      safe('/tracks', { search: q, take: lim, skip: 0 }),
      safe('/library/albums', { search: q, take: lim, skip: 0 }),
      safe('/library/artists', { search: q, take: lim, skip: 0 }),
    ]);
    return {
      tracks: t ? this.unwrap(t, (x: DyRawTrack) => this.toTrack(x)).list : [],
      albums: a ? this.unwrap(a, (x: any) => this.toAlbum(x)).list : [],
      artists: ar ? this.unwrap(ar, (x: any) => this.toArtist(x)).list : [],
    };
  }

  async lyric(trackId: string): Promise<string | null> {
    try {
      const r: any = await this.get(`/tracks/${trackId}`);
      const l = r && r.lyrics;
      return (typeof l === 'string' && l) ? l : null;
    } catch {
      return null;
    }
  }

  async resolveStream(trackId: string): Promise<UpstreamRef> {
    await this.ensureAuth();
    return {
      url: `${this.apiBase}/tracks/${trackId}/stream`,
      headers: { Authorization: 'Bearer ' + this.token },
    };
  }

  async resolveCover(coverId?: string): Promise<UpstreamRef | null> {
    if (!coverId) return null;
    // coverId 已是完整匿名封面 URL（构建时拼成）；若是裸 path 则兜底构造
    const url = /^https?:\/\//i.test(coverId) ? coverId : this.coverUrlFromPath(coverId);
    return url ? { url } : null;
  }

  dispose(): void {
    this.token = null;
    this.loginPromise = null;
  }
}
