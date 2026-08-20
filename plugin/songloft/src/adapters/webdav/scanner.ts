// WebDAV 扫描器：递归扫描、渐进发布、KV 分片持久化

import { Track } from '../../types';
import { WebDavCache } from './cache';
import { WebDavClient } from './client';
import { WebDavMetadata } from './metadata';
import { DavEntry, sleep } from './types';

declare const songloft: any;

// KV 键前缀带版本号：扫描结果结构变更时必须升版，否则旧格式缓存会被直接读回，修复不生效。
// v4：改为分片 + 精简字段存储（单个上万条的巨型 JSON 在 QuickJS 里序列化/解析都会拖垮后端）。
const SCAN_KV_PREFIX = 'wd_scan4:';
const KV_CHUNK = 2000;          // 每个 KV 分片存多少条
const PUBLISH_EVERY = 200;      // 每扫到多少首就对外发布一次（渐进可用）
const FIRST_BATCH_MS = 4000;    // 无缓存时最多等多久就先返回已扫部分（远小于反代 10s 超时）

export class WebDavScanner {
  private sourceId: string;
  private client: WebDavClient;
  private meta: WebDavMetadata;
  private cache: WebDavCache;

  constructor(sourceId: string, client: WebDavClient, meta: WebDavMetadata, cache: WebDavCache) {
    this.sourceId = sourceId;
    this.client = client;
    this.meta = meta;
    this.cache = cache;
  }

  isScanComplete(): boolean {
    return this.cache.scanComplete;
  }

  /** 递归扫描（限制深度与总量，避免大盘卡死） */
  async scan(force = false): Promise<Track[]> {
    if (!force) {
      // 1) 内存命中优先返回（过期则后台刷新）。必须先判内存，否则从 KV 恢复后 scannedAt 是旧时间戳，
      //    每个请求都会重新读取并解析上万条的大 JSON，反而把后端拖慢。
      if (this.cache.tracks && this.cache.tracks.length) {
        if (Date.now() - this.cache.scannedAt >= WebDavCache.CACHE_TTL) this.backgroundRescan();
        return this.cache.tracks;
      }
      // 2) KV 持久化层：跨热重载/进程，避免每次实时全量扫描触发反代超时（远程慢 WebDAV 常见）。
      //    即使过期也先返回旧结果并后台刷新，比实时慢扫描被反代 502 切断好得多。
      const kv = await this.loadScanKV();
      if (kv && kv.tracks && kv.tracks.length) {
        this.cache.tracks = kv.tracks;
        this.cache.scannedAt = kv.scannedAt || 0;
        // KV 里只会写入完整扫描的结果，恢复后即为完成态（否则上层会一直当部分结果不肯缓存）
        this.cache.scanComplete = true;
        this.restoreRelToRoot(kv.tracks);
        if (Date.now() - this.cache.scannedAt >= WebDavCache.CACHE_TTL) this.backgroundRescan();
        return this.cache.tracks;
      }
    }
    // force（刷新）且已有完整扫描结果：立即返回旧结果 + 后台重扫。
    // v1.4.38 修正：之前 force 直接清缓存重扫，请求最多等 FIRST_BATCH_MS 只能拿到
    // 4 秒内的扫描进度（如 5027，partial）→ 前端数量从完整总数（5730）倒退成扫描进度再跳回，
    // 表现为「刷新后数量变成扫描中的值」。现在保存旧结果引用先返回（数量不倒退），
    // 后台重扫完成后新文件对后续请求可见。
    // 注意：必须在 backgroundRescan() 前保存引用——doScan 同步部分会执行
    // this.cache.tracks = found（空数组），晚一步读就拿到空列表。
    if (this.cache.tracks && this.cache.tracks.length && this.cache.scanComplete && !this.cache.scanning) {
      const keep = this.cache.tracks;
      this.backgroundRescan();
      return keep;
    }
    // 3) 无任何缓存（或强制刷新且无完整结果）→ 启动扫描，但绝不让 HTTP 请求干等到全部扫完。
    //    大库逐层 Depth:1 遍历可能要几分钟，同步等待必然被反向代理 10s 超时切断（502）。
    //    这里最多等 FIRST_BATCH_MS 拿首批，随后直接返回已扫到的部分，列表随扫描进度渐进补全。
    if (!this.cache.scanning) {
      this.cache.scanning = this.doScan().catch((e) => {
        this.cache.scanning = null;
        (globalThis as any).songloft?.log?.warn?.('WebDAV 扫描失败：' + (e && e.message ? e.message : e));
        return (this.cache.tracks || []) as Track[];
      });
    }
    const pending = this.cache.scanning;
    await Promise.race([pending, sleep(FIRST_BATCH_MS)]);
    return (this.cache.tracks || []) as Track[];
  }

