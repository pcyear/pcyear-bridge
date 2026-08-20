// 诊断与可观测性端点
// 替代临时 debug-art，提供系统化的健康检查、链路诊断与指标查询。

import { createRouter, jsonResponse, type HTTPRequest, type HTTPResponse } from '@songloft/plugin-sdk';
import { getAdapter, getEnabledAdapters, loadConfigs, SONGLOFT_SOURCE_ID, builtinSongloftConfig } from '../manager';import { q } from '../lib/common';
import { resolveCoverBytes, resolveCoverDataUrl } from '../lib/cover';
import { metrics } from '../core/metrics';
import { taskManager } from '../core/task';

declare const songloft: any;

type Router = ReturnType<typeof createRouter>;

function fail(message: string, status = 400): HTTPResponse {
  return jsonResponse({ ok: false, message }, status);
}

export function registerDiagRoutes(router: Router): void {
  // 整体健康：插件版本、源数量、缓存/指标概览
  router.get('/health', async () => {
    const configs = await loadConfigs();
    const hasBuiltin = configs.some((c) => c.id === SONGLOFT_SOURCE_ID);
    const sources = (hasBuiltin ? configs : [builtinSongloftConfig(), ...configs]).map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      enabled: c.enabled !== false,
    }));
    const snapshot = metrics.snapshot();
    return jsonResponse({
      ok: true,
      plugin: 'multisource-music',
      version: (globalThis as any).PLUGIN_VERSION || 'unknown',
      sources: {
        total: sources.length,
        enabled: sources.filter((s) => s.enabled).length,
        list: sources,
      },
      metrics: {
        counters: snapshot.counters,
        timerOps: Object.keys(snapshot.timers),
      },
    });
  });

  // 各源连通性诊断（逐源限时 6s，失败不阻断整体）
  router.get('/diag/sources', async () => {
    const entries = await getEnabledAdapters();
    const results = await Promise.all(entries.map(async ({ cfg, adapter }) => {
      const t0 = Date.now();
      try {
        const r = await adapter.testConnection();
        return {
          id: cfg.id,
          type: cfg.type,
          name: cfg.name,
          ok: r.ok,
          message: r.message,
          elapsedMs: Date.now() - t0,
        };
      } catch (e: any) {
        return {
          id: cfg.id,
          type: cfg.type,
          name: cfg.name,
          ok: false,
          message: (e && e.message) || String(e),
          elapsedMs: Date.now() - t0,
        };
      }
    }));
    return jsonResponse({ ok: true, sources: results });
  });

  // 封面解析链路诊断：返回是否命中缓存、是否走目录封面、是否走内嵌封面、耗时
  router.get('/diag/cover', async (req) => {
    const p = q(req);
    const sourceId = p.sourceId;
    const coverId = p.coverId;
    if (!sourceId || !coverId) return fail('缺少 sourceId 或 coverId');

    const steps: { step: string; ok: boolean; detail?: any }[] = [];
    const t0 = Date.now();
    let dataUrl: string | null = null;
    let bytes: { buf: Uint8Array; ct: string } | null = null;

    // 1) 是否命中 cover-data 缓存（resolveCoverDataUrl 内部会查）
    try {
      dataUrl = await resolveCoverDataUrl(sourceId, coverId);
      steps.push({ step: 'cover-data-cache', ok: !!dataUrl, detail: dataUrl ? 'hit' : 'miss' });
    } catch (e: any) {
      steps.push({ step: 'cover-data-cache', ok: false, detail: (e && e.message) || String(e) });
    }

    // 2) 直接走字节解析链路，看能否拿到图
    try {
      bytes = await resolveCoverBytes(sourceId, coverId);
      steps.push({ step: 'resolve-cover-bytes', ok: !!bytes, detail: bytes ? { contentType: bytes.ct, bytes: bytes.buf.length } : null });
    } catch (e: any) {
      steps.push({ step: 'resolve-cover-bytes', ok: false, detail: (e && e.message) || String(e) });
    }

    return jsonResponse({
      ok: true,
      sourceId,
      coverId,
      elapsedMs: Date.now() - t0,
      hasCover: !!dataUrl || !!bytes,
      steps,
    });
  });

  // 扫描任务诊断：返回指定 source 的扫描状态与进度
  router.get('/diag/scan', async (req) => {
    const p = q(req);
    const sourceId = p.sourceId;
    if (!sourceId) return fail('缺少 sourceId');

    const tasks = taskManager.list(sourceId);
    let adapterProgress: any = null;
    try {
      const ad = (await getEnabledAdapters()).find((x) => x.cfg.id === sourceId)?.adapter as any;
      if (ad) {
        const total = (ad.tracks && ad.tracks.length) || 0;
        const complete = typeof ad.isScanComplete === 'function' ? ad.isScanComplete() : true;
        adapterProgress = { total, complete };
      }
    } catch { /* ignore */ }

    return jsonResponse({
      ok: true,
      sourceId,
      tasks,
      adapter: adapterProgress,
    });
  });

  // 指标快照
  router.get('/diag/metrics', async () => {
    return jsonResponse({ ok: true, metrics: metrics.snapshot() });
  });
}
