// GEAK / yomtime NAS 音乐适配器
// 登录：方法 B 无头登录
//   1) GET {base}/v1/nas/ping（无鉴权）→ data.serial_number
//   2) 派生密钥 key16 = MD5(serial + "|i_love_yomtime").hex().substring(8, 24)
//   3) 密码 = base64(XXTEA(utf8(password), utf8(key16)))
//   4) POST {base}/v1/nas/login → data.token（nas_token）
// 鉴权：请求头 Yom-Nas-Authorization；流/封面用 ?yom_nas_authorization= 查询参数（播放器无法自定义头）
// 目录（/api/directories）即歌单；曲目带 directory_id 归属某目录。
import { md5 } from '../crypto';
import { SourceAdapter, SourceConfig, Track, Album, Artist, Playlist, SearchResults, UpstreamRef } from '../types';

// sidecar .lrc 读取缓存：基于文件 mtime 感知变化。
// 文件内容没改就复用上次读取（避免宿主前端重复请求时反复整文件读取），
// 文件被修改（mtime 变化）则立即重读，保证用户改了歌词后能即时刷新。
const lrcStatCache = new Map<string, { mtime: number; text: string | null }>();
function fileMtimeMs(st: any): number {
  if (!st) return 0;
  if (typeof st.mtimeMs === 'number') return st.mtimeMs;
  if (st.mtime && typeof st.mtime.getTime === 'function') return st.mtime.getTime();
  if (typeof st.mtime === 'number') return st.mtime;
  return 0;
}

// ---------------- XXTEA（与 yomtime 客户端一致，已真机验证）----------------
const XXTEA_DELTA = 0x9E3779B9;

function utf8Bytes(str: string): Uint8Array {
  const out: number[] = [];
  for (let o = 0; o < str.length; o++) {
    let i = str.charCodeAt(o);
    if (i < 128) out.push(i);
    else if (i < 2048) out.push(192 | (i >> 6), 128 | (i & 63));
    else if (i < 55296 || i > 57343) out.push(224 | (i >> 12), 128 | (i >> 6 & 63), 128 | (i & 63));
    else {
      if (o + 1 < str.length) {
        const l = str.charCodeAt(o + 1);
        if (i < 56320 && 56320 <= l && l <= 57343) {
          const c = ((i & 1023) << 10 | l & 1023) + 65536;
          out.push(240 | (c >> 18), 128 | (c >> 12 & 63), 128 | (c >> 6 & 63), 128 | (c & 63));
          o++;
          continue;
        }
      }
      out.push(224 | (i >> 12), 128 | (i >> 6 & 63), 128 | (i & 63));
    }
  }
  return Uint8Array.from(out);
}

function toUint32(bytes: Uint8Array, lenPrefixed: boolean): Uint32Array {
  const n = bytes.length;
  let a = n >> 2;
  if (n & 3) a++;
  const o = lenPrefixed ? new Uint32Array(a + 1) : new Uint32Array(a);
  if (lenPrefixed) o[a] = n;
  for (let i = 0; i < n; i++) o[i >> 2] |= bytes[i] << ((i & 3) << 3);
  return o;
}

function fromUint32(u: Uint32Array): Uint8Array {
  const a = u.length << 2;
  const out = new Uint8Array(a);
  for (let l = 0; l < a; l++) out[l] = (u[l >> 2] >>> ((l & 3) << 3)) & 0xFF;
  return out;
}

function padKey16(keyBytes: Uint8Array): Uint8Array {
  if (keyBytes.length >= 16) return keyBytes.slice(0, 16);
  const t = new Uint8Array(16);
  t.set(keyBytes);
  return t;
}

function xxteaMx(sum: number, z: number, y: number, r: number, c: number, key: Uint32Array): number {
  return ((y >>> 5) ^ (z << 2)) + ((z >>> 3) ^ (y << 4)) ^ (sum ^ z) + (key[(r & 3) ^ c] ^ y);
}

