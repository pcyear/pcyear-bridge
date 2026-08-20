// WebDAV 缓存：目录缓存、封面缓存、无封面缓存、扫描结果内存缓存

import { Track } from '../../types';
import { EmbeddedArtOut, AudioHeadInfo } from '../../embedded_art';
import { DavEntry } from './types';

export class WebDavCache {
  // 目录级 PROPFIND 缓存：浏览「专辑/艺术家」只读用到的那一层目录，
  // 不再为了列个目录去扫描整库（旧实现每个列表端点都 await scan() 拿两万条再内存 filter）。
  private dirCache = new Map<string, { entries: DavEntry[]; ts: number }>();
  static readonly DIR_TTL = 5 * 60 * 1000;

  // 扫描缓存
  tracks: Track[] | null = null;
  scanning: Promise<Track[]> | null = null;
  scannedAt = 0;
  // 本轮扫描是否已完整走完。渐进扫描期间 tracks 是「部分结果」，
  // 上层据此决定不要把不完整列表写进持久化缓存（否则用户永远只看到一半）。
  scanComplete = false;
  static readonly CACHE_TTL = 5 * 60 * 1000;

  // 内嵌封面解析缓存（避免同一曲目反复拉取文件头）
  private coverCache = new Map<string, EmbeddedArtOut | null>();
  // v1.4.12 音频文件头解析缓存：一次抓取同时得到封面 + ID3 标签（标题/作者/专辑）+ 图片完整性信息
  private headCache = new Map<string, AudioHeadInfo>();
  // v1.4.14 集合元数据缓存（/collections/info 结果，TTL 5min）：避免同一集合反复统计子目录音频数
  private collectionCache = new Map<string, { ts: number; info: any }>();
  static readonly COLLECTION_TTL = 5 * 60 * 1000;
  // 无封面缓存：某 coverId 已确认没有任何候选封面后，短期不再重复探测
  private noCoverCache = new Set<string>();
  // 目录级无封面缓存（v1.4.4）：某个目录确认无封面（无图片文件且首曲无内嵌封面）后，
  // 该目录下所有 coverId（单曲/集合）直接跳过解析 —— 曲目列表 50 首同目录只探 1 次，不再每首拉 2MB 文件头
  private noCoverDirs = new Set<string>();
  // 目录级封面探测缓存：dir → 封面 URL（null 表示该目录确认无封面文件）。
  // 关键性能修复：候选文件名有 21 个且串行探测，若按 coverId（单曲）缓存，
  // 同一目录 N 首歌会重复 N×21 次远程往返，慢 WebDAV 下必然大面积超时。
  private dirCoverCache = new Map<string, string | null>();

  getDir(key: string): DavEntry[] | undefined {
    const hit = this.dirCache.get(key);
    if (hit && Date.now() - hit.ts < WebDavCache.DIR_TTL) return hit.entries;
    return undefined;
  }

  setDir(key: string, entries: DavEntry[]): void {
    this.dirCache.set(key, { entries, ts: Date.now() });
  }

  getDirCover(dir: string): string | null | undefined {
    return this.dirCoverCache.get(dir);
  }

  setDirCover(dir: string, url: string | null): void {
    this.dirCoverCache.set(dir, url);
  }

  getCover(rel: string): EmbeddedArtOut | null | undefined {
    return this.coverCache.get(rel);
  }

  setCover(rel: string, art: EmbeddedArtOut | null): void {
    this.coverCache.set(rel, art);
  }

  getHead(rel: string): AudioHeadInfo | undefined {
    return this.headCache.get(rel);
  }

  setHead(rel: string, info: AudioHeadInfo): void {
    this.headCache.set(rel, info);
  }

  getCollectionInfo(id: string): any | undefined {
    const h = this.collectionCache.get(id);
    return h && Date.now() - h.ts < WebDavCache.COLLECTION_TTL ? h.info : undefined;
  }

  setCollectionInfo(id: string, info: any): void {
    this.collectionCache.set(id, { ts: Date.now(), info });
  }

  hasNoCover(coverId: string): boolean {
    return this.noCoverCache.has(coverId);
  }

  addNoCover(coverId: string): void {
    this.noCoverCache.add(coverId);
  }

  removeNoCover(coverId: string): void {
    this.noCoverCache.delete(coverId);
  }

  hasNoCoverDir(dir: string): boolean {
    return this.noCoverDirs.has(dir);
  }

  addNoCoverDir(dir: string): void {
    this.noCoverDirs.add(dir);
  }

  removeNoCoverDir(dir: string): void {
    this.noCoverDirs.delete(dir);
  }

  clearScan(): void {
    this.tracks = null;
    this.scannedAt = 0;
    this.scanning = null;
    this.scanComplete = false;
  }

  clearCovers(): void {
    this.dirCoverCache.clear();
    this.noCoverCache.clear();
    this.coverCache.clear();
    this.noCoverDirs.clear();
    this.headCache.clear();
    this.collectionCache.clear();
  }

  clearDirs(): void {
    this.dirCache.clear();
  }

  dispose(): void {
    this.tracks = null;
    this.scanning = null;
    this.coverCache.clear();
  }
}
