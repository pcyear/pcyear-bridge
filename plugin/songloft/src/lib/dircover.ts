// 被动目录封面：歌曲封面解析成功后，把「歌曲封面 → 所属文件夹」记录到持久 KV。
// 目录封面查询 = 自身记录 → 无则继承子目录（深度 2）。绝不主动扫描音频文件头。
//
// 链路：前端打开文件夹 → 列表歌曲懒加载封面（cover-data）→ 解析成功 →
// routes/cover.ts 调 adapter.recordDirCoverFromTrack(coverId) → 记录到本 KV →
// 下次 collections/info / cover-data(目录型) 直接读记录出封面。
//
// KV 按 entryPath 命名空间隔离（宿主 storage 语义），key: msm_fdircov:<sourceId>:<colId>
// 存的是「歌曲级 coverId」（如 ab:audiobook/... 或 WebDAV 曲目相对路径），取图走既有解析链路。

const KV_PREFIX = 'msm_fdircov:';

/** 记录目录封面（幂等；歌曲封面解析成功后调用） */
export async function recordDirCover(sourceId: string, colId: string, coverId: string): Promise<void> {
  if (!sourceId || !colId || !coverId) return;
  try {
    const s = (globalThis as any).songloft?.storage;
    if (s && s.set) await s.set(KV_PREFIX + sourceId + ':' + colId, { coverId, ts: Date.now() });
  } catch { /* 忽略 */ }
}

/** 读取目录的被动封面记录（歌曲 coverId；无记录返回 undefined） */
export async function getDirCover(sourceId: string, colId: string): Promise<string | undefined> {
  try {
    const s = (globalThis as any).songloft?.storage;
    if (!s || !s.get) return undefined;
    const raw = await s.get(KV_PREFIX + sourceId + ':' + colId);
    if (raw && typeof raw === 'object' && (raw as any).coverId) return (raw as any).coverId;
  } catch { /* 忽略 */ }
  return undefined;
}
