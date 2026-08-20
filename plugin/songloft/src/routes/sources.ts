// 音源配置管理路由（从 main.ts 提取）

import { createRouter, jsonResponse } from '@songloft/plugin-sdk';
import { readBody, q, intOf, fail, errMsg, CACHE_PREFIX, classifyConnError } from '../lib/common';
import {
  loadConfigs, saveConfigs, getConfig, buildAdapter, getAdapter, newSourceId, invalidate,
  toSummary, defaultSourceId, SOURCE_TYPE_LABELS, builtinSongloftConfig, SONGLOFT_SOURCE_ID,
  AUDIOBOOK_SOURCE_ID, builtinAudiobookConfig, STORAGE_KEY, FS_FILE,
} from '../manager';
import { isSelfSubsonicUrl } from '../subsonic-server';
import { sha256 } from '../crypto';
import { SourceConfig } from '../types';
import { getFuseConfig, setFuseConfig, pruneFuseSource, getLocalOpts, setLocalOpts } from '../lib/fuse';

declare const songloft: any;

type Router = ReturnType<typeof createRouter>;

// ============ 目录列举缓存：编辑音源时目录列表首次慢、之后秒开 ============
// 内存 + KV 持久化（跨插件重载/重启仍命中）。键只含「连接指纹哈希」，密码仅取哈希、不落盘明文。
const dirListMem = new Map<string, { at: number; list: any[] }>();
const DIR_LIST_TTL = 5 * 60 * 1000; // 5 分钟

function dirListKeyOf(cfg: SourceConfig, dirPath: string): string {
  const fp = sha256(`${cfg.type}|${cfg.baseUrl}|${cfg.username || ''}|${cfg.password || ''}`);
  return `dirlist:${fp}:${dirPath || '/'}`;
}

async function dirListGet(key: string): Promise<any[] | undefined> {
  const m = dirListMem.get(key);
  if (m && Date.now() - m.at < DIR_LIST_TTL) return m.list;
  try {
    const raw = await songloft.storage.get(CACHE_PREFIX + key);
    if (raw) {
      const o = JSON.parse(String(raw));
      if (o && Date.now() - o.at < DIR_LIST_TTL) { dirListMem.set(key, o); return o.list; }
    }
  } catch { /* 持久层失败不阻断主流程 */ }
  return undefined;
}

async function dirListSet(key: string, list: any[]): Promise<void> {
  const o = { at: Date.now(), list };
  dirListMem.set(key, o);
  try { await songloft.storage.set(CACHE_PREFIX + key, JSON.stringify(o)); } catch { /* 持久化失败仅内存生效 */ }
}

// 删除音源时，清理 SongLoft 服务端曲库里「导入自此音源」的远程副本歌曲。
// 这些歌曲的 source_data（JSON 字符串）内带 sourceId = 该音源 id；删除音源配置并不会自动
// 把它们从服务端曲库移除，只会靠「排除远程歌曲」开关或「融合」隐藏，持续干扰本地库与搜索。
// 因此删除音源时要主动清掉，避免脏数据残留（如之前从 WebDAV 导入的有声书副本）。
async function purgeImportedTracks(sourceId: string): Promise<{ purged: number; failed: number }> {
  // 先全量收集要删的 id（收集阶段不删除，避免删除改变分页 offset 导致漏删/重复）
  const toDelete: number[] = [];
  let offset = 0;
  const PAGE = 500;
  while (true) {
    let page: any[] = [];
    try {
      page = (await songloft.songs.list({ limit: PAGE, offset })) || [];
    } catch {
      break;
    }
    if (!page.length) break;
    for (const s of page) {
      if (!s || s.type !== 'remote') continue;
      let sd: any = s.source_data;
      if (typeof sd === 'string') {
        try { sd = JSON.parse(sd); } catch { continue; }
      }
      if (!sd || (sd.sourceId || sd.source_id) !== sourceId) continue;
      const sid = Number(s.id);
      if (!Number.isNaN(sid)) toDelete.push(sid);
    }
    if (page.length < PAGE) break;
    offset += page.length;
  }
  let purged = 0;
  let failed = 0;
  for (const sid of toDelete) {
    try {
      await songloft.songs.delete(sid);
      purged++;
    } catch {
      failed++;
    }
  }
  return { purged, failed };
}

