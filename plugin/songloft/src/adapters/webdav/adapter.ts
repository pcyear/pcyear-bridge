// WebDAV 适配器（坚果云 / Nextcloud / Alist / Synology WebDAV / Windows IIS 等）
//
// WebDAV 本身没有音乐元数据接口，因此策略是：
//  1. PROPFIND 递归扫描目录树（Depth: 1 逐层，兼容性最好）
//  2. 按「艺术家/专辑/曲目」的常见目录结构推断元数据，推断不出就用文件名
//  3. 结果缓存在内存，避免每次浏览都重新扫盘
//
// 鉴权：HTTP Basic（Authorization: Basic base64(user:pass)）
// 流：直接 GET 文件 URL（多数 WebDAV 服务端原生支持 Range）

import {
  SourceAdapter, SourceConfig, Track, Album, Artist, Playlist, SearchResults, UpstreamRef,
} from '../../types';

import { recordDirCover } from '../../lib/dircover';import { WebDavCache } from './cache';
import { WebDavClient } from './client';
import { WebDavCoverResolver } from './cover';
import { WebDavMetadata } from './metadata';
import { WebDavScanner } from './scanner';
import { DavEntry } from './types';

// 目录歌曲数统计的保护参数：挂载网盘等巨大目录时，靠这两项保证「统计数量」永不卡死后端。
// 单个统计 PROPFIND 最多 3s；整个统计总预算 5s，到点停手（已数到的出数字、没数到的不显示）。
const COUNT_PROPFIND_MS = 3000;
const COUNT_BUDGET_MS = 5000;
const COUNT_MAX_FILES = 3000; // 单目录统计上限：超过即截断，避免超大目录把后端拖垮
const COUNT_MAX_DEPTH = 5;    // 递归深度上限

export class WebDavAdapter implements SourceAdapter {
  readonly type = 'webdav' as const;
  readonly sourceId: string;

  private cfg: SourceConfig;
  private client: WebDavClient;
  private meta: WebDavMetadata;
  private cache: WebDavCache;
  private scanner: WebDavScanner;
  private coverResolver: WebDavCoverResolver;
  // 多 root 时 rel → 所属 root 的映射；被 metadata 与 scanner 共享。
  private relToRoot = new Map<string, string>();

