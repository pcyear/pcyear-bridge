// 适配器基类
// 提供统一的日志、错误包装、指标记录，降低新增音源的实现成本。

import { Logger, rootLogger } from '../core/logger';
import { toAppError, AppError } from '../core/errors';
import { metrics } from '../core/metrics';
import { SourceAdapter, SourceConfig } from '../types';

export abstract class BaseAdapter implements SourceAdapter {
  readonly abstract type: SourceAdapter['type'];
  readonly sourceId: string;
  protected cfg: SourceConfig;
  protected logger: Logger;

  constructor(cfg: SourceConfig) {
    this.cfg = cfg;
    this.sourceId = cfg.id;
    this.logger = rootLogger.child({ sourceId: cfg.id, type: cfg.type });
  }

  /** 包装任意操作：记录日志、指标、统一错误类型 */
  protected async run<T>(op: string, fn: () => Promise<T>): Promise<T> {
    return this.logger.timed(op, async () => {
      metrics.inc(`adapter:${this.type}:${op}`);
      try {
        return await fn();
      } catch (e: any) {
        metrics.inc(`adapter:${this.type}:${op}:err`);
        throw toAppError(e);
      }
    });
  }

  /** 子类实现：测试连通性 */
  abstract testConnection(): Promise<{ ok: boolean; message: string }>;

  abstract listTracks(opts: { limit?: number; offset?: number }): Promise<{ list: any[]; total: number }>;
  abstract listAlbums(opts: { limit?: number; offset?: number }): Promise<{ list: any[]; total: number }>;
  abstract listArtists(opts: { limit?: number; offset?: number }): Promise<{ list: any[]; total: number }>;
  abstract albumTracks(albumId: string, opts: { limit?: number; offset?: number }): Promise<{ list: any[]; total: number }>;
  abstract artistTracks(artistId: string, opts: { limit?: number; offset?: number }): Promise<{ list: any[]; total: number }>;
  abstract search(query: string, opts: { limit?: number }): Promise<{ tracks: any[]; albums: any[]; artists: any[] }>;
  abstract resolveStream(trackId: string): Promise<{ url: string; headers: Record<string, string> }>;
  abstract resolveCover(coverId?: string): Promise<{ url: string; headers: Record<string, string>; inline?: any } | null>;

  /** v1.4.13：音源自定义封面缺失时，用曲目流 URL 抓文件头解析内嵌封面（Range 150KB + APIC 二次抓取 + ID3）。
   *  默认不实现（返回 null）；fnMusic/subsonic 等基于 resolveStream 实现；WebDAV 走自己的 cover.ts 链路。 */
  async resolveEmbeddedCover(trackId?: string): Promise<{ contentType: string; data: Uint8Array } | null> {
    void trackId;
    return null;
  }

  dispose?(): void {}
}
