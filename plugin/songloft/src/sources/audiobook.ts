// SongLoft 有声书音源适配器（内置源，与本地库同级）
// - 数据源：宿主 fs:external 配置的 /app/audiobook 目录（官方有声书插件同款路径）
// - 能力：浏览（扫描目录音频文件）/ 搜索 / 播放（/api/music/url → 插件 /stream → serveFile 直读文件）
// - 元数据：懒加载 ID3/MP4 标签（标题/作者/专辑）与内嵌封面（/cover-img → resolveEmbeddedCover 回退）
// - 设置：rootPaths 指定文件夹（空 = 全部）；文件夹列表由 /sources/audiobook-folders 提供
import { SourceAdapter, SourceConfig, Track, Album, Artist, SearchResults, UpstreamRef } from '../types';
import { errMsg } from '../lib/common';
import { parseAudioHeadFromUrl } from '../lib/audio-head';
import { AudioHeadInfo } from '../embedded_art';
import { hostBase } from '../lib/cover';
import { recordDirCover, getDirCover } from '../lib/dircover';

declare const songloft: any;

/** 有声书目录（宿主 fs:external 绝对路径，与官方 audiobook 插件 externalPaths 一致） */
export const AUDIOBOOK_ROOT = '/app/audiobook';
/** 有声书内置源 ID（与本地库 src_msm_songloft 同级） */
export const AUDIOBOOK_SOURCE_ID = 'src_msm_audiobook';

const AUDIO_EXTS = /\.(mp3|m4a|flac|wav|ogg|aac|opus)$/i;
const SCAN_TTL = 60 * 1000;      // 全量扫描缓存 60s
const HEAD_TTL = 5 * 60 * 1000;  // 文件头（标签+封面）缓存 5min

export function isAudiobookSourceId(sourceId: string): boolean {
  return sourceId === AUDIOBOOK_SOURCE_ID;
}

export function builtinAudiobookConfig(): SourceConfig {
  return {
    id: AUDIOBOOK_SOURCE_ID,
    type: 'audiobook' as any,
    name: 'Songloft 有声书',
    enabled: true,
    isDefault: false,
    baseUrl: '',
    rootPaths: [], // 空 = 扫描全部；设置后按指定文件夹过滤
    extra: { builtin: true },
  };
}

export class AudiobookAdapter implements SourceAdapter {
  readonly type = 'audiobook' as any;
  readonly sourceId: string;
  private cfg: SourceConfig;
  private scanCache: { ts: number; tracks: Track[] } | null = null;
  private headCache = new Map<string, { ts: number; info: AudioHeadInfo }>();

  constructor(cfg: SourceConfig) {
    this.cfg = cfg;
    this.sourceId = cfg.id;
  }

  private roots(): string[] {
    return Array.isArray(this.cfg.rootPaths) ? this.cfg.rootPaths.filter(Boolean) : [];
  }

