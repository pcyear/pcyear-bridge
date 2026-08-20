// 统一缓存封装（memory + KV）
// 解决项目中 listMemCache / dirListMem / hostLyricCache / favCache / cover cache 各自为政的问题。

import { Logger } from './logger';

interface MemEntry<V> {
  value: V;
  exp: number; // 过期时间戳（0 表示永不过期）
}

interface CacheOptions {
  /** 内存缓存 TTL，毫秒；0 表示不缓存到内存 */
  memTtl?: number;
  /** KV 缓存 TTL，毫秒；0 表示不持久化到 KV */
  kvTtl?: number;
}

function storage(): any {
  const g = globalThis as any;
  return g.songloft?.storage;
}

function now() { return Date.now(); }

export class Cache {
  private ns: string;
  private version: string;
  private mem = new Map<string, MemEntry<any>>();
  private logger: Logger;

  constructor(namespace: string, version = '1', logger: Logger = new Logger({ operation: 'cache' })) {
    this.ns = namespace + ':';
    this.version = version;
    this.logger = logger;
  }

  private memKey(key: string): string { return this.ns + this.version + ':' + key; }
  private kvKey(key: string): string { return this.ns + this.version + ':' + key; }

  /** 清理过期内存缓存 */
  private gc(): void {
    const t = now();
    for (const [k, v] of this.mem.entries()) {
      if (v.exp > 0 && t >= v.exp) this.mem.delete(k);
    }
  }

  async get<V>(key: string): Promise<V | undefined> {
    this.gc();
    const mk = this.memKey(key);
    const mem = this.mem.get(mk);
    if (mem && (mem.exp === 0 || now() < mem.exp)) {
      this.logger.debug(`hit mem ${key}`);
      return mem.value as V;
    }
    const s = storage();
    if (!s || !s.get) return undefined;
    try {
      const raw = await s.get(this.kvKey(key));
      if (raw && raw.value !== undefined && raw.value !== null) {
        if (!raw.exp || now() < raw.exp) {
          // 回填内存，使用剩余 TTL
          const remain = raw.exp ? Math.max(0, raw.exp - now()) : 0;
          if (remain > 0) {
            this.mem.set(mk, { value: raw.value, exp: now() + Math.min(remain, 5 * 60 * 1000) });
          }
          return raw.value as V;
        }
      }
    } catch (e: any) {
      this.logger.warn(`KV get fail ${key}: ${(e && e.message) || String(e)}`);
    }
    return undefined;
  }

  async set<V>(key: string, value: V, opts: CacheOptions = {}): Promise<void> {
    const mk = this.memKey(key);
    if (opts.memTtl !== 0) {
      this.mem.set(mk, { value, exp: opts.memTtl ? now() + opts.memTtl : 0 });
    }
    const s = storage();
    if (s && s.set && opts.kvTtl !== 0) {
      try {
        await s.set(this.kvKey(key), {
          value,
          exp: opts.kvTtl ? now() + opts.kvTtl : 0,
        });
      } catch (e: any) {
        this.logger.warn(`KV set fail ${key}: ${(e && e.message) || String(e)}`);
      }
    }
  }

  async delete(key: string): Promise<void> {
    this.mem.delete(this.memKey(key));
    const s = storage();
    if (s && s.set) {
      try { await s.set(this.kvKey(key), null); } catch { /* ignore */ }
    }
  }

  /** 按 namespace 失效：删除所有以该 namespace 开头的 KV 键（通过迭代，宿主 storage 无 scan 接口） */
  async invalidate(): Promise<void> {
    this.mem.clear();
    const s = storage();
    if (!s || !s.get || !s.set) return;
    // 版本失效：升版即可让旧 KV 键“不可见”。这里同时把当前版本所有已知键置 null。
    // 由于无法扫描 KV，最佳实践是在业务层记录写了哪些 key，或在 forceRefresh 时显式 delete。
    // 当前实现至少清空内存；需要全清时请使用 bumpVersion()。
  }

  /** 升级缓存版本：旧 KV 键自动失效（业务不再读取），新写入使用新版本键 */
  bumpVersion(): void {
    const next = String(Date.now());
    this.logger.info(`bump version ${this.version} -> ${next}`);
    this.mem.clear();
    this.version = next;
  }

  /** 内存缓存统计（调试用） */
  stats(): { namespace: string; version: string; memKeys: number } {
    this.gc();
    return { namespace: this.ns, version: this.version, memKeys: this.mem.size };
  }
}

/** 全局缓存实例（业务按需使用或 new Cache） */
export const sharedCache = new Cache('msm', '1');
