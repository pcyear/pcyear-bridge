// 通用工具函数（从 main.ts 提取）

import { jsonResponse, parseQuery, type HTTPRequest, type HTTPResponse } from '@songloft/plugin-sdk';

/** 通用缓存键前缀 */
export const CACHE_PREFIX = 'msm_cache:';

export function readBody(req: HTTPRequest): any {
  if (!req.body) return {};
  try {
    const text = typeof req.body === 'string'
      ? req.body
      : new TextDecoder().decode(req.body as Uint8Array);
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export function q(req: HTTPRequest): Record<string, string> {
  const raw = parseQuery(req.query || '');
  const out: Record<string, string> = {};
  for (const k of Object.keys(raw)) {
    const v = (raw as any)[k];
    if (typeof v !== 'string') { out[k] = v; continue; }
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  }
  return out;
}

export function intOf(v: string | undefined, dflt: number): number {
  const n = parseInt(v || '', 10);
  return isNaN(n) ? dflt : n;
}

export function fail(message: string, status = 400): HTTPResponse {
  return jsonResponse({ ok: false, message }, status);
}

export function errMsg(e: any): string {
  return (e && e.message) || String(e);
}

// LRC 歌词标签处理：
//  - 时间标签 [mm:ss.xx] 原样保留；
//  - ID 标签 [ti:]/[ar:]/[al:]/[au:]/[by:] 按 LRC 规范转成可读文字（如「歌名：传奇」），随歌词一起展示，
//    不再整段丢弃（丢弃会导致 [ti:xxx] 泄漏或首行截断）；
//  - 指令型标签（[offset:]/[length:] 等）非展示内容，转空。
const LRC_TIME_TAG = /\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/;
const LRC_ANY_TAG = /\[[^\]]*\]/g;
const LRC_ID_TAG_LABEL: Record<string, string> = {
  ti: '歌名', ar: '歌手', al: '专辑', au: '作词', by: '制作',
};
/** 把一个 ID 标签（如 [ti:传奇]）转成可读文字；非展示型（offset/length 等）返回空串。 */
export function convertLrcIdTag(tag: string): string {
  const inner = tag.slice(1, -1);
  const ci = inner.indexOf(':');
  if (ci < 0) return '';
  const key = inner.slice(0, ci).trim().toLowerCase();
  const val = inner.slice(ci + 1).trim();
  if (!val) return '';
  const label = LRC_ID_TAG_LABEL[key];
  if (!label) return ''; // 非展示型指令标签不展示
  return `${label}：${val}`;
}
/** 把 ID 标签（[ti:]/[ar:]/[al:]/[au:]/[by:]）从行内提取成可读头部文字；
 *  时间标签原样保留；非展示型标签（[offset:]/[length:] 等）直接移除。
 *  返回 { header, line }：header 是转换后的可读文字（如「歌名：传奇」），line 是去掉 ID 标签后的剩余行。 */
export function extractLrcIdTagLine(line: string): { headers: string[]; line: string } {
  const headers: string[] = [];
  const remaining = (line || '').replace(LRC_ANY_TAG, (m) => {
    if (LRC_TIME_TAG.test(m)) return m;
    const meta = convertLrcIdTag(m);
    if (meta) headers.push(meta);
    return '';
  });
  return { headers, line: remaining.trim() };
}
export function stripLrcIdTags(s: string): string {
  return extractLrcIdTagLine(s).line;
}
// 归一化 LRC 文本：统一换行符、把所有展示型 ID 标签提取到顶部（按 LRC 规范应展示为可读文字），
// 时间标签原样保留。这样即使源文件把 [ar:]/[al:] 等标签散在行中，也不会插在歌词中间。
export function normalizeLrc(text: string): string {
  if (!text) return text;
  const headers: string[] = [];
  const lines: string[] = [];
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const { headers: h, line } = extractLrcIdTagLine(raw);
    headers.push(...h);
    if (line) lines.push(line);
  }
  return [...headers, ...lines].join('\n');
}

const LRC_DISPLAY_TAGS = new Set(['ti', 'ar', 'al', 'au', 'by']);
/**
 * 给插件前端（static/js/app.js 的 parseStandardLRC）用的归一化：保留时间标签与显示型元标签
 * （[ti:]/[ar:]/[al:]/[au:]/[by:]），只移除非显示型（[re:]/[ve:]/[length:]/[offset:] 等）。
 * 原因：歌词渲染与「标签转文字（歌名：）」由前端 parseStandardLRC 完成——它识别整行元标签并置顶。
 * 后端必须保留元标签，前端才能解析；若此处剥掉，前端只收到纯歌词，歌名/歌手信息丢失。
 * Subsonic/箭头音乐路径不走这里（走 normalizeLrc + parseLrcStructured 转文字）。
 */
export function normalizeLrcForPlayer(text: string): string {
  if (!text) return text;
  return text.replace(/\r\n?/g, '\n').split('\n').map(line =>
    line.replace(LRC_ANY_TAG, (m) => {
      if (LRC_TIME_TAG.test(m)) return m;
      const key = m.slice(1, -1).split(':')[0].trim().toLowerCase();
      return LRC_DISPLAY_TAGS.has(key) ? m : '';
    }).trim()
  ).filter(l => l.length > 0).join('\n');
}