function xxteaEncrypt(v: Uint32Array, key: Uint32Array): Uint32Array {
  const n = v.length;
  if (n < 2) return v;
  let y = v[n - 1];
  let sum = 0;
  const rounds = Math.floor(6 + 52 / n);
  for (let u = rounds; u > 0; u--) {
    sum = (sum + XXTEA_DELTA) | 0;
    const e = (sum >>> 2) & 3;
    for (let r = 0; r < n - 1; r++) {
      const z = v[r + 1];
      v[r] = (v[r] + xxteaMx(sum, z, y, r, e, key)) | 0;
      y = v[r];
    }
    const z0 = v[0];
    v[n - 1] = (v[n - 1] + xxteaMx(sum, z0, y, n - 1, e, key)) | 0;
    y = v[n - 1];
  }
  return v;
}

function xxteaEncryptBytes(plain: Uint8Array, key: Uint8Array): Uint8Array {
  return fromUint32(xxteaEncrypt(toUint32(plain, true), toUint32(padKey16(key), false)));
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  if (typeof btoa === 'function') return btoa(bin);
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
    out += CHARS[b0 >> 2];
    out += CHARS[((b0 & 3) << 4) | (b1 !== undefined ? b1 >> 4 : 0)];
    out += b1 !== undefined ? CHARS[((b1 & 15) << 2) | (b2 !== undefined ? b2 >> 6 : 0)] : '=';
    out += b2 !== undefined ? CHARS[b2 & 63] : '=';
  }
  return out;
}

function deriveKey(serial: string): string {
  return md5(serial + '|i_love_yomtime').substring(8, 24);
}

function encryptPassword(password: string, serial: string): string {
  const key16 = deriveKey(serial);
  return bytesToBase64(xxteaEncryptBytes(utf8Bytes(password), utf8Bytes(key16)));
}

interface GeakRawTrack {
  id?: string | number; title?: string; artist?: string; album?: string;
  duration?: number; path?: string; cover_path?: string; cover_url?: string; directory_id?: string | number;
  favorite?: boolean;
}

export class GeakAdapter implements SourceAdapter {
  readonly type = 'geak' as const;
  readonly sourceId: string;
  // GEAK 上游流地址宿主媒体层无法直连（自签/跨域证书、鉴权头），改为走插件 /api/upstream-stream 代理
  readonly streamViaProxy = true;

  private cfg: SourceConfig;
  private baseUrl: string;
  private nasBase: string;
  private musicBase: string;
  private token: string | null = null;
  private loginPromise: Promise<void> | null = null;
  private trackCache = new Map<string, { filePath?: string; songId: string }>();

  constructor(cfg: SourceConfig) {
    this.cfg = cfg;
    this.sourceId = cfg.id;
    const raw = (cfg.baseUrl || '').trim().replace(/\/+$/, '');
    this.baseUrl = raw || 'http://localhost';
    this.nasBase = this.baseUrl + '/v1/nas';
    this.musicBase = this.baseUrl + '/v1/music';
  }

