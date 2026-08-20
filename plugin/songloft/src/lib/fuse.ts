// 本地库融合配置：控制「SongLoft 本地库」是否把其它音源的内容并入浏览。
//
// 设计要点：
// - 融合配置是独立 KV（msm_local_fuse），与用户音源表（msm_sources）分开，避免互相覆盖。
// - fused: string[] 存放要并入的「其它音源 ID」；空数组 = 仅加载本地库（默认）。
// - 删除某个音源时，pruneFuseSource 把它从 fused 中剔除，满足「删除源时自动从本地库移除」。
// - 集合（专辑/艺术家/歌单）ID 用 `encodeCollectionId(sid, realId)` 打前缀，
//   钻取路由（/album/tracks 等）用 `decodeCollectionId` 还原，从而把请求路由回正确的适配器。
//   曲目本身不前缀化：decorate 已经把每首歌的 sourceId 设成它归属的真实音源，播放天然正确。

import { getConfig, getAdapter, loadConfigs, SONGLOFT_SOURCE_ID } from '../manager';
import { SourceAdapter, SourceConfig } from '../types';

declare const songloft: any;

const STORAGE_KEY = 'msm_local_fuse';

/** 融合集合 ID 的前缀标记（保证与真实 sourceId 不冲突） */
export const FUSE_MARK = '__fz__';

export interface FuseConfig {
  fused: string[];
}

export interface FusedEntry {
  sid: string;
  ad: SourceAdapter;
  cfg: SourceConfig;
}

/** 读取融合配置（空数组 = 仅本地库） */
export async function getFuseConfig(): Promise<FuseConfig> {
  try {
    const raw = await songloft.storage.get(STORAGE_KEY);
    if (raw && typeof raw === 'object') {
      if (Array.isArray((raw as any).fused)) return { fused: (raw as any).fused.filter((x: any) => typeof x === 'string') };
      // 兼容早期误存成数组的情况
      if (Array.isArray(raw)) return { fused: raw as string[] };
    }
  } catch { /* 忽略读取失败 */ }
  return { fused: [] };
}

/**
 * 保存融合配置：只保留「确实存在于用户音源表」的 ID（防止配置漂移导致路由到已不存在的源），
 * 并清空合并缓存（让下一次列表请求立即反映新配置）。
 */
export async function setFuseConfig(cfg: FuseConfig): Promise<FuseConfig> {
  const configs = await loadConfigs();
  const valid = new Set(configs.map((c) => c.id));
  const seen = new Set<string>();
  // 既剔除不存在的源，也去除重复 id
  const fused = Array.isArray(cfg.fused)
    ? cfg.fused.filter((id) => {
        if (!valid.has(id)) return false;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
    : [];
  const clean: FuseConfig = { fused };
  try { await songloft.storage.set(STORAGE_KEY, clean); } catch { /* 忽略写入失败 */ }
  clearMergeCache();
  return clean;
}

/** 删除音源时调用：从融合列表移除该 ID（不存在则无操作） */
export async function pruneFuseSource(id: string): Promise<void> {
  const cfg = await getFuseConfig();
  if (!cfg.fused.includes(id)) return;
  cfg.fused = cfg.fused.filter((x) => x !== id);
  try { await songloft.storage.set(STORAGE_KEY, cfg); } catch { /* 忽略写入失败 */ }
  clearMergeCache();
}

// ============ 本地库显示选项 ============
// 与融合配置相互独立：控制本地库（SongLoft 服务端曲库）是否排除「导入的远程歌曲」
// （如从 WebDAV 导入进服务端、type=remote 的副本，典型如误导入的有声书）。
const LOCAL_OPTS_KEY = 'msm_local_opts';

export interface LocalOpts {
  /** true = 本地库只显示服务端本地曲库，排除 type=remote 的导入歌曲 */
  excludeRemote: boolean;
  /** 非空时，本地库只显示 path 位于这些文件夹下的本地歌（留空 = 全部） */
  localRootPaths?: string[];
}

/** 读取本地库显示选项（默认不排除） */
export async function getLocalOpts(): Promise<LocalOpts> {
  try {
    const raw = await songloft.storage.get(LOCAL_OPTS_KEY);
    if (raw && typeof raw === 'object') {
      const rp = (raw as any).localRootPaths;
      return {
        excludeRemote: !!(raw as any).excludeRemote,
        localRootPaths: Array.isArray(rp) ? rp.filter((x: any) => typeof x === 'string') : undefined,
      };
    }
  } catch { /* 忽略读取失败 */ }
  return { excludeRemote: false };
}

/** 保存本地库显示选项，并立即失效本地库聚合缓存，使过滤器切换立刻生效 */
export async function setLocalOpts(o: LocalOpts): Promise<LocalOpts> {
  const clean: LocalOpts = { excludeRemote: !!o.excludeRemote };
  if (Array.isArray(o.localRootPaths)) {
    clean.localRootPaths = o.localRootPaths.filter((x: any) => typeof x === 'string');
  }
  try { await songloft.storage.set(LOCAL_OPTS_KEY, clean); } catch { /* 忽略写入失败 */ }
  clearMergeCache();
  // 动态导入以避免与 sources/songloft 的潜在循环依赖；失效聚合缓存让切换立即反映
  try { const m = await import('../sources/songloft'); m.invalidateSongloftLib(); } catch { /* 忽略 */ }
  return clean;
}

/** 取当前融合的「其它音源」适配器列表（仅 enabled 且能成功构建的） */
export async function fusedAdapters(): Promise<FusedEntry[]> {
  const cfg = await getFuseConfig();
  const out: FusedEntry[] = [];
  for (const sid of cfg.fused) {
    if (sid === SONGLOFT_SOURCE_ID) continue; // 不能把自己融进自己
    try {
      const c = await getConfig(sid);
      if (!c || c.enabled === false || c.type === 'songloft') continue;
      const ad = await getAdapter(sid);
      out.push({ sid, ad, cfg: c });
    } catch (e: any) {
      songloft.log.warn(`融合源 ${sid} 不可用，已跳过：${(e && e.message) || e}`);
    }
  }
  return out;
}

/** 集合（专辑/艺术家/歌单）ID 编码：打上来源前缀 */
export function encodeCollectionId(sid: string, realId: string): string {
  return `${FUSE_MARK}${sid}__${realId}`;
}

/** 集合 ID 解码：返回 { sid, realId }，sid 为 null 表示本地库原生 ID */
export function decodeCollectionId(id: string): { sid: string | null; realId: string } {
  if (id && typeof id === 'string' && id.startsWith(FUSE_MARK)) {
    const body = id.slice(FUSE_MARK.length);
    const i = body.indexOf('__');
    if (i >= 0) return { sid: body.slice(0, i), realId: body.slice(i + 2) };
  }
  return { sid: null, realId: id };
}

// ============ 合并结果缓存：避免每次翻页都重新聚合所有源 ============
const mergeMemCache = new Map<string, { at: number; data: any }>();
const MERGE_TTL = 60 * 1000; // 60 秒

/** 取合并后的完整列表（带缓存）。key 不含 limit/offset，翻页时复用同一次聚合结果。 */
export async function getMerged(key: string, builder: () => Promise<any>): Promise<any> {
  const cached = mergeMemCache.get(key);
  if (cached && Date.now() - cached.at < MERGE_TTL) return cached.data;
  const data = await builder();
  mergeMemCache.set(key, { at: Date.now(), data });
  return data;
}

/** 清空合并缓存（配置变更 / 源删除时调用） */
export function clearMergeCache(): void {
  mergeMemCache.clear();
}