// 删除音源（被 DELETE /sources 与 POST /sources?op=delete 共用）。
// 注：宿主 jsplugin 机桥对 DELETE 方法支持不可靠，会被认证层拦截返回 401，导致前端误弹
// 「非法访问」。故前端统一改用 POST + op=delete 调用本函数。
async function handleDeleteSource(id: string) {
  if (!id) return fail('缺少 id');
  if (id === SONGLOFT_SOURCE_ID) return fail('本地库不能删除');
  const configs = await loadConfigs();
  const next = configs.filter((c) => c.id !== id);
  if (next.length === configs.length) return fail('未找到该音源', 404);
  // 删除音源的同时，清理服务端曲库里「导入自此音源」的远程副本歌曲（见 purgeImportedTracks）
  let purge = { purged: 0, failed: 0 };
  try {
    purge = await purgeImportedTracks(id);
  } catch (e: any) {
    songloft.log.warn(`清理「导入自此音源的歌曲」失败：${errMsg(e)}`);
  }
  if (!next.some((c) => c.isDefault && c.enabled !== false)) {
    const first = next.filter((c) => c.enabled !== false)[0];
    if (first) first.isDefault = true;
  }
  await saveConfigs(next);
  invalidate(id);
  // 从本地库融合列表移除该源（满足「删除源时自动从本地库移除」）
  await pruneFuseSource(id);
  // 清空本地库缓存：被删源的远程副本歌可能仍在 45s 缓存里，立即失效避免残留显示
  try { const m = await import('../sources/songloft'); m.invalidateSongloftLib(); } catch { /* 忽略 */ }
  return jsonResponse({ ok: true, purged: purge.purged, failed: purge.failed });
}