  /**
   * 逐层分批扫描（通用兼容方案，适用于所有标准 WebDAV 服务）。
   *
   * 协议层：只用 PROPFIND + Depth:1 拿当前目录的直接子项，逐个子目录再发 Depth:1 一层层下钻。
   * 绝不使用 Depth:infinity —— 那会让服务端一次性递归整棵树，大目录必然超时、
   * 内存爆炸，且很多实现（nginx-dav / sabre-dav / seafile）会直接截断返回部分结果。
   *
   * 消费层：流式分批发布。每扫到 PUBLISH_EVERY 首就把已扫结果对外可见，
   * 调用方无需等待整棵树扫完即可渲染（渐进可用），彻底避免请求被反代超时切断。
   */
  private async doScan(keepComplete = false): Promise<Track[]> {
    const found: Track[] = [];
    const maxDepth = 6;
    const maxFiles = 20000;
    const starts = this.client.roots.length ? this.client.roots : ['/'];
    // 关键：队列必须携带「所属起始 root」。fileToTrack 要用起始 root 切片求相对路径，
    // 若传当前遍历目录 cur.path，rel 会退化成纯文件名，目录层级全丢 → 艺术家/专辑塌缩成「未知」。
    const queue: { path: string; depth: number; root: string }[] = starts.map((path) => ({ path, depth: 0, root: path }));

    // v1.4.38：区分「初次扫描」与「后台重扫」。
    // 初次（keepComplete=false）：scanComplete 置 false（部分结果），立即挂载 found 让读取方渐进可见。
    // 后台重扫（keepComplete=true）：保持 scanComplete=true、cache.tracks 继续指向旧完整结果，
    // 新结果在扫完后一次性替换——重扫期间请求仍拿到旧完整结果（数量不倒退、不显示扫描中）。
    if (!keepComplete) {
      this.cache.scanComplete = false;
      // 立即把（正在增长的）数组挂到 this.cache.tracks：同一引用，后续 push 对读取方即时可见，
      // 无需每批复制数组，也不会把上万条结果在内存里堆两份。
      this.cache.tracks = found;
    }
    let sincePublish = 0;

    // 单线程 QuickJS 事件循环：PROPFIND 是异步 I/O，并发不阻塞主流程；
    // 对含上万文件的大库（电影/软件/音乐混合）串行逐目录 PROPFIND 太慢，
    // 每批最多并发 4 个目录，把全量扫描时间缩短约 4 倍，且不会压垮慢速 WebDAV。
    const BATCH = 4;
    while (queue.length > 0 && found.length < maxFiles) {
      const batch = queue.splice(0, Math.min(BATCH, queue.length));
      const results = await this.mapLimit(batch, BATCH, async (cur) => {
        // 单层 PROPFIND(Depth:1)。单个目录失败不影响整棵树，跳过继续。
        let entries: DavEntry[] = [];
        try { entries = await this.client.propfind(cur.path); } catch { entries = []; }
        return { entries, cur };
      });
      for (const { entries, cur } of results) {
        if (!entries || !entries.length) continue;
        for (const e of entries) {
          if (e.isDir) {
            if (cur.depth < maxDepth) queue.push({ path: e.href, depth: cur.depth + 1, root: cur.root });
          } else if (this.meta.isAudio(e.name)) {
            found.push(this.meta.fileToTrack(e, cur.root));
            sincePublish++;
            if (found.length >= maxFiles) break;
          }
        }
        // 分批发布：刷新时间戳让「部分结果」立刻被视为可用缓存对外服务。
        if (sincePublish >= PUBLISH_EVERY) {
          this.cache.scannedAt = Date.now();
          sincePublish = 0;
        }
      }
      // 关键改进：每个 batch 处理完成后让出事件循环，避免扫描期间其他请求饿死导致 502。
      await sleep(0);
    }

    this.cache.scannedAt = Date.now();
    this.cache.scanComplete = true;
    this.cache.scanning = null;
    // 后台重扫（keepComplete）：扫完才把新结果替换上去（期间旧结果一直对外，数量不倒退）
    if (keepComplete) this.cache.tracks = found;
    // 只有完整扫完才落盘，避免把半截结果固化到 KV
    await this.saveScanKV(found, this.cache.scannedAt);
    return found;
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

  backgroundRescan(): void {
    if (this.cache.scanning) return;
    // v1.4.38：后台重扫传 keepComplete=true —— 扫描期间保持 scanComplete=true、
    // cache.tracks 继续指向旧完整结果（新结果完成后一次性替换），刷新/过期重扫不会
    // 让数量倒退成扫描进度或显示「扫描中」。
    this.cache.scanning = this.doScan(true).catch((e) => {
      (globalThis as any).songloft?.log?.warn?.('WebDAV 后台重扫失败：' + (e && e.message ? e.message : e));
      this.cache.scanning = null;
      return [] as Track[];
    });
  }

  /** 从 KV 恢复的 Track 没走过 fileToTrack，需按 _root 重建 rel→root 映射，否则 absOf 拼错路径 */
  private restoreRelToRoot(tracks: Track[]): void {
    this.meta.relToRoot.clear();
    const fallback = this.client.roots[0] || '/';
    for (const t of tracks) {
      if (t && t.id) this.meta.relToRoot.set(t.id, (t as any)._root || fallback);
    }
  }

  // ---- 扫描结果持久化：分片 + 精简字段 ----
  // 上万条 Track 存成单个 JSON 会让 QuickJS 在序列化/解析时长时间卡死后端，
  // 故按 KV_CHUNK 分片存储；每条只存不可推导的字段，path/coverId/_source 读回时重建。

  private kvKey(suffix: string): string {
    return SCAN_KV_PREFIX + this.sourceId + ':' + suffix;
  }

  private normalize(p: string): string {
    return ('/' + p).replace(/\/+/g, '/').replace(/\/$/, '');
  }

  /** Track → 紧凑数组（省掉键名与可推导字段，体积约为原来的一半） */
  private packTrack(t: Track): any[] {
    return [t.id, t.title, t.artist, t.album, t.trackNo || 0, t.size || 0, t.codec || '', (t as any)._root || '/'];
  }

  /** 紧凑数组 → Track（重建 path / coverId / _source） */
  private unpackTrack(a: any[]): Track {
    const rel = a[0];
    const root = a[7] || '/';
    const base = root === '/' ? '' : root;
    const t: any = {
      id: rel,
      title: a[1],
      artist: a[2],
      album: a[3],
      trackNo: a[4] || undefined,
      size: a[5] || undefined,
      codec: a[6] || '',
      path: this.normalize((base ? base + '/' : '/') + rel),
      coverId: rel,
      _source: this.sourceId,
      _root: root,
    };
    return t as Track;
  }

  async loadScanKV(): Promise<{ tracks: Track[]; scannedAt: number } | null> {
    try {
      const s = (globalThis as any).songloft?.storage;
      if (!s || !s.get) return null;
      const meta = await s.get(this.kvKey('meta'));
      if (!meta || !meta.chunks) return null;
      const tracks: Track[] = [];
      for (let i = 0; i < meta.chunks; i++) {
        const part = await s.get(this.kvKey('c' + i));
        if (!part || !part.length) continue;
        for (const row of part) tracks.push(this.unpackTrack(row));
      }
      if (!tracks.length) return null;
      return { tracks, scannedAt: meta.scannedAt || 0 };
    } catch { return null; }
  }

  async saveScanKV(tracks: Track[], scannedAt: number): Promise<void> {
    try {
      const s = (globalThis as any).songloft?.storage;
      if (!s || !s.set) return;
      const size = KV_CHUNK;
      const chunks = Math.ceil(tracks.length / size);
      // 先读旧 meta，写完后清掉多余的旧分片（重扫后文件变少时不留脏数据）
      let oldChunks = 0;
      try { const m = await s.get(this.kvKey('meta')); oldChunks = (m && m.chunks) || 0; } catch { /* ignore */ }
      for (let i = 0; i < chunks; i++) {
        const part = tracks.slice(i * size, (i + 1) * size).map((t) => this.packTrack(t));
        await s.set(this.kvKey('c' + i), part);
      }
      for (let i = chunks; i < oldChunks; i++) {
        try { await s.set(this.kvKey('c' + i), null); } catch { /* ignore */ }
      }
      await s.set(this.kvKey('meta'), { chunks, scannedAt, total: tracks.length });
    } catch { /* KV 写入失败不影响主流程 */ }
  }

  async warmup(): Promise<void> {
    try {
      const kv = await this.loadScanKV();
      if (kv && kv.tracks && kv.tracks.length) {
        this.cache.tracks = kv.tracks;
        this.cache.scannedAt = kv.scannedAt || 0;
        this.cache.scanComplete = true;
        this.restoreRelToRoot(kv.tracks);
      }
    } catch { /* 忽略 */ }
  }

  clearKV(): void {
    try {
      const s = (globalThis as any).songloft?.storage;
      if (s && s.set) s.set(this.kvKey('meta'), null);
    } catch { /* ignore */ }
  }
}