  constructor(cfg: SourceConfig) {
    this.cfg = cfg;
    this.sourceId = cfg.id;

    this.client = new WebDavClient(cfg);
    this.cache = new WebDavCache();
    this.meta = new WebDavMetadata(this.sourceId, this.client.roots, this.relToRoot);
    this.scanner = new WebDavScanner(this.sourceId, this.client, this.meta, this.cache);
    this.coverResolver = new WebDavCoverResolver(this.client, this.meta, this.cache, this.sourceId);
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const entries = await this.client.propfind(this.client.basePath);
      const dirs = entries.filter((e) => e.isDir).length;
      const audio = entries.filter((e) => !e.isDir && this.meta.isAudio(e.name)).length;
      return { ok: true, message: `连接成功，根目录下有 ${dirs} 个子目录、${audio} 个音频文件` };
    } catch (e: any) {
      return { ok: false, message: (e && e.message) || String(e) };
    }
  }

  /** 列举某目录下的子目录（多层钻取用）；path 为空列出根一层。
   *  不附带歌曲数统计（v1.2.21 起改为前端按需触发 countSongsIn，避免挂载网盘时默认卡顿）。 */
  async listDirectories(path?: string): Promise<{ path: string; name: string; count?: number }[]> {
    const base = (path && path.trim()) ? this.normalize(path.trim()) : (this.client.roots[0] || '/');
    // 不吞异常：让 /sources/directories 接口把真实错误（鉴权失败/路径不存在/超时）回显给用户，
    // 而不是返回空列表让人误以为「没目录」。
    const entries = await this.client.propfind(base);
    const dirs = entries.filter((e) => e.isDir);
    return dirs.map((e) => ({ path: e.href, name: e.name }));
  }

  /** 递归取目录内全部音频（文件夹播放/加入播放列表用）：Depth: infinity 单次拉全树 */
  async browseDeep(path?: string): Promise<{ tracks: Track[] }> {
    const base = (path && path.trim()) ? this.normalize(path.trim()) : (this.client.roots[0] || '/');
    const root = this.client.roots[0] || '/';
    let deep: DavEntry[] = [];
    try {
      deep = await this.client.propfindDeep(base, 8000);
    } catch {
      try { deep = await this.listDir(base); } catch { return { tracks: [] }; }
    }
    const tracks: Track[] = [];
    for (const e of deep) {
      if (!e.isDir && this.meta.isAudio(e.name)) tracks.push(this.meta.fileToTrack(e, root));
    }
    return { tracks };
  }

  /** 文件夹浏览：单层 PROPFIND 返回子目录 + 直接音频文件（无限级钻取用，每层 1 次请求）。
   *  dirs 带集合 id（mkId 格式）→ 前端 folderCard 走 collections/info 懒加载封面+数量（与有声书一致） */
  async browse(path?: string, opts?: { limit?: number; offset?: number }): Promise<{ dirs: { path: string; name: string; id?: string }[]; tracks: Track[]; total?: number }> {
    const base = (path && path.trim()) ? this.normalize(path.trim()) : (this.client.roots[0] || '/');
    const entries = await this.listDir(base);
    const root = this.client.roots[0] || '/';
    const dirs = entries.filter((e) => e.isDir).map((e) => {
      const rel = e.href.slice(root === '/' ? 0 : root.length).replace(/^\/+|\/+$/g, '');
      return { path: e.href, name: e.name, id: this.meta.mkId(root, rel) };
    });
    const tracks: Track[] = [];
    for (const e of entries) {
      if (!e.isDir && this.meta.isAudio(e.name)) {
        const t = this.meta.fileToTrack(e, this.client.roots[0]);
        const head = this.cache.getHead(t.id);
        if (head) {
          if (head.title) t.title = head.title;
          if (head.artist) t.artist = head.artist;
          if (head.album) t.album = head.album;
          if (head.duration) t.duration = head.duration;
          if (head.size) t.size = head.size;
        }
        tracks.push(t);
      }
    }
    // 铁律㉒懒加载：单层 PROPFIND 一次取全，tracks 按 limit/offset 切片返回（dirs 目录少不切片）
    const total = tracks.length;
    const limit = (opts && opts.limit) || total;
    const offset = (opts && opts.offset) || 0;
    return { dirs, tracks: tracks.slice(offset, offset + limit), total };
  }

  /** 递归统计某目录下（含子目录）的歌曲总数，供目录选择框「加载数量」按需触发。
   *  有界 BFS + 全局截止时间保护（COUNT_BUDGET_MS），挂载网盘等巨大目录也不卡死。 */
  async countSongsIn(path: string): Promise<number> {
    const base = (path && path.trim()) ? this.normalize(path.trim()) : (this.client.roots[0] || '/');
    const deadline = Date.now() + COUNT_BUDGET_MS;
    const queue: { path: string; depth: number }[] = [{ path: base, depth: 0 }];
    let total = 0;
    while (queue.length > 0) {
      if (Date.now() > deadline) break; // 全局截止：到点停手，已数到的保留
      if (total >= COUNT_MAX_FILES) break;
      const cur = queue.shift() as { path: string; depth: number };
      let entries: DavEntry[] = [];
      try { entries = await this.client.propfind(cur.path, COUNT_PROPFIND_MS); } catch { continue; }
      for (const e of entries) {
        if (e.isDir) {
          if (cur.depth < COUNT_MAX_DEPTH) queue.push({ path: e.href, depth: cur.depth + 1 });
        } else if (this.meta.isAudio(e.name)) {
          total++;
        }
      }
    }
    return total;
  }

  // ---------------- 目录懒加载（最小化取数的基础）----------------
  /**
   * 读取单层目录（Depth:1）并缓存。
   * 浏览专辑/艺术家/打开文件夹全部走它：只请求真正要看的那一层，
   * 而不是先把整库扫一遍再在内存里 filter。
   */
  private async listDir(absPath: string): Promise<DavEntry[]> {
    const key = this.normalize(absPath || '/');
    const hit = this.cache.getDir(key);
    if (hit) return hit;
    let entries: DavEntry[] = [];
    try {
      entries = await this.client.propfind(key);
    } catch {
      entries = [];
    }
    this.cache.setDir(key, entries);
    return entries;
  }

  private normalize(p: string): string {
    return ('/' + p).replace(/\/+/g, '/').replace(/\/$/, '');
  }

  /** 有限并发地映射（避免几十个 PROPFIND 一次性打爆慢 WebDAV / 单线程后端） */
  private async mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let i = 0;
    const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
      while (i < items.length) {
        const idx = i++;
        try { out[idx] = await fn(items[idx]); } catch { out[idx] = undefined as any; }
      }
    });
    await Promise.all(workers);
    return out;
  }

  /** 列出某相对目录下的音频曲目（单层，1 次 PROPFIND） */
  private async tracksInDir(root: string, rel: string): Promise<Track[]> {
    const entries = await this.listDir(this.meta.absUnder(root, rel));
    const out: Track[] = [];
    for (const e of entries) {
      if (!e.isDir && this.meta.isAudio(e.name)) {
        const t = this.meta.fileToTrack(e, root);
        // v1.4.12：该曲文件头若已解析过（封面请求时顺带抓取），用真实 ID3 标签覆盖文件名推导的元数据
        const head = this.cache.getHead(t.id);
        if (head) {
          if (head.title) t.title = head.title;
          if (head.artist) t.artist = head.artist;
          if (head.album) t.album = head.album;
          if (head.duration) t.duration = head.duration;
          if (head.size) t.size = head.size;
        }
        out.push(t);
      }
    }
    return out;
  }

  /** 列出某相对目录下的子目录名（单层，1 次 PROPFIND） */
  private async subDirs(root: string, rel: string): Promise<string[]> {
    const entries = await this.listDir(this.meta.absUnder(root, rel));
    return entries.filter((e) => e.isDir).map((e) => e.name);
  }

  // ---------------- 扫描入口 ----------------
  private scan(force = false): Promise<Track[]> {
    return this.scanner.scan(force);
  }

  /** 本轮扫描是否已完整结束（上层据此判断返回的是否为部分结果，决定要不要持久化缓存） */
  isScanComplete(): boolean {
    return this.scanner.isScanComplete();
  }

  /**
   * onInit 预热：只做两件轻活 —— 从 KV 恢复既有扫描结果（纯本地，无网络），
   * 以及预读每个 root 的顶层目录（1 次 PROPFIND/root），让「专辑/艺术家」首屏秒开。
   *
   * 刻意不再做全量文件扫描：插件后端是单线程的，几千次 PROPFIND 会把事件循环占满数分钟，
   * 期间 /cover-data、/ui-state 等所有请求都排在后面 → 被反向代理 10s 切断
   * （现象就是「封面一张张由默认图变成破裂图」）。
   * 全量扫描改为仅「全部歌曲 / 搜索」按需触发，浏览目录一律走 listDir 懒加载。
   */
  async warmup(): Promise<void> {
    await this.scanner.warmup();
    try {
      for (const root of this.client.rootList) await this.listDir(this.meta.absUnder(root, ''));
    } catch { /* 预热失败不阻断启动 */ }
  }

  // ---------------- 列表 ----------------
  async listTracks(opts: { limit?: number; offset?: number }) {
    const all = await this.scan();
    const offset = opts.offset || 0;
    const limit = opts.limit || 50;
    return { list: all.slice(offset, offset + limit), total: all.length };
  }

  /**
   * 专辑列表 = 目录结构，只读两层（root + 一级目录），不扫全库。
   * v1.4.3 骨架化：**只返回 {id, name}**，不夹带 coverId/artist/trackCount。
   * 封面/歌手/曲目数等「列表之外的元素」由前端按可见区域批量请求
   * POST /collections/info 获取 —— 列表接口职责单一，响应毫秒级。
   * 列二级目录（mapLimit 6）是「列专辑」本身必需的动作，hasAudio 只是
   * 顺带从同一次 PROPFIND 响应判断「散装音频当专辑」，不产生额外请求。
   */
  async listAlbums(opts: { limit?: number; offset?: number }) {
    const out: Album[] = [];
    for (const root of this.client.rootList) {
      const top = await this.listDir(this.meta.absUnder(root, ''));
      const topDirs = top.filter((e) => e.isDir).map((e) => e.name);
      // root 下直接躺着的音频 → 归入「未知专辑」
      if (top.some((e) => !e.isDir && this.meta.isAudio(e.name))) {
        out.push({ id: this.meta.mkId(root, ''), name: '未知专辑', _source: this.sourceId });
      }
      const infos = await this.mapLimit(topDirs, 6, async (d) => {
        const entries = await this.listDir(this.meta.absUnder(root, d));
        return {
          d,
          dirs: entries.filter((e) => e.isDir).map((e) => e.name),
          hasAudio: entries.some((e) => !e.isDir && this.meta.isAudio(e.name)),
        };
      });
      for (const it of infos) {
        if (!it) continue;
        // 二级目录即专辑
        for (const sub of it.dirs) {
          out.push({ id: this.meta.mkId(root, it.d + '/' + sub), name: sub, _source: this.sourceId });
        }
        // 一级目录下的散装音频则把它自己当专辑
        if (it.hasAudio) {
          out.push({ id: this.meta.mkId(root, it.d), name: it.d, _source: this.sourceId });
        }
      }
    }
    out.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const offset = opts.offset || 0;
    const limit = opts.limit || 50;
    return { list: out.slice(offset, offset + limit), total: out.length };
  }

  /**
   * 艺术家列表 = 一级目录，**每个 root 只需 1 次 PROPFIND**。
   * v1.4.3 骨架化：只返回 {id, name}，不再对每个一级目录 listDir
   * 数 albumCount/trackCount（那是对慢 WebDAV 的 N+1 请求风暴，大库必超时）。
   * 专辑数/曲目数/封面由前端按需请求 POST /collections/info 获取。
   */
  async listArtists(opts: { limit?: number; offset?: number }) {
    const out: Artist[] = [];
    for (const root of this.client.rootList) {
      const top = await this.listDir(this.meta.absUnder(root, ''));
      if (top.some((e) => !e.isDir && this.meta.isAudio(e.name))) {
        out.push({ id: this.meta.mkId(root, ''), name: '未知艺术家', _source: this.sourceId });
      }
      for (const e of top) {
        if (e.isDir) out.push({ id: this.meta.mkId(root, e.name), name: e.name, _source: this.sourceId });
      }
    }
    out.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const offset = opts.offset || 0;
    const limit = opts.limit || 50;
    return { list: out.slice(offset, offset + limit), total: out.length };
  }

  async listPlaylists(_opts: { limit?: number; offset?: number }) {
    // WebDAV 本身没有歌单概念，按目录导入即可。
    return { list: [] as Playlist[], total: 0 };
  }

  async playlistTracks(_playlistId: string, _opts: { limit?: number; offset?: number }): Promise<{ list: Track[]; total: number }> {
    throw new Error('WebDAV 没有歌单目录，请使用「专辑」或「艺术家」目录导入。');
  }

  /**
   * 打开专辑 = 打开一个目录：**1 次 PROPFIND**（命中目录缓存则 0 次）。
   * 旧实现 await scan() 扫两万文件再 filter，慢库必被反代 10s 切断 → 空列表/502。
   */
  async albumTracks(albumId: string, opts: { limit?: number; offset?: number }) {
    const { root, rel } = this.meta.parseCollectionId(albumId);
    let list = await this.tracksInDir(root, rel);
    // 目录本身没有音频（旧名字型 id 或层级更深）→ 下探一层再取
    if (!list.length) {
      const dirs = await this.subDirs(root, rel);
      if (dirs.length) {
        const nested = await this.mapLimit(dirs, 6, (d) => this.tracksInDir(root, rel ? rel + '/' + d : d));
        list = ([] as Track[]).concat(...nested.filter(Boolean));
      }
    }
    list.sort((a, b) => (a.trackNo || 0) - (b.trackNo || 0) || (a.title || '').localeCompare(b.title || ''));
    const offset = opts.offset || 0;
    const limit = opts.limit || list.length;
    return { list: list.slice(offset, offset + limit), total: list.length };
  }

  /**
   * 打开艺术家 = 打开一级目录：1 次 PROPFIND 拿子目录，再按专辑逐个取（并发 6，均走目录缓存）。
   */
  async artistTracks(artistId: string, opts: { limit?: number; offset?: number }) {
    const { root, rel } = this.meta.parseCollectionId(artistId);
    const direct = await this.tracksInDir(root, rel);
    const dirs = await this.subDirs(root, rel);
    const nested = await this.mapLimit(dirs, 6, (d) => this.tracksInDir(root, rel ? rel + '/' + d : d));
    const list = direct.concat(...nested.filter(Boolean));
    list.sort((a, b) => (a.album || '').localeCompare(b.album || '')
      || (a.trackNo || 0) - (b.trackNo || 0)
      || (a.title || '').localeCompare(b.title || ''));
    const offset = opts.offset || 0;
    const limit = opts.limit || list.length;
    return { list: list.slice(offset, offset + limit), total: list.length };
  }

  /**
   * 批量获取集合（专辑/艺术家）的二次元数据：封面标识、歌手、曲目数、专辑数。
   * 列表接口只返回骨架 {id, name}，前端按可见区域分批调用 /collections/info，
   * 避免一个列表请求里夹带大量「目录探测 / 读音频头」导致反代超时。
   * 每个 id 只发 1 次 PROPFIND（listDir，命中 dirCache 则 0 请求），并发上限 4。
   */
  /** 歌曲封面解析成功后被动记录到所属目录（cover-data 成功时由路由调用，见 dircover.ts） */
  async recordDirCoverFromTrack(coverId: string): Promise<void> {
    if (!coverId) return;
    const idx = coverId.lastIndexOf('/');
    const dirRel = idx >= 0 ? coverId.slice(0, idx) : '';
    if (!dirRel) return;
    const root = this.meta.relToRoot.get(coverId) || this.client.roots[0] || '/';
    const colId = this.meta.mkId(root, dirRel);
    await recordDirCover(this.sourceId, colId, coverId);
    // 失效内存 no-cover 缓存（记录前目录型封面解析失败会 addNoCover，不清则永远拦截）
    this.cache.removeNoCover(colId);
    this.cache.removeNoCoverDir(this.meta.absUnder(root, dirRel));
  }

  async collectionInfo(ids: string[]): Promise<Array<{ id: string; name?: string; artist?: string; album?: string; trackCount?: number; albumCount?: number; coverId?: string } | null>> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    return this.mapLimit(unique, 4, async (id) => {
      try {
        // v1.4.14：集合元数据缓存（TTL 5min），避免同一集合反复统计子目录音频数
        const cached = this.cache.getCollectionInfo(id);
        if (cached) return cached;
        const { root, rel } = this.meta.parseCollectionId(id);
        const entries = await this.listDir(this.meta.absUnder(root, rel));
        const segs = rel.split('/').filter(Boolean);
        const name = segs[segs.length - 1] || '';
        const parent = segs.length >= 2 ? segs[segs.length - 2] : '';
        const audioCount = entries.filter((e) => !e.isDir && this.meta.isAudio(e.name)).length;
        const subDirs = entries.filter((e) => e.isDir).map((e) => e.name);
        // 专辑：当前目录含音频且无子目录；艺术家/文件夹：含子目录（或有散装音频的顶层目录）
        const isAlbum = !!rel && subDirs.length === 0 && audioCount > 0;
        let trackCount: number;
        if (isAlbum || subDirs.length === 0) {
          // 专辑/无子目录：当前目录音频（1 次 Depth:1）
          trackCount = audioCount;
        } else if (subDirs.length <= 20) {
          // 文件夹/艺术家型（子目录 ≤20）：v1.4.16 首选 Depth: infinity 单次 PROPFIND 统计全树音频
          //（1 次请求拿到所有层级；子目录 >20 的巨目录如 picture_cache(878) 直接跳过，防大 XML/超时拖垮后端）
          try {
            const deep = await this.client.propfindDeep(this.meta.absUnder(root, rel), 8000);
            trackCount = deep.filter((e) => !e.isDir && this.meta.isAudio(e.name)).length;
          } catch {
            // 深度失败（服务器不支持/超时）：回退当前目录音频（不再遍历子目录，避免雪上加霜）
            trackCount = audioCount;
          }
        } else {
          trackCount = audioCount;
        }
        const result = {
          id,
          name,
          artist: isAlbum && parent ? parent : undefined,
          trackCount: trackCount || undefined,
          albumCount: subDirs.length || undefined,
          coverId: id,
        };
        this.cache.setCollectionInfo(id, result);
        return result;
      } catch {
        return { id, name: '' };
      }
    });
  }

  async search(query: string, opts: { limit?: number; dir?: string }): Promise<SearchResults> {
    const all = await this.scan();
    const q = query.toLowerCase();
    const lim = opts.limit || 30;
    // 目录内搜索：文件夹（drill）内搜索只搜该目录（含子目录），不搜全库
    let scope = all;
    const dir = opts.dir || '';
    if (dir) {
      const { rel } = this.meta.parseCollectionId(dir);
      if (rel) {
        const prefix = rel + '/';
        scope = all.filter((t) => (t.id || '').startsWith(prefix) || t.id === rel);
      }
    }
    const tracks = scope.filter((t) =>
      (t.title || '').toLowerCase().indexOf(q) >= 0
      || (t.artist || '').toLowerCase().indexOf(q) >= 0
      || (t.album || '').toLowerCase().indexOf(q) >= 0,
    ).slice(0, lim);

    const hitIds = new Set(tracks.map((t) => t.id));

    // 专辑/艺术家：从目录结构推导，与 listAlbums/listArtists 完全一致口径。
    // WebDAV 曲目的 artist/album 元数据多为空，真实艺术家/专辑实为文件夹名。
    // 旧实现只按 t.artist/t.album 聚合 → 空元数据时永远只剩「未知艺术家」，
    // 「猴子警长」这类目录名永远无法作为艺术家出现。
    // 故：artistName = t.artist || 顶层文件夹名；albumName = t.album || 文件所在文件夹名；
    // 并以真实目录 id 作为 coverId —— 前端即可像普通列表一样懒加载封面，卡片不再缩小/空白。
    const derive = (t: Track) => {
      const { root, rel } = this.meta.parseCollectionId(t.id);
      const segs = rel.split('/').filter(Boolean);
      if (!segs.length) return null;
      // 扫描器把空 artist/album 填成占位符「未知艺术家/未知专辑」，须视为空，
      // 否则会盖掉文件夹名（listArtists/listAlbums 的艺术家/专辑实为顶层/父文件夹名）。
      const artistMeta = (t.artist && t.artist.trim() && t.artist.trim() !== '未知艺术家') ? t.artist.trim() : '';
      const albumMeta = (t.album && t.album.trim() && t.album.trim() !== '未知专辑') ? t.album.trim() : '';
      // 根目录下的散装音频：与 listArtists/listAlbums 一致，归为「未知艺术家/未知专辑」
      if (segs.length === 1) {
        const id = this.meta.mkId(root, '');
        return {
          artistName: artistMeta || '未知艺术家',
          albumName: albumMeta || '未知专辑',
          artistId: id,
          albumId: id,
        };
      }
      const top = segs[0];
      const parent = segs.slice(0, -1).join('/');
      return {
        artistName: artistMeta || top,
        albumName: albumMeta || parent,
        artistId: this.meta.mkId(root, top),
        albumId: this.meta.mkId(root, parent),
      };
    };

    const albumCnt = new Map<string, number>();
    const artistCnt = new Map<string, number>();
    for (const t of scope) {
      const d = derive(t);
      if (!d) continue;
      artistCnt.set(d.artistName, (artistCnt.get(d.artistName) || 0) + 1);
      albumCnt.set(d.albumName, (albumCnt.get(d.albumName) || 0) + 1);
    }

    const albumMap = new Map<string, Album>();
    const artistMap = new Map<string, Artist>();
    for (const t of scope) {
      const d = derive(t);
      if (!d) continue;
      const byTrack = hitIds.has(t.id);
      const albumHit = d.albumName.toLowerCase().indexOf(q) >= 0;
      const artistHit = d.artistName.toLowerCase().indexOf(q) >= 0;
      if ((albumHit || byTrack) && !albumMap.has(d.albumName)) {
        albumMap.set(d.albumName, {
          id: d.albumId, name: d.albumName, artist: d.artistName,
          trackCount: albumCnt.get(d.albumName) || 0,
          coverId: d.albumId, _source: this.sourceId,
        });
      }
      if ((artistHit || byTrack) && !artistMap.has(d.artistName)) {
        artistMap.set(d.artistName, {
          id: d.artistId, name: d.artistName,
          trackCount: artistCnt.get(d.artistName) || 0,
          coverId: d.artistId, _source: this.sourceId,
        });
      }
    }
    const half = Math.max(5, Math.ceil(lim / 2));
    return {
      tracks,
      albums: Array.from(albumMap.values()).slice(0, half),
      artists: Array.from(artistMap.values()).slice(0, half),
    };
  }

  /** 同目录同名 .lrc 文件 */
  async lyric(trackId: string): Promise<string | null> {
    try {
      const dot = trackId.lastIndexOf('.');
      const lrcRel = (dot > 0 ? trackId.slice(0, dot) : trackId) + '.lrc';
      const resp = await fetch(this.client.fullUrl(this.meta.absOf(lrcRel)), { headers: { Authorization: this.client.auth } });
      if (!resp.ok) return null;
      return await resp.text();
    } catch {
      return null;
    }
  }

  // ---------------- 上游解析 ----------------
  async resolveStream(trackId: string): Promise<UpstreamRef> {
    return { url: this.client.fullUrl(this.meta.absOf(trackId)), headers: { Authorization: this.client.auth } };
  }

  async resolveCover(coverId?: string): Promise<UpstreamRef | null> {
    return this.coverResolver.resolveCover(coverId);
  }

  /**
   * 用户显式刷新（listEndpoint 的 ?refresh=1 调用）。
   * v1.4.38 修正：不再 clearScan() 清空内存扫描结果——之前清空后 scan(force) 只能返回
   * 重扫 4 秒内的进度（如 5027，partial），前端数量从完整总数（5730）倒退成扫描进度，再跳回，
   * 表现为「刷新后数量变成扫描中的值」。
   * 改为：保留完整扫描结果供本次请求立即返回（数量不倒退），由 scanner.scan(force) 触发后台重扫，
   * 新加文件在重扫完成后（几十秒内）对后续请求可见。
   * 目录懒加载 / 封面探测 / KV 分片持久化仍清空，保证「刷新后新增文件夹/封面可见」。
   */
  forceRefresh(): void {
    // 不清 scan（保留完整结果，见上注释）
    // 目录懒加载缓存：不清的话「刷新」后新增的文件夹/歌曲不可见
    this.cache.clearDirs();
    // 封面探测缓存一并清空，否则「刷新」后新加的 cover.jpg 仍不可见
    this.cache.clearCovers();
    // 清空分片持久化（只清 meta 即可让 loadScanKV 判空，分片会在下次写入时覆盖）
    this.scanner.clearKV();
  }

  dispose(): void {
    this.cache.dispose();
  }
}
