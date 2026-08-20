// UI 状态与通用缓存路由（从 main.ts 提取）

import { createRouter, jsonResponse } from '@songloft/plugin-sdk';
import { readBody, q, fail, errMsg, CACHE_PREFIX } from '../lib/common';

declare const songloft: any;

type Router = ReturnType<typeof createRouter>;

const UI_STATE_KEY = 'msm_ui_state';

export function registerUiRoutes(router: Router): void {
  router.get('/ui-state', async () => {
    try {
      const raw = await songloft.storage.get(UI_STATE_KEY);
      return jsonResponse({ ok: true, state: raw || null });
    } catch (e: any) {
      return fail('读取状态失败：' + errMsg(e));
    }
  });

  router.post('/ui-state', async (req) => {
    try {
      const body = readBody(req);
      await songloft.storage.set(UI_STATE_KEY, body.state || {});
      return jsonResponse({ ok: true });
    } catch (e: any) {
      return fail('保存状态失败：' + errMsg(e));
    }
  });

  // ============ 通用列表缓存（持久化到宿主 KV）============
  // 背景：web 端右键刷新框架后 localStorage 会被重置，列表缓存放本地会丢、每次重走音源网络(很慢,10s+)。
  // 这里把首屏列表/详情快照也存进宿主 KV：硬刷新后首启可从后端秒取，避免长等待。
  // 仅缓存首屏(limit 内)数据，drill 详情也较小，均远低于 KV 单条容量限制。
  router.get('/cache', async (req) => {
    try {
      const key = q(req).key;
      if (!key) return fail('缺少 key');
      const raw = await songloft.storage.get(CACHE_PREFIX + key);
      return jsonResponse({ ok: true, data: raw || null });
    } catch (e: any) { return fail('读取缓存失败：' + errMsg(e)); }
  });

  router.post('/cache', async (req) => {
    try {
      const body = readBody(req) as { key?: string; value?: any };
      if (!body || !body.key) return fail('缺少 key');
      await songloft.storage.set(CACHE_PREFIX + body.key, body.value == null ? null : body.value);
      return jsonResponse({ ok: true });
    } catch (e: any) { return fail('写缓存失败：' + errMsg(e)); }
  });
}
