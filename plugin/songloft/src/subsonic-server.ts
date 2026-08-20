// Subsonic 服务端 —— 对外提供 Subsonic REST API，让第三方客户端（Symfonium / DSub /
// Navidrome 等）浏览并播放本插件的聚合音源库。
//
// 设计要点（对齐官方 subsonic 插件的服务端模式）：
//  1. 路由挂在 /rest/:action 下（plugin.json 的 publicPaths 加 "/rest"），网关层不鉴权，
//     由本模块按 Subsonic 协议自行校验（u/p、enc:、t/s token、Basic）。
//  2. 每个已启用音源 = 一个「音乐文件夹」（musicFolderId = 音源 id）。
//  3. 所有对象 id 为自包含编码（base64url），解码即得 sourceId + 原生 id + 元数据，
//     无需全局索引；跨进程/重启 id 稳定。
//  4. 二进制（stream / getCoverArt）沿用宿主约束：QuickJS 无法回传二进制体，
//     故下载到插件数据目录临时文件后以 {serveFile:{filePath}} 由 Go 层读盘回传。

import {
  createRouter, jsonResponse, parseQuery,
  type HTTPRequest, type HTTPResponse,
} from '@songloft/plugin-sdk';
import { getAdapter, loadConfigs, SONGLOFT_SOURCE_ID } from './manager';
import { Track, Album, Artist, Playlist, SourceAdapter } from './types';
import { md5 } from './crypto';
import { resolveSongsBatch } from './lib/import';
import { resolveLyric } from './routes/lyric';
import { resolveCoverBytes, resolveCoverBytesInner, getAlbumCandidates } from './lib/cover';
import { toBytes, getHeader, convertLrcIdTag, normalizeLrc } from './lib/common';

// ============ 常量 ============
const API_VERSION = '1.16.1';
const SERVER_VERSION = '1.16.1';
const SERVER_TYPE = 'songloft';
const XMLNS = 'http://subsonic.org/restapi';
const CFG_KEY = 'subsonic_server_config';
const SEP = '\u0001';
const LIST_TTL = 10 * 60 * 1000;
// 本插件自身的路由前缀特征。任何 subsonic 音源指向它 = 自己调自己。
const SELF_PATH_MARK = '/jsplugin/multisource-music';
// 聚合端点里单个音源的最长等待时间。后端是单线程的：任一慢源都会拖垮所有 API，
// 故必须逐源限时，超时就当该源为空（铁律：对外抓取必须限时）。
const PER_SOURCE_TIMEOUT = 6000;

// ============ 工具 ============
function sl(): any { return (globalThis as any).songloft; }
function errMsg(e: any): string { return (e && e.message) || String(e); }

// ============ Subsonic 客户端写操作支撑（收藏 star / 歌单增改删）============
// 箭头音乐等 Subsonic 客户端连到本插件暴露的 Subsonic 服务端，其 star / 建歌单等写操作
// 此前被当作空占位（star 不落库、createPlaylist 无分支）。这里补齐：
//   - star/unstar → 复用「多源音乐桥·收藏」host 歌单（与 SongLoft UI 收藏共用，q-0 已定合并）；
//   - createPlaylist/updatePlaylist/deletePlaylist → 在 host 建/改/删歌单，自动同步到
//     箭头音乐（getPlaylists 读 host 歌单）与 SongLoft UI（/playlists 同源）。
const FAV_PL_KEY = 'msm_fav_playlist';
const FAV_PL_NAME = '多源音乐桥·收藏';

/** 解析 Subsonic 重复参数（如 createPlaylist 的 songId=..&songId=..）。
 *  同时兼容三种 query 形态：原始串（带或不带前导 ?）、SDK 已解析的对象、POST body。 */
function multiParams(req: HTTPRequest, key: string): string[] {
  const out: string[] = [];
  const qraw = (req && req.query) as any;
  if (typeof qraw === 'string') {
    const raw = qraw.replace(/^\?/, '');
    for (const pair of raw.split('&')) {
      if (!pair) continue;
      const idx = pair.indexOf('=');
      const k = decodeURIComponent(idx < 0 ? pair : pair.slice(0, idx));
      if (k !== key) continue;
      out.push(decodeURIComponent(idx < 0 ? '' : pair.slice(idx + 1)));
    }
  } else if (qraw && typeof qraw === 'object') {
    const v = qraw[key];
    if (Array.isArray(v)) out.push(...v.map(String));
    else if (v !== undefined) out.push(String(v));
  }
  try {
    const b = readBody(req);
    if (b && typeof b === 'object') {
      const v = (b as any)[key];
      if (Array.isArray(v)) out.push(...v.map(String));
      else if (v !== undefined) out.push(String(v));
    }
  } catch { /* ignore */ }
  // 兼容部分客户端把多个 id 用逗号拼进同一个参数（id=1,2,3）——展开成独立项。
  const expanded: string[] = [];
  for (const s of out) {
    if (s.includes(',')) expanded.push(...s.split(','));
    else expanded.push(s);
  }
  return expanded;
}

/** 解码 Subsonic 歌曲 id（encId('sg',...)），用自带元数据还原 Track，便于可靠入库（避免文本搜索） */
function decodeSongId(id: string): { sourceId: string; trackId: string; track: any } | null {
  const parts = decId(id || '');
  if (parts[0] !== 'sg' || !parts[1] || !parts[2]) return null;
  return {
    sourceId: parts[1], trackId: parts[2],
    track: {
      id: parts[2], title: parts[3] || '', artist: parts[4] || '', album: parts[5] || '',
      coverId: parts[6] || '', duration: Number(parts[7]) || 0, trackNo: Number(parts[8]) || 0,
      year: Number(parts[9]) || 0, size: Number(parts[10]) || 0, codec: parts[11] || '',
    },
  };
}

/** 把一批 Subsonic 歌曲 id 解析为主机歌曲 id（与播放/收藏同源路径 resolveSongsBatch） */
async function resolveStarIds(ids: string[]): Promise<number[]> {
  const items: { sid: string; trackId: string; track?: any }[] = [];
  for (const id of ids) {
    const d = decodeSongId(id);
    if (d) items.push({ sid: d.sourceId, trackId: d.trackId, track: d.track });
  }
  if (!items.length) return [];
  try {
    const res = await resolveSongsBatch(items, false, false);
    return res.filter(r => r.songId).map(r => r.songId);
  } catch (e: any) {
    sl().log.warn('[subsonic] resolveStarIds failed: ' + errMsg(e));
    return [];
  }
}

/** 确保「多源音乐桥·收藏」host 歌单存在（与 SongLoft UI 收藏共用同一歌单，q-0 已定） */
async function ensureFavPlaylist(): Promise<number | null> {
  try {
    const cached = await sl().storage.get(FAV_PL_KEY);
    if (cached) { try { const id = Number((JSON.parse(String(cached)) as any).id); if (id) return id; } catch {} }
    try {
      const list = await sl().playlists.search(FAV_PL_NAME);
      if (list && list.length) { const id = list[0].id; await sl().storage.set(FAV_PL_KEY, JSON.stringify({ id })); return id; }
    } catch { /* ignore */ }
    const pl = await sl().playlists.create({ name: FAV_PL_NAME });
    await sl().storage.set(FAV_PL_KEY, JSON.stringify({ id: pl.id }));
    return pl.id;
  } catch (e: any) {
    sl().log.warn('[subsonic] ensureFavPlaylist failed: ' + errMsg(e));
    return null;
  }
}

// 收藏集合缓存：用于歌曲对象上的 starred 标记（多数 Subsonic 客户端靠它显示「爱心」）。
// 缓存只读、允许轻微滞后；star/unstar/setRating 后主动刷新，亦在过期(>60s)时后台刷新。
let _favSet: Set<number> | null = null;
let _favSetAt = 0;
async function refreshFavSet(): Promise<void> {
  try {
    const plId = await ensureFavPlaylist();
    const set = new Set<number>();
    if (plId) {
      const songs = (await sl().playlists.getSongs(plId)) || [];
      for (const t of songs as any[]) { const id = Number(t.id); if (id) set.add(id); }
    }
    _favSet = set; _favSetAt = Date.now();
  } catch { /* 保留旧值 */ }
}
function favSetSync(): Set<number> {
  if (!_favSet || Date.now() - _favSetAt > 60000) refreshFavSet().catch(() => {});
  return _favSet || new Set();
}

// .177：这些 action 会输出歌曲节点；处理前同步刷新收藏集合，保证 starred/userStarred 实时。
const SONG_OUT_ACTIONS = new Set<string>([
  'search2', 'search3', 'getRandomSongs', 'getStarred', 'getStarred2',
  'getMusicDirectory', 'getAlbum', 'getArtist', 'getSong', 'getPlaylist',
  'getPlaylists', 'getAlbumList', 'getAlbumList2', 'getIndexes', 'getArtists',
  'getArtistInfo', 'getArtistInfo2',
]);