  /** rootPaths 过滤：非空时相对路径（audiobook/ 前缀）必须匹配某一前缀 */
  private matchRoots(p: string): boolean {
    const roots = this.roots();
    return !roots.length || roots.some((rp) => p.startsWith(rp));
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      await songloft.fs.readdir(AUDIOBOOK_ROOT);
      return { ok: true, message: '有声书目录可访问' };
    } catch (e: any) {
      return { ok: false, message: '有声书目录不可访问：' + errMsg(e) };
    }
  }

  /** 全量扫描（不过滤 rootPaths，结果缓存 60s）。只列目录不刮削——标签刮削移到分页/搜索后对当前页做（懒加载，避免大库全量刮削触发反代超时） */
  private async scanAll(): Promise<Track[]> {
    if (this.scanCache && Date.now() - this.scanCache.ts < SCAN_TTL) return this.scanCache.tracks;
    const out: Track[] = [];
    await this.walk(AUDIOBOOK_ROOT, 'audiobook', out, 0);
    this.scanCache = { ts: Date.now(), tracks: out };
    return out;
  }

  private async walk(absPath: string, relPath: string, out: Track[], depth: number): Promise<void> {
    if (depth > 4) return;
    let entries: any[] = [];
    try { entries = await songloft.fs.readdir(absPath); } catch { return; }
    for (const e of entries || []) {
      if (!e || !e.name) continue;
      const childAbs = absPath + '/' + e.name;
      const childRel = relPath + '/' + e.name;
      if (e.isDir) {
        await this.walk(childAbs, childRel, out, depth + 1);
      } else if (AUDIO_EXTS.test(e.name)) {
        out.push({
          id: 'ab:' + childRel,
          title: e.name.replace(/\.[^.]+$/, ''),
          artist: '',
          album: undefined,
          coverId: 'ab:' + childRel,
          path: childRel,
          _source: 'audiobook',
          _raw: { audiobook: true, abs: childAbs },
        });
      }
    }
  }

  /** 列表只应用 headCache 已刮削的标签（命中即覆盖），绝不主动发起刮削请求。
   *  与 WebDAV 完全一致：列表接口职责单一秒回；标签/封面刮削由封面请求链路（resolveEmbeddedCover→headOf）驱动并缓存 */
  private applyCachedHead(tracks: Track[]): Track[] {
    for (const t of tracks) {
      const abs = String((t as any)._raw?.abs || '');
      const hit = abs ? this.headCache.get(abs) : undefined;
      if (hit && Date.now() - hit.ts < HEAD_TTL) {
        const info = hit.info;
        if (info.title) t.title = info.title;
        if (info.artist) t.artist = info.artist;
        if (info.album) t.album = info.album;
        if (info.duration) (t as any).duration = info.duration;
        if (info.size) (t as any).size = info.size;
      }
    }
    return tracks;
  }

  /** 解析单个曲目文件头（宿主 Go 原生文件服务 /files/ 路由 Range 150KB，宿主直读、不占插件 worker，避免 self-fetch 死锁）；缓存 5min */
  async headOf(track: Track): Promise<AudioHeadInfo> {
    const abs = String((track as any)._raw?.abs || '');
    if (!abs) return {};
    const hit = this.headCache.get(abs);
    if (hit && Date.now() - hit.ts < HEAD_TTL) return hit.info;
    try {
      const base = (await hostBase()).replace(/\/+$/, '');
      // getFileUrl 返回宿主内部文件路由（Go 原生 ServeFile，支持 Range），
      // 路径规则同 ServeFileDirective（绝对路径需在 fs:external 目录内）。
      // 不能经插件自身 /stream 路由自环 fetch：宿主单 worker + env.mu 下会死锁（远程实测 10s 挂起）。
      const fileUrl = await songloft.plugin.getFileUrl(abs);
      const info = await parseAudioHeadFromUrl(base + fileUrl);
      this.headCache.set(abs, { ts: Date.now(), info: info || {} });
      return info || {};
    } catch { return {}; }
  }

  async listTracks(opts: { limit?: number; offset?: number }): Promise<{ list: Track[]; total: number }> {
    const all = (await this.scanAll()).filter((t) => this.matchRoots(t.path || ''));
    const limit = opts && opts.limit ? opts.limit : 200;
    const offset = opts && opts.offset ? opts.offset : 0;
    // 懒加载（WebDAV 同款）：列表只切片+应用已缓存标签，不触发刮削 → 秒回；刮削由封面请求驱动
    return { list: this.applyCachedHead(all.slice(offset, offset + limit)), total: all.length };
  }

  async listAlbums(): Promise<{ list: Album[]; total: number }> {
    return { list: [], total: 0 };
  }

  async listArtists(): Promise<{ list: Artist[]; total: number }> {
    return { list: [], total: 0 };
  }

  async albumTracks(): Promise<{ list: Track[]; total: number }> {
    return { list: [], total: 0 };
  }

  async artistTracks(): Promise<{ list: Track[]; total: number }> {
    return { list: [], total: 0 };
  }

  /** 文件夹浏览：列出 /app/audiobook 下指定相对路径的子目录与音频文件（无限级钻取）。
   *  铁律㉒懒加载：tracks 按 limit/offset 分页（attachSizes/applyCachedHead 只对当前页做，省 stat）；total=目录全部数 */
  /** 递归取目录内全部音频（文件夹播放/加入播放列表用，scanAll 60s 缓存零成本） */
  async browseDeep(dirPath: string): Promise<{ tracks: Track[] }> {
    const rel = String(dirPath || '').replace(/^\/+|\/+$/g, '');
    // 归一化前缀：scanAll 的 track.path 形如 'audiobook/<书>/xxx.mp3'（带前缀），
    // 但前端传入的 dirPath 可能来自 folders()（带前缀）或 browse() 的 dir.path（不带前缀），
    // 两种情况都要归一化为带 'audiobook/' 前缀再拼目录分隔，否则 prefix 匹配不上 → 返回空。
    const norm = rel.startsWith('audiobook/') ? rel : rel ? 'audiobook/' + rel : 'audiobook';
    const prefix = norm + '/';
    const all = (await this.scanAll()).filter((t) => this.matchRoots(t.path || '') && (t.path || '').startsWith(prefix));
    return { tracks: this.applyCachedHead(all) };
  }

  async browse(dirPath: string, opts?: { limit?: number; offset?: number }): Promise<{ dirs: { path: string; name: string; id?: string }[]; tracks: Track[]; total?: number }> {
    // 前端传入的 dirPath 带 "audiobook/" 前缀（来自 folders() 的输出），
    // 而 AUDIOBOOK_ROOT 已是 /app/audiobook，必须剥掉前缀，否则拼成
    // /app/audiobook/audiobook/... 双重前缀 → readdir 返回空 → “这个分类下没有歌曲”。
    const rel = String(dirPath || '').replace(/^\/+|\/+$/g, '').replace(/^audiobook\//, '').replace(/^audiobook$/, '');
    const abs = rel ? AUDIOBOOK_ROOT + '/' + rel : AUDIOBOOK_ROOT;
    let entries: any[] = [];
    try { entries = (await songloft.fs.readdir(abs)) || []; } catch { /* 目录不存在 */ }
    const dirs: { path: string; name: string; id?: string }[] = [];
    const tracks: Track[] = [];
    for (const e of entries) {
      if (!e || !e.name) continue;
      if (e.isDir) {
        const p = rel ? rel + '/' + e.name : e.name;
        // id 供前端文件夹卡片走 collections/info 懒加载（封面+数量），格式 ab:dir:<path>
        dirs.push({ name: e.name, path: p, id: 'ab:dir:' + p });
      } else if (AUDIO_EXTS.test(e.name)) {
        const p = rel ? rel + '/' + e.name : e.name;
        tracks.push({
          id: 'ab:audiobook/' + p,
          title: e.name.replace(/\.[^.]+$/, ''),
          artist: '',
          album: undefined,
          coverId: 'ab:audiobook/' + p,
          path: 'audiobook/' + p,
          _source: 'audiobook',
          _raw: { audiobook: true, abs: abs + '/' + e.name },
        });
      }
    }
    dirs.sort((x, y) => x.name.localeCompare(y.name));
    // 懒加载分页：只对当前页 stat + 应用缓存标签（不主动刮削，刮削由封面请求驱动）
    const total = tracks.length;
    const limit = (opts && opts.limit) || total;
    const offset = (opts && opts.offset) || 0;
    const page = tracks.slice(offset, offset + limit);
    await this.attachSizes(page);
    return { dirs, tracks: this.applyCachedHead(page), total };
  }

  /** 并发 stat 取曲目文件大小（宿主 fs.stat，不解析文件头、不发 HTTP） */
  private async attachSizes(tracks: Track[]): Promise<void> {
    if (!tracks.length) return;
    let i = 0;
    const workers = new Array(Math.min(6, tracks.length)).fill(0).map(async () => {
      while (i < tracks.length) {
        const idx = i++;
        const abs = String((tracks[idx] as any)._raw?.abs || '');
        if (!abs) continue;
        try {
          const st = await songloft.fs.stat(abs);
          if (st && st.size) (tracks[idx] as any).size = st.size;
        } catch { /* stat 失败忽略 */ }
      }
    });
    await Promise.all(workers);
  }

  /** 集合元数据缓存（文件夹卡片懒加载，WebDAV 同款 TTL 5min） */
  private colCache = new Map<string, { ts: number; val: any }>();
  private readonly COL_TTL = 5 * 60 * 1000;

  /** 递归统计目录内音频数 + 找第一个音频（相对目录路径）；有界：深度 3、计数上限 5000 */
  /** 递归统计目录内音频数（仅计数，不解析文件头——封面走被动记录，见 dircover.ts） */
  private async countAudios(abs: string, depth: number, budget: { n: number }): Promise<{ count: number }> {
    if (depth > 3) return { count: 0 };
    let entries: any[] = [];
    try { entries = (await songloft.fs.readdir(abs)) || []; } catch { return { count: 0 }; }
    let count = 0;
    for (const e of entries) {
      if (!e || !e.name) continue;
      if (AUDIO_EXTS.test(e.name)) {
        count++;
        if (budget.n++ > 5000) return { count };
      }
    }
    for (const e of entries) {
      if (e && e.isDir && budget.n <= 5000) {
        const sub = await this.countAudios(abs + '/' + e.name, depth + 1, budget);
        count += sub.count;
      }
    }
    return { count };
  }

  /** 集合元数据（文件夹卡片懒加载，WebDAV 同款）：递归统计目录内音频数 + 取第一首有内嵌封面的音频作封面源。
   *  由前端可见区域 scheduleCardInfo → POST /collections/info 驱动，结果缓存 5min */
  /** 歌曲封面解析成功后被动记录到所属目录（cover-data 成功时由路由调用，见 dircover.ts） */
  async recordDirCoverFromTrack(coverId: string): Promise<void> {
    if (!coverId || !coverId.startsWith('ab:audiobook/')) return;
    const rel = coverId.slice('ab:audiobook/'.length);
    const idx = rel.lastIndexOf('/');
    const dirRel = idx >= 0 ? rel.slice(0, idx) : '';
    if (!dirRel) return;
    const colId = 'ab:dir:' + dirRel;
    await recordDirCover(this.sourceId, colId, coverId);
    // 失效内存集合缓存（记录前 collections/info 可能已缓存「无封面」结果，5min 内不清则卡片永远默认图）
    this.colCache.delete(colId);
  }

  /** 目录封面：自身被动记录 → 无则继承子目录（子→孙，深度 2） */
  private async dirCoverOf(colId: string): Promise<string | undefined> {
    const own = await getDirCover(this.sourceId, colId);
    if (own) return own;
    if (!colId.startsWith('ab:dir:')) return undefined;
    const rel = colId.slice('ab:dir:'.length);
    if (!rel) return undefined;
    return await this.inheritDirCover(rel, 0);
  }

  private async inheritDirCover(rel: string, depth: number): Promise<string | undefined> {
    if (depth >= 2) return undefined;
    const abs = AUDIOBOOK_ROOT + '/' + rel;
    let entries: any[] = [];
    try { entries = (await songloft.fs.readdir(abs)) || []; } catch { return undefined; }
    for (const e of entries) {
      if (!e || !e.name || !e.isDir) continue;
      const subRel = rel ? rel + '/' + e.name : e.name;
      const subCol = 'ab:dir:' + subRel;
      const own = await getDirCover(this.sourceId, subCol);
      if (own) return own;
      const deep = await this.inheritDirCover(subRel, depth + 1);
      if (deep) return deep;
    }
    return undefined;
  }

  async collectionInfo(ids: string[]): Promise<Array<{ id: string; name?: string; trackCount?: number; coverId?: string } | null>> {
    const unique = Array.from(new Set((ids || []).filter(Boolean)));
    // 并发 4 处理（首屏多目录时避免串行解析文件头拖慢），封面继承最多探测 5 个音频
    const out: any[] = new Array(unique.length);
    let idx = 0;
    const worker = async () => {
      while (idx < unique.length) {
        const i = idx++;
        const id = unique[i];
        try {
          if (typeof id !== 'string' || !id.startsWith('ab:dir:')) { out[i] = { id }; continue; }
          const rel = id.slice('ab:dir:'.length);
          if (!rel || rel.split('/').some((s) => s === '..' || s === '')) { out[i] = { id }; continue; }
          const abs = AUDIOBOOK_ROOT + '/' + rel;
          const cached = this.colCache.get(id);
          if (cached && Date.now() - cached.ts < this.COL_TTL) { out[i] = cached.val; continue; }
          const { count } = await this.countAudios(abs, 0, { n: 0 });
          const val = {
            id,
            name: rel.split('/').pop() || '',
            trackCount: count || undefined,
            coverId: (await this.dirCoverOf(id)) || undefined,
          };
          this.colCache.set(id, { ts: Date.now(), val });
          out[i] = val;
        } catch { out[i] = { id }; }
      }
    };
    await Promise.all(new Array(Math.min(4, unique.length)).fill(0).map(() => worker()));
    return out;
  }

  async search(query: string, opts: { limit?: number; dir?: string }): Promise<SearchResults> {
    const q = String(query || '').toLowerCase().trim();
    const all = (await this.scanAll()).filter((t) => this.matchRoots(t.path || ''));
    const hits = q
      ? all.filter((t) => (t.title || '').toLowerCase().includes(q) || (t.artist || '').toLowerCase().includes(q) || (t.path || '').toLowerCase().includes(q))
      : [];
    // 搜索同 WebDAV：只应用已缓存标签，不触发刮削
    const page = hits.slice(0, (opts && opts.limit) || 50);
    return { tracks: this.applyCachedHead(page), albums: [], artists: [] };
  }

  /** 有声书播放地址由 /api/music/url 在 main.ts 中提前拦截并返回插件自身 /stream 端点（见 createMusicUrlHandler），
   *  本方法不会被调用，仅作为 SourceAdapter 接口占位（返回空，若被误调用将由上层报错暴露）。 */
  async resolveStream(_trackId: string): Promise<UpstreamRef> {
    return { url: '', headers: {} };
  }

  async resolveCover(_coverId?: string): Promise<UpstreamRef | null> {
    return null; // 无自定义封面 API，走 resolveEmbeddedCover 回退
  }

  /** 内嵌封面：读曲目文件头 APIC / MP4 covr（cover.ts 在自定义封面缺失时自动调用本回退）。
   *  每请求只刮削 1 个文件（headOf → 宿主 Go /files/ 直读），由前端可见区域逐条驱动，宿主队列天然排队 */
  async resolveEmbeddedCover(coverId?: string): Promise<{ data: Uint8Array; contentType: string } | null> {
    if (!coverId || !coverId.startsWith('ab:')) return null;
    const rel = coverId.slice(3).replace(/^audiobook\//, '');
    if (!rel || rel.split('/').some((seg) => seg === '..' || seg === '')) return null;
    const abs = AUDIOBOOK_ROOT + '/' + rel;
    const info = await this.headOf({ id: coverId, _raw: { abs } } as any);
    if (info && info.art && info.art.data && info.art.data.length >= 8) {
      return { data: info.art.data, contentType: info.art.contentType || 'image/jpeg' };
    }
    return null;
  }

  async lyric(_trackId: string): Promise<string | null> {
    return null;
  }

  /** 文件夹列表（设置弹窗用）：audiobook 顶层 + 一级子目录 */
  async folders(): Promise<string[]> {
    const out: string[] = [];
    try {
      const top = await songloft.fs.readdir(AUDIOBOOK_ROOT);
      out.push('audiobook');
      for (const e of top || []) {
        if (e && e.isDir) out.push('audiobook/' + e.name);
      }
    } catch { /* 目录不可达则返回空 */ }
    return out;
  }
}
