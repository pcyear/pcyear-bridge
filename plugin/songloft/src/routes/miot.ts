// miot（智能音箱投屏）插件代理路由
// 背景：宿主 SDK 的 apiGet/apiPost 强制给路径加本插件前缀 → 前端无法直接调其他插件接口；
// 前端又拿不到 access_token（宿主不注入），裸 fetch 会 401。
// 正解：宿主官方支持 songloft.plugin.getToken()（后端拿插件 JWT），且后端用
// 请求 Host 里的局域网 IP fetch 宿主自身毫秒级可达（host-cover/host-lyric 已验证，
// 铁律⑮ 仅针对 localhost 挂起）。因此由后端代拉 miot 插件接口，前端统一走本插件 /miot-proxy。

import { jsonResponse, type HTTPRequest, type HTTPResponse } from '@songloft/plugin-sdk';
import { q, errMsg } from '../lib/common';
import { hostBase } from '../lib/cover';

declare const songloft: any;

type Router = ReturnType<typeof import('@songloft/plugin-sdk').createRouter>;

const MIOT_ENTRY = 'miot';

function bytesToStr(b: Uint8Array | null | undefined): string {
  if (!b || !b.length) return '';
  try { return new (globalThis as any).TextDecoder().decode(b); }
  catch { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return s; }
}

/** 把宿主 SDK 的 POST body 规范化为 JSON 字符串（兼容 string / Uint8Array / 已解析对象） */
function bodyToJsonString(b: any): string | undefined {
  if (b == null) return undefined;
  if (typeof b === 'string') return b.length ? b : undefined;
  if (b instanceof Uint8Array || Array.isArray(b) || (b && typeof b.length === 'number')) {
    try { return new (globalThis as any).TextDecoder().decode(b as Uint8Array); } catch { /* fallthrough */ }
  }
  if (typeof b === 'object') { try { return JSON.stringify(b); } catch { /* ignore */ } }
  return undefined;
}

export function registerMiotRoutes(router: Router): void {
  const handler = async (req: HTTPRequest, method: string): Promise<HTTPResponse> => {
    const p = q(req);
    const path = p.path || '';
    if (!/^[a-zA-Z0-9_\-/]+$/.test(path)) return jsonResponse({ ok: false, message: '非法 path' }, 400);
    // 除 path 外的 query 参数透传给 miot 接口
    const rest: Record<string, string> = {};
    for (const k of Object.keys(p)) if (k !== 'path') rest[k] = p[k];
    const qs = Object.keys(rest).length
      ? '?' + Object.keys(rest).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(rest[k])).join('&')
      : '';
    try {
      const base = await hostBase();
      if (!base) return jsonResponse({ ok: false, message: '无法确定宿主地址' }, 500);
      const token = await songloft.plugin.getToken();
      const url = `${base}/api/v1/jsplugin/${MIOT_ENTRY}/${path}${qs}`;
      const headers: Record<string, string> = { Authorization: 'Bearer ' + token };
      let body: string | undefined;
      if (method === 'POST') {
        headers['Content-Type'] = 'application/json';
        body = bodyToJsonString(req.body);
      }
      // 10s 超时（AbortController 优先，缺则 race 兜底——与 lib/common fetchWithTimeout 同款）
      const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = setTimeout(() => { try { ac && ac.abort(); } catch { /* ignore */ } }, 10000);
      let resp: any;
      try {
        resp = await fetch(url, { method, headers, body, signal: ac ? ac.signal : undefined });
      } finally {
        clearTimeout(timer);
      }
      if (!resp || !resp.ok) {
        let msg = '';
        try { msg = (await resp.text()).slice(0, 200); } catch { /* ignore */ }
        return jsonResponse({ ok: false, status: resp && resp.status, message: `miot 接口 HTTP ${resp && resp.status}${msg ? '：' + msg : ''}` });
      }
      const text = await resp.text();
      try { return jsonResponse(JSON.parse(text || '{}')); }
      catch { return jsonResponse({ ok: true, raw: text }); }
    } catch (e: any) {
      return jsonResponse({ ok: false, message: 'miot 代理失败：' + errMsg(e) });
    }
  };
  router.get('/miot-proxy', (req) => handler(req, 'GET'));
  router.post('/miot-proxy', (req) => handler(req, 'POST'));
}