function utf8Encode(str: string): Uint8Array {
  try { return new TextEncoder().encode(str); } catch {
    const out: number[] = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else if (c < 0xd800 || c >= 0xe000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      else {
        i++;
        c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return new Uint8Array(out);
  }
}
function utf8Decode(u8: Uint8Array): string {
  try { return new TextDecoder().decode(u8); } catch {
    let s = '';
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return s;
  }
}

const B64C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64C[b0 >> 2];
    out += B64C[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64C[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64C[b2 & 0x3f] : '=';
  }
  return out;
}
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const pad = clean.length % 4 === 0 ? 0 : 4 - (clean.length % 4);
  const src = clean + '='.repeat(pad);
  const out: number[] = [];
  for (let i = 0; i < src.length; i += 4) {
    // 注意：'=' 填充位必须当作 0 参与计算（B64C.indexOf('=') 是 -1，直接 OR 会污染字节）
    const c0 = src[i] === '=' ? 0 : B64C.indexOf(src[i]);
    const c1 = src[i + 1] === '=' ? 0 : B64C.indexOf(src[i + 1]);
    const c2 = src[i + 2] === '=' ? 0 : B64C.indexOf(src[i + 2]);
    const c3 = src[i + 3] === '=' ? 0 : B64C.indexOf(src[i + 3]);
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    out.push((n >> 16) & 0xff);
    if (src[i + 2] !== '=') out.push((n >> 8) & 0xff);
    if (src[i + 3] !== '=') out.push(n & 0xff);
  }
  return new Uint8Array(out);
}
function b64urlEncode(str: string): string {
  return bytesToBase64(utf8Encode(str)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str: string): string {
  let s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  try { return utf8Decode(base64ToBytes(s)); } catch { return ''; }
}

function escXml(s: any): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function readBody(req: HTTPRequest): any {
  if (!req.body) return {};
  let text: string;
  try {
    text = typeof req.body === 'string'
      ? req.body
      : new TextDecoder().decode(req.body as Uint8Array);
  } catch { return {}; }
  if (!text) return {};
  const ct = (headerOf(req, 'Content-Type') || '').toLowerCase();
  // Subsonic 标准客户端（含箭头音乐）POST 时用 application/x-www-form-urlencoded 传参；
  // 旧实现只认 JSON，导致 body 里的鉴权(u/p/t/s)与数据(id/songId/songIdToRemove)全部丢失 →
  // 鉴权失败(code 40)或静默 no-op。这里兼容 urlencoded 与 JSON 两种形态。
  const looksForm = ct.includes('application/x-www-form-urlencoded')
    || (!ct.includes('application/json') && (text[0] === '?' || text.includes('=')) && !text.startsWith('{') && !text.startsWith('['));
  if (looksForm) {
    const out: Record<string, any> = {};
    for (const pair of text.replace(/^\?/, '').split('&')) {
      if (!pair) continue;
      const idx = pair.indexOf('=');
      const k = decodeURIComponent(idx < 0 ? pair : pair.slice(0, idx));
      if (!k) continue;
      const v = decodeURIComponent(idx < 0 ? '' : pair.slice(idx + 1));
      if (k in out) { // 重复 key（如 songId=1&songId=2）→ 收成数组
        if (!Array.isArray(out[k])) out[k] = [out[k]];
        out[k].push(v);
      } else out[k] = v;
    }
    return out;
  }
  try { return JSON.parse(text); } catch { return {}; }
}

// ============ 请求捕获（诊断用，公开只读 /subsonic-capture） ============
const SUBSONIC_REQ_LOG_KEY = 'subsonic_req_log';
// 公开暴露插件构建版本，便于远程确认真机跑的是哪一版（无需用户报版本号）。
let _pluginVersion: string | null = null;
async function getPluginVersion(): Promise<string> {
  if (_pluginVersion) return _pluginVersion;
  try {
    const raw = await sl().fs.readFile('plugin.json', { encoding: 'utf8' });
    _pluginVersion = (JSON.parse(raw).version as string) || 'unknown';
  } catch { _pluginVersion = 'unknown'; }
  return _pluginVersion;
}
function redactVal(k: string, v: any): any {
  if (k === 'p' || k === 't' || k === 's' || k === 'u' || k === 'password' || k === 'pass') return '<redacted>';
  return v;
}
// 高频且与歌词/列表无关的噪声请求，过滤掉以免冲掉关键请求（如 getSong/getLyrics*/getOpenSubsonicExtensions）。
const CAPTURE_NOISE = new Set(['getCoverArt', 'stream', 'ping', 'getAvatar', 'hls']);
async function captureSubsonicReq(action: string, req: HTTPRequest, p: Record<string, any>): Promise<void> {
  if (CAPTURE_NOISE.has(action)) return;
  const rec: any = {
    at: new Date().toISOString(),
    action,
    method: (req && (req as any).method) || '?',
    params: {} as Record<string, any>,
  };
  for (const k of Object.keys(p || {})) rec.params[k] = redactVal(k, p[k]);
  const arr = (await sl().storage.get(SUBSONIC_REQ_LOG_KEY)) || [];
  arr.push(rec);
  if (arr.length > 300) arr.shift();
  await sl().storage.set(SUBSONIC_REQ_LOG_KEY, arr);
}

function q(req: HTTPRequest): Record<string, string> {
  const raw = parseQuery(req.query || '');
  const out: Record<string, string> = {};
  for (const k of Object.keys(raw)) {
    const v = (raw as any)[k];
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

/** 合并 query + body 的参数（部分客户端 POST 时把鉴权参数放 body） */
function allParams(req: HTTPRequest): Record<string, string> {
  const out: Record<string, string> = {};
  const a = q(req);
  for (const k of Object.keys(a)) out[k] = a[k];
  try {
    const b = readBody(req);
    if (b && typeof b === 'object') for (const k of Object.keys(b)) if (out[k] === undefined) out[k] = String(b[k]);
  } catch { /* ignore */ }
  return out;
}

function headerOf(req: HTTPRequest, name: string): string {
  const h = (req && req.headers) || {};
  const v = h[name] ?? h[name.toLowerCase()] ?? h[name.toUpperCase()];
  return v == null ? '' : String(v);
}

// ============ 响应组装（XML / JSON 双格式） ============
interface Node {
  t: string;                                   // 标签名
  a?: Record<string, string | number | boolean>; // 属性
  c?: Node[];                                  // 子节点
  text?: string;                               // 纯文本内容（歌词）
}
function n(t: string, a?: Record<string, string | number | boolean>, c?: Node[], text?: string): Node {
  return { t, a: a || {}, c, text };
}
function toXml(node: Node): string {
  let s = '<' + node.t;
  const a = node.a || {};
  for (const k of Object.keys(a)) {
    const v = a[k];
    if (v === undefined || v === null || v === '') continue;
    s += ' ' + k + '="' + escXml(v) + '"';
  }
  if (node.text !== undefined) return s + '>' + escXml(node.text) + '</' + node.t + '>';
  if (!node.c || node.c.length === 0) return s + '/>';
  s += '>';
  for (const ch of node.c) s += toXml(ch);
  return s + '</' + node.t + '>';
}
function toJson(node: Node): any {
  const o: any = {};
  const a = node.a || {};
  for (const k of Object.keys(a)) {
    const v = a[k];
    if (v !== undefined && v !== null && v !== '') o[k] = v;
  }
  if (node.text !== undefined) { o.value = node.text; return o; }
  // Subsonic 协议中所有元素型子节点都是列表（数组）；单个元素也必须是数组，
  // 不能折叠成对象（否则客户端按数组解析会失败）。
  const groups: Record<string, Node[]> = {};
  for (const ch of node.c || []) (groups[ch.t] = groups[ch.t] || []).push(ch);
  for (const k of Object.keys(groups)) {
    o[k] = groups[k].map(toJson);
  }
  return o;
}

const LRC_TIME_TAG_G = /\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g;

// 把 LRC 文本解析为 OpenSubsonic 结构化歌词：{synced, line:[{start?, value}]}
// 支持 [mm:ss.xx] / [mm:ss.xxx] / [mm:ss] 三种时间标签；兼容 \r\n 与 \r 换行、一行多时间标签（每行展开为多行）。
// ID 标签（[ti:]/[ar:]/[al:]/[au:]/[by:]）按 LRC 规范转成可读文字，并统一提到最前面作为头部行（start:0），
// 避免原文件把标签散在行中间时导致歌词顺序错乱；头部行不参与「是否为同步歌词」的判定。
// 注意：OpenSubsonic 规范要求 line.start 为「毫秒整数」（参考官方 subsonic 插件：minutes*60000+seconds*1000+ms），
// 旧实现输出秒浮点（如 0.25）会被箭头音乐等严格客户端判为无效而丢弃整段歌词。
function parseLrcStructured(text: string): { synced: boolean; line: { start?: number; value: string }[] } {
  if (!text || !text.trim()) return { synced: false, line: [] };
  const headers: { start: 0; value: string }[] = [];
  const timed: { start: number; value: string }[] = [];
  const noTime: { value: string }[] = [];
  let anyTime = false;
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const times: { mm: number; ss: number; frac: number; d: number }[] = [];
    let lyricText = raw;
    for (const m of raw.matchAll(/\[([^\]]*)\]/g)) {
      const tag = m[0];
      const inner = m[1];
      const tm = /^(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?$/.exec(inner);
      if (tm) {
        times.push({ mm: +tm[1], ss: +tm[2], frac: tm[3] ? +tm[3] : 0, d: tm[3] ? tm[3].length : 0 });
      } else {
        // ID 标签（[ti:]/[ar:]/[al:]/[au:]/[by:]）：转可读文字提到最前
        const meta = convertLrcIdTag(tag);
        if (meta) headers.push({ start: 0, value: meta });
      }
      lyricText = lyricText.split(tag).join('');
    }
    const value = lyricText.trim();
    if (!value) continue;
    if (times.length) {
      for (const t of times) {
        const ms = t.d === 3 ? t.frac : t.d === 2 ? t.frac * 10 : t.d === 1 ? t.frac * 100 : 0;
        const start = Math.round((t.mm * 60 + t.ss) * 1000 + ms); // 毫秒整数
        timed.push({ start, value });
      }
      anyTime = true;
    } else {
      noTime.push({ value });
    }
  }
  if (headers.length === 0 && timed.length === 0 && noTime.length === 0) {
    return { synced: false, line: [{ start: 0, value: text.trim() }] };
  }
  // 只要存在带时间轴的行，就视为「有时间轴歌词」(synced=true)。
  // 之前用 `anyTime && noTime.length===0`：歌词里常见的「歌名/歌手」等无时间轴元数据行
  // 会让 noTime 非空，从而把整首歌误判成 synced=false。部分客户端(箭头音乐/Symfonium)对
  // getLyricsBySongId 要求 synced=true 才接受为有效平台歌词，synced=false 会被当「无歌词」丢弃。
  const synced = timed.length > 0;
  // 兜底：确保所有无时间戳行都带 start:0（毫秒整数），避免严格客户端（如箭头音乐）丢弃。
  const line = [
    ...headers,
    ...timed,
    ...noTime.map(l => ({ start: 0, value: l.value })),
  ];
  return { synced, line };
}

// 从 LRC 原始文本抽取 [ti:]/[ar:]/[al:]/[au:] 等 ID 标签。
// 用途：补全宿主记录里为空的 title/artist/album——本地库很多歌 artist/album 为空，
// 但 LRC 里带这些元数据（插件歌词视图能显示「歌名/歌手/专辑」，Subsonic 客户端却拿不到）。
function extractLrcMeta(text: string): { title?: string; artist?: string; album?: string; author?: string } {
  const meta: any = {};
  if (!text) return meta;
  // 1) 标准 LRC 括号标签：[ti:]/[ar:]/[al:]/[au:]
  const re = /\[([a-zA-Z]+):([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const key = (m[1] || '').toLowerCase();
    const val = (m[2] || '').trim();
    if (!val) continue;
    if ((key === 'ti' || key === 'title') && !meta.title) meta.title = val;
    else if ((key === 'ar' || key === 'artist') && !meta.artist) meta.artist = val;
    else if ((key === 'al' || key === 'album') && !meta.album) meta.album = val;
    else if ((key === 'au' || key === 'author') && !meta.author) meta.author = val;
  }
  // 2) 中文标签行（如「歌名：达拉崩吧」「歌手：洛天依/言和」「专辑：达拉崩吧」）：
  // 部分转换曲/第三方 LRC 不在括号里表达元数据，而是用中文前缀行。若括号标签未取到则补这部分。
  const lines = (text || '').split(/\r?\n/);
  for (const line of lines) {
    const tm = line.match(/^(?:歌名|歌曲|标题|歌)\s*[:：]\s*(.+?)\s*$/);
    if (tm && !meta.title) { meta.title = tm[1].trim(); continue; }
    const am = line.match(/^(?:歌手|演唱|艺人|作者)\s*[:：]\s*(.+?)\s*$/);
    if (am && !meta.artist) { meta.artist = am[1].trim(); continue; }
    const alm = line.match(/^(?:专辑)\s*[:：]\s*(.+?)\s*$/);
    if (alm && !meta.album) { meta.album = alm[1].trim(); continue; }
    const aum = line.match(/^(?:作词|作曲|原著)\s*[:：]\s*(.+?)\s*$/);
    if (aum && !meta.author) { meta.author = aum[1].trim(); continue; }
  }
  return meta;
}

// 把 LRC 文本去掉时间标签，ID 标签转成可读文字并提到最前（符合 Subsonic getLyrics 的纯文本 value）。
function stripLrcTags(text: string): string {
  return normalizeLrc(text || '')
    .replace(LRC_TIME_TAG_G, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .join('\n');
}

// 构造 OpenSubsonic 歌词响应（严格对齐 OpenSubsonic 官方规范 + 箭头音乐解析路径）：
//   getLyricsBySongId -> 顶层 lyricsList: { structuredLyrics: [{displayArtist,displayTitle,lang,offset,synced,line:[{start,value}]}] }
//                         （注意：顶层键是 lyricsList，不是 lyricsBySongId！箭头音乐读 response.lyricsList.structuredLyrics）
//   getLyrics         -> lyrics: { artist, title, value(纯文本) }，并附 structuredLyrics 兼容支持结构化歌词的客户端
// 注意：displayArtist/displayTitle/lang/offset/synced 都放在 structuredLyrics 条目内；start 为毫秒整数。
function okLyric(fmt: string, kind: 'lyricsBySongId' | 'lyrics', artist: string, title: string, lyricText: string): HTTPResponse {
  const { synced, line } = parseLrcStructured(lyricText);
  // OpenSubsonic 规范：lang 必须是 2 字母 ISO-639-1 代码（如 zh/en），"und" 是 3 字母，
  // 严格解析器会判整条非法而丢弃（箭头音乐/Symfonium 表现为「平台歌词没有」）。
  const lang = /[一-鿿]/.test(lyricText || '') ? 'zh' : 'en';
  // 用 LRC [ar:]/[al:]/[ti:] 补全宿主记录里为空的 artist/album/title（本地库常见 artist/album 空，
  // 但 LRC 带这些元数据——插件歌词视图能显示，Subsonic 客户端也必须拿到真实值）。
  const meta = extractLrcMeta(lyricText);
  const dispArtist = artist || meta.artist || 'Unknown Artist';
  const dispTitle = title || meta.title || 'Unknown';
  // displayArtist/displayTitle 必须始终输出：本地库很多歌 artist 为空，缺字段同样会让
  // 严格客户端（Symfonium）判定结构化歌词无效。
  const entry: any = { lang, synced, offset: 0, line };
  entry.displayArtist = dispArtist;
  entry.displayTitle = dispTitle;
  const structured = [entry];
  const plain = stripLrcTags(lyricText);
  if (fmt === 'json') {
    const body: any = { status: 'ok', version: API_VERSION, type: SERVER_TYPE, serverVersion: SERVER_VERSION, openSubsonic: true };
    if (kind === 'lyricsBySongId') {
      // 官方规范：getLyricsBySongId 的顶层键是 lyricsList（很多客户端如箭头音乐直接读 response.lyricsList.structuredLyrics）
      body.lyricsList = { structuredLyrics: structured };
    } else {
      body.lyrics = { artist, title, value: plain, structuredLyrics: structured };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ 'subsonic-response': body }),
    };
  }
  // XML 兼容：顶层用 lyricsList（与官方规范一致）。lang 必须用 2 字母 ISO-639-1（如 zh），
  // 之前硬编码 'und'（3 字母）会被严格 XML 解析器判非法并丢弃整段歌词。
  const lineNodes = line.map(l => n('line', ('start' in l ? { start: l.start } : {}), [], l.value));
  const structuredNode = n('structuredLyrics', {}, [n('lyric', { lang, synced, offset: 0 }, lineNodes)]);
  if (kind === 'lyricsBySongId') {
    return okResp('xml', n('lyricsList', {}, [structuredNode]));
  }
  return okResp('xml', n('lyrics', { artist, title }, [n('value', {}, [], plain), n('structuredLyrics', {}, [structuredNode])]));
}

function okResp(fmt: string, payload: Node | null, extra?: Record<string, string | number | boolean>): HTTPResponse {
  const base: Record<string, string | number | boolean> = {
    status: 'ok', version: API_VERSION, type: SERVER_TYPE, serverVersion: SERVER_VERSION, openSubsonic: true,
  };
  if (extra) for (const k of Object.keys(extra)) base[k] = extra[k];
  if (fmt === 'json') {
    const root: any = { ...base };
    // 关键：payload 必须按自己的标签包一层（如 {"song":{...}} / {"artists":{...}}），
    // 直接展开会丢失标签、结构与 Subsonic 协议不符。
    if (payload) root[payload.t] = toJson(payload);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ 'subsonic-response': root }),
    };
  }
  // xmlns 是 Subsonic 协议强制项：命名空间感知的客户端解析器缺了它会一个元素都找不到（列表全空）
  const root: Node = { t: 'subsonic-response', a: { xmlns: XMLNS, ...base }, c: payload ? [payload] : [] };
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Cache-Control': 'no-cache' },
    body: '<?xml version="1.0" encoding="UTF-8"?>\n' + toXml(root),
  };
}
function errResp(fmt: string, code: number, message: string, httpStatus?: number): HTTPResponse {
  const base: Record<string, string | number | boolean> = {
    status: 'failed', version: API_VERSION, type: SERVER_TYPE, serverVersion: SERVER_VERSION, openSubsonic: true,
  };
  const errNode = n('error', { code, message });
  const statusCode = httpStatus || 200;
  if (fmt === 'json') {
    // 协议要求错误体嵌在 error 下：{"subsonic-response":{"status":"failed","error":{"code":40,...}}}，
    // 平铺成 {...,"code":40} 客户端读不到错误码，只会显示一片空白
    return {
      statusCode,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ 'subsonic-response': { ...base, error: toJson(errNode) } }),
    };
  }
  return {
    statusCode,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    body: '<?xml version="1.0" encoding="UTF-8"?>\n' + toXml(n('subsonic-response', { xmlns: XMLNS, ...base }, [errNode])),
  };
}

// ============ 配置 ============
export interface SubsonicServerConfig {
  enabled: boolean;
  username?: string;
  password?: string;
  /** 对外可达的服务器地址（如 http://192.168.31.61:58091 或公网域名）。
   *  用于 302 重定向给第三方客户端（客户端必须能访问）。
   *  注意：不能用 songloft.plugin.getHostUrl() 返回的 localhost——宿主对 localhost 请求
   *  只返回占位/截断内容。前端保存配置时自动填 location.origin。 */
  host?: string;
  /** 插件内部 fetch 宿主用的地址（如 http://192.168.31.61:58091）。
   *  插件（运行在 NAS 上）若用公网域名/回环地址取流会拿到截断内容（实测 1KB 占位），
   *  必须用宿主所在局域网内网地址。为空则回退用 host。 */
  internalHost?: string;
  /** 仅推送 SongLoft 本地库（true）还是包含全部外部音源（false）。默认 true：外部源在
   *  Subsonic 客户端里播放依赖宿主库已导入（ensure-songs），且需外部源直链可达，不可靠。 */
  localOnly?: boolean;
}
async function loadServerConfig(): Promise<SubsonicServerConfig> {
  try {
    const c = await sl().storage.get(CFG_KEY);
    if (c && typeof c === 'object') {
      return {
        enabled: !!c.enabled,
        username: c.username || '',
        password: c.password || '',
        host: c.host || '',
        internalHost: c.internalHost || '',
        localOnly: c.localOnly !== false,
      };
    }
  } catch { /* ignore */ }
  return { enabled: false, username: '', password: '', localOnly: true };
}
async function saveServerConfig(cfg: SubsonicServerConfig): Promise<void> {
  await sl().storage.set(CFG_KEY, cfg);
}

