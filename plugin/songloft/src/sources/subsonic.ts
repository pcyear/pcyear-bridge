// Subsonic 兼容适配器（Navidrome / Airsonic / Gonic / Astiga 等）
//
// 协议：Subsonic REST API 1.16.1
//  - 鉴权：u=<user>&t=md5(password+salt)&s=<salt>&v=1.16.1&c=<client>&f=json
//  - 响应包在 { "subsonic-response": { status, version, ... } } 内
//  - 流：/rest/stream?id=<id>（带鉴权 query，无需额外 header）
//  - 封面：/rest/getCoverArt?id=<coverArt>
//
// 注意：Subsonic 的鉴权在 query 里，所以 resolveStream 直接返回带签名的完整 URL，
// 宿主拿去代理即可，不需要自定义请求头。

import { md5, randomSalt } from '../crypto';
import { parseAudioHeadFromUrl } from '../lib/audio-head';
import {
  SourceAdapter, SourceConfig, Track, Album, Artist, Playlist, SearchResults, UpstreamRef,
} from '../types';

const API_VERSION = '1.16.1';
const CLIENT_NAME = 'songloft-multisource';

export class SubsonicAdapter implements SourceAdapter {
  readonly type = 'subsonic' as const;
  readonly sourceId: string;

  private cfg: SourceConfig;
  private rest: string;
  private folderIds: string[];   // 选中的音乐库 ID（rootPaths）

  constructor(cfg: SourceConfig) {
    this.cfg = cfg;
    this.sourceId = cfg.id;
    const base = (cfg.baseUrl || '').replace(/\/+$/, '').replace(/\/rest$/, '');
    this.rest = `${base}/rest`;
    const raw = (cfg.rootPaths && cfg.rootPaths.length) ? cfg.rootPaths : (cfg.rootPath ? [cfg.rootPath] : []);
    this.folderIds = raw.map(String);
  }

  /** 每次请求生成新 salt，避免重放 */
  private authQuery(): string {
    const salt = randomSalt(12);
    const token = md5((this.cfg.password || '') + salt);
    return [
      `u=${encodeURIComponent(this.cfg.username || '')}`,
      `t=${token}`,
      `s=${salt}`,
      `v=${API_VERSION}`,
      `c=${CLIENT_NAME}`,
    ].join('&');
  }

  // withFmt=false 用于二进制端点（getCoverArt）：Subsonic 规范二进制端点不应带 f=json，
  // 部分严格实现（Airsonic/Gonic/老版 Navidrome）会对带 f=json 的 getCoverArt 返回 JSON 而非图片 → 封面失败。
  private url(method: string, params?: Record<string, any>, withFmt = true): string {
    let u = `${this.rest}/${method}?${this.authQuery()}`;
    if (withFmt) u += '&f=json';
    if (params) {
      for (const k of Object.keys(params)) {
        const v = params[k];
        if (v === undefined || v === null || v === '') continue;
        u += `&${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`;
      }
    }
    return u;
  }