export function registerSourceRoutes(router: Router): void {
  router.get('/sources', async (req) => {
    // 诊断分支：原样返回未解密的落盘内容（含密文），用于确认凭证已加密存储。
    // 不暴露给前端常规流程（需显式 ?op=raw 触发）。
    const p = q(req);
    if (p.op === 'raw') {
      let storageRaw: any = null;
      let fsRaw: any = null;
      try { storageRaw = await songloft.storage.get(STORAGE_KEY); } catch { /* ignore */ }
      try {
        const fr = await songloft.fs.readFile(FS_FILE, { encoding: 'utf8' });
        fsRaw = JSON.parse(fr);
      } catch { /* ignore */ }
      // 注意：storageRaw/fsRaw 是未解密的落盘内容（含密文），用于确认凭证已加密存储
      return jsonResponse({ ok: true, storage: storageRaw, fs: fsRaw });
    }
    const configs = await loadConfigs();
    // SongLoft 本地库是内置音源：始终展示在列表首位（用户配置表里不会保存它）
    // 内置源固定顺序：SongLoft 本地库 → SongLoft 有声书 → 其他用户源（有声书紧跟本地库下面）
    const songloftCfg = configs.find((c) => c.id === SONGLOFT_SOURCE_ID) || builtinSongloftConfig();
    const abCfg = configs.find((c) => c.id === AUDIOBOOK_SOURCE_ID) || builtinAudiobookConfig();
    const rest = configs.filter((c) => c.id !== SONGLOFT_SOURCE_ID && c.id !== AUDIOBOOK_SOURCE_ID);
    const all = [songloftCfg, abCfg, ...rest];
    return jsonResponse({
      ok: true,
      data: all.map(toSummary),
      defaultId: defaultSourceId(all),
      typeLabels: SOURCE_TYPE_LABELS,
    });
  });

  // 本地库融合配置：返回当前已融合的「其它音源」ID 列表（空数组 = 仅本地库）
  router.get('/sources/fuse', async () => {
    try {
      const cfg = await getFuseConfig();
      return jsonResponse({ ok: true, fused: cfg.fused });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 200);
    }
  });

  // 保存本地库融合配置：body.fused = 要并入本地库的其它音源 ID 数组（可空 = 仅本地库）
  router.post('/sources/fuse', async (req) => {
    try {
      const body = readBody(req);
      const fused = Array.isArray(body.fused) ? body.fused.filter((x: any) => typeof x === 'string') : [];
      // 不允许把本地库自己融进自己
      const clean = await setFuseConfig({ fused: fused.filter((id: string) => id !== SONGLOFT_SOURCE_ID) });
      songloft.log.info(`更新本地库融合配置：融合 ${clean.fused.length} 个其它音源`);
      return jsonResponse({ ok: true, fused: clean.fused });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 200);
    }
  });

  // 本地库显示选项：是否排除「导入的远程歌曲」（如从 WebDAV 导入进服务端的有声书）
  router.get('/sources/local-opts', async () => {
    try {
      const opts = await getLocalOpts();
      return jsonResponse({ ok: true, opts });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 200);
    }
  });

  // 本地库「仅显示指定文件夹」可选列表：扫描服务端本地曲库（type!=remote）所有歌的
  // file_path/path 目录，去重排序返回，供前端文件夹多选。
  router.get('/sources/local-folders', async () => {
    try {
      const dirs = new Set<string>();
      let offset = 0;
      const PAGE = 500;
      while (true) {
        let page: any[] = [];
        try { page = (await songloft.songs.list({ limit: PAGE, offset })) || []; } catch { break; }
        if (!page.length) break;
        for (const s of page) {
          if (!s || s.type === 'remote') continue;
          const p = String((s as any).file_path || (s as any).path || (s as any).path_relative || '');
          if (!p) continue;
          const i = p.lastIndexOf('/');
          const dir = i >= 0 ? p.slice(0, i) : p;
          if (dir) dirs.add(dir);
        }
        if (page.length < PAGE) break;
        offset += page.length;
      }
      return jsonResponse({ ok: true, folders: [...dirs].sort() });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 200);
    }
  });

  // SongLoft 有声书：文件夹列表（设置弹窗用，扫描 /app/audiobook）
  router.get('/sources/audiobook-folders', async () => {
    try {
      const ad: any = await getAdapter(AUDIOBOOK_SOURCE_ID);
      const folders = ad && typeof ad.folders === 'function' ? await ad.folders() : [];
      return jsonResponse({ ok: true, folders });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 200);
    }
  });

  // SongLoft 有声书：清理失效桥接记录（源文件已被删除的宿主歌曲），防幽灵/冗余
  router.post('/sources/audiobook-purge', async () => {
    try {
      const toDelete: number[] = [];
      let offset = 0;
      const PAGE = 500;
      while (true) {
        let page: any[] = [];
        try { page = (await songloft.songs.list({ limit: PAGE, offset })) || []; } catch { break; }
        if (!page.length) break;
        for (const sg of page) {
          if (!sg || sg.type !== 'remote') continue;
          let sd: any = sg.source_data;
          if (typeof sd === 'string') { try { sd = JSON.parse(sd); } catch { continue; } }
          if (!sd || sd.sourceId !== AUDIOBOOK_SOURCE_ID) continue;
          const tr = String(sd.trackId || '');
          const rel = (tr.startsWith('ab:') ? tr.slice(3) : '').replace(/^audiobook\//, '');
          if (!rel) continue;
          const abs = '/app/audiobook/' + rel;
          let exists = true;
          try { exists = await songloft.fs.exists(abs); } catch { exists = false; }
          if (!exists) toDelete.push(Number(sg.id));
        }
        if (page.length < PAGE) break;
        offset += page.length;
      }
      let purged = 0, failed = 0;
      for (const id of toDelete) {
        try { await songloft.songs.delete(id); purged++; } catch { failed++; }
      }
      return jsonResponse({ ok: true, purged, failed });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 200);
    }
  });

  router.post('/sources/local-opts', async (req) => {
    try {
      const body = readBody(req);
      const clean = await setLocalOpts({
        excludeRemote: !!(body && body.excludeRemote),
        localRootPaths: Array.isArray(body && body.localRootPaths) ? body.localRootPaths : undefined,
      });
      return jsonResponse({ ok: true, opts: clean });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 200);
    }
  });

  router.post('/sources', async (req) => {
    const input = readBody(req) as Partial<SourceConfig> & { op?: string };
    // 删除音源走 POST + op=delete：宿主 jsplugin 机桥对 DELETE 方法支持不可靠（常被认证层
    // 拦截返回 401），与上游歌单增改删统一用 POST + op，规避同样的代理/传输风险。
    if (input && input.op === 'delete') {
      return await handleDeleteSource(String(input.id || q(req).id || ''));
    }
    if (!input || !input.type) return fail('缺少 type');
    // audiobook 是内置 fs 源，无 baseUrl（走 fs:external /app/audiobook）；其余源必须有 baseUrl
    if (input.type !== 'audiobook' && !input.baseUrl) return fail('缺少 type 或 baseUrl');
    if (!SOURCE_TYPE_LABELS[input.type]) return fail('不支持的音源类型：' + input.type);
    // 禁止把 Subsonic 音源指回本插件自己：后端单线程，自调会永久死锁，
    // 表现为「所有列表接口 504、第三方客户端一首歌都看不到」
    if (input.type === 'subsonic' && isSelfSubsonicUrl(String(input.baseUrl))) {
      return fail('该地址是本插件自己的 Subsonic 服务端，不能再添加为音源（会导致插件死锁）');
    }

    const configs = await loadConfigs();
    const isNew = !input.id;
    const id = input.id || newSourceId();
    const existing = configs.filter((c) => c.id === id)[0];

    const cfg: SourceConfig = {
      id,
      type: input.type,
      name: input.name || SOURCE_TYPE_LABELS[input.type],
      enabled: input.enabled !== false,
      isDefault: !!input.isDefault,
      baseUrl: String(input.baseUrl).replace(/\/+$/, ''),
      username: input.username,
      // 编辑时留空密码 = 沿用原密码，避免前端把密码回显出来
      password: (input.password === undefined || input.password === '') && existing
        ? existing.password
        : input.password,
      // 访问码同样：编辑时留空 = 沿用原访问码；主动清空则置空（飞牛未开启访问码时）
      accessCode: (input.accessCode === undefined || input.accessCode === '') && existing
        ? existing.accessCode
        : (input.accessCode || ''),
      rootPath: input.rootPath,
      rootPaths: Array.isArray(input.rootPaths) ? input.rootPaths : (existing && existing.rootPaths),
      extra: input.extra || (existing && existing.extra),
    };

    const next = configs.filter((c) => c.id !== id);
    next.push(cfg);
    // 第一个音源自动设为默认
    if (isNew && next.length === 1) cfg.isDefault = true;
    if (cfg.isDefault) for (const c of next) if (c.id !== id) c.isDefault = false;
    // 默认音源被删/禁用后兜底
    if (!next.some((c) => c.isDefault && c.enabled !== false)) {
      const first = next.filter((c) => c.enabled !== false)[0];
      if (first) first.isDefault = true;
    }

    await saveConfigs(next);
    invalidate(id);
    songloft.log.info(`${isNew ? '新增' : '更新'}音源：${cfg.name}（${cfg.type}）`);
    return jsonResponse({ ok: true, data: toSummary(cfg) });
  });

  router.delete('/sources', async (req) => {
    return await handleDeleteSource(q(req).id);
  });

  // 导出全部音源配置（含密码，供备份 / 跨卸载恢复）。请在可信环境使用。
  router.get('/sources/export', async () => {
    const configs = await loadConfigs();
    return jsonResponse({ ok: true, data: configs });
  });

  // 导入配置：merge=true 时按 id 合并（导入项覆盖同名），否则整体替换。
  router.post('/sources/import', async (req) => {
    try {
      const body = readBody(req);
      const incoming: SourceConfig[] = Array.isArray(body.configs) ? body.configs : [];
      if (!incoming.length) return fail('没有可导入的配置');
      const existing = await loadConfigs();
      let next: SourceConfig[];
      if (body.replace === true) {
        next = incoming.slice();
      } else {
        const byId: Record<string, SourceConfig> = {};
        for (const c of existing) byId[c.id] = c;
        for (const c of incoming) byId[c.id] = c;
        next = Object.values(byId);
      }
      // 兜底：确保至少有一个默认音源
      if (!next.some((c) => c.isDefault && c.enabled !== false)) {
        const first = next.filter((c) => c.enabled !== false)[0];
        if (first) first.isDefault = true;
      }
      await saveConfigs(next);
      invalidate();
      songloft.log.info(`已导入 ${incoming.length} 个音源配置（共 ${next.length} 个）`);
      return jsonResponse({ ok: true, total: next.length });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) }, 200);
    }
  });

  // 测试连接：已保存的音源传 id，新建时直接传完整配置
  router.post('/sources/test', async (req) => {
    const input = readBody(req) as Partial<SourceConfig>;
    let cfg: SourceConfig | null = null;
    try {
      // 编辑已存音源时：密码/访问码在表单里不回显（加密存储），
      // 只要其中任一为空就用已存配置回填，避免「已设置却提示请配置」。
      if (input && input.id && ((input.password === undefined || input.password === '') || (input.accessCode === undefined || input.accessCode === ''))) {
        cfg = await getConfig(input.id);
        if (cfg) {
          cfg = {
            ...cfg,
            ...input,
            password: (input.password === undefined || input.password === '') ? cfg.password : input.password,
            accessCode: (input.accessCode === undefined || input.accessCode === '') ? cfg.accessCode : input.accessCode,
          } as SourceConfig;
        }
      }
      if (!cfg) {
        if (!input || !input.type || !input.baseUrl) return fail('缺少 type 或 baseUrl');
        if (input.type === 'subsonic' && isSelfSubsonicUrl(String(input.baseUrl))) {
          return fail('该地址是本插件自己的 Subsonic 服务端，不能再添加为音源（会导致插件死锁）');
        }
        cfg = {
          id: input.id || 'probe',
          type: input.type,
          name: input.name || 'probe',
          enabled: true,
          baseUrl: String(input.baseUrl).replace(/\/+$/, ''),
          username: input.username,
          password: input.password,
          accessCode: input.accessCode,
          rootPath: input.rootPath,
          extra: input.extra,
        };
      }
      const result = await buildAdapter(cfg).testConnection();
      // 记录状态（KV，跨重启可见）—— 让前端侧边栏能显示每个源的连接状态/失败原因
      if (cfg.id && cfg.id !== 'probe') {
        try {
          const kind = result.ok ? 'ok' : classifyConnError(result.message || '');
          await songloft.storage.set(`msm_src_status:${cfg.id}`, { ok: !!result.ok, kind, message: String(result.message || ''), ts: Date.now() });
        } catch { /* ignore */ }
      }
      return jsonResponse({ ok: result.ok, message: result.message, kind: result.ok ? 'ok' : classifyConnError(result.message || '') });
    } catch (e: any) {
      if (cfg && cfg.id && cfg.id !== 'probe') {
        try {
          const msg = errMsg(e);
          await songloft.storage.set(`msm_src_status:${cfg.id}`, { ok: false, kind: classifyConnError(msg), message: msg, ts: Date.now() });
        } catch { /* ignore */ }
      }
      return jsonResponse({ ok: false, message: errMsg(e), kind: classifyConnError(errMsg(e)) });
    }
  });

  // 各源最近一次连接测试状态（供前端侧边栏展示 + 启动时 toast 失败源）
  router.get('/sources/status', async () => {
    try {
      const configs = await loadConfigs();
      const statuses: Record<string, { ok: boolean; kind: 'ok' | 'auth' | 'network'; message: string; ts: number }> = {};
      for (const c of configs) {
        try {
          const raw = await songloft.storage.get(`msm_src_status:${c.id}`);
          if (!raw) continue;
          const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (o && typeof o === 'object') statuses[c.id] = { ok: !!o.ok, kind: (o.kind === 'ok' || o.kind === 'auth' || o.kind === 'network') ? o.kind : (o.ok ? 'ok' : classifyConnError(o.message || '')), message: String(o.message || ''), ts: Number(o.ts) || 0 };
        } catch { /* ignore */ }
      }
      return jsonResponse({ ok: true, statuses });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: errMsg(e) });
    }
  });

  // 列举可选目录：传连接配置（type/baseUrl/username/password/rootPaths）+ 当前 path，
  // 返回该目录下的子目录列表，供前端目录多选器（WebDAV 多层钻取 / Subsonic 一层音乐库）。
  router.post('/sources/directories', async (req) => {
    const input = readBody(req) as Partial<SourceConfig> & { dirPath?: string; refresh?: string };
    try {
      if (!input || !input.type || !input.baseUrl) return fail('缺少 type 或 baseUrl');
      if (!SOURCE_TYPE_LABELS[input.type]) return fail('不支持的音源类型：' + input.type);
      // 已保存的音源：密码留空时回退到已存配置
      let cfg: SourceConfig;
      if (input.id && (input.password === undefined || input.password === '')) {
        const existing = await getConfig(input.id);
        cfg = { ...(existing as SourceConfig), ...input, password: existing ? existing.password : input.password } as SourceConfig;
      } else {
        cfg = {
          id: input.id || 'probe',
          type: input.type as any,
          name: input.name || 'probe',
          enabled: true,
          baseUrl: String(input.baseUrl).replace(/\/+$/, ''),
          username: input.username,
          password: input.password,
          rootPaths: Array.isArray(input.rootPaths) ? input.rootPaths : undefined,
          rootPath: input.rootPath,
        };
      }
      // 目录浏览永远从「真实根目录」开始，不受已选 rootPaths 影响：
      // 否则一旦选中某个二级目录，webdav adapter 的 roots 会被设成该二级目录，
      // listDirectories('') 用 roots[0] 当 base，导致「根目录」列举永远卡在二级目录、回不到真正的根。
      cfg.rootPaths = undefined; cfg.rootPath = undefined;
      const dirPath = input.dirPath || '';
      // 目录列表缓存：首次慢、之后秒开（跨插件重载/重启仍命中）；refresh=1 时强制重新拉取
      const dirCacheKey = dirListKeyOf(cfg, dirPath);
      if (input.refresh !== '1') {
        const hit = await dirListGet(dirCacheKey);
        if (hit) return jsonResponse({ ok: true, list: hit, cached: true });
      }
      const adapter = await buildAdapter(cfg);
      if (!adapter.listDirectories) return jsonResponse({ ok: true, list: [] });
      const list = await adapter.listDirectories(dirPath);
      await dirListSet(dirCacheKey, list);
      return jsonResponse({ ok: true, list });
    } catch (e: any) {
      return jsonResponse({ ok: false, list: [], message: errMsg(e) }, 200);
    }
  });

  // 文件夹浏览：返回指定音源某路径下的子目录与直接音频文件（无限级钻取；fnMusic 等无目录概念源返回 unsupported）
  router.get('/browse', async (req) => {
    try {
      const p = q(req);
      const sourceId = String(p.sourceId || '');
      if (!sourceId) return jsonResponse({ ok: false, message: '缺少 sourceId' }, 200);
      const cfg = await getConfig(sourceId);
      if (!cfg) return jsonResponse({ ok: false, message: '音源不存在' }, 200);
      const adapter = await buildAdapter(cfg);
      if (!adapter || typeof (adapter as any).browse !== 'function') {
        return jsonResponse({ ok: true, unsupported: true, dirs: [], tracks: [] });
      }
      const res = await (adapter as any).browse(String(p.path || ''), {
        limit: p.limit ? Number(p.limit) : undefined,
        offset: p.offset ? Number(p.offset) : undefined,
      });
      return jsonResponse({ ok: true, dirs: res.dirs || [], tracks: res.tracks || [], total: res.total || (res.tracks || []).length });
    } catch (e: any) {
      return jsonResponse({ ok: false, dirs: [], tracks: [], message: errMsg(e) }, 200);
    }
  });

  // 按需统计单个目录（或 Subsonic 音乐库）下的歌曲总数，供前端「加载数量」按钮触发。
  // 不默认加载（挂载网盘等慢源默认不卡），用户点按钮才扫，结果由前端缓存到再次点击。
  router.post('/sources/directory-count', async (req) => {
    const input = readBody(req) as Partial<SourceConfig> & { dirPath?: string };
    try {
      if (!input || !input.type || !input.baseUrl) return fail('缺少 type 或 baseUrl');
      if (!SOURCE_TYPE_LABELS[input.type]) return fail('不支持的音源类型：' + input.type);
      let cfg: SourceConfig;
      if (input.id && (input.password === undefined || input.password === '')) {
        const existing = await getConfig(input.id);
        cfg = { ...(existing as SourceConfig), ...input, password: existing ? existing.password : input.password } as SourceConfig;
      } else {
        cfg = {
          id: input.id || 'probe',
          type: input.type as any,
          name: input.name || 'probe',
          enabled: true,
          baseUrl: String(input.baseUrl).replace(/\/+$/, ''),
          username: input.username,
          password: input.password,
          rootPaths: Array.isArray(input.rootPaths) ? input.rootPaths : undefined,
          rootPath: input.rootPath,
        };
      }
      // 目录浏览永远从「真实根目录」开始，不受已选 rootPaths 影响
      cfg.rootPaths = undefined; cfg.rootPath = undefined;
      const adapter = await buildAdapter(cfg);
      if (!adapter.countSongsIn) return jsonResponse({ ok: true, count: 0, unsupported: true });
      const count = await adapter.countSongsIn(input.dirPath || '');
      return jsonResponse({ ok: true, count });
    } catch (e: any) {
      return jsonResponse({ ok: false, count: 0, message: errMsg(e) }, 200);
    }
  });
}