/**
 * 兼容读取 fetch 响应体为 Uint8Array。
 * 宿主 QuickJS 运行时的 fetch Response 不一定实现 arrayBuffer()（直接调会抛 "not a function"），
 * 多数情况下响应体以 Uint8Array 形式挂在 .body 上。这里多形态兜底，确保流/封面代理稳定。
 */
export async function toBytes(resp: any): Promise<Uint8Array> {
  if (resp && typeof resp.arrayBuffer === 'function') {
    return new Uint8Array(await resp.arrayBuffer());
  }
  if (resp && resp.body != null) {
    if (resp.body instanceof Uint8Array) return resp.body;
    if (typeof resp.body === 'string') return new TextEncoder().encode(resp.body);
  }
  if (resp && typeof resp.bytes === 'function') {
    return new Uint8Array(await resp.bytes());
  }
  if (resp && typeof resp.text === 'function') {
    return new TextEncoder().encode(await resp.text());
  }
  return new Uint8Array(0);
}

/** 兼容读取响应头：支持 Headers.get 与普通对象两种形态 */
export function getHeader(resp: any, name: string): string | null {
  const h = resp && resp.headers;
  if (!h) return null;
  if (typeof h.get === 'function') {
    const v = h.get(name);
    return v == null ? null : String(v);
  }
  if (h && typeof h === 'object') {
    const lower = name.toLowerCase();
    for (const k of Object.keys(h)) if (k.toLowerCase() === lower) return String(h[k]);
  }
  return null;
}

/**
 * 宿主要求 HTTPResponse.body 为 base64 字符串（Go 侧反序列化时按 string 解析）。
 * QuickJS 运行时不一定有 btoa，故优先 btoa，缺失时回退到宿主 Go 桥 __go_buffer_to_string。
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const g = globalThis as any;
  if (typeof g.btoa === 'function') {
    // .186：32KB 分块批量转换，避免逐字节 O(n²) 拼接（1.7MB 封面编码 7~12s 超反代 10s 极限的根因）。
    let bin = '';
    for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768) as any);
    return g.btoa(bin);
  }
  if (typeof g.__go_buffer_to_string === 'function') {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
    return g.__go_buffer_to_string(hex, 'base64');
  }
  // 兜底手动 base64
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += table[b0 >> 2];
    out += table[((b0 & 3) << 4) | (b1 != null ? b1 >> 4 : 0)];
    out += b1 != null ? table[((b1 & 15) << 2) | (b2 != null ? b2 >> 6 : 0)] : '=';
    out += b2 != null ? table[b2 & 63] : '=';
  }
  return out;
}

/**
 * 把 Basic 鉴权以 user:pass@ 形式嵌入 URL，供浏览器 <audio>/<img> 直接带鉴权请求。
 * 背景：宿主 onHTTPRequest 无法回传二进制体（实测 Content-Length 正确但 body 为 0），
 * 所以内联预览播放 / 封面改用「上游直链」，而非插件二进制代理。
 */
export function embedBasicAuth(url: string, user?: string, pass?: string): string {
  if (!user && !pass) return url;
  try {
    const u = encodeURIComponent(user || '');
    const p = encodeURIComponent(pass || '');
    return url.replace(/^(https?:\/\/)/, `$1${u}:${p}@`);
  } catch { return url; }
}

/**
 * 带超时的 fetch：防止不可达/极慢 lyric_url 把单线程插件后端挂死十几秒。
 */
// 连接错误分类：区分「网络不通」vs「登录/鉴权失败」（前端三色状态点：绿=正常 / 黄=登录失败 / 红=网络不通）
export function classifyConnError(msg: string): 'ok' | 'auth' | 'network' {
  const s = String(msg || '').toLowerCase();
  // 网络层错误：连接/超时/DNS/SSL/fetch 失败（中英文都匹配）
  if (/timeout|timed ?out|connect|connection|refused|network|dns|econn|enotfound|etimedout|fetch failed|failed to fetch|socket|tls|ssl|unreachable|settimeout|超时|无法连接|连接失败|网络|不通|拒绝|不可达|连不上|time ?out/i.test(s)) return 'network';
  // 其余默认归「登录/鉴权失败」（401/403/密码/token/HTML 页面等）
  return 'auth';
}

export async function fetchWithTimeout(url: string, ms: number, headers?: Record<string, string>): Promise<any> {
  // 超时控制：优先用 AbortController + signal（能真正取消底层 fetch，避免泄漏占用单线程调度）。
  // 实测宿主 QuickJS 环境并非总有 AbortController（缺时 new 抛 ReferenceError）——
  // 特性检测：没有则退回 Promise.race（无法真取消，依赖宿主 fetch 自身连接超时兜底）。
  if (typeof AbortController !== 'undefined') {
    const ac = new AbortController();
    const timer = setTimeout(() => { try { ac.abort(); } catch {} }, ms);
    try {
      return await fetch(url, { signal: ac.signal, headers });
    } finally {
      clearTimeout(timer);
    }
  }
  return Promise.race([
    fetch(url, { headers }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}