  private async call<T = any>(method: string, params?: Record<string, any>): Promise<any> {
    const resp = await fetch(this.url(method, params), { method: 'GET' });
    let json: any = null;
    try { json = await resp.json(); } catch {
      throw new Error(`Subsonic 返回非 JSON 响应（HTTP ${resp.status}，${method}）`);
    }
    const sr = json['subsonic-response'];
    if (!sr) throw new Error(`Subsonic 响应格式异常（${method}）`);
    if (sr.status !== 'ok') {
      const err = sr.error || {};
      throw new Error(`Subsonic 错误 ${err.code || ''}：${err.message || '未知错误'}`);
    }
    return sr;
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const sr = await this.call('ping');
      const type = sr.type ? `${sr.type} ` : '';
      return { ok: true, message: `连接成功（${type}Subsonic API ${sr.version || API_VERSION}）` };
    } catch (e: any) {
      return { ok: false, message: (e && e.message) || String(e) };
    }
  }

  /** 列出音乐库（一层），path 参数忽略（Subsonic 音乐库无层级）。
   *  不再默认取歌曲数（v1.2.21 起改为前端按需调用 countSongsIn）。 */
  async listDirectories(_path?: string): Promise<{ path: string; name: string; count?: number }[]> {
    try {
      const sr = await this.call('getMusicFolders');
      const folders = (sr.musicFolders && sr.musicFolders.musicFolder) || [];
      return folders.map((f: any) => ({ path: String(f.id), name: f.name || ('音乐库 ' + f.id) }));
    } catch { return []; }
  }

  /** 递归统计某音乐库（或目录 id）下的歌曲总数，前端「加载数量」按需触发。
   *  有界递归 + 截止时间保护，避免超大音乐库把单线程后端卡死。 */
  async countSongsIn(path: string): Promise<number> {
    const deadline = Date.now() + 8000;
    const stack: string[] = [String(path)];
    let total = 0;
    const MAX = 5000;
    while (stack.length > 0) {
      if (Date.now() > deadline) break;
      if (total >= MAX) break;
      const id = stack.pop() as string;
      let dsr: any;
      try { dsr = await this.call('getMusicDirectory', { id }); } catch { continue; }
      const children = (dsr.directory && dsr.directory.child) || [];
      for (const c of children) {
        if (c.isDir) stack.push(String(c.id));
        else total++;
      }
    }
    return total;
  }

  // ---------------- 映射 ----------------
  private mapTrack = (s: any): Track => ({
    id: String(s.id),
    title: s.title || '未知曲目',
    artist: s.artist || '未知艺术家',
    album: s.album,
    albumArtist: s.albumArtist,
    // Subsonic 的 duration 本来就是秒
    duration: typeof s.duration === 'number' ? s.duration : undefined,
    trackNo: s.track,
    discNo: s.discNumber,
    year: s.year,
    coverId: s.coverArt ? String(s.coverArt) : undefined,
    size: s.size,
    bitrate: s.bitRate ? s.bitRate * 1000 : undefined,
    codec: s.suffix,
    path: s.path,
    _source: this.sourceId,
    _raw: s,
  });

  private mapAlbum = (a: any): Album => ({
    id: String(a.id),
    name: a.name || a.album || '未知专辑',
    artist: a.artist,
    year: a.year,
    coverId: a.coverArt ? String(a.coverArt) : undefined,
    trackCount: a.songCount,
    _source: this.sourceId,
  });

  private mapArtist = (a: any): Artist => ({
    id: String(a.id),
    name: a.name || '未知艺术家',
    coverId: a.coverArt ? String(a.coverArt) : undefined,
    albumCount: a.albumCount,
    _source: this.sourceId,
  });

  private mapPlaylist = (p: any): Playlist => ({
    id: String(p.id),
    name: p.name || '未命名歌单',
    description: p.comment,
    coverId: p.coverArt ? String(p.coverArt) : undefined,
    trackCount: p.songCount,
    _source: this.sourceId,
  });

  // ---------------- 列表 ----------------
  // Subsonic 没有"全部曲目"接口，用 search3 空关键词 + 分页近似
  async listTracks(opts: { limit?: number; offset?: number }) {
    const limit = opts.limit || 50;
    const offset = opts.offset || 0;
    if (this.folderIds.length) {
      // 多音乐库：逐个 search3（musicFolderId）合并（search3 只接受一个 folderId）
      const list: Track[] = [];
      for (const fid of this.folderIds) {
        try {
          const sr = await this.call('search3', {
            query: '', songCount: limit, songOffset: 0, musicFolderId: fid,
            artistCount: 0, albumCount: 0,
          });
          const songs = ((sr.searchResult3 && sr.searchResult3.song) || []).map(this.mapTrack);
          list.push(...songs);
          if (list.length >= limit) break;
        } catch { /* 跳过失败的音乐库 */ }
      }
      const sliced = list.slice(0, limit);
      return { list: sliced, total: offset + sliced.length + (sliced.length === limit ? limit : 0) };
    }
    const sr = await this.call('search3', {
      query: '', songCount: limit, songOffset: offset,
      artistCount: 0, albumCount: 0,
    });
    const list = ((sr.searchResult3 && sr.searchResult3.song) || []).map(this.mapTrack);
    // 上游不返回总数，用"取满即可能有下一页"来推断
    return { list, total: offset + list.length + (list.length === limit ? limit : 0) };
  }

  async listAlbums(opts: { limit?: number; offset?: number }) {
    const limit = opts.limit || 50;
    const offset = opts.offset || 0;
    const sr = await this.call('getAlbumList2', { type: 'alphabeticalByName', size: limit, offset });
    const list = ((sr.albumList2 && sr.albumList2.album) || []).map(this.mapAlbum);
    return { list, total: offset + list.length + (list.length === limit ? limit : 0) };
  }

  async listArtists(opts: { limit?: number; offset?: number }) {
    const sr = await this.call('getArtists');
    const indexes = (sr.artists && sr.artists.index) || [];
    let all: Artist[] = [];
    for (const idx of indexes) {
      all = all.concat((idx.artist || []).map(this.mapArtist));
    }
    const offset = opts.offset || 0;
    const limit = opts.limit || 50;
    return { list: all.slice(offset, offset + limit), total: all.length };
  }

  async listPlaylists(opts: { limit?: number; offset?: number }) {
    const sr = await this.call('getPlaylists');
    const all = ((sr.playlists && sr.playlists.playlist) || []).map(this.mapPlaylist);
    const offset = opts.offset || 0;
    const limit = opts.limit || 50;
    return { list: all.slice(offset, offset + limit), total: all.length };
  }

  async albumTracks(albumId: string, _opts: { limit?: number; offset?: number }) {
    const sr = await this.call('getAlbum', { id: albumId });
    const list = ((sr.album && sr.album.song) || []).map(this.mapTrack);
    return { list, total: list.length };
  }

  async artistTracks(artistId: string, _opts: { limit?: number; offset?: number }) {
    // 先取艺术家下的专辑，再逐个取曲目
    const sr = await this.call('getArtist', { id: artistId });
    const albums = (sr.artist && sr.artist.album) || [];
    let list: Track[] = [];
    for (const al of albums.slice(0, 20)) {
      try {
        const a = await this.call('getAlbum', { id: al.id });
        list = list.concat(((a.album && a.album.song) || []).map(this.mapTrack));
      } catch { /* 跳过失败的专辑 */ }
    }
    return { list, total: list.length };
  }

  async playlistTracks(playlistId: string, _opts: { limit?: number; offset?: number }) {
    const sr = await this.call('getPlaylist', { id: playlistId });
    const list = ((sr.playlist && sr.playlist.entry) || []).map(this.mapTrack);
    return { list, total: list.length };
  }

  // ---------------- 上游歌单增改删（Subsonic REST 1.16.1）----------------
  async createPlaylist(name: string, trackIds?: string[]): Promise<Playlist> {
    const params: Record<string, any> = { name: name || '未命名歌单' };
    if (trackIds && trackIds.length) params.songId = trackIds;
    const sr = await this.call('createPlaylist', params);
    const p = (sr.playlist) || {};
    return this.mapPlaylist(p);
  }

  async updatePlaylist(playlistId: string, opts: { name?: string; trackIdsToAdd?: string[]; trackIdsToRemove?: string[] }): Promise<void> {
    const params: Record<string, any> = { playlistId };
    if (opts.name !== undefined) params.name = opts.name;
    if (opts.trackIdsToAdd && opts.trackIdsToAdd.length) params.songIdToAdd = opts.trackIdsToAdd;
    if (opts.trackIdsToRemove && opts.trackIdsToRemove.length) params.songIdToRemove = opts.trackIdsToRemove;
    await this.call('updatePlaylist', params);
  }

  async deletePlaylist(playlistId: string): Promise<void> {
    await this.call('deletePlaylist', { id: playlistId });
  }

  async search(query: string, opts: { limit?: number; dir?: string }): Promise<SearchResults> {
    const lim = opts.limit || 30;
    const half = Math.max(5, Math.ceil(lim / 2));
    const sr = await this.call('search3', {
      query, songCount: lim, albumCount: half, artistCount: half,
    });
    const r = sr.searchResult3 || {};
    return {
      tracks: (r.song || []).map(this.mapTrack),
      albums: (r.album || []).map(this.mapAlbum),
      artists: (r.artist || []).map(this.mapArtist),
    };
  }

  async lyric(trackId: string): Promise<string | null> {
    // 先拿歌曲详情：需要 artist/title 用于旧 getLyrics，也用于读取部分服务端内联的歌词字段
    let song: any = null;
    try {
      const sr = await this.call('getSong', { id: trackId });
      song = sr && sr.song;
    } catch { /* 部分服务端可能没 getSong，继续用其他方式 */ }

    const artist = (song && (song.artist || song.displayArtist)) || '';
    const title = (song && (song.title || song.displayTitle)) || '';

    // 1) 部分服务端直接在 getSong / search3 里返回内联歌词（参考官方 subsonic 插件的 lyricUrl/lyric 字段）
    let inline = (song && (song.lyrics || song.lyric || song.lyricContent)) || '';
    if (inline && String(inline).trim()) return String(inline).trim();

    // 2) getLyricsBySongId 是 OpenSubsonic 扩展，优先尝试（可返回同步歌词）
    try {
      const sr = await this.call('getLyricsBySongId', { id: trackId });
      const text = this.parseStructuredLyrics(sr);
      if (text) return text;
    } catch { /* 回落到旧接口 */ }

    // 3) 旧 getLyrics 必须传 artist + title（标准 Subsonic 参数），传 id 会被服务端忽略/报错。
    // 箭头音乐等旧客户端只走这条，因此是重点修复点。
    if (artist && title) {
      try {
        const sr2 = await this.call('getLyrics', { artist, title });
        const val = sr2.lyrics && (sr2.lyrics.value || sr2.lyrics._content);
        if (val) return String(val).trim();
      } catch { /* ignore */ }
    }

    return null;
  }

  /** 解析 OpenSubsonic structuredLyrics：兼容 lyricsList / structuredLyrics / line / value 多种形态 */
  private parseStructuredLyrics(sr: any): string | null {
    if (!sr) return null;
    const list = sr.lyricsList || sr.lyrics;
    if (!list) return null;
    const structured = list.structuredLyrics || list;
    const entries = Array.isArray(structured) ? structured : (structured ? [structured] : []);
    for (const entry of entries) {
      const lines = entry.line || entry.lines || entry.content;
      const arr = Array.isArray(lines) ? lines : (lines ? [lines] : []);
      if (!arr.length) continue;
      const synced = entry.synced !== false;
      const out = arr.map((ln: any) => {
        const value = typeof ln === 'string' ? ln : (ln.value || ln.text || ln.content || '');
        if (!synced || typeof ln.start !== 'number') return value;
        const total = Math.floor(ln.start / 10) / 100; // ms → 秒（两位小数）
        const mm = String(Math.floor(total / 60)).padStart(2, '0');
        const ss = (total % 60).toFixed(2).padStart(5, '0');
        return `[${mm}:${ss}]${value}`;
      });
      return out.join('\n');
    }
    // 兜底纯文本 value
    const plain = (sr.lyrics && (sr.lyrics.value || sr.lyrics._content)) ||
                  (list.value || list._content);
    return plain ? String(plain).trim() : null;
  }

  // ---------------- 上游解析 ----------------
  // 鉴权在 query 里，无需自定义头
  async resolveStream(trackId: string): Promise<UpstreamRef> {
    return { url: this.url('stream', { id: trackId }), headers: {} };
  }

  async resolveCover(coverId?: string): Promise<UpstreamRef | null> {
    if (!coverId) return null;
    // 二进制端点不加 f=json（见 url() 注释）
    return { url: this.url('getCoverArt', { id: coverId, size: 512 }, false), headers: {} };
  }

  /** v1.4.13：音源自定义封面缺失时，用曲目流 URL 抓文件头解析内嵌封面（Range 150KB + APIC 二次抓取 + ID3）。
   *  前提：coverId 恰好是曲目 id（前端 cover-data 传曲目 id 时成立）；音源 API 的封面/标题/作者仍优先。 */
  async resolveEmbeddedCover(trackId?: string): Promise<{ contentType: string; data: Uint8Array } | null> {
    if (!trackId) return null;
    try {
      const { url, headers } = await this.resolveStream(trackId);
      const info = await parseAudioHeadFromUrl(url, headers);
      return info.art || null;
    } catch {
      return null;
    }
  }
}
