// 音源管理器：配置持久化 + 适配器构建/缓存 + 跨音源聚合。

import { FnMusicAdapter } from './sources/fnMusic';
import { SubsonicAdapter } from './sources/subsonic';
import { WebDavAdapter } from './adapters/webdav/adapter';
import { SongloftAdapter } from './sources/songloft';
import { AudiobookAdapter, AUDIOBOOK_SOURCE_ID, builtinAudiobookConfig } from './sources/audiobook';
import { GeakAdapter } from './sources/geak';
export { AUDIOBOOK_SOURCE_ID, builtinAudiobookConfig } from './sources/audiobook';
import { SourceAdapter, SourceConfig, SourceSummary, SourceType, Track } from './types';
import { ensureEncryptionKey, encryptCredential, decryptCredential, isEncryptedPayload } from './crypto';

declare const songloft: any;

export const STORAGE_KEY = 'msm_sources';
// 插件数据目录内的镜像文件：跨插件重启 / 更新保留（完整卸载仍会被清，需配合导出导入）。
export const FS_FILE = 'sources.json';

/** SongLoft 本地媒体库音源的固定 ID（内置源，无需配置） */
export const SONGLOFT_SOURCE_ID = 'src_msm_songloft';

/** 适配器实例缓存：插件存活期间复用，避免每次请求都重新登录 */
const adapterCache: Record<string, SourceAdapter> = {};

// ---- 持久化：songloft.storage（宿主 KV，按 entryPath 命名空间） + songloft.fs 镜像 ----
// 两套都写，读取时 storage 优先、缺失再回退 fs 文件，最大限度避免「重装即丢配置」。

async function loadFromFs(): Promise<SourceConfig[]> {
  try {
    const raw = await songloft.fs.readFile(FS_FILE, { encoding: 'utf8' });
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return await decryptConfigs(parsed as SourceConfig[]);
  } catch { /* 文件不存在或损坏，忽略 */ }
  return [];
}

// ---- 凭证加解密（AES-256-CBC，宿主随机密钥，见 crypto.ts）----
// 落盘前加密、读取后解密；明文只在内存短暂存在。旧明文配置（无 ENC1: 前缀）原样透传，平滑过渡。

async function encryptConfigs(list: SourceConfig[]): Promise<SourceConfig[]> {
  const key = await ensureEncryptionKey();
  return list.map((c) => {
    let out = c;
    if (typeof c.password === 'string' && c.password && !isEncryptedPayload(c.password)) {
      out = { ...out, password: encryptCredential(c.password, key) };
    }
    // 飞牛访问码与密码同等敏感，一并加密落盘（明文只在内存短暂存在）
    if (typeof c.accessCode === 'string' && c.accessCode && !isEncryptedPayload(c.accessCode)) {
      out = { ...out, accessCode: encryptCredential(c.accessCode, key) };
    }
    return out;
  });
}

async function decryptConfigs(list: SourceConfig[]): Promise<SourceConfig[]> {
  const key = await ensureEncryptionKey();
  return list.map((c) => {
    let out = c;
    if (typeof c.password === 'string' && isEncryptedPayload(c.password)) {
      out = { ...out, password: decryptCredential(c.password, key) };
    }
    if (typeof c.accessCode === 'string' && isEncryptedPayload(c.accessCode)) {
      out = { ...out, accessCode: decryptCredential(c.accessCode, key) };
    }
    return out;
  });
}

async function saveToFs(configs: SourceConfig[]): Promise<void> {
  try {
    await songloft.fs.writeFile(FS_FILE, JSON.stringify(configs), { encoding: 'utf8' });
  } catch (e: any) {
    songloft.log.warn('写入持久化镜像失败（不影响运行）：' + ((e && e.message) || e));
  }
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  fnMusic: '飞牛音乐',
  webdav: 'WebDAV',
  subsonic: 'Subsonic / Navidrome',
  songloft: 'SongLoft 本地库',
  audiobook: 'Songloft 有声书',
  geak: 'GEAK NAS',
};

export function buildAdapter(cfg: SourceConfig): SourceAdapter {
  switch (cfg.type) {
    case 'fnMusic': return new FnMusicAdapter(cfg);
    case 'subsonic': return new SubsonicAdapter(cfg);
    case 'webdav': return new WebDavAdapter(cfg);
    case 'songloft': return new SongloftAdapter(cfg);
    case 'audiobook': return new AudiobookAdapter(cfg);
      case 'geak': return new GeakAdapter(cfg);
    default: throw new Error('未知音源类型：' + cfg.type);
  }
}

/** SongLoft 内置音源配置（不在用户配置表里，随取随建） */
export function builtinSongloftConfig(): SourceConfig {
  return {
    id: SONGLOFT_SOURCE_ID,
    type: 'songloft',
    name: 'SongLoft 本地库',
    enabled: true,
    isDefault: false, // 不抢占用户默认源；无任何配置时 defaultSourceId 会回退选中它
    baseUrl: '',
    extra: { builtin: true },
  };
}

