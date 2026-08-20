// v1.4.13 通用「Range 150KB + APIC 完整性二次抓取 + ID3 标签」音频文件头解析。
// 任何音源（WebDAV / fnMusic / subsonic / …）的曲目流 URL 都可以用它解析内嵌封面与 ID3 标签，
// 作为「音源自定义封面 / 元数据缺失」时的兜底；音源 API 提供的封面 / 标题 / 作者一律优先。
import { fetchWithTimeout, toBytes } from './common';
import { parseAudioHead, AudioHeadInfo, imageComplete } from '../embedded_art';

export const AUDIO_HEAD_LIMIT = 150 * 1024;
// 分段续抓总上限：单个内嵌封面超过此值视为异常帧声明，放弃（防异常 size 拖垮单线程后端）
export const AUDIO_HEAD_MAX_FETCH = 16 * 1024 * 1024;

/**
 * Range 抓取前 need 字节（HEAD 已知 size 时贴合实际，避免 416）。
 * v1.4.56.46 修复「封面只加载 150K 显半截」根因：旧实现硬性要求 206，
 * 一旦源站忽略 Range 头、整体回 200，续抓就 return null 静默失败，永远卡在首抓 150KB。
 * 现改为：206 按请求字节裁剪；200（不认 Range、回整文件）直接原样返回，其已含完整内嵌封面，
 * 交由上层 parseAudioHead 解析即可。
 */
async function fetchRange(url: string, headers: Record<string, string> | undefined, size: number, need: number): Promise<Uint8Array | null> {
  const end = size > 0 && size < need ? size - 1 : need - 1;
  try {
    const resp = await fetchWithTimeout(url, 8000, { ...(headers || {}), Range: `bytes=0-${end}` });
    if (!resp) return null;
    const buf = await toBytes(resp);
    if (!buf || buf.length === 0) return null;
    // 206：源站按 Range 返回前 need 字节，超出部分裁剪；200：忽略 Range 回整文件，原样返回（已含完整封面）
    if (resp.status === 206 && buf.length > need) return buf.slice(0, need);
    return buf;
  } catch {
    return null;
  }
}

/**
 * 对任意曲目流 URL 解析音频文件头：
 * 1) HEAD 拿文件总大小（不下载内容；404/410 提前返回）
 * 2) GET Range 只拉头部 AUDIO_HEAD_LIMIT（150KB）
 * 3) parseAudioHead：封面 + ID3 标题/作者/专辑 + 图片完整性
 * 4) 图片被截断（APIC 帧头算出的帧结束偏移超过已抓取字节）→ 按实际位置二次抓取（≤1MB）
 */
export async function parseAudioHeadFromUrl(url: string, headers?: Record<string, string>): Promise<AudioHeadInfo> {
  if (!url) return {};
  let size = -1;
  try {
    const h = await fetchWithTimeout(url, 5000, headers);
    if (h) {
      const hdrs = h.headers || {};
      const cl = hdrs['content-length'] ?? hdrs['Content-Length'] ?? hdrs['content_length'];
      if (cl != null) size = parseInt(String(cl), 10) || -1;
      else if (h.status === 404 || h.status === 410) return {};
    }
  } catch { /* HEAD 失败（405/501 等）不阻塞，继续 GET Range */ }

  const buf = await fetchRange(url, headers, size, AUDIO_HEAD_LIMIT);
  if (!buf || buf.length < 16) return {};
  let info = parseAudioHead(buf);
  // v1.4.53：分段续抓 —— 图片被截断时按 needBytes 二次（或多次）抓取补齐。
  // 每次把抓取上限抬到当前 needBytes（覆盖已识别的帧结束偏移），重新解析；
  // 若仍 incomplete 且偏移更大，继续抬高直到拿到完整封面或触及总上限。
  // 旧实现只抓一次且上限 1MB，>1MB 大封面直接放弃（无封面 / 半截）。
  let need = info.artIncomplete?.needBytes ?? 0;
  // 首抓可能拿到「帧声明完整、但图片本身缺终止符(FFD9/IEND)」的截断图（标签工具把帧长度写小）。
  // 以图片自身完整性为准：缺终止符即视为截断，强制续抓，绝不把半截图当完整下发。
  if (info.art && !imageComplete(info.art.data)) {
    need = Math.max(need, buf.length + AUDIO_HEAD_LIMIT);
  }
  while (need > 0 && need <= AUDIO_HEAD_MAX_FETCH) {
    const buf2 = await fetchRange(url, headers, size, need);
    if (!buf2 || buf2.length < 16) break;
    const info2 = parseAudioHead(buf2);
    if (info2.art && imageComplete(info2.art.data)) { info = info2; break; }
    if (info2.artIncomplete?.needBytes && info2.artIncomplete.needBytes > need) {
      need = info2.artIncomplete.needBytes; // 范围还不够，继续抬高
      continue;
    }
    if (info2.art) {
      // 拿到图了但仍缺终止符（帧长偏小）→ 再放大一截重试，直到取到完整图或触及上限
      need = Math.min(AUDIO_HEAD_MAX_FETCH, need + AUDIO_HEAD_LIMIT);
      continue;
    }
    if (!info2.artIncomplete) info = info2; // 帧完整但无图
    break;
  }
  info.artIncomplete = null;
  // 顺带返回文件总大小（HEAD content-length），供列表行「时长缺失时显示文件大小」
  if (size > 0) info.size = size;
  return info;
}