// ============ 鉴权 ============
/** 最近几次鉴权请求的参数摘要（仅诊断用，不含明文密码）。 */
const authDebugLog: any[] = [];
async function checkAuth(p: Record<string, string>, req: HTTPRequest, action: string): Promise<{ ok: boolean; user: string }> {
  const cfg = await loadServerConfig();
  if (!cfg.enabled) return { ok: false, user: '' };
  const uname = cfg.username || '';
  const upass = cfg.password || '';
  // 未设置账号密码：视为不鉴权（局域网内使用）
  if (!uname && !upass) return { ok: true, user: '' };
  const u = p.u || '';
  const pw = p.p || '';
  const tok = p.t || '';
  const salt = p.s || '';
  const authH = headerOf(req, 'Authorization');
  // 用户名通配：管理员未设 username（空）时接受任意用户名，只验密码/token。
  // 否则必须严格匹配（多用户场景或第三方客户端固定传 admin 等用户名）。
  const userOk = !uname || u === uname;
  let okNow = false;
  // 1) HTTP Basic
  if (authH && /^basic\s/i.test(authH)) {
    try {
      const cred = utf8Decode(base64ToBytes(authH.replace(/^basic\s+/i, '')));
      const i = cred.indexOf(':');
      const bu = cred.slice(0, i);
      const bp = cred.slice(i + 1);
      if (userOk && bp === upass) okNow = true;
    } catch { /* 解析失败继续走其它方式 */ }
  }
  // 2) u + p（支持 enc:md5hex 形式：内容是明文密码的 md5 十六进制）
  if (!okNow && userOk && pw) {
    if (pw.startsWith('enc:')) {
      try { if (md5(upass) === pw.slice(4).toLowerCase()) okNow = true; } catch { /* ignore */ }
    } else if (pw === upass) {
      okNow = true;
    }
  }
  // 3) token 认证：t = md5(password + salt)
  if (!okNow && userOk && tok && salt) {
    try { if (md5(upass + salt) === tok.toLowerCase()) okNow = true; } catch { /* ignore */ }
  }
  // 记录诊断摘要（不记明文密码），保留最近 20 条
  authDebugLog.push({
    at: new Date().toISOString(),
    action,
    id: String(p.id || '').slice(0, 30),
    c: String(p.c || ''),
    ua: String(headerOf(req, 'User-Agent')).slice(0, 40),
    u, uLen: u.length, matchU: u === uname,
    hasP: !!pw, pLen: pw.length, pEnc: pw.startsWith('enc:'),
    hasT: !!tok, tLen: tok.length, hasS: !!salt,
    hasBasic: /^basic\s/i.test(authH), ok: okNow,
  });
  if (authDebugLog.length > 20) authDebugLog.shift();
  if (okNow) return { ok: true, user: u };
  return { ok: false, user: '' };
}
/** 供管理端读取最近几次鉴权摘要（排查客户端 401）。 */
export function subsonicAuthDebug(): any {
  return { ok: true, log: authDebugLog };
}

// ============ 对象 id 编解码（自包含，跨重启稳定） ============
function encId(...parts: string[]): string { return b64urlEncode(parts.join(SEP)); }
function decId(id: string): string[] {
  const s = b64urlDecode(id);
  if (!s) return [];
  return s.split(SEP);
}
function songIdOf(sourceId: string, t: Track): string {
  // v1.4.52.165：剔除易变字段（coverId/duration/codec/size/trackNo/year），
  // 只编码稳定身份+展示字段，保证同一首歌在「收藏歌单」与「搜索/列表」两来源生成的 id 恒定，
  // 客户端按 id 比对收藏状态/点亮爱心才能成立（收藏 id 不稳定根因）。
  return encId('sg', sourceId, t.id || '', t.title || '', t.artist || '', t.album || '');
}
function artistIdOf(sourceId: string, ar: Artist): string {
  return encId('ar', sourceId, ar.id || '', ar.name || '');
}
function albumIdOf(sourceId: string, al: Album): string {
  return encId('al', sourceId, al.id || '', al.name || '', al.artist || '', al.coverId || '');
}
function playlistIdOf(sourceId: string, pl: Playlist): string {
  return encId('pl', sourceId, pl.id || '', pl.name || '');
}
function coverIdOf(sourceId: string, coverId: string): string {
  return encId('cov', sourceId, coverId);
}
function folderIdOf(sourceId: string): string {
  return encId('folder', sourceId);
}
/** 把客户端传来的 musicFolderId（编码后的 folder id）解析回音源 id；原生 sourceId 也兼容 */
function resolveFolderId(raw: string): string {
  const parts = decId(raw || '');
  if (parts[0] === 'folder' && parts[1]) return parts[1];
  return raw || '';
}

// ============ 列表内存缓存（TTL） ============
const listCache = new Map<string, { at: number; val: any }>();
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = listCache.get(key);
  if (hit && Date.now() - hit.at < LIST_TTL) return hit.val;
  const val = await fn();
  listCache.set(key, { at: Date.now(), val });
  return val;
}

// ============ 数据源访问 ============
/**
 * 判断某个 subsonic 音源是否指回本插件自己的 Subsonic 服务端。
 * 这是致命配置：聚合端点会去调自己，而后端是单线程的 —— 请求永远等不到回包，
 * 整个插件的所有 API 一起 504（现象：第三方客户端能连上但歌曲列表全空）。
 */
export function isSelfSubsonicUrl(baseUrl: string): boolean {
  return String(baseUrl || '').toLowerCase().indexOf(SELF_PATH_MARK) >= 0;
}
/** 逐源限时：超时不抛错，返回兜底值，避免单个慢源拖死整个聚合请求。 */
function perSource<T>(p: Promise<T>, fb: T, ms?: number): Promise<T> {
  return Promise.race([
    p.catch(() => fb),
    new Promise<T>((resolve) => setTimeout(() => resolve(fb), ms || PER_SOURCE_TIMEOUT)),
  ]);
}

async function enabledSources(): Promise<{ id: string; name: string; adapter: SourceAdapter }[]> {
  const cfg = await loadServerConfig();
  const out: { id: string; name: string; adapter: SourceAdapter }[] = [];
  if (cfg.localOnly !== false) {
    // 仅推送 SongLoft 本地库（外部源在 Subsonic 客户端播放依赖宿主库导入 + 外部直链，不可靠）
    try {
      const ad = await getAdapter(SONGLOFT_SOURCE_ID);
      out.push({ id: SONGLOFT_SOURCE_ID, name: 'SongLoft 本地库', adapter: ad });
    } catch { /* ignore */ }
    return out;
  }
  const configs = await loadConfigs();
  for (const c of configs) {
    if (c.enabled === false) continue;
    // 自引用源直接剔除，否则整个插件会被自己的请求锁死
    if (c.type === 'subsonic' && isSelfSubsonicUrl((c as any).baseUrl)) {
      sl().log.warn('[subsonic] 跳过自引用音源「' + (c.name || c.id) + '」：其地址指向本插件自身，会导致请求死锁');
      continue;
    }
    try {
      const ad = await getAdapter(c.id);
      out.push({ id: c.id, name: c.name || c.type, adapter: ad });
    } catch { /* 单个源失败跳过 */ }
  }
  // 内置 SongLoft 本地库也作为一个文件夹
  if (!out.some(x => x.id === SONGLOFT_SOURCE_ID)) {
    try {
      const ad = await getAdapter(SONGLOFT_SOURCE_ID);
      out.unshift({ id: SONGLOFT_SOURCE_ID, name: 'SongLoft 本地库', adapter: ad });
    } catch { /* ignore */ }
  }
  return out;
}
async function adapterOf(sourceId: string): Promise<SourceAdapter> {
  return getAdapter(sourceId);
}

// 艺术家列表（含缓存）
/**
 * 逐源取列表：命中缓存直接返；否则限时拉取。
 * 关键：超时/失败**不写缓存**，否则一次网络抖动会把「空库」固化 LIST_TTL（10 分钟），
 * 用户看到的就是「第三方客户端里一首歌都没有」。
 */
async function listCachedOf<T>(key: string, run: () => Promise<{ list?: T[] } | null>): Promise<T[]> {
  const hit = listCache.get(key);
  if (hit && Date.now() - hit.at < LIST_TTL) return hit.val;
  const r = await perSource<{ list?: T[] } | null>(run(), null);
  if (!r) return [];
  const list = (r.list || []) as T[];
  listCache.set(key, { at: Date.now(), val: list });
  return list;
}
async function listArtistsCached(sourceId: string): Promise<Artist[]> {
  return listCachedOf<Artist>('ar|' + sourceId, async () => {
    const ad = await adapterOf(sourceId);
    return ad.listArtists({ limit: 3000, offset: 0 });
  });
}
async function listAlbumsCached(sourceId: string): Promise<Album[]> {
  return listCachedOf<Album>('al|' + sourceId, async () => {
    const ad = await adapterOf(sourceId);
    return ad.listAlbums({ limit: 3000, offset: 0 });
  });
}
async function listTracksCached(sourceId: string): Promise<Track[]> {
  return listCachedOf<Track>('tr|' + sourceId, async () => {
    const ad = await adapterOf(sourceId);
    return ad.listTracks({ limit: 3000, offset: 0 });
  });
}

function norm(s: string): string { return String(s || '').toLowerCase().trim(); }

/** 给 Promise 加超时，避免某个源（尤其外部 Subsonic 上游）慢查询拖垮整个歌词请求 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const tm = setTimeout(() => reject(new Error('timeout ' + ms + 'ms')), ms);
    p.then((v) => { clearTimeout(tm); resolve(v); }, (e) => { clearTimeout(tm); reject(e); });
  });
}

/**
 * 按 artist+title 在搜索结果里挑最匹配的曲目（对齐官方 subsonic 插件 getLyrics 的匹配逻辑）。
 * 原实现只验 artist 子串、不验 title，导致上游模糊搜索取错歌/取不到 → 歌词空。
 * 这里：title 优先精确匹配（lc），再按 artist 精确/包含兜底，最后退到首个候选。
 * title 为空（仅 artist）时退回原 artist 子串逻辑，保持兼容。
 */
function bestLyricMatch(tracks: Track[], title: string, artist: string): Track | null {
  if (!tracks || !tracks.length) return null;
  const lt = norm(title), la = norm(artist);
  if (!lt) {
    return tracks.find(x => !la || !x.artist || norm(x.artist).indexOf(la) >= 0) || tracks[0];
  }
  let exact: Track | null = null, artistHit: Track | null = null, first: Track | null = null;
  for (const x of tracks) {
    const rt = norm(x.title || ''), ra = norm(x.artist || '');
    if (rt === lt) {
      if (la && ra === la) { exact = x; break; }
      if (!artistHit && (!la || ra.includes(la) || la.includes(ra))) artistHit = x;
      if (!first) first = x;
    }
  }
  return exact || artistHit || first;
}