  private authHeaders(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.token) h['Yom-Nas-Authorization'] = this.token;
    if (extra) Object.assign(h, extra);
    return h;
  }

  private loginMethod(): number {
    const host = this.baseUrl.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ? 0 : 2;
  }

  private login(): Promise<void> {
    if (this.loginPromise) return this.loginPromise;
    this.loginPromise = (async () => {
      const pingResp = await fetch(`${this.nasBase}/ping`, { method: 'GET' });
      const ping: any = await pingResp.json().catch(() => ({}));
      const serial = ping && ping.data && ping.data.serial_number;
      if (!serial) throw new Error('GEAK 连接失败：ping 未返回 serial_number（请检查地址是否为 GEAK/yomtime 服务）');
      const enc = encryptPassword(this.cfg.password || '', serial);
      const body = {
        keepLoggedIn: false,
        direct_ip_login: { account: this.cfg.username || '', geak_id: '', password: enc, method: this.loginMethod() },
      };
      const resp = await fetch(`${this.nasBase}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: any = await resp.json().catch(() => ({}));
      if (data && data.code === 0 && data.data && data.data.token) {
        this.token = data.data.token;
        return;
      }
      throw new Error(`GEAK 登录失败：${data && (data.message || data.reason) || ('code=' + (data && data.code)) || '未知错误'}`);
    })();
    this.loginPromise.catch(() => { /* 交由调用方处理 */ }).then(() => { this.loginPromise = null; });
    return this.loginPromise;
  }

  async ensureToken(): Promise<void> {
    if (!this.token) await this.login();
  }

  private buildUrl(path: string, query?: Record<string, any>): string {
    let url = `${this.musicBase}${path}`;
    if (query) {
      const q = Object.keys(query)
        .filter((k) => query[k] !== undefined && query[k] !== null && query[k] !== '')
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(query[k]))}`)
        .join('&');
      if (q) url += (url.indexOf('?') >= 0 ? '&' : '?') + q;
    }
    return url;
  }

  private async req<T = any>(method: string, path: string, opts: { query?: Record<string, any>; body?: any; retry?: boolean } = {}): Promise<T> {
    await this.ensureToken();
    const url = this.buildUrl(path, opts.query);
    const headers = this.authHeaders(opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined);
    const resp = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    if (resp.status === 401 && !opts.retry) {
      this.token = null;
      return this.req<T>(method, path, { ...opts, retry: true });
    }
    let data: any = null;
    try { data = await resp.json(); } catch {
      throw new Error(`GEAK 返回了非 JSON 响应（HTTP ${resp.status}，路径 ${path}）`);
    }
    if (data && data.code !== undefined && data.code !== 0) {
      if (!opts.retry && (data.code === 401 || data.code === 100003)) {
        this.token = null;
        return this.req<T>(method, path, { ...opts, retry: true });
      }
      throw new Error(`GEAK 接口错误：${data.message || data.reason || ('code=' + data.code)}（${path}）`);
    }
    return data as T;
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      this.token = null;
      await this.login();
      return { ok: true, message: 'GEAK 连接成功，已登录' };
    } catch (e: any) {
      return { ok: false, message: (e && e.message) || String(e) };
    }
  }

  private mapTrack(t: GeakRawTrack): Track {
    const id = String(t.id != null ? t.id : '');
    // GEAK 曲目封面来源优先级（取自 GEAK web bundle 的 cover 解析逻辑）：
    //   1) cover_url —— 远程封面地址（如 iTunes/mzstatic 缩略图），多数歌曲有；
    //   2) cover_path —— NAS 内部封面文件路径，/api/cover?path= 取；
    //   3) 均无则无封面（不再回退 file_path，否则 /api/cover?path=<mp3> 会返回整首音频或 502）。
    const coverId = t.cover_url || t.cover_path || undefined;
    const track: Track = {
      id,
      title: t.title || '未知曲目',
      artist: t.artist || '未知艺术家',
      album: t.album || undefined,
      // GEAK 的 duration 单位是毫秒（实测 244728 ≈ 4:05），统一归一化为秒（对齐 fnMusic / SongLoft Song.duration）
      duration: typeof t.duration === 'number' ? (t.duration > 1000 ? Math.round(t.duration / 1000) : t.duration) : undefined,
      coverId,
      path: t.file_path || t.path,
      _source: this.sourceId,
    };
    this.trackCache.set(id, { filePath: t.file_path || t.path, songId: id });
    return track;
  }

  private mapDir(d: any): { id: string; name: string; trackCount?: number } {
    return {
      id: String(d.id != null ? d.id : (d.path || '')),
      name: d.name || '未命名',
      trackCount: d.song_count != null ? d.song_count : undefined,
    };
  }

  private unwrap<T>(r: any, mapper: (x: any) => T): { list: T[]; total: number } {
    const list = (r && r.data && r.data.list) || [];
    const total = (r && r.data && typeof r.data.total === 'number') ? r.data.total : list.length;
    return { list: list.map(mapper), total };
  }

  // ---------- GEAK 全量曲目缓存 + 挂载根路径 ----------
  // GEAK 没有独立的「专辑/艺术家/文件夹」列表接口：专辑名来自曲目 album 字段，
  // 文件夹树来自曲目 file_path，艺术家来自曲目 artist 字段。故统一拉全量曲目派生。
  private _songsCache: { at: number; list: GeakRawTrack[] } | null = null;
  private async allSongs(force = false): Promise<GeakRawTrack[]> {
    if (this._songsCache && !force && Date.now() - this._songsCache.at < 30000) return this._songsCache.list;
    const out: GeakRawTrack[] = [];
    let page = 1;
    const size = 200;
    for (let guard = 0; guard < 500; guard++) {
      const r: any = await this.req('GET', '/api/songs', { query: { page, page_size: size } });
      const list: GeakRawTrack[] = (r && r.data && r.data.list) || [];
      for (const t of list) out.push(t);
      const total = (r && r.data && typeof r.data.total === 'number') ? r.data.total : list.length;
      if (!list.length || out.length >= total) break;
      page++;
    }
    this._songsCache = { at: Date.now(), list: out };
    return out;
  }

  private _mountPath: string | null = null;
  private async mountPath(): Promise<string> {
    if (this._mountPath !== null) return this._mountPath;
    try {
      const r: any = await this.req('GET', '/api/directories');
      const arr: any[] = Array.isArray(r && r.data) ? r.data : (r && r.data && r.data.list) || [];
      this._mountPath = (arr[0] && arr[0].path) || '';
    } catch { this._mountPath = ''; }
    return this._mountPath;
  }

  /** 从曲目元数据派生集合（专辑/艺术家）：按字段聚合去重并统计曲目数，顺便取首枚封面。 */
  private deriveCollections(field: 'album' | 'artist'): { id: string; name: string; trackCount: number; coverId?: string; _source: string }[] {
    const map = new Map<string, { cnt: number; cover?: string }>();
    for (const s of this._songsCache ? this._songsCache.list : []) {
      const v = s[field] && String((s as any)[field]).trim();
      if (!v || v === '未知艺术家' || v === '未知专辑') continue;
      const e = map.get(v) || { cnt: 0 };
      e.cnt++;
      const c = s.cover_url || s.cover_path || undefined;
      if (!e.cover && c) e.cover = c;
      map.set(v, e);
    }
    const list = [...map.entries()].map(([name, e]) => ({ id: name, name, trackCount: e.cnt, coverId: e.cover, _source: this.sourceId }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }

  async listTracks(opts: { limit?: number; offset?: number }) {
    const r = await this.req('GET', '/api/songs', { query: { page: Math.floor((opts.offset || 0) / (opts.limit || 50)) + 1, page_size: opts.limit || 50 } });
    return this.unwrap(r, (t: any) => this.mapTrack(t));
  }

  async listAlbums(opts: { limit?: number; offset?: number }) {
    // 专辑来自曲目 album 字段（GEAK 无独立专辑接口）。directory_id 多数情况下为空，
    // 直接按曲目 album 聚合更稳，也能覆盖「散装导入、未归入目录」的歌。
    const songs = await this.allSongs();
    this._songsCache!.list = songs; // 确保 deriveCollections 命中缓存
    const all = this.deriveCollections('album');
    const limit = opts.limit || all.length;
    const offset = opts.offset || 0;
    return { list: all.slice(offset, offset + limit), total: all.length };
  }

  async listArtists(opts: { limit?: number; offset?: number }) {
    const songs = await this.allSongs();
    this._songsCache!.list = songs;
    const all = this.deriveCollections('artist');
    const limit = opts.limit || all.length;
    const offset = opts.offset || 0;
    return { list: all.slice(offset, offset + limit), total: all.length };
  }

  async listPlaylists(opts: { limit?: number; offset?: number }) {
    const r = await this.req('GET', '/api/directories');
    // 注意：/api/directories 的 data 是「数组」而非 {list:[]}，两种形态都兼容
    const dirs: any[] = Array.isArray(r && r.data) ? r.data : (r && r.data && r.data.list) || [];
    // 每个目录并行查首曲封面：GEAK /api/songs?directory_id=X&page_size=1（已在 collectionInfo 验证可用）。
    // 注意：/api/songs 列表本身不返回 directory_id（mapTrack 也未透出），故不能依赖全量分组，必须按目录查询。
    const covList = await Promise.all(dirs.map(async (d: any) => {
      const did = String(this.mapDir(d).id);
      try {
        const rr: any = await this.req('GET', '/api/songs', { query: { directory_id: did, page: 1, page_size: 1 } });
        const songs: any[] = (rr && rr.data && rr.data.list) || [];
        const t = songs[0];
        return t ? (t.cover_url || t.cover_path || undefined) : undefined;
      } catch { return undefined; }
    }));
    const list = dirs.map((d: any, i: number) => {
      const m = this.mapDir(d);
      return { id: m.id, name: m.name, trackCount: m.trackCount, coverId: covList[i], _source: this.sourceId } as Playlist;
    });
    const total = (r && r.data && typeof r.data.total === 'number') ? r.data.total : list.length;
    return { list, total };
  }

  async albumTracks(albumId: string, opts: { limit?: number; offset?: number }) {
    const songs = await this.allSongs();
    const list = songs.filter((s) => (s.album || '') === albumId).map((t) => this.mapTrack(t));
    const total = list.length;
    const limit = opts.limit || total;
    const offset = opts.offset || 0;
    return { list: list.slice(offset, offset + limit), total };
  }

  async artistTracks(artistId: string, opts: { limit?: number; offset?: number }) {
    const songs = await this.allSongs();
    const list = songs.filter((s) => (s.artist || '') === artistId).map((t) => this.mapTrack(t));
    const total = list.length;
    const limit = opts.limit || total;
    const offset = opts.offset || 0;
    return { list: list.slice(offset, offset + limit), total };
  }

  /** 文件夹视图：从曲目 file_path 派生目录树（GEAK 的目录接口只暴露挂载根，
   *  真实多级目录藏在每首歌的 file_path 里，如 Music/流行音乐/曹操.mp3）。
   *  folderPath 为相对挂载根的路径（空 = 根）；返回 dirs（相对路径）与当前层直接音频。 */
  async browse(folderPath: string, opts?: { limit?: number; offset?: number }): Promise<{ dirs: { path: string; name: string; id?: string }[]; tracks: Track[]; total?: number }> {
    const mount = await this.mountPath();
    const cur = folderPath
      ? (mount ? mount.replace(/\/+$/, '') + '/' + folderPath.replace(/^\/+/, '').replace(/\/+$/, '') : folderPath)
      : mount;
    const songs = await this.allSongs();
    const dirSet = new Map<string, string>(); // relPath -> 末段名
    const files: GeakRawTrack[] = [];
    for (const s of songs) {
      const fp = s.file_path || '';
      if (!fp) continue;
      if (cur && fp !== cur && !fp.startsWith(cur + '/')) continue;
      const rest = cur ? (fp === cur ? '' : fp.slice(cur.length + 1)) : fp;
      const slash = rest.indexOf('/');
      if (slash >= 0) {
        const rel = rest.slice(0, slash);
        if (!dirSet.has(rel)) dirSet.set(rel, rel.split('/').pop() || rel);
      } else if (rest) {
        files.push(s);
      }
    }
    const dirs = [...dirSet.entries()].map(([rel, name]) => ({ name, path: rel, id: rel }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const total = files.length;
    const limit = (opts && opts.limit) || total;
    const offset = (opts && opts.offset) || 0;
    return { dirs, tracks: files.slice(offset, offset + limit).map((t) => this.mapTrack(t)), total };
  }

  /** 集合二次元数据（专辑/艺术家/歌单/文件夹卡片懒加载封面/数量）：前端 ensureDrillCover → POST /collections/info 驱动。
   *  前端对所有 drill 视图（files/albums/artists/playlists）的卡片统一收集 dataset.id 批量调用本方法，
   *  因此同一接口必须能识别四类 id：
   *   - 文件夹：relative 路径（mount+前缀匹配 file_path）
   *   - 专辑：专辑名（曲目 album 字段相等）
   *   - 艺术家：艺术家名（曲目 artist 字段相等）
   *   - 歌单：directory id（directory_id 查询首首曲目封面） */
  async collectionInfo(ids: string[]): Promise<Array<{ id: string; name?: string; trackCount?: number; coverId?: string } | null>> {
    const mount = await this.mountPath();
    const songs = await this.allSongs();
    // 预建 album / artist 索引（一次遍历，避免每个 id 重复扫全量）
    const albumCov = new Map<string, string>(), albumCnt = new Map<string, number>();
    const artistCov = new Map<string, string>(), artistCnt = new Map<string, number>();
    for (const s of songs) {
      const c = s.cover_url || s.cover_path || undefined;
      if (s.album && s.album !== '未知专辑') {
        albumCnt.set(s.album, (albumCnt.get(s.album) || 0) + 1);
        if (c && !albumCov.has(s.album)) albumCov.set(s.album, c);
      }
      if (s.artist && s.artist !== '未知艺术家') {
        artistCnt.set(s.artist, (artistCnt.get(s.artist) || 0) + 1);
        if (c && !artistCov.has(s.artist)) artistCov.set(s.artist, c);
      }
    }
    const unique = Array.from(new Set((ids || []).filter(Boolean).map(String)));
    const out: any[] = await Promise.all(unique.map(async (idRaw: string) => {
      // 类型前缀：前端对专辑/艺术家/歌单卡片用 album:/artist:/playlist: 前缀，避免与文件夹路径或脏数据冲突
      let kind = 'folder';
      let id = idRaw;
      if (idRaw.startsWith('album:')) { kind = 'album'; id = idRaw.slice(6); }
      else if (idRaw.startsWith('artist:')) { kind = 'artist'; id = idRaw.slice(7); }
      else if (idRaw.startsWith('playlist:')) { kind = 'playlist'; id = idRaw.slice(9); }
      try {
        // 精确类型分支：前端已带前缀时直接定位
        if (kind === 'album') {
          if (albumCnt.has(id)) return { id: idRaw, name: id, trackCount: albumCnt.get(id), coverId: albumCov.get(id) };
          return { id: idRaw, name: id };
        }
        if (kind === 'artist') {
          if (artistCnt.has(id)) return { id: idRaw, name: id, trackCount: artistCnt.get(id), coverId: artistCov.get(id) };
          return { id: idRaw, name: id };
        }
        if (kind === 'playlist') {
          try {
            const r: any = await this.req('GET', '/api/songs', { query: { directory_id: id, page: 1, page_size: 1 } });
            const list: any[] = (r && r.data && r.data.list) || [];
            const total = (r && r.data && typeof r.data.total === 'number') ? r.data.total : list.length;
            if (total > 0 || list.length) {
              const t = list[0];
              const c = t ? (t.cover_url || t.cover_path || undefined) : undefined;
              return { id: idRaw, name: id, trackCount: total, coverId: c };
            }
          } catch { /* ignore */ }
          return { id: idRaw, name: id };
        }
        // 无前缀（旧前端 / 文件夹视图）：folder 路径匹配 + album/artist/playlist 兜底
        const cur = id
          ? (mount ? mount.replace(/\/+$/, '') + '/' + id.replace(/^\/+/, '').replace(/\/+$/, '') : id)
          : mount;
        let count = 0;
        let coverId: string | undefined;
        for (const s of songs) {
          const fp = s.file_path || '';
          if (!fp) continue;
          if (cur && fp !== cur && !fp.startsWith(cur + '/')) continue;
          count++;
          if (!coverId) {
            const c = s.cover_url || s.cover_path || undefined;
            if (c) coverId = c;
          }
        }
        if (count > 0) return { id: idRaw, name: id.split('/').pop() || id, trackCount: count, coverId };
        // 专辑名匹配
        if (albumCnt.has(id)) return { id: idRaw, name: id, trackCount: albumCnt.get(id), coverId: albumCov.get(id) };
        // 艺术家名匹配
        if (artistCnt.has(id)) return { id: idRaw, name: id, trackCount: artistCnt.get(id), coverId: artistCov.get(id) };
        // 歌单：directory_id 查询（轻量，仅取首首 + total）
        try {
          const r: any = await this.req('GET', '/api/songs', { query: { directory_id: id, page: 1, page_size: 1 } });
          const list: any[] = (r && r.data && r.data.list) || [];
          const total = (r && r.data && typeof r.data.total === 'number') ? r.data.total : list.length;
          if (total > 0 || list.length) {
            const t = list[0];
            const c = t ? (t.cover_url || t.cover_path || undefined) : undefined;
            return { id: idRaw, name: id, trackCount: total, coverId: c };
          }
        } catch { /* ignore */ }
        return { id: idRaw, name: id };
      } catch { return { id: idRaw, name: id }; }
    }));
    return out;
  }

  async playlistTracks(playlistId: string, opts: { limit?: number; offset?: number }) {
    const r = await this.req('GET', '/api/songs', { query: { directory_id: playlistId, page: Math.floor((opts.offset || 0) / (opts.limit || 100)) + 1, page_size: opts.limit || 100 } });
    return this.unwrap(r, (t: any) => this.mapTrack(t));
  }

  async search(query: string, opts: { limit?: number; dir?: string }): Promise<SearchResults> {
    const lim = opts.limit || 30;
    const r = await this.req('GET', '/api/songs/search', { query: { keyword: query, limit: lim } });
    const list = this.unwrap(r, (t: any) => this.mapTrack(t)).list;
    return { tracks: list, albums: [], artists: [] };
  }

  async lyric(trackId: string): Promise<string | null> {
    try {
      const songId = this.resolveSongId(trackId);
      const r: any = await this.req('GET', '/api/songs/lyrics', { query: { id: songId } });
      const data = r && r.data;
      if (data && typeof data === 'object' && (data.lyric || data.content)) return data.lyric || data.content || null;
      if (typeof data === 'string' && data.trim()) return data;
    } catch { /* 无歌词不算错误 */ }
    // GEAK API 无歌词时，回退读磁盘「同名 .lrc」副车文件（如用户手动放在歌曲同目录的 .lrc）。
    // 宿主播放器能直接读 sidecar，但 GEAK API 不返回，故这里补齐，使插件 /lyric 与
    // Subsonic（getLyrics*/fetchLyricForImport 均走 adapter.lyric）都能拿到本地歌词。
    try {
      const fp = await this.resolveFilePath(trackId);
      if (fp) {
        const dot = fp.lastIndexOf('.');
        const lrc = (dot > 0 ? fp.slice(0, dot) : fp) + '.lrc';
        // 基于 mtime 的缓存：文件没改复用上次结果，改了立即重读（解决「改歌词不刷新」）
        const cached = lrcStatCache.get(lrc);
        let raw: string | null = cached ? cached.text : null;
        if (cached) {
          const st = await (globalThis as any).songloft.fs.stat(lrc).catch(() => null);
          if (fileMtimeMs(st) !== cached.mtime) raw = null; // 文件已变，失效重读
        }
        if (raw === null) {
          raw = await (globalThis as any).songloft.fs.readFile(lrc, { encoding: 'utf8' }).catch(() => null);
          const st = await (globalThis as any).songloft.fs.stat(lrc).catch(() => null);
          lrcStatCache.set(lrc, { mtime: fileMtimeMs(st), text: raw });
        }
        if (raw && String(raw).trim()) return String(raw);
      }
    } catch { /* 无 sidecar 不算错误 */ }
    return null;
  }

  async resolveStream(trackId: string): Promise<UpstreamRef> {
    await this.ensureToken();
    const filePath = await this.resolveFilePath(trackId);
    if (!filePath) throw new Error('GEAK 无法解析播放地址（缺少文件路径）');
    const url = this.buildUrl('/api/stream', { path: filePath });
    const q = `${url}${url.indexOf('?') >= 0 ? '&' : '?'}yom_nas_authorization=${encodeURIComponent(this.token || '')}`;
    return { url: q, headers: this.authHeaders() };
  }

  async resolveCover(coverId?: string): Promise<UpstreamRef | null> {
    if (!coverId) return null;
    // 远程封面地址（GEAK cover_url 字段，如 iTunes/mzstatic 缩略图）：直接作为上游 URL 返回
    if (/^https?:\/\//i.test(coverId)) return { url: coverId, headers: {} };
    // NAS 内部封面路径（cover_path）：经 /api/cover?path= 取，需鉴权 token
    if (!coverId.startsWith('/')) return null;
    await this.ensureToken();
    const url = this.buildUrl('/api/cover', { path: coverId });
    const q = `${url}${url.indexOf('?') >= 0 ? '&' : '?'}yom_nas_authorization=${encodeURIComponent(this.token || '')}`;
    return { url: q, headers: this.authHeaders() };
  }

  // ---------------- 平台原生收藏（GEAK 服务端收藏）----------------
  // GEAK 接口（取自其 web bundle）：
  //   读取：GET /api/songs/favorites?page=&page_size=  → data.list[]（与 /api/songs 同形状，含 favorite 字段）
  //   切换：POST /api/songs/favorite  body { id: songId }  → 服务端按当前状态翻转（幂等由本方法保证）
  private _favIdsCache: { at: number; ids: Set<string> } | null = null;

  async favoriteIds(): Promise<string[]> {
    if (this._favIdsCache && Date.now() - this._favIdsCache.at < 30000) return [...this._favIdsCache.ids];
    // 直接分页拉取服务端收藏列表提取 id（不依赖全量歌曲的 favorite 字段）
    const ids = new Set<string>();
    const size = 200;
    let page = 1;
    for (;;) {
      const r: any = await this.req('GET', '/api/songs/favorites', { query: { page, page_size: size } });
      const raw: GeakRawTrack[] = (r && r.data && r.data.list) || [];
      for (const t of raw) ids.add(String(t.id));
      const total = (r && r.data && typeof r.data.total === 'number') ? r.data.total : raw.length;
      if (raw.length === 0 || ids.size >= total || raw.length < size) break;
      if (page > 50) break;
      page++;
    }
    this._favIdsCache = { at: Date.now(), ids };
    return [...ids];
  }

  async listFavorites(opts: { limit?: number; offset?: number }): Promise<{ list: Track[]; total: number }> {
    const size = opts.limit || 200;
    const page = Math.floor((opts.offset || 0) / size) + 1;
    const r: any = await this.req('GET', '/api/songs/favorites', { query: { page, page_size: size } });
    const raw: GeakRawTrack[] = (r && r.data && r.data.list) || [];
    const list = raw.map((t) => this.mapTrack(t));
    const total = (r && r.data && typeof r.data.total === 'number') ? r.data.total : list.length;
    return { list, total };
  }

  async setFavorite(trackId: string, fav: boolean): Promise<void> {
    const cur = new Set(await this.favoriteIds());
    const isFav = cur.has(String(trackId));
    if (isFav === fav) return; // 已在目标状态，无需翻转
    // GEAK 收藏接口要求数字型 id 字段（{id: <number>}），字符串会报 "id is required"
    await this.req('POST', '/api/songs/favorite', { body: { id: Number(trackId) } });
    // 更新内存缓存
    if (!this._favIdsCache) this._favIdsCache = { at: Date.now(), ids: new Set() };
    if (fav) this._favIdsCache.ids.add(String(trackId));
    else this._favIdsCache.ids.delete(String(trackId));
    this._favIdsCache.at = Date.now();
  }

  private resolveSongId(trackId: string): string {
    const c = this.trackCache.get(trackId);
    return (c && c.songId) || trackId;
  }

  private async resolveFilePath(trackId: string): Promise<string | null> {
    const c = this.trackCache.get(trackId);
    if (c && c.filePath) return c.filePath;
    // 优先从全量歌曲缓存按 id 找（浏览/收藏时已拉过全量，字段名 file_path 或 path 都兼容）
    try {
      const songs = await this.allSongs();
      const hit = songs.find((s) => String(s.id) === String(trackId));
      if (hit && (hit.file_path || hit.path)) {
        const fp = (hit.file_path || hit.path) as string;
        this.trackCache.set(trackId, { filePath: fp, songId: trackId });
        return fp;
      }
    } catch { /* ignore */ }
    // 兜底：detail 接口（字段名 file_path 或 path 都兼容）
    const songId = this.resolveSongId(trackId);
    try {
      const r: any = await this.req('GET', '/api/songs/detail', { query: { id: songId } });
      const m = r && r.data;
      if (m) {
        const fp = m.file_path || m.path;
        if (fp) {
          this.trackCache.set(trackId, { filePath: fp, songId });
          return fp;
        }
      }
    } catch { /* ignore */ }
    return null;
  }

  dispose(): void {
    this.token = null;
    this.loginPromise = null;
    this.trackCache.clear();
  }
}