export async function loadConfigs(): Promise<SourceConfig[]> {
  try {
    const raw = await songloft.storage.get(STORAGE_KEY);
    let parsed: SourceConfig[] | null = null;
    if (raw && Object.prototype.toString.call(raw) === '[object Array]' && (raw as any[]).length) {
      parsed = raw as SourceConfig[];
    }
    // 兼容误存成 JSON 字符串的情况
    if (typeof raw === 'string') {
      const p = JSON.parse(raw);
      if (p && Array.isArray(p) && p.length) parsed = p;
    }
    if (parsed) return await decryptConfigs(parsed);
  } catch (e: any) {
    songloft.log.warn('读取音源配置失败：' + ((e && e.message) || e));
  }
  // 回退：插件数据目录的镜像文件（重装后若宿主 KV 被清空，这里还能找回）
  const fromFs = await loadFromFs();
  if (fromFs.length) return fromFs;
  return [];
}

export async function saveConfigs(configs: SourceConfig[]): Promise<void> {
  const enc = await encryptConfigs(configs);
  try {
    await songloft.storage.set(STORAGE_KEY, enc);
  } catch (e: any) {
    songloft.log.warn('写入宿主 KV 失败：' + ((e && e.message) || e));
  }
  await saveToFs(enc);
}

export async function getConfig(sourceId: string): Promise<SourceConfig | null> {
  const configs = await loadConfigs();
  for (const c of configs) if (c.id === sourceId) return c;
  // SongLoft 本地库是内置音源，不在用户配置表里也能取到
  if (sourceId === SONGLOFT_SOURCE_ID) return builtinSongloftConfig();
  // SongLoft 有声书也是内置源（配置了 rootPaths 时会保存在用户配置表，优先命中上面循环）
  if (sourceId === AUDIOBOOK_SOURCE_ID) return builtinAudiobookConfig();
  return null;
}

export async function getAdapter(sourceId: string): Promise<SourceAdapter> {
  const cfg = await getConfig(sourceId);
  if (!cfg) throw new Error('未找到音源：' + sourceId);
  if (cfg.enabled === false) throw new Error(`音源「${cfg.name}」已被禁用`);
  const cached = adapterCache[sourceId];
  if (cached) return cached;
  const ad = buildAdapter(cfg);
  adapterCache[sourceId] = ad;
  return ad;
}

/** 取所有已启用音源的适配器（用于全局搜索） */
export async function getEnabledAdapters(): Promise<{ cfg: SourceConfig; adapter: SourceAdapter }[]> {
  const configs = await loadConfigs();
  const out: { cfg: SourceConfig; adapter: SourceAdapter }[] = [];
  for (const cfg of configs) {
    if (cfg.enabled === false) continue;
    try {
      out.push({ cfg, adapter: await getAdapter(cfg.id) });
    } catch (e: any) {
      songloft.log.warn(`音源「${cfg.name}」不可用：${(e && e.message) || e}`);
    }
  }
  return out;
}

export function invalidate(sourceId?: string): void {
  if (sourceId) {
    const ad = adapterCache[sourceId];
    if (ad && ad.dispose) { try { ad.dispose(); } catch { /* ignore */ } }
    delete adapterCache[sourceId];
    return;
  }
  for (const k of Object.keys(adapterCache)) {
    const ad = adapterCache[k];
    if (ad && ad.dispose) { try { ad.dispose(); } catch { /* ignore */ } }
    delete adapterCache[k];
  }
}

/** 下发前端的摘要（剔除密码） */
export function toSummary(cfg: SourceConfig): SourceSummary {
  return {
    id: cfg.id,
    type: cfg.type,
    name: cfg.name,
    enabled: cfg.enabled !== false,
    isDefault: !!cfg.isDefault,
    baseUrl: cfg.baseUrl,
    username: cfg.username,
    rootPath: cfg.rootPath,
    rootPaths: cfg.rootPaths && cfg.rootPaths.length ? cfg.rootPaths : undefined,
    hasPassword: !!cfg.password,
    hasAccessCode: !!cfg.accessCode,
  };
}

export function defaultSourceId(configs: SourceConfig[]): string | null {
  for (const c of configs) if (c.isDefault && c.enabled !== false) return c.id;
  for (const c of configs) if (c.enabled !== false) return c.id;
  return null;
}

/** 生成音源 ID */
export function newSourceId(): string {
  return 'src_' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

/**
 * 跨音源聚合搜索曲目。
 * 单个音源失败不影响整体（降级返回其余结果）。
 */
export async function searchAllTracks(
  keyword: string,
  limitPerSource: number,
): Promise<{ track: Track; cfg: SourceConfig }[]> {
  const entries = await getEnabledAdapters();
  const results = await Promise.all(entries.map(async ({ cfg, adapter }) => {
    try {
      const r = await adapter.search(keyword, { limit: limitPerSource });
      return r.tracks.map((track) => ({ track, cfg }));
    } catch (e: any) {
      songloft.log.warn(`音源「${cfg.name}」搜索失败：${(e && e.message) || e}`);
      return [];
    }
  }));
  let flat: { track: Track; cfg: SourceConfig }[] = [];
  for (const r of results) flat = flat.concat(r);
  return flat;
}