// 歌名归一化（用于跨源/本地库搜索兜底）：剥离括号内容及常见后缀词，提升「正式版 / 现场版 / 伴奏」
// 等后缀导致的匹配失败。例：「达拉崩吧正式版」→「达拉崩吧」，使其能命中宿主本地库同名歌曲。
function normalizeTitleForSearch(t: string): string {
  let s = String(t || '').trim();
  if (!s) return s;
  s = s.replace(/[\(\[（【〈《][^\)\]）】〉》]*[\)\]）】〉》]/g, ' ');
  s = s.replace(/(正式版|现场版|伴奏|原版|完整版|官方版|高清版|翻唱|Demo|Cover|Remastered|Live|MV|版|版)$/gi, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** 宿主聚合歌词兜底：在本地库按 title 搜出宿主歌曲，再走 SongloftAdapter.lyric（读 lyric_url/lyric_remote_url）。
 *  对应官方 subsonic 插件的 songloft.songs.search + /api/v1/songs/{id}/lyric，覆盖上游无歌词的曲目。 */
async function hostLyricFallback(title: string, artist: string): Promise<string | null> {
  if (!title) return null;
  try {
    const localAd = await getAdapter(SONGLOFT_SOURCE_ID);
    if (typeof localAd.search !== 'function' || typeof localAd.lyric !== 'function') return null;
    const r: any = await localAd.search(title, { limit: 20 });
    const t = bestLyricMatch(r.tracks || [], title, artist);
    if (t && t.id) return (await localAd.lyric(String(t.id))) || null;
  } catch { /* ignore */ }
  return null;
}

// 读宿主侧「同名 .lrc」副车文件：从宿主歌曲记录（file_path 或 source_data.path）推导 .lrc 路径，
// 经 songloft.fs 读取。宿主播放器能直接读 sidecar，但未必把它写进歌曲 lyric 字段，
// 导致第三方 Subsonic 客户端（箭头音乐等）拿不到本地/外部源歌曲的磁盘歌词。返回 null 表示无副车或读取失败。
async function readHostSidecarLyric(hostId: number, sourceId: string, trackId: string): Promise<string | null> {
  let fp = '';
  if (hostId) {
    try {
      const song: any = await sl().songs.getById(hostId);
      if (song) {
        fp = String(song.file_path || song.path || '');
        if (!fp && song.source_data) {
          try {
            const sd = typeof song.source_data === 'string' ? JSON.parse(song.source_data) : song.source_data;
            if (sd && sd.path) fp = String(sd.path);
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }
  if (!fp && sourceId && trackId) {
    // 兜底：从源适配器拿曲目文件路径（部分适配器暴露 getTrackPath）
    try {
      const ad = await getAdapter(sourceId);
      const trk: any = ad && typeof (ad as any).getTrackPath === 'function' ? await (ad as any).getTrackPath(trackId) : null;
      if (trk) fp = String(trk);
    } catch { /* ignore */ }
  }
  if (!fp) return null;
  const dot = fp.lastIndexOf('.');
  const lrc = (dot > 0 ? fp.slice(0, dot) : fp) + '.lrc';
  try {
    const raw = await sl().fs.readFile(lrc, { encoding: 'utf8' });
    if (raw && String(raw).trim()) return String(raw);
  } catch { /* ignore */ }
  return null;
}

// 取歌词文本统一入口：
//  1) 优先宿主歌曲已存 lyric（getHostSongId 映射命中时最快最准）；
//  2) 其次读宿主侧同名 .lrc 副车文件；
//  3) 回退跨源搜索上游 LRC（适配器自身会回退读 sidecar，如 geak.lyric）；
//  4) 标题兜底：宿主本地库按歌名搜已存歌词——插件内能显示歌词即源于此，最稳。
// 第 4 步专门覆盖「getHostSongId 的 sourceId:trackId 映射缺失」场景（如 GEAK 歌曲未写回 songMap），
// 且剥离「正式版/现场版」等后缀，使「达拉崩吧正式版」也能命中宿主库里的「达拉崩吧」，
// 这正是箭头音乐经 Subsonic 推流「有歌无词」的根因（跨源实时取词读不到 NAS 副车，而宿主库已入库）。
async function getLyricText(sourceId: string, trackId: string, title: string, artist: string): Promise<string | null> {
  let text: string | null = null;
  let hostId = 0;
  try { hostId = await getHostSongId(sourceId, trackId); } catch { /* ignore */ }
  if (hostId) {
    try {
      const localAd = await getAdapter(SONGLOFT_SOURCE_ID);
      if (localAd && typeof localAd.lyric === 'function') {
        const t = await withTimeout(localAd.lyric(String(hostId)), 5000);
        if (t && t.trim()) text = t;
      }
    } catch { /* ignore */ }
  }
  if (!text) {
    text = await readHostSidecarLyric(hostId, sourceId, trackId);
  }
  if (!text) {
    text = (await resolveLyric({ sourceId, trackId, title, artist })) || null;
  }
  if (!text && title) {
    // 宿主本地库按歌名搜已存歌词；先原始标题，再剥离后缀的归一化标题，提升「正式版」等后缀命中率。
    let hf = await hostLyricFallback(title, artist);
    if (!hf) hf = await hostLyricFallback(normalizeTitleForSearch(title), artist);
    text = hf || null;
  }
  return text && text.trim() ? text : null;
}

// 艺术家 → 专辑列表：优先按专辑列表过滤艺术家，兜底按艺术家歌曲聚合
async function albumsOfArtist(sourceId: string, artistName: string): Promise<Album[]> {
  try {
    const albums = await listAlbumsCached(sourceId);
    const hit = albums.filter(al => al.artist && norm(al.artist) === norm(artistName));
    if (hit.length) return hit;
  } catch { /* 继续兜底 */ }
  // 兜底：拉该艺术家全部歌曲按专辑名聚合
  try {
    const ad = await adapterOf(sourceId);
    const r = await ad.artistTracks(artistName, { limit: 3000, offset: 0 });
    const map = new Map<string, Album>();
    for (const t of (r && r.list) || []) {
      const name = t.album || '未知专辑';
      if (!map.has(name)) map.set(name, { id: '@name:' + name, name, artist: artistName, coverId: t.coverId });
    }
    return Array.from(map.values());
  } catch { return []; }
}

// 专辑 → 歌曲：真实专辑走 albumTracks；@name: 伪专辑走搜索过滤
async function tracksOfAlbum(sourceId: string, album: Album): Promise<Track[]> {
  const name = album.name;
  try {
    if (album.id && !String(album.id).startsWith('@name:')) {
      const ad = await adapterOf(sourceId);
      const r = await ad.albumTracks(album.id, { limit: 3000, offset: 0 });
      if ((r && r.list && r.list.length) || album.artist) return (r && r.list) || [];
    }
  } catch { /* 兜底搜索 */ }
  try {
    const ad = await adapterOf(sourceId);
    const r = await ad.search(name, { limit: 200 });
    let list = (r && r.tracks) || [];
    if (album.artist) {
      const filtered = list.filter(t => t.album && (norm(t.album) === norm(name) || norm(t.album).indexOf(norm(name)) >= 0));
      if (filtered.length) list = filtered;
    }
    return list;
  } catch { return []; }
}

// ============ 元素构建 ============
/** 按编码（codec/suffix）推断 MIME Content-Type。第三方客户端（尤其移动端）常依赖
 *  contentTyp 识别可播放媒体；缺了可能整批丢弃歌曲（列表显空）。 */
function contentTypeOf(codec: string): string {
  const c = String(codec || '').toLowerCase();
  if (/m4a|mp4|m4b|mov|mp41|mp42/i.test(c)) return 'audio/mp4';
  if (/flac/i.test(c)) return 'audio/flac';
  if (/ogg|opus/i.test(c)) return 'audio/ogg';
  if (/wav/i.test(c)) return 'audio/wav';
  if (/aac/i.test(c)) return 'audio/aac';
  if (/mka|matroska/i.test(c)) return 'audio/x-matroska';
  if (/ape/i.test(c)) return 'audio/x-ape';
  return 'audio/mpeg';
}
function songNode(sourceId: string, t: Track): Node {
  const coverArt = t.coverId ? coverIdOf(sourceId, t.coverId) : undefined;
  const starred = (sourceId === SONGLOFT_SOURCE_ID && favSetSync().has(Number(t.id))) ? new Date().toISOString() : undefined;
  // .165：补 albumId/artistId/parent/bitRate/discNumber（Navidrome 系客户端据此归类）；
  // .177：path 强制 String、duration 转整数（强类型客户端整表解析失败根因）。
  const albumName = t.album || (sourceId === SONGLOFT_SOURCE_ID ? 'SongLoft' : '');
  const albumId = albumIdOf(sourceId, { id: '@name:' + albumName, name: albumName, artist: t.artist, coverId: t.coverId });
  const artistId = t.artist ? artistIdOf(sourceId, { id: '@name:' + t.artist, name: t.artist }) : undefined;
  return n('song', {
    id: songIdOf(sourceId, t),
    title: t.title,
    artist: t.artist || '未知艺人',
    album: albumName,
    albumId,
    artistId,
    parent: albumId,
    duration: Math.round(t.duration || 0),
    track: t.trackNo || 0,
    year: t.year || 0,
    size: t.size || 0,
    contentType: contentTypeOf(t.codec),
    suffix: t.codec || 'mp3',
    bitRate: t.bitrate || 0,
    discNumber: t.discNo || 0,
    coverArt: coverArt as any,
    path: String(t.path || t.id || ''),
    isDir: false,
    ...(starred ? { starred, userStarred: true } : {}),
  });
}
function albumNode(sourceId: string, al: Album): Node {
  const coverArt = al.coverId ? coverIdOf(sourceId, al.coverId) : undefined;
  return n('album', {
    id: albumIdOf(sourceId, al),
    name: al.name,
    artist: al.artist || '',
    year: al.year || 0,
    songCount: al.trackCount || 0,
    coverArt: coverArt as any,
  });
}
function artistNode(sourceId: string, ar: Artist): Node {
  return n('artist', {
    id: artistIdOf(sourceId, ar),
    name: ar.name,
    albumCount: ar.albumCount || 0,
    coverArt: ar.coverId ? (coverIdOf(sourceId, ar.coverId) as any) : undefined,
  });
}
// getMusicDirectory 的 child 条目（artist/album/song 统一成 child）
function childOf(sourceId: string, type: 'ar' | 'al' | 'sg', ref: any): Node {
  if (type === 'ar') {
    const ar = ref as Artist;
    return n('child', { id: artistIdOf(sourceId, ar), title: ar.name, artist: ar.name, isDir: true, albumCount: ar.albumCount || 0 });
  }
  if (type === 'al') {
    const al = ref as Album;
    return n('child', {
      id: albumIdOf(sourceId, al),
      title: al.name,
      artist: al.artist || '',
      album: al.name,
      isDir: true,
      coverArt: al.coverId ? (coverIdOf(sourceId, al.coverId) as any) : undefined,
    });
  }
  const t = ref as Track;
  // 歌曲封面 id 加 song: 作用域前缀：getCoverArt 据此只解析「这首歌自身」的封面，
  // 不继承所属专辑封面（无封面即不显示）。专辑/艺人封面用原生歌曲 id（见 childOf('al')），
  // 走同专辑候选回退。标准 Subsonic：track.coverArt 通常指的是该曲自身封面。
  const coverArt = t.coverId ? coverIdOf(sourceId, 'song:' + t.coverId) : undefined;
  const starred = (sourceId === SONGLOFT_SOURCE_ID && favSetSync().has(Number(t.id))) ? new Date().toISOString() : undefined;
  // .165/.177：同 songNode 的 albumId/artistId/parent/bitRate/discNumber + path String + duration 整数。
  const albumName = t.album || (sourceId === SONGLOFT_SOURCE_ID ? 'SongLoft' : '');
  const albumId = albumIdOf(sourceId, { id: '@name:' + albumName, name: albumName, artist: t.artist, coverId: t.coverId });
  const artistId = t.artist ? artistIdOf(sourceId, { id: '@name:' + t.artist, name: t.artist }) : undefined;
  return n('child', {
    id: songIdOf(sourceId, t),
    title: t.title,
    artist: t.artist || '未知艺人',
    album: albumName,
    albumId,
    artistId,
    parent: albumId,
    duration: Math.round(t.duration || 0),
    track: t.trackNo || 0,
    year: t.year || 0,
    contentType: contentTypeOf(t.codec),
    coverArt: coverArt as any,
    suffix: t.codec || 'mp3',
    bitRate: t.bitrate || 0,
    discNumber: t.discNo || 0,
    isDir: false,
    ...(starred ? { starred, userStarred: true } : {}),
  });
}
// 按首字母分组（非 A-Z 归 "#"）
function indexGroups(items: { name: string }[]): { letter: string; list: any[] }[] {
  const groups = new Map<string, any[]>();
  for (const it of items) {
    let ch = String(it.name || '').trim().charAt(0).toUpperCase();
    if (!ch || !/^[A-Z]$/.test(ch)) ch = '#';
    if (!groups.has(ch)) groups.set(ch, []);
    groups.get(ch)!.push(it);
  }
  const out: { letter: string; list: any[] }[] = [];
  for (const [letter, list] of groups) out.push({ letter, list });
  out.sort((a, b) => (a.letter === '#' ? 1 : b.letter === '#' ? -1 : a.letter < b.letter ? -1 : 1));
  return out;
}

// ============ URL 拼装 ============

/** 宿主歌曲的 url/cover_url 常为相对路径（/api/v1/...），QuickJS fetch 无法抓相对地址，
 *  需要补全为绝对地址并追加 access_token（与 /host-lyric 抓取逻辑一致）。
 *  重要：songloft.plugin.getHostUrl() 返回 localhost，宿主对 localhost 请求只返回占位/截断内容
 *  （实测 4KB 而非完整 12MB、全量请求挂起 30s）。
 *  - internal=true（插件内 fetch，如封面代理/歌词）：优先用配置的 internalHost（内网地址），
 *    其次 host，最后客户端 Host 头，兜底 getHostUrl()。
 *  - internal=false（302 重定向给客户端）：用对外地址 host（客户端必须可达）。 */
async function absolutize(url: string, hostHeader?: string, internal?: boolean): Promise<string> {
  if (!url) return url;
  let full = url;
  const cfg = await loadServerConfig().catch(() => null);
  const cfgHost = String((cfg && cfg.host) || '').trim();
  const intHost = String((cfg && (cfg.internalHost || cfg.host)) || '').trim();
  // 替换 localhost/127.0.0.1 前缀：插件内 fetch 用内网地址，302 给客户端用对外地址
  const m = /^https?:\/\/[^/]+/.exec(full);
  if (m) {
    const host = m[0];
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
      const base = internal ? (intHost || cfgHost) : cfgHost;
      if (base) full = base.replace(/\/+$/, '') + full.slice(m[0].length);
    }
  }
  if (full.startsWith('/')) {
    let base = internal ? (intHost || cfgHost) : cfgHost;
    if (!base) base = String(hostHeader || '').trim();
    if (!base) {
      try { base = await sl().plugin.getHostUrl(); } catch { /* 保持原样 */ }
    }
    if (base) full = base.replace(/\/+$/, '') + full;
  }
  if (full.includes('/api/v1/')) {
    try {
      const token = await sl().plugin.getToken();
      if (token) full += (full.includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(token);
    } catch { /* ignore */ }
  }
  return full;
}

/** 外部源歌曲：songId:trackId → hostSongId。songMap 由 ensure-songs 路径写入；
 *  冷路径（用户从未用插件 UI 播放过）调自身 /ensure-songs 端点走一遍"快速导入"（不拉封面/歌词）。 */
async function getHostSongId(sourceId: string, trackId: string): Promise<number> {
  try {
    const raw = await sl().storage.get('songMap');
    if (raw) {
      const m = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const v = m && m[`${sourceId}:${trackId}`];
      if (typeof v === 'number') return v;
    }
  } catch { /* ignore */ }
  // 冷路径 fallback：自调 /ensure-songs（快速模式：不拉封面/歌词，仅拿 host songId）
  try {
    const cfg = await loadServerConfig();
    let base = String(cfg.host || '').trim();
    // host 未配置时回退宿主本机地址（插件自调自身端点，本机地址即可）
    if (!base) {
      try { base = await sl().plugin.getHostUrl().catch(() => ''); } catch { base = ''; }
      base = String(base || '').trim();
    }
    const token = await sl().plugin.getToken().catch(() => '');
    if (!base) return 0;
    let url = base.replace(/\/+$/, '') + '/api/v1/jsplugin/multisource-music/ensure-songs';
    const reqInit: any = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // 冷路径导入必须带歌词：对齐官方 subsonic 插件「导入即存歌词」策略，
      // 否则歌曲进宿主后 lyric_url 为空 → 客户端永远拿不到歌词。
      body: JSON.stringify({ tracks: [{ sourceId, trackId }], withCover: true, withLyric: true }),
    };
    if (token) reqInit.headers['Authorization'] = 'Bearer ' + token;
    const ctrl = new AbortController();
    // 必须小于宿主反向代理 ~10s 超时，否则插件请求被掐断变 502；超时时 getHostSongId 返回 0 → serveStream 降级 302 直链，不 502。
    const t = setTimeout(() => ctrl.abort(), 9000);
    reqInit.signal = ctrl.signal;
    const resp = await fetch(url, reqInit);
    clearTimeout(t);
    if (resp && resp.ok) {
      const j = await resp.json().catch(() => null);
      if (j && j.ok && Array.isArray(j.results) && j.results[0] && typeof j.results[0].songId === 'number') {
        return j.results[0].songId;
      }
    }
  } catch { /* ignore */ }
  return 0;
}

// 代理音频流：解析宿主 songId → serveFile: { songId } 让 Go 层直接 serve 宿主歌曲。
// 零拷贝、原生 Range/seek、Content-Range total 正确（MP3/FLAC/MP4 均可播）。
// 仅当歌曲未导入宿主（外部源冷路径）时兜底 302 到适配器直链。
async function serveStream(id: string, req: HTTPRequest, fmt: string): Promise<HTTPResponse> {
  const parts = decId(id);
  if (parts[0] !== 'sg' || !parts[1] || !parts[2]) return errResp(fmt, 10, 'Missing parameter: id');
  const sourceId = parts[1];
  const trackId = parts[2];
  try {
    // 1) 内置 songloft 源：native trackId 即 host songId
    // 2) 外部源：songMap → hostSongId；冷路径则自调 /ensure-songs 触发导入
    let hostSongId = 0;
    if (sourceId === SONGLOFT_SOURCE_ID) {
      const n = parseInt(trackId, 10);
      if (n > 0) hostSongId = n;
    }
    if (!hostSongId) hostSongId = await getHostSongId(sourceId, trackId);
    if (hostSongId) {
      // 按歌曲编码推断 Content-Type（id 第 12 段是 codec；为空时用宿主歌曲 format 兜底）
      let ct = 'audio/mpeg';
      const codec = String(parts[11] || '').toLowerCase();
      if (/m4a|mp4|m4b|mov|mp41|mp42/i.test(codec)) ct = 'audio/mp4';
      else if (/flac/i.test(codec)) ct = 'audio/flac';
      else if (/ogg|opus/i.test(codec)) ct = 'audio/ogg';
      else if (/wav/i.test(codec)) ct = 'audio/wav';
      else if (/aac/i.test(codec)) ct = 'audio/aac';
      if (ct === 'audio/mpeg') {
        // id 无 codec 段（如 songloft 本地库 .mov 歌曲）→ 用宿主歌曲 format 推断
        try {
          const s = await (sl() as any).songs.getById(hostSongId);
          const fmt = String((s && (s.format || s.file_path || '')) || '').toLowerCase();
          if (/m4a|mp4|m4b|mov/i.test(fmt)) ct = 'audio/mp4';
          else if (/flac/i.test(fmt)) ct = 'audio/flac';
          else if (/ogg|opus/i.test(fmt)) ct = 'audio/ogg';
          else if (/wav/i.test(fmt)) ct = 'audio/wav';
          else if (/aac/i.test(fmt)) ct = 'audio/aac';
        } catch { /* 保持 audio/mpeg */ }
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': ct, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' },
        serveFile: { songId: hostSongId },
      };
    }
    // 兜底：歌曲从未导入宿主 → 302 到适配器直链（客户端可能不支持，但别无选择）
    const ad = await adapterOf(sourceId);
    const up = await ad.resolveStream(trackId);
    if (!up || !up.url) return errResp(fmt, 60, 'Song not found');
    const absUrl = await absolutize(up.url, headerOf(req, 'Host'));
    if (!absUrl) return errResp(fmt, 60, 'Song not found');
    return { statusCode: 302, headers: { 'Location': absUrl, 'Content-Type': 'text/plain' }, body: '' };
  } catch (e: any) {
    sl().log.warn('[subsonic] stream ' + trackId + ' err: ' + errMsg(e));
    return errResp(fmt, 0, 'Stream failed');
  }
}

// 封面代理：插件内 fetch（B 站 CDN / 宿主内部地址）→ 落盘 cover_cache → serveFile 返回。
// 关键：① 宿主 HTTPResponse.body 不支持二进制（Uint8Array 会 unmarshal 报错），二进制必须走 serveFile；
//  ② local 歌曲 source_cover_url 是公开 CDN（无需 token）；remote 歌曲 fallback 宿主 cover（localhost+system token）；
//  ③ 封面 URL 的 ?v= 版本参数过期会 404，需剔除；④ fetch 加超时避免拖死单线程后端。
const COVER_DIR = 'cover_cache';
// 封面诊断（公开只读 /rest/subsonic-cover-dbg）：记录每次 getCoverArt 走的是哪条解析路径、结果如何。
// 用于真机排查「第三方客户端拿不到本地库封面」——确认是插件代拉失败还是客户端不跟随 302。
const COVER_DBG_KEY = 'subsonic_cover_dbg';
async function coverDbg(rec: any): Promise<void> {
  try {
    const arr = (await sl().storage.get(COVER_DBG_KEY)) || [];
    arr.push({ at: new Date().toISOString(), ...rec });
    if (arr.length > 25) arr.shift();
    await sl().storage.set(COVER_DBG_KEY, arr);
  } catch { /* ignore */ }
}
async function serveCoverBuf(buf: Uint8Array, ct: string, fmt: string): Promise<HTTPResponse> {
  try { sl().fs.mkdir(COVER_DIR, { recursive: true }); } catch { /* 已存在 */ }
  const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg';
  const fname = `${COVER_DIR}/sub_${Date.now()}_${Math.floor(Math.random() * 1e6)}.${ext}`;
  try { await sl().fs.writeFile(fname, bytesToBase64(buf), { encoding: 'base64' }); }
  catch (e: any) { sl().log.warn('[subsonic] cover write err: ' + errMsg(e)); return errResp(fmt, 60, 'Cover art not found'); }
  return { statusCode: 200, headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=86400' }, serveFile: { filePath: fname } };
}
// 封面服务端结果缓存（内存）：同一 (sourceId, coverId) 复用已解析文件 / 直接返回失败，
// 避免单线程后端被「死直链」反复拖住（宿主 /songs/{id}/cover 对失效 cover_url 会挂起，实测每次卡满超时）。
// 正缓存 30min（大封面首次 base64 昂贵，缓存后秒回）；负缓存仅 2min——慢但可用的封面若首次偶发超时，
// 不能长时间被负缓存遮蔽，2min 后重试即可命中（死封面靠各阶段限时快速失败，2min 内重复请求也够用）。
const coverServeCache = new Map<string, { filePath: string; ct: string; at: number }>();
const coverServeNoneCache = new Map<string, number>();
const COVER_SERVE_TTL = 30 * 60_000;
const COVER_SERVE_NONE_TTL = 2 * 60_000;
// 宿主直链代拉超时：工作直链毫秒级~数秒（大封面 1.7MB PNG 头要等宿主从上游取回，实测 2.5~5s），
// 死直链（宿主对失效 cover_url 会挂起）8s+ 仍无响应。6s 取平衡；真无封面歌靠负缓存不反复卡后端。
const COVER_FETCH_TIMEOUT = 6000;
// 单次直链「请求头 + 读完整 body」的整体上限：大图 body 读取不在 fetch 超时内，须单独封顶。
// 注：大封面（≥1MB）后续 base64 编码为同步 CPU，事件循环期间定时器不触发——所以这里不做「整体预算
// 提前返回」式兜底（会把本来 9s 能成功的大图变成 502）。各阶段分别限时即为最坏情况上界。
const COVER_FETCH_TOTAL_TIMEOUT = 8000;
async function serveCoverCached(sourceId: string, coverId: string, buf: Uint8Array, ct: string, fmt: string): Promise<HTTPResponse> {
  const ck = sourceId + ':' + coverId;
  const hit = coverServeCache.get(ck);
  if (hit && Date.now() - hit.at < COVER_SERVE_TTL) {
    try { if (await sl().fs.exists(hit.filePath)) return { statusCode: 200, headers: { 'Content-Type': hit.ct, 'Cache-Control': 'public, max-age=86400' }, serveFile: { filePath: hit.filePath } }; } catch { /* 缓存文件失效则重写 */ }
  }
  const resp = await serveCoverBuf(buf, ct, fmt);
  if (resp.serveFile && resp.serveFile.filePath) coverServeCache.set(ck, { filePath: resp.serveFile.filePath, ct, at: Date.now() });
  return resp;
}
async function serveCover(id: string, fmt: string, hostHeader: string, req: HTTPRequest): Promise<HTTPResponse> {
  // 兼容多种编码 id：cov（标准封面）；al/sg（Amcfy 等客户端会把 album/song id 直接当封面 id 用）。
  // 歌曲封面 id 带 song: 作用域前缀 → 只解析这首歌自身的封面（无封面即不显示，不继承专辑）。
  // 专辑/艺人封面 id 为原生歌曲 id → 走同专辑候选回退（首歌可能无封面）。
  const parts = decId(id);
  let sourceId = '', coverId = '', isSong = false;
  if (parts[0] === 'cov') {
    sourceId = parts[1] || ''; coverId = parts[2] || '';
    isSong = coverId.startsWith('song:');
    if (isSong) coverId = coverId.slice('song:'.length);
  } else if (parts[0] === 'al') {
    // al|<sourceId>|<albumId>|<name>|<artist>|<coverId> —— coverId 内嵌在 id 尾部
    sourceId = parts[1] || ''; coverId = parts[5] || parts[2] || ''; isSong = false;
  } else if (parts[0] === 'sg') {
    // sg|<sourceId>|<trackId>|... —— 歌曲自身封面即其 id
    sourceId = parts[1] || ''; coverId = parts[2] || ''; isSong = true;
  }
  if (!sourceId || !coverId) return errResp(fmt, 60, 'Cover art not found');
  const ck = sourceId + ':' + coverId;
  // 正缓存命中 → 直接回已解析文件（必须在解析前查，否则每次仍重复解析）。
  const hit = coverServeCache.get(ck);
  if (hit && Date.now() - hit.at < COVER_SERVE_TTL) {
    try { if (await sl().fs.exists(hit.filePath)) return { statusCode: 200, headers: { 'Content-Type': hit.ct, 'Cache-Control': 'public, max-age=86400' }, serveFile: { filePath: hit.filePath } }; } catch { /* 缓存文件失效则重新解析 */ }
  }
  // 负缓存命中 → 直接 60（无封面，快速失败）。
  const noneAt = coverServeNoneCache.get(ck);
  if (noneAt && Date.now() - noneAt < COVER_SERVE_NONE_TTL) {
    await coverDbg({ src: sourceId, coverId, scope: isSong ? 'song' : 'album', step: 'none-cached' });
    return errResp(fmt, 60, 'Cover art not found');
  }
  // 通用限时（竞速超时返回 null，不抛错）。注：QuickJS 事件循环同步 CPU 段（base64/解析）期间
  // 定时器不会准时触发，因此所有内部阶段（直链/候选）都各自限时，整体预算只作最后兜底。
  const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
    Promise.race([p, new Promise<T | null>((res) => setTimeout(() => res(null), ms))]);
  // 直链代拉（带 internalHost 改写）：请求头 6s 超时 + 整体 8s 封顶；成功返回图片字节，否则 null。
  const fetchCoverBytes = async (u: string): Promise<{ buf: Uint8Array; ct: string } | null> => {
    // 若配置了 internalHost（内网 http 地址），改写 host 代拉，避开公网自签证书 / hairpin NAT。
    try {
      const cfg = await loadServerConfig();
      const intHost = String(cfg.internalHost || '').trim();
      if (intHost) {
        const m = /^(https?:\/\/[^/]+)/.exec(u);
        if (m) u = intHost.replace(/\/+$/, '') + u.slice(m[1].length);
      }
    } catch { /* ignore */ }
    // 宿主封面端点 /songs/{id}/cover 支持 w= 缩放：服务端代拉用缩略图。
    // 关键：原图可能 1.7MB PNG，QuickJS 端 base64 编码是同步 CPU，会阻塞事件循环、请求逼近
    // 宿主反代 10s 切断变 502（实测 song3 1.7MB PNG 首次 502）。缩到 w=600 后 ~74KB，秒级完成。
    if (/\/songs\/[^/?]+\/cover(\?|$)/.test(u)) {
      const sep = u.includes('?') ? '&' : '?';
      u += sep + 'w=600';
    }
    return withTimeout((async () => {
      try {
        const resp = await Promise.race([
          fetch(u, { method: 'GET' }),
          new Promise<any>((_, rej) => setTimeout(() => rej(new Error('timeout')), COVER_FETCH_TIMEOUT)),
        ]);
        if (resp && resp.ok) {
          const buf = await toBytes(resp);
          const ct = String(getHeader(resp, 'Content-Type') || 'image/jpeg');
          if (buf && buf.length) return { buf, ct };
          await coverDbg({ src: sourceId, coverId, scope: isSong ? 'song' : 'album', step: 'directUrl.empty', url: u.slice(0, 80) });
        } else if (resp) {
          await coverDbg({ src: sourceId, coverId, scope: isSong ? 'song' : 'album', step: 'directUrl.http' + String(resp.status || ''), url: u.slice(0, 80) });
        }
      } catch (e: any) { await coverDbg({ src: sourceId, coverId, scope: isSong ? 'song' : 'album', step: 'directUrl.err', err: errMsg(e), url: u.slice(0, 80) }); }
      return null;
    })(), COVER_FETCH_TOTAL_TIMEOUT);
  };
  // 整个解析加整体预算：死直链串行累计可能逼近宿主反代 10s 切断 → 保证返回远早于它。
  const resolve = async (): Promise<HTTPResponse> => {
    // 完全复用插件内部取封面逻辑（与前端 /cover-data 同源）：
    // - 歌曲：resolveCoverBytesInner（只取自身封面，含宿主原生封面直链 server-side 代拉、及无封面时音频内嵌回落）
    // - 专辑/艺人：resolveCoverBytes（含同专辑候选回退）
    const rb = isSong
      ? await resolveCoverBytesInner(sourceId, coverId)
      : await resolveCoverBytes(sourceId, coverId);
    if (rb && rb.buf && rb.buf.length) {
      await coverDbg({ src: sourceId, coverId, scope: isSong ? 'song' : 'album', step: 'buf', len: rb.buf.length, ct: rb.ct });
      return serveCoverCached(sourceId, coverId, rb.buf, rb.ct || 'image/jpeg', fmt);
    }
    if (rb && rb.directUrl) {
      // 本地库宿主原生封面直链：插件 server-side 代拉字节回传（标准 Subsonic 直接返回图片，不走 302）。
      // 专辑/艺人作用域：主直链 + 前 3 个同专辑候选并行竞速，谁先拿到图用谁——
      // 死直链（宿主对失效 cover_url 会挂起超时）不阻塞候选命中。
      const cands = isSong ? [] : ((await getAlbumCandidates(sourceId, coverId).catch(() => undefined)) || []);
      const attempts: Promise<{ buf: Uint8Array; ct: string } | null>[] = [fetchCoverBytes(rb.directUrl)];
      for (const c of cands.slice(0, 3)) {
        if (c === coverId) continue;
        attempts.push((async () => {
          try {
            const r = await resolveCoverBytesInner(sourceId, c);
            if (r && r.directUrl) return await fetchCoverBytes(r.directUrl);
          } catch { /* ignore */ }
          return null;
        })());
      }
      const direct = await withTimeout(
        Promise.any(attempts.map(p => p.then(r => { if (r && r.buf && r.buf.length) return r; return Promise.reject(new Error('no-cover')); }))),
        6000,
      ).catch(() => null);
      if (direct) {
        await coverDbg({ src: sourceId, coverId, scope: isSong ? 'song' : 'album', step: 'directUrl.ok', len: direct.buf.length, ct: direct.ct });
        return serveCoverCached(sourceId, coverId, direct.buf, direct.ct, fmt);
      }
      // 主直链/候选全失败 → 音频内嵌封面兜底（限时 4s）：宿主无封面文件的本地歌曲
      // （如虫儿飞 MP3 内嵌封面、宿主 cover 端点 404）靠此恢复显示。
      // ⚠️ 大封面 CPU 阻塞风险已消除：宿主直链代拉现在带 w=600 缩放（fetchCoverBytes 内），
      // 1.7MB 大图走直链即可成功，不会走到这里；此处只处理「宿主确实无封面文件」的歌曲，
      // 其内嵌封面通常很小，解析快。仍加 4s 上限兜底。
      const eb = await withTimeout(resolveCoverBytesInner(sourceId, coverId, { forceEmbedded: true }), 4000);
      if (eb && eb.buf && eb.buf.length) {
        await coverDbg({ src: sourceId, coverId, scope: isSong ? 'song' : 'album', step: 'embedded.ok', len: eb.buf.length, ct: eb.ct });
        return serveCoverCached(sourceId, coverId, eb.buf, eb.ct || 'image/jpeg', fmt);
      }
      await coverDbg({ src: sourceId, coverId, scope: isSong ? 'song' : 'album', step: 'fail' });
      coverServeNoneCache.set(ck, Date.now());
      return errResp(fmt, 60, 'Cover art not found');
    }
    await coverDbg({ src: sourceId, coverId, scope: isSong ? 'song' : 'album', step: 'none' });
    coverServeNoneCache.set(ck, Date.now());
    return errResp(fmt, 60, 'Cover art not found');
  };
  try {
    return await resolve();
  } catch (e: any) {
    sl().log.warn('[subsonic] cover err: ' + errMsg(e));
    await coverDbg({ src: sourceId, coverId, scope: isSong ? 'song' : 'album', step: 'exception', err: errMsg(e) });
    return errResp(fmt, 60, 'Cover art not found');
  }
}

// ============ 各端点实现 ============
async function handleAction(action: string, p: Record<string, string>, req: HTTPRequest, fmt: string, user: string): Promise<HTTPResponse> {
  const intOf = (v: string | undefined, d: number): number => { const n = parseInt(v || '', 10); return isNaN(n) ? d : n; };

  switch (action) {
    case 'ping':
      return okResp(fmt, null);

    case 'getLicense':
      return okResp(fmt, n('license', { valid: true, email: user || 'user', licenseExpires: '', trialExpires: '' }));

    case 'getUser':
      return okResp(fmt, n('user', {
        username: user || 'user', adminRole: true, streamRole: true, downloadRole: true,
        coverArtRole: true, scrobbleRole: true,
      }));

    case 'getArtistInfo':
    case 'getArtistInfo2': {
      // 第三方客户端（箭头音乐）频繁调用，返回最小成功响应避免客户端异常
      const id = p.id || '';
      return okResp(fmt, n('artistInfo2', { id }, [
        n('similarArtist', {}, []),
      ]));
    }

    case 'getScanStatus':
      return okResp(fmt, n('scanStatus', { scanning: false, count: 0 }));

    case 'getMusicFolders': {
      const srcs = await enabledSources();
      return okResp(fmt, n('musicFolders', {}, srcs.map(s => n('musicFolder', { id: folderIdOf(s.id), name: s.name }))));
    }

    case 'getIndexes':
    case 'getArtists': {
      const sid = resolveFolderId(p.musicFolderId || (p.folderId as string) || '');
      const sources = sid ? (await enabledSources()).filter(s => s.id === sid) : await enabledSources();
      const all: { sourceId: string; artist: Artist }[] = [];
      for (const s of sources) {
        try {
          for (const ar of await listArtistsCached(s.id)) all.push({ sourceId: s.id, artist: ar });
        } catch { /* ignore */ }
      }
      const idxs = indexGroups(all.map(x => ({ name: x.artist.name })));
      // index 子节点：getIndexes 用 <indexes> 包装，getArtists 直接放 <artists> 下
      let indexChildren = idxs.map(g => n('index', { name: g.letter },
        all.filter(x => {
          const ch = String(x.artist.name || '').trim().charAt(0).toUpperCase();
          const eff = ch && /^[A-Z]$/.test(ch) ? ch : '#';
          return eff === g.letter;
        }).map(x => n('artist', {
          id: artistIdOf(x.sourceId, x.artist), name: x.artist.name, albumCount: x.artist.albumCount || 0,
          // 艺术家封面：给客户端可请求的 cov id（ar.coverId 即其首个有封面歌曲 id）。
          ...(x.artist.coverId ? { coverArt: coverIdOf(x.sourceId, x.artist.coverId) } : {}),
        }))
      ));
      // 艺术家为空（本地库常 artist 空）：返回一个虚拟「所有歌曲」入口，id=folderId，
      // 客户端点进去 getMusicDirectory?folderId → 根目录 fallback 返回全部歌曲，保证列表不空。
      if (all.length === 0 && sources.length) {
        const folderId = folderIdOf(sources[0].id);
        indexChildren = [n('index', { name: '#' }, [n('artist', { id: folderId, name: '所有歌曲', albumCount: 0 })])];
      }
      if (action === 'getArtists') return okResp(fmt, n('artists', {}, indexChildren));
      return okResp(fmt, n('indexes', { lastModified: Math.floor(Date.now() / 1000), ignoredArticles: 'The El La' }, indexChildren));
    }

    case 'getArtist': {
      const parts = decId(p.id || '');
      if (parts[0] !== 'ar' || !parts[1] || !parts[2]) return errResp(fmt, 10, 'Required parameter is missing: id');
      const sid = parts[1];
      const name = parts[3] || '';
      const albums = await albumsOfArtist(sid, name);
      // 艺术家详情页封面：取首个有封面的专辑作艺术家封面。
      const firstCover = albums.find(al => al.coverId);
      const node = n('artist', {
        id: p.id, name: name || parts[2], albumCount: albums.length,
        ...(firstCover ? { coverArt: coverIdOf(sid, firstCover.coverId) } : {}),
      }, albums.map(al => albumNode(sid, al)));
      return okResp(fmt, node);
    }

    case 'getAlbum': {
      const parts = decId(p.id || '');
      if (parts[0] !== 'al' || !parts[1] || !parts[2]) return errResp(fmt, 10, 'Required parameter is missing: id');
      const sid = parts[1];
      const album: Album = { id: parts[2], name: parts[3] || parts[2], artist: parts[4] || '', coverId: parts[5] || '' };
      const tracks = await tracksOfAlbum(sid, album);
      // 专辑节点须带 coverArt（al id 尾部内嵌 coverId），否则客户端无封面可请求。
      const node = n('album', {
        id: p.id, name: album.name, artist: album.artist,
        ...(album.coverId ? { coverArt: coverIdOf(sid, album.coverId) } : {}),
      }, tracks.map(t => songNode(sid, t)));
      return okResp(fmt, node);
    }

    case 'getMusicDirectory': {
      const rawId = p.id || '';
      const parts = decId(rawId);
      // 根目录判据：id='0'（Subsonic 惯例根）或解码后非已知类型（sg/ar/al/pl/folder）→ 当作根目录，
      // 返回所有源的所有歌曲（扁平）。本地库 artist 多为空，用根目录直接列歌曲才能保证「所有歌曲」列表不空。
      const isRoot = rawId === '0' || !parts.length || !parts[0] || !['sg', 'ar', 'al', 'pl', 'folder'].includes(parts[0]);
      if (isRoot) {
        const sources = await enabledSources();
        const children: Node[] = [];
        for (const s of sources) {
          try {
            const tracks = await perSource(listTracksCached(s.id), [] as Track[], 5000);
            for (const t of (tracks as Track[])) children.push(childOf(s.id, 'sg', t));
          } catch { /* ignore */ }
        }
        return okResp(fmt, n('directory', { id: rawId || '0', name: 'All Songs' }, children));
      }
      const type = parts[0];
      const sid = parts[1] || '';
      let children: Node[] = [];
      let name = '';
      if (type === 'folder') {
        const srcs = await enabledSources();
        const src = srcs.find(s => s.id === sid);
        name = src ? src.name : 'Music';
        const artists = await listArtistsCached(sid).catch(() => []);
        if (artists.length) {
          children = artists.map(ar => childOf(sid, 'ar', ar));
        } else {
          // 艺术家为空（本地库常 artist 空）：直接返回所有歌曲，保证「所有歌曲」列表不空
          const tracks = await perSource(listTracksCached(sid), [] as Track[], 5000).catch(() => []);
          children = (tracks as Track[]).map(t => childOf(sid, 'sg', t));
        }
      } else if (type === 'ar') {
        const artistName = parts[3] || '';
        name = artistName || parts[2];
        const albums = await albumsOfArtist(sid, artistName);
        children = albums.map(al => childOf(sid, 'al', al));
      } else if (type === 'al') {
        const album: Album = { id: parts[2], name: parts[3] || parts[2], artist: parts[4] || '' };
        name = album.name;
        const tracks = await tracksOfAlbum(sid, album);
        children = tracks.map(t => childOf(sid, 'sg', t));
      } else if (type === 'pl') {
        const playlistId = parts[2];
        name = parts[3] || '';
        try {
          const ad = await adapterOf(sid);
          const r = await ad.playlistTracks ? await ad.playlistTracks(playlistId, { limit: 3000, offset: 0 }) : { list: [] };
          children = (r && r.list || []).map(t => childOf(sid, 'sg', t));
        } catch { /* ignore */ }
      } else {
        return errResp(fmt, 60, 'Directory not found');
      }
      return okResp(fmt, n('directory', { id: rawId, name: name || 'Music' }, children));
    }

    case 'getSong': {
      const parts = decId(p.id || '');
      if (parts[0] !== 'sg' || !parts[1] || !parts[2]) return errResp(fmt, 10, 'Required parameter is missing: id');
      const sid = parts[1];
      const trackId = parts[2];
      // .165：id 不再含易变字段（coverId/duration/codec/size/trackNo/year），
      // 对本地源用 trackId(=hostSongId) 回查补全真实时长/格式/封面。
      let t: Track | null = null;
      if (sid === SONGLOFT_SOURCE_ID) {
        const hostId = Number(trackId);
        if (hostId > 0) {
          try {
            const u = await sl().songs.getById(hostId);
            if (u) t = {
              id: String(u.id), title: u.title || trackId, artist: u.artist || '', album: u.album || '',
              duration: u.duration || 0, trackNo: u.track_no || u.trackNo || 0, year: u.year || 0,
              coverId: u.cover_id || u.coverId || '', size: u.size || 0, codec: u.codec || u.format || '',
              _source: sid,
            };
          } catch { /* ignore */ }
        }
      }
      if (!t) t = { id: trackId, title: parts[3] || trackId, artist: parts[4] || '', album: parts[5] || '' };
      // .178：宿主记录 artist/album/title 可能为空（如转换曲未写入 ID3，仅留 Bilibili XCoder 转码信息），
      // 但 LRC 内 [ti:]/[ar:]/[al:] 标签含真实信息。箭头音乐等客户端依赖 getSong 返回的 title/artist/album
      // 字段，故在构建 songNode 前用 LRC 元数据兜底补全（与 getLyricsBySongId 的 displayTitle/displayArtist 一致）。
      let lyricPlain: string | null = null;
      try {
        const lyricText = await getLyricText(sid, trackId, t.title || '', t.artist || '');
        if (lyricText) {
          const meta = extractLrcMeta(lyricText);
          if (meta.title && !t.title) t.title = meta.title;
          if (meta.artist && !t.artist) t.artist = meta.artist;
          if (meta.album && !t.album) t.album = meta.album;
          // 内联歌词：部分客户端（Symfonium/箭头音乐）把 getSong.lyrics 视为「嵌入歌词」直接展示。
          lyricPlain = stripLrcTags(lyricText);
        }
      } catch { /* ignore */ }
      const songNodeRet = songNode(sid, t);
      if (lyricPlain) {
        songNodeRet.a = songNodeRet.a || {};
        songNodeRet.a.lyrics = lyricPlain;
      }
      return okResp(fmt, songNodeRet);
    }

    case 'getAlbumList':
    case 'getAlbumList2': {
      const sid = resolveFolderId(p.musicFolderId || '');
      const sources = sid ? (await enabledSources()).filter(s => s.id === sid) : await enabledSources();
      const type = p.type || 'alphabeticalByArtist';
      const size = Math.min(intOf(p.size, 10), 500);
      const albums: { sourceId: string; album: Album }[] = [];
      for (const s of sources) {
        try {
          for (const al of await listAlbumsCached(s.id)) albums.push({ sourceId: s.id, album: al });
        } catch { /* ignore */ }
      }
      let list = albums.slice();
      if (type === 'newest') list.sort((a, b) => (b.album.year || 0) - (a.album.year || 0));
      else if (type === 'alphabeticalByArtist') list.sort((a, b) => norm(a.album.artist || a.album.name).localeCompare(norm(b.album.artist || b.album.name)));
      list = list.slice(0, size);
      const tag = action === 'getAlbumList2' ? 'albumList2' : 'albumList';
      return okResp(fmt, n(tag, {}, list.map(x => albumNode(x.sourceId, x.album))));
    }

    case 'getRandomSongs': {
      const sid = resolveFolderId(p.musicFolderId || '');
      const sources = sid ? (await enabledSources()).filter(s => s.id === sid) : await enabledSources();
      const size = Math.min(intOf(p.size, 10), 100);
      const pool: { sourceId: string; track: Track }[] = [];
      for (const s of sources) {
        try {
          const tracks = await perSource(listTracksCached(s.id), [] as Track[], 5000);
          for (const t of (tracks as Track[])) pool.push({ sourceId: s.id, track: t });
        } catch { /* ignore */ }
      }
      // Fisher–Yates 取前 size
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
      }
      const picked = pool.slice(0, size);
      return okResp(fmt, n('randomSongs', {}, picked.map(x => songNode(x.sourceId, x.track))));
    }

    case 'search2':
    case 'search3': {
      const query = p.query || p.any || '';
      const sid = resolveFolderId(p.musicFolderId || '');
      const sources = sid ? (await enabledSources()).filter(s => s.id === sid) : await enabledSources();
      const artistCount = intOf(p.artistCount, 20);
      const albumCount = intOf(p.albumCount, 20);
      const songCount = intOf(p.songCount, 20);
      const artists: Node[] = [];
      const albums: Node[] = [];
      const songs: Node[] = [];

      if (query.trim()) {
        // 有查询词：走各 adapter 搜索
        for (const s of sources) {
          try {
            const searchLimit = Math.min(intOf(p.songCount, 100), 500);
            const r = await cached('sr|' + s.id + '|' + query + '|' + searchLimit, () => s.adapter.search(query, { limit: searchLimit }));
            if (!r) continue;
            for (const ar of (r.artists || []).slice(0, artistCount)) artists.push(artistNode(s.id, ar));
            for (const al of (r.albums || []).slice(0, albumCount)) albums.push(albumNode(s.id, al));
            for (const t of (r.tracks || []).slice(0, songCount)) songs.push(songNode(s.id, t));
            if (artists.length >= artistCount && albums.length >= albumCount && songs.length >= songCount) break;
          } catch { /* ignore */ }
        }
      } else {
        // 空查询：返回歌曲列表（第三方客户端如箭头音乐用此获取「全部歌曲」）
        // ⚠️ 绝不用 listTracks（全量枚举太重，单线程下会卡死所有其他 API）；
        // 用 listTracksCached 走全量缓存，本地库/少量源很轻，故尊重客户端 songCount，
        // 硬上限放宽到 1000（之前硬限 50 导致箭头音乐「所有歌曲」只显示约 50 首，
        // 真机 capture + 代码双重证实）。
        const totalSongLimit = Math.min(intOf(p.songCount, 500), 1000);
        let collected = 0;
        for (const s of sources) {
          if (collected >= totalSongLimit) break;
          try {
            const tracks = await perSource(listTracksCached(s.id), [] as Track[], 5000);
            for (const t of (tracks as Track[]).slice(0, totalSongLimit - collected)) {
              songs.push(songNode(s.id, t));
              collected++;
            }
          } catch { /* ignore */ }
        }
      }

      if (action === 'search2') {
        return okResp(fmt, n('searchResult2', {}, artists.concat(albums).concat(songs)));
      }
      return okResp(fmt, n('searchResult3', {}, artists.concat(albums).concat(songs)));
    }

    case 'getCoverArt':
      return serveCover(p.id || '', fmt, headerOf(req, 'Host'), req);

    case 'stream':
    case 'download':
      return serveStream(p.id || '', req, fmt);

    case 'getOpenSubsonicExtensions': {
      // OpenSubsonic 扩展声明：声明 lyricsList 后，Symfonium/箭头音乐才会走 getLyricsBySongId
      // 拉结构化（带时间轴）歌词；否则它判定服务端不支持歌词，连 getLyrics 都不调用。
      // 注意：toJson 把所有子节点都转成对象数组，无法表达 versions:[1] 标量数组，故此处手写响应体。
      const extNames = ['lyricsList'];
      if (fmt === 'json') {
        const body: any = {
          status: 'ok', version: API_VERSION, type: SERVER_TYPE, serverVersion: SERVER_VERSION, openSubsonic: true,
          openSubsonicExtensions: extNames.map((name) => ({ name, versions: [1] })),
        };
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' },
          body: JSON.stringify({ 'subsonic-response': body }),
        };
      }
      const extXml = extNames.map((name) => `<extension name="${escXml(name)}"><versions><version>1</version></versions></extension>`).join('');
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        `<subsonic-response xmlns="${XMLNS}" status="ok" version="${API_VERSION}" type="${SERVER_TYPE}" serverVersion="${SERVER_VERSION}" openSubsonic="true">` +
        `<openSubsonicExtensions>${extXml}</openSubsonicExtensions></subsonic-response>`;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Cache-Control': 'no-cache' },
        body: xml,
      };
    }

    case 'getLyricsBySongId': {
      const parts = decId(p.id || '');
      if (parts[0] !== 'sg' || !parts[1] || !parts[2]) return errResp(fmt, 10, 'Required parameter is missing: id');
      const sid = parts[1];
      const trackId = parts[2];
      const title = parts[3] || '';
      const artist = parts[4] || '';
      // 统一取歌词：宿主已存 lyric → 宿主侧同名 .lrc 副车文件 → 跨源上游 LRC（含适配器 sidecar 回退）。
      const lyricText = await getLyricText(sid, trackId, title, artist);
      if (!lyricText) return okResp(fmt, n('lyricsBySongId', {}, []));
      // 箭头音乐等 OpenSubsonic 客户端读 getLyricsBySongId 时只解析 structuredLyrics，
      // 非标准 lyrics:[{value}] 会被忽略——必须用结构化格式（对齐官方 subsonic 插件）。
      return okLyric(fmt, 'lyricsBySongId', artist, title, lyricText);
    }

    case 'getLyrics': {
      // 按 artist+title 取歌词：优先宿主本地库（已存歌词最稳），再跨全源搜索拉上游 LRC（对齐宿主 /lyric-search）。
      const artist = p.artist || '';
      const title = p.title || '';
      let lyricText = (await hostLyricFallback(title, artist)) || '';
      // 标题兜底：剥离「正式版/现场版」等后缀，使「达拉崩吧正式版」也能命中宿主库里的「达拉崩吧」
      // （箭头音乐常带后缀传歌名，getLyricsBySongId 路径已同样处理）。
      if (!lyricText) lyricText = (await hostLyricFallback(normalizeTitleForSearch(title), artist)) || '';
      // 跨全部启用音源搜索（含外部源 GEAKOS/fn/WebDAV），覆盖本地库无记录的外源歌曲；
      // resolveLyric 命中后走适配器 lyric，适配器自身会回退读同名 .lrc 副车文件（如 geak.lyric）。
      if (!lyricText) lyricText = (await resolveLyric({ title, artist })) || '';
      if (!lyricText) return okResp(fmt, n('lyrics', {}, []));
      // OpenSubsonic 客户端（箭头音乐）：在 lyricsList.structuredLyrics 给结构化歌词；
      // 同时保留 <value> 纯文本兼容旧客户端。
      return okLyric(fmt, 'lyrics', artist, title, lyricText);
    }

    case 'getPlaylists': {
      const sid = resolveFolderId(p.musicFolderId || '');
      const sources = sid ? (await enabledSources()).filter(s => s.id === sid) : await enabledSources();
      const playlists: { sourceId: string; pl: Playlist }[] = [];
      for (const s of sources) {
        try {
          if (typeof s.adapter.listPlaylists !== 'function') continue;
          const r = await s.adapter.listPlaylists({ limit: 1000, offset: 0 });
          for (const pl of (r && r.list) || []) { if (pl.name === FAV_PL_NAME) continue; playlists.push({ sourceId: s.id, pl }); }
        } catch { /* ignore */ }
      }
      return okResp(fmt, n('playlists', {}, playlists.map(x => n('playlist', {
        id: playlistIdOf(x.sourceId, x.pl), name: x.pl.name, songCount: x.pl.trackCount || 0,
        // 歌单封面：SongLoft adapter 已把歌单封面定为「首首有封面歌曲」的 id。
        ...(x.pl.coverId ? { coverArt: coverIdOf(x.sourceId, x.pl.coverId) } : {}),
      }))));
    }

    case 'getPlaylist': {
      const parts = decId(p.id || '');
      if (parts[0] !== 'pl' || !parts[1] || !parts[2]) return errResp(fmt, 10, 'Required parameter is missing: id');
      const sid = parts[1];
      const playlistId = parts[2];
      const name = parts[3] || '';
      try {
        const ad = await adapterOf(sid);
        if (typeof ad.playlistTracks !== 'function') return errResp(fmt, 60, 'Playlist not found');
        const r = await ad.playlistTracks(playlistId, { limit: 3000, offset: 0 });
        const tracks = (r && r.list) || [];
        return okResp(fmt, n('playlist', { id: p.id, name, songCount: tracks.length }, tracks.map(t => n('entry', songNode(sid, t).a))));
      } catch {
        return errResp(fmt, 60, 'Playlist not found');
      }
    }

    case 'createPlaylist': {
      const name = (p.name || '').trim() || '未命名歌单';
      const ids = multiParams(req, 'songId');
      const hostIds = await resolveStarIds(ids);
      const pl = await sl().playlists.create({ name });
      if (hostIds.length) { try { await sl().playlists.addSongs(pl.id, hostIds); } catch (e: any) { sl().log.warn('[subsonic] createPlaylist addSongs: ' + errMsg(e)); } }
      return okResp(fmt, n('playlist', { id: playlistIdOf(SONGLOFT_SOURCE_ID, pl), name: pl.name, songCount: hostIds.length }));
    }
    case 'updatePlaylist': {
      // 歌单 id 编码为 encId('pl', sourceId, rawPlId, name)：Subsonic 标准用 playlistId 参数，
      // 部分客户端（含箭头音乐）用 id，两者都兼容。必须按 sourceId 路由到宿主或源适配器。
      const plParam = p.playlistId || p.id || '';
      const parts = decId(plParam);
      if (parts[0] !== 'pl' || !parts[1] || !parts[2]) return errResp(fmt, 10, 'Required parameter is missing: playlistId');
      const sid = parts[1];
      const rawPlId = parts[2];
      if (sid === SONGLOFT_SOURCE_ID) {
        // 宿主歌单：沿用宿主 playlist API（song id 为宿主 songId）
        const hostPlId = Number(rawPlId);
        const pl = await sl().playlists.getById(hostPlId);
        if (!pl) return errResp(fmt, 70, 'Playlist not found');
        if (p.name !== undefined && p.name !== '') { try { await sl().playlists.update(hostPlId, { name: p.name }); } catch (e: any) { sl().log.warn('[subsonic] updatePlaylist rename: ' + errMsg(e)); } }
        // 添加：兼容新版 songIdToAdd 与旧版 songToAdd（csv 多个）
        const addIds = await resolveStarIds(multiParams(req, 'songIdToAdd').concat(multiParams(req, 'songToAdd')));
        if (addIds.length) { try { await sl().playlists.addSongs(hostPlId, addIds); } catch (e: any) { sl().log.warn('[subsonic] updatePlaylist add: ' + errMsg(e)); } }
        // 移除：兼容新版 songIdToRemove（id）与旧版 songIndexToRemove（歌单内 0 基索引，可多个）
        let rmIds = await resolveStarIds(multiParams(req, 'songIdToRemove'));
        const idxRmv = multiParams(req, 'songIndexToRemove').map((x: string) => Number(x)).filter((n: number) => !isNaN(n));
        if (idxRmv.length) {
          try {
            const cur = (await sl().playlists.getSongs(hostPlId)) || [];
            const hostIds = cur.map((t: any) => Number(t.id));
            for (const i of idxRmv) { if (i >= 0 && i < hostIds.length) rmIds.push(hostIds[i]); }
          } catch (e: any) { sl().log.warn('[subsonic] updatePlaylist index-remove: ' + errMsg(e)); }
        }
        rmIds = Array.from(new Set(rmIds));
        if (rmIds.length) { try { await sl().playlists.removeSongs(hostPlId, rmIds); } catch (e: any) { sl().log.warn('[subsonic] updatePlaylist remove: ' + errMsg(e)); } }
      } else {
        // 外部源歌单：回源到对应音源适配器（song id 还原为源侧原生 id）
        const ad = await adapterOf(sid);
        if (typeof ad.updatePlaylist !== 'function') return errResp(fmt, 70, 'Playlist not found');
        const toSrcIds = (key: string) => multiParams(req, key)
          .map(id => { const d = decodeSongId(id); return (d && d.sourceId === sid) ? d.trackId : null; })
          .filter((x): x is string => !!x);
        const opts: { name?: string; trackIdsToAdd?: string[]; trackIdsToRemove?: string[] } = {};
        if (p.name !== undefined && p.name !== '') opts.name = p.name;
        const addIds = toSrcIds('songIdToAdd');
        if (addIds.length) opts.trackIdsToAdd = addIds;
        const rmIds = toSrcIds('songIdToRemove');
        if (rmIds.length) opts.trackIdsToRemove = rmIds;
        try { await ad.updatePlaylist(rawPlId, opts); }
        catch (e: any) { sl().log.warn('[subsonic] updatePlaylist (source): ' + errMsg(e)); return errResp(fmt, 0, 'updatePlaylist failed: ' + errMsg(e)); }
      }
      return okResp(fmt, null);
    }
    case 'deletePlaylist': {
      // 歌单 id 编码为 encId('pl', sourceId, rawPlId, name)；Subsonic 标准用 id 参数（非 playlistId）。
      // 旧实现把 parts[2]（源侧歌单 id）误当宿主歌单 id → getById 失败「Playlist not found」。
      const plParam = p.id || p.playlistId || '';
      const parts = decId(plParam);
      if (parts[0] !== 'pl' || !parts[1] || !parts[2]) return errResp(fmt, 10, 'Required parameter is missing: playlistId');
      const sid = parts[1];
      const rawPlId = parts[2];
      if (sid === SONGLOFT_SOURCE_ID) {
        const hostPlId = Number(rawPlId);
        const pl = await sl().playlists.getById(hostPlId);
        if (!pl) return errResp(fmt, 70, 'Playlist not found');
        await sl().playlists.delete(hostPlId);
      } else {
        const ad = await adapterOf(sid);
        if (typeof ad.deletePlaylist !== 'function') return errResp(fmt, 70, 'Playlist not found');
        try { await ad.deletePlaylist(rawPlId); }
        catch (e: any) { sl().log.warn('[subsonic] deletePlaylist (source): ' + errMsg(e)); return errResp(fmt, 0, 'deletePlaylist failed: ' + errMsg(e)); }
      }
      return okResp(fmt, null);
    }
    case 'star':
    case 'unstar': {
      const fav = action === 'star';
      const ids = multiParams(req, 'id').concat(multiParams(req, 'songId'));
      sl().log.info('[subsonic] ' + action + ': 收到 id 参数 ' + ids.length + ' 个');
      if (!ids.length) {
        sl().log.warn('[subsonic] ' + action + ': 未解析到任何 id/songId 参数（客户端可能用 albumId/artistId，或参数未进入 query/body）');
        return okResp(fmt, null);
      }
      const hostIds = await resolveStarIds(ids);
      sl().log.info('[subsonic] ' + action + ': 解析出宿主歌曲 ' + hostIds.length + ' 首（原始 ' + ids.length + '）');
      if (hostIds.length) {
        const plId = await ensureFavPlaylist();
        if (!plId) { sl().log.warn('[subsonic] ' + action + ': 无法获取/创建收藏歌单'); return okResp(fmt, null); }
        try {
          if (fav) await sl().playlists.addSongs(plId, hostIds);
          else await sl().playlists.removeSongs(plId, hostIds);
        } catch (e: any) {
          sl().log.warn('[subsonic] ' + action + ' 写收藏歌单失败: ' + errMsg(e));
          return errResp(fmt, 0, action + ' failed: ' + errMsg(e));
        }
      } else {
        sl().log.warn('[subsonic] ' + action + ': 歌曲 id 未能解析为宿主歌曲（resolveStarIds 返回空，可能 sourceId 不匹配或歌曲未入库）');
      }
      await refreshFavSet();
      return okResp(fmt, null);
    }
    case 'setRating': {
      // 部分客户端（含某些「喜爱」按钮）用 5 星评分表示喜爱：rating>0 → 收藏，rating==0 → 取消收藏
      const rating = Number(p.rating || '0');
      const ids = multiParams(req, 'id').concat(multiParams(req, 'songId'));
      if (!ids.length) return okResp(fmt, null);
      const hostIds = await resolveStarIds(ids);
      if (hostIds.length) {
        const plId = await ensureFavPlaylist();
        if (!plId) return okResp(fmt, null);
        try {
          if (rating > 0) await sl().playlists.addSongs(plId, hostIds);
          else await sl().playlists.removeSongs(plId, hostIds);
          await refreshFavSet();
        } catch (e: any) { sl().log.warn('[subsonic] setRating 写收藏失败: ' + errMsg(e)); return errResp(fmt, 0, 'setRating failed: ' + errMsg(e)); }
      }
      return okResp(fmt, null);
    }
    case 'getStarred':
    case 'getStarred2': {
      const plId = await ensureFavPlaylist();
      let songs: any[] = [];
      if (plId) { try { songs = await sl().playlists.getSongs(plId); } catch (e: any) { sl().log.warn('[subsonic] getStarred 读收藏歌单失败: ' + errMsg(e)); } }
      else sl().log.warn('[subsonic] getStarred: 未获取到收藏歌单');
      await refreshFavSet();
      sl().log.info('[subsonic] getStarred: 返回收藏歌曲 ' + (songs ? songs.length : 0) + ' 首');
      // .165/.177：getStarred2 返回 Navidrome 标准三块 song/album/artist
      //（旧实现只返回 song，album/artist 用 @name: 合成稳定可解析 id，客户端据此归类显示）。
      const albumMap = new Map<string, Album>();
      const artistMap = new Map<string, Artist>();
      // 宿主歌单歌对象带 cover_url 但无 coverId：按 toTrack 同规则补 coverId，否则 songNode 不发 coverArt。
      const cidOf = (u: any): string | undefined => (u && (u.coverId || (u.cover_url ? String(u.id) : undefined))) || undefined;
      for (const u of (songs || [])) {
        const an = u.album || 'SongLoft';
        if (an && !albumMap.has(an)) albumMap.set(an, { id: '@name:' + an, name: an, artist: u.artist, coverId: cidOf(u) });
        if (u.artist && !artistMap.has(u.artist)) artistMap.set(u.artist, { id: '@name:' + u.artist, name: u.artist, coverId: cidOf(u) });
      }
      const all = [
        ...(songs || []).map((t: any) => songNode(SONGLOFT_SOURCE_ID, { ...t, coverId: cidOf(t) })),
        ...Array.from(albumMap.values()).map((al) => albumNode(SONGLOFT_SOURCE_ID, al)),
        ...Array.from(artistMap.values()).map((ar) => artistNode(SONGLOFT_SOURCE_ID, ar)),
      ];
      return okResp(fmt, n(action === 'getStarred2' ? 'starred2' : 'starred', {}, all));
    }
    case 'scrobble':
    case 'getInternetRadioStations':
      if (action === 'getInternetRadioStations') return okResp(fmt, n('internetRadioStations', {}, []));
      return okResp(fmt, null);

    default:
      return errResp(fmt, 0, 'Unknown Subsonic API method: ' + action);
  }
}

// ============ 主入口 / 路由注册 ============
async function handleSubsonic(req: HTTPRequest, params: any): Promise<HTTPResponse> {
  // action 来源：1) 路由 :action 参数（/rest/:action）；2) 请求路径最后一段（根路径 /ping.view 等）
  let action = String((params && params.action) || '');
  if (!action) {
    const path = String((req && req.path) || '');
    const seg = path.split('/').filter(Boolean).pop() || '';
    action = seg;
  }
  action = action.replace(/\.view$/, '');
  const p = allParams(req);
  // 诊断捕获：记录第三方客户端(如箭头音乐)实际发送的请求形态（action/method/参数，鉴权字段脱敏）。
  // 通过公开只读端点 /subsonic-capture 读取，用于定位「服务端通但某客户端不行」的差异。
  try { captureSubsonicReq(action, req, p); } catch { /* ignore */ }
  const fmt = p.f === 'json' ? 'json' : 'xml';
  try {
    const auth = await checkAuth(p, req, action);
    // 鉴权失败返回 HTTP 200 + code:40（Subsonic 协议标准，与官方 songloft-plugin-subsonic 一致）。
    // 客户端靠 body 的 error.code=40 识别「密码错误」；HTTP 状态码保持 200。
    if (!auth.ok) return errResp(fmt, 40, 'Wrong username or password');
    // .177：输出歌曲节点的 action 先同步刷新收藏集合，保证列表红心（starred/userStarred）实时
    //（favSet 过期时若异步后台刷新，本次响应会缺 starred → 箭头音乐等客户端爱心不亮）。
    if (SONG_OUT_ACTIONS.has(action)) { try { await refreshFavSet(); } catch { /* ignore */ } }
    const resp = await handleAction(action, p, req, fmt, auth.user);
    // 记录最近对外真实响应（含 body 前 500 字符），排查「客户端连上但列表/歌曲为空」
    try {
      const arr = (await sl().storage.get('subsonic_resp_log')) || [];
      arr.push({ at: new Date().toISOString(), action, code: resp.statusCode, u: p.u || '', body: String(resp.body || '').slice(0, 500) });
      if (arr.length > 40) arr.shift();
      await sl().storage.set('subsonic_resp_log', arr);
    } catch { /* ignore */ }
    return resp;
  } catch (e: any) {
    sl().log.error('[subsonic] ' + action + ' failed: ' + errMsg(e));
    try {
      const arr = (await sl().storage.get('subsonic_resp_log')) || [];
      arr.push({ at: new Date().toISOString(), action, code: 0, u: p.u || '', error: errMsg(e).slice(0, 300) });
      if (arr.length > 40) arr.shift();
      await sl().storage.set('subsonic_resp_log', arr);
    } catch { /* ignore */ }
    return errResp(fmt, 0, 'Internal server error');
  }
}

export function registerSubsonicRoutes(router: ReturnType<typeof createRouter>): void {
  // 管理端：读取最近 20 条 Subsonic 请求路径（排查客户端 404/401，含 SDK 路由未匹配的）
  router.get('/subsonic-reqlog', async () => {
    try {
      const raw = await sl().storage.get('reqlog');
      return jsonResponse({ ok: true, log: Array.isArray(raw) ? raw : [] });
    } catch (e: any) {
      return jsonResponse({ ok: false, msg: errMsg(e) });
    }
  });
  // 诊断端点（公开只读，鉴权字段已脱敏）：返回最近 60 条 Subsonic 请求的 action/method/参数。
  // 用于定位「服务端通但某第三方客户端(如箭头音乐)不行」的差异——看客户端到底发了什么参数。
  // 挂在 /rest/ 下以绕过插件 admin 鉴权（与 Subsonic REST 同前缀，免 admin 鉴权），便于外部直接读取。
  router.get('/rest/subsonic-capture', async () => {
    try {
      const arr = (await sl().storage.get(SUBSONIC_REQ_LOG_KEY)) || [];
      return jsonResponse({ ok: true, build: await getPluginVersion(), count: arr.length, log: arr });
    } catch (e: any) {
      return jsonResponse({ ok: false, msg: errMsg(e) });
    }
  });
  // 公开只读版本回显（挂在 /rest/ 下免 admin 鉴权）：远程确认真机跑的是哪一版。
  router.get('/rest/subsonic-build', async () => {
    return jsonResponse({ ok: true, build: await getPluginVersion() });
  });
  // 公开只读：封面解析诊断（每次 getCoverArt 走的路径/结果），用于真机排查第三方客户端拿不到封面。
  router.get('/rest/subsonic-cover-dbg', async () => {
    try {
      const arr = (await sl().storage.get(COVER_DBG_KEY)) || [];
      return jsonResponse({ ok: true, build: await getPluginVersion(), count: arr.length, log: arr });
    } catch (e: any) { return jsonResponse({ ok: false, msg: errMsg(e) }); }
  });
  router.get('/rest/subsonic-capture-clear', async () => {
    try {
      await sl().storage.set(SUBSONIC_REQ_LOG_KEY, []);
      await sl().storage.set('subsonic_resp_log', []);
      return jsonResponse({ ok: true });
    }
    catch (e: any) { return jsonResponse({ ok: false, msg: errMsg(e) }); }
  });
  // 公开只读：读取最近对外真实响应体（含 getLyrics* 的完整返回），用于确认真机客户端
  // 实际收到的是合规歌词还是错误/空——定位「服务端通但客户端不显示」的最后一环。
  router.get('/rest/subsonic-resplog', async () => {
    try {
      const arr = (await sl().storage.get('subsonic_resp_log')) || [];
      return jsonResponse({ ok: true, build: await getPluginVersion(), count: arr.length, log: arr });
    } catch (e: any) { return jsonResponse({ ok: false, msg: errMsg(e) }); }
  });
  // 管理端：读取最近一次鉴权参数摘要（排查客户端 401）
  router.get('/subsonic-auth-debug', async () => jsonResponse(subsonicAuthDebug()));
  // 管理端：读取/保存服务端配置（供插件前端设置弹窗使用）
  router.get('/subsonic-server-config', async () => {
    const cfg = await loadServerConfig();
    return jsonResponse({ ok: true, config: { enabled: !!cfg.enabled, username: cfg.username || '', hasPassword: !!cfg.password, host: cfg.host || '', internalHost: cfg.internalHost || '', localOnly: cfg.localOnly !== false } });
  });
  // 调试端点：管理员用，绕过对外 Subsonic 鉴权，直接复用 handleAction 打印真实返回结构。
  // 用于排查「艺术家/专辑/歌单能拿到，但歌曲拿不到」这类问题——看歌曲端点到底返回空还是格式不认。
  router.get('/subsonic-debug', async (req) => {
    const p = q(req);
    const action = String(p.action || p.a || '');
    if (!action) return jsonResponse({ ok: false, msg: 'missing action param' });
    // 读取最近对外真实响应体（排查客户端拿到的是空还是格式不认）
    if (action === '__responses') {
      try { const arr = (await sl().storage.get('subsonic_resp_log')) || []; return jsonResponse({ ok: true, log: arr }); }
      catch (e: any) { return jsonResponse({ ok: false, msg: errMsg(e) }); }
    }
    if (action === '__clear') {
      try { await sl().storage.set('subsonic_resp_log', []); await sl().storage.set('reqlog', []); return jsonResponse({ ok: true }); }
      catch (e: any) { return jsonResponse({ ok: false, msg: errMsg(e) }); }
    }
    // 用真实密码 + u=admin + Basic 走完整对外 Subsonic 链路，100% 复现第三方客户端收到的响应。
    // 参数透传（id/musicFolderId/query 等），仅覆盖鉴权为 admin+真实密码。
    if (action === '__probe') {
      try {
        const cfg = await loadServerConfig();
        const pw = cfg.password || '';
        const authH = 'Basic ' + bytesToBase64(utf8Encode('admin:' + pw));
        const qparts: string[] = [];
        for (const k of Object.keys(p)) {
          if (k === 'u' || k === 'p' || k === 't' || k === 's' || k === 'action' || k === 'a') continue;
          qparts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(p[k])));
        }
        qparts.push('u=admin'); qparts.push('f=json');
        const fakeReq: any = {
          method: 'GET', path: '/rest/' + (p.realAction || p.endpoint || 'getPlaylist'),
          query: qparts.join('&'), headers: { Authorization: authH }, body: undefined,
        };
        const r = await handleSubsonic(fakeReq, { action: p.realAction || p.endpoint || 'getPlaylist' });
        const body = typeof r.body === 'string' ? JSON.parse(r.body) : r.body;
        return jsonResponse({ ok: true, code: r.statusCode, body });
      } catch (e: any) { return jsonResponse({ ok: false, msg: errMsg(e) }); }
    }
    try {
      const resp = await handleAction(action, p, req, 'json', 'debug');
      const body = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
      return jsonResponse({ ok: true, response: body });
    } catch (e: any) {
      return jsonResponse({ ok: false, msg: errMsg(e) });
    }
  });
  router.post('/subsonic-server-config', async (req) => {
    const body = readBody(req) || {};
    const cur = await loadServerConfig();
    const next: SubsonicServerConfig = {
      enabled: !!body.enabled,
      username: typeof body.username === 'string' ? body.username : (cur.username || ''),
      password: (typeof body.password === 'string' && body.password !== '') ? body.password : (cur.password || ''),
      host: typeof body.host === 'string' ? body.host : (cur.host || ''),
      internalHost: typeof body.internalHost === 'string' ? body.internalHost : (cur.internalHost || ''),
      localOnly: body.localOnly !== false,
    };
    await saveServerConfig(next);
    sl().log.info('[subsonic] 服务端配置已保存：enabled=' + next.enabled + ' localOnly=' + next.localOnly + ' host=' + (next.host || '(auto)') + ' internalHost=' + (next.internalHost || '(auto)'));
    return jsonResponse({ ok: true });
  });
  // 前端 localStorage 全量镜像落盘：GET 返回映射，POST 接收并覆盖保存。
  // 让歌词偏移/播放速率/收藏/界面状态等用户数据持久化到插件服务端（sl().storage），
  // 不被浏览器清缓存抹掉。cover: 等纯缓存键由前端上传时排除，服务端也再兜底过滤一次。
  router.get('/rest/kv', async () => {
    try {
      const data = (await sl().storage.get('mm_kv_mirror')) || {};
      return jsonResponse({ ok: true, data: (data && typeof data === 'object') ? data : {} });
    } catch (e: any) { return jsonResponse({ ok: false, msg: errMsg(e) }); }
  });
  router.post('/rest/kv', async (req) => {
    try {
      const body = readBody(req) || {};
      const data: Record<string, string> = {};
      for (const k of Object.keys(body)) {
        if (k.indexOf('cover:') === 0) continue; // 纯缓存键不落盘
        const v = body[k];
        data[k] = typeof v === 'string' ? v : (v == null ? '' : JSON.stringify(v));
      }
      await sl().storage.set('mm_kv_mirror', data);
      return jsonResponse({ ok: true });
    } catch (e: any) { return jsonResponse({ ok: false, msg: errMsg(e) }); }
  });
  // 歌词偏移（提前/延迟）专用直连落盘：绕过 localStorage 镜像与任何键判定，直接读写 sl().storage。
  // 前端保存/加载都直接调用，确保不依赖镜像链路即可持久化到服务端、刷新/清缓存后恢复。
  router.get('/rest/lrcOffset', async (req) => {
    try {
      const k = (allParams(req).key as string) || '';
      if (!k) return jsonResponse({ ok: true, v: null });
      const raw = await sl().storage.get('mm:lrcOffset:' + k);
      return jsonResponse({ ok: true, v: raw == null ? null : (parseFloat(String(raw)) || 0) });
    } catch (e: any) { return jsonResponse({ ok: false, msg: errMsg(e) }); }
  });
  router.post('/rest/lrcOffset', async (req) => {
    try {
      const body = readBody(req) || {};
      const k = body.key;
      if (!k) return jsonResponse({ ok: false, msg: 'no key' });
      if (body.v === 0 || body.v == null) await sl().storage.set('mm:lrcOffset:' + String(k), null);
      else await sl().storage.set('mm:lrcOffset:' + String(k), String(body.v));
      return jsonResponse({ ok: true });
    } catch (e: any) { return jsonResponse({ ok: false, msg: errMsg(e) }); }
  });
  // Subsonic REST API：一个 :action 兜住所有 .view 动作。
  // 兼容客户端拼 /rest 的层数：标准 1 级（Navidrome/Substreamer 自动拼 /rest），
  // 也有用户手动把 /rest 填进地址导致的双/三级（Navidrome 实测拼出 /rest/rest/ping.view）。
  const restPatterns = ['/rest/:action', '/rest/rest/:action', '/rest/rest/rest/:action'];
  for (const pattern of restPatterns) {
    router.get(pattern, handleSubsonic);
    router.post(pattern, handleSubsonic);
  }
  // 根路径兜底：Amcfy 等客户端连接时会先请求 .../rest（无 action），SDK 路由匹配不上返回 404。
  // 注册 1 段 /rest（及不带 /rest 的 /）直接回 ping，让连接测试通过。
  const rootPing = async (req: HTTPRequest): Promise<HTTPResponse> => {
    const p = allParams(req);
    return okResp(p.f === 'json' ? 'json' : 'xml', null);
  };
  router.get('/rest', rootPing);
  router.post('/rest', rootPing);
  router.get('/', rootPing);
  router.post('/', rootPing);

  // 预热收藏集合缓存（用于歌曲 starred 标记）
  refreshFavSet().catch(() => {});
}
