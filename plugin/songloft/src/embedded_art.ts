// 从音频文件前若干字节里提取内嵌封面（ID3v2 APIC / FLAC PICTURE / MP4 covr）。
//
// 背景：WebDAV 这类「只有文件」的音源没有封面 API；多数音乐库把封面以二进制形式
// 嵌在音频文件里，而非单独的 cover.jpg。宿主 onHTTPRequest 无法回传二进制体，但
// /cover-data 可以回传 base64 data URI（文本），所以这里把「读文件 → 解析内嵌图」
// 放在插件服务端完成，前端直接 img.src = dataUri。

/** 内嵌封面解析结果 */
export interface EmbeddedArtOut {
  contentType: string;
  data: Uint8Array;
}

/**
 * v1.4.12：一次抓取文件头同时得到封面与 ID3 标签（标题/作者/专辑），并给出图片完整性信息。
 * artIncomplete.needBytes = 图片帧在文件中的结束偏移（绝对字节数），
 * 首次 Range 抓取（默认 150KB）不够时，按此偏移二次抓取即可拿到完整图片。
 */
export interface AudioHeadInfo {
  art?: EmbeddedArtOut | null;
  artIncomplete?: { needBytes: number } | null;
  title?: string;
  artist?: string;
  album?: string;
  /** 时长（秒）：ID3 TLEN / MP4 mvhd 解析可得时填充 */
  duration?: number;
  /** 文件总大小（字节）：由 parseAudioHeadFromUrl 的 HEAD content-length 填充 */
  size?: number;
}

// 读取 32 位大端（避免 JS 位运算的 32 位有符号溢出问题）
function u32(b: Uint8Array, off: number): number {
  return (b[off] * 16777216) + (b[off + 1] * 65536) + (b[off + 2] * 256) + b[off + 3];
}
function u24(b: Uint8Array, off: number): number {
  return (b[off] * 65536) + (b[off + 1] * 256) + b[off + 2];
}
function u28syncsafe(b: Uint8Array, off: number): number {
  return (b[off] * 2097152) + (b[off + 1] * 16384) + (b[off + 2] * 128) + b[off + 3];
}

/** 用文件头魔数推断内容类型（比信任声明 MIME 更可靠） */
export function sniffContentType(d: Uint8Array): string {
  if (d.length >= 3 && d[0] === 0xFF && d[1] === 0xD8 && d[2] === 0xFF) return 'image/jpeg';
  if (d.length >= 8 && d[0] === 0x89 && d[1] === 0x50 && d[2] === 0x4E && d[3] === 0x47) return 'image/png';
  if (d.length >= 6 && d[0] === 0x47 && d[1] === 0x49 && d[2] === 0x46) return 'image/gif';
  if (d.length >= 4 && d[0] === 0x42 && d[1] === 0x4D) return 'image/bmp';
  if (d.length >= 12 && d[8] === 0x57 && d[9] === 0x45 && d[10] === 0x42 && d[11] === 0x50) return 'image/webp';
  if (d.length >= 5 && d[0] === 0x3C && d[1] === 0x3F && d[2] === 0x78 && d[3] === 0x6D && d[4] === 0x6C) return 'image/svg+xml';
  return 'image/jpeg';
}

/** 按图片魔数定位真实图片数据起点，丢弃工具写入的前缀垃圾：
 *  实测 MP4 covr 的 data atom 在 version/flags(0x0D) 后还有 4 字节 00 预留字段
 *  （某些写入工具不规范），直接返回会把 4 字节 00 带进图片 → 浏览器显示破裂图。
 *  在数据前 64 字节内找 JPEG/PNG/GIF/RIFF(WebP)/BMP 魔数，找到即裁剪；找不到原样返回。 */
function trimImagePrefix(data: Uint8Array): Uint8Array {
  const magics: number[][] = [
    [0xFF, 0xD8, 0xFF],        // JPEG
    [0x89, 0x50, 0x4E, 0x47],  // PNG
    [0x47, 0x49, 0x46],        // GIF
    [0x52, 0x49, 0x46, 0x46],  // RIFF (WebP / AVI)
    [0x42, 0x4D],              // BMP
  ];
  const maxScan = Math.min(64, data.length);
  for (let i = 0; i < maxScan; i++) {
    for (const m of magics) {
      if (i + m.length > data.length) continue;
      let ok = true;
      for (let k = 0; k < m.length; k++) if (data[i + k] !== m[k]) { ok = false; break; }
      if (ok) return data.subarray(i);
    }
  }
  return data;
}

/**
 * 校验内嵌图是否以格式终止符收尾：JPEG 以 FFD9（EOI）结尾、PNG 以 IEND 结尾。
 * 某些标签工具把图片帧长度写得偏小（< 真实图片字节数），解析器按「帧声明长度」取到
 * 一段就当「完整」返回，浏览器缺结尾解码失败 → 显示损坏网格图（即用户说的「封面显示一半」）。
 * 以图片自身终止符为准：缺终止符即视为截断，交由上层续抓，绝不下发半截图。
 * （JPEG 数据里的 FF 会被编码器转义为 FF00，故流中真实的 FFD9 只可能是真正的图像结尾，
 *   向后扫描最后一个 FFD9 即真实结束，不会误命中音频数据。）
 */
export function imageComplete(data: Uint8Array): boolean {
  const n = data.length;
  if (n < 2) return false;
  if (data[0] === 0xFF && data[1] === 0xD8) {
    return data[n - 2] === 0xFF && data[n - 1] === 0xD9;
  }
  if (n >= 8 && data[0] === 0x89 && data[1] === 0x50) {
    return data[n - 8] === 0 && data[n - 7] === 0 && data[n - 6] === 0 && data[n - 5] === 0
      && data[n - 4] === 0x49 && data[n - 3] === 0x45 && data[n - 2] === 0x4E && data[n - 1] === 0x44;
  }
  // GIF / BMP / WebP 等无统一简洁终止符，信任解析结果
  return true;
}

/**
 * 从 buf 的 start 偏移起提取内嵌图：先按魔数定位真实图片起点（跳过工具写入的前缀垃圾），
 * 再向后扫描图片终止符（JPEG FFD9 / PNG IEND），取到尽可能完整的图片；
 * 整个可用缓冲内都找不到终止符 → 返回已扫描内容（仍截断，由上层续抓补齐）。
 * 扫描范围取整个 buf（直到 buf.length）：JPEG 流中 FF 已转义，真实 FFD9 必为图像结尾，
 * 不会误命中后续音频数据；故「最后一个 FFD9」即准确结束位置。
 */
function extractFullImage(buf: Uint8Array, start: number): Uint8Array {
  // 定位真实图片起点
  const maxScan = Math.min(64, buf.length - start);
  let m = start;
  const magics: number[][] = [
    [0xFF, 0xD8, 0xFF],
    [0x89, 0x50, 0x4E, 0x47],
    [0x47, 0x49, 0x46],
    [0x52, 0x49, 0x46, 0x46],
    [0x42, 0x4D],
  ];
  for (let i = 0; i < maxScan; i++) {
    let ok = false;
    for (const mg of magics) {
      if (start + i + mg.length > buf.length) continue;
      let good = true;
      for (let k = 0; k < mg.length; k++) if (buf[start + i + k] !== mg[k]) { good = false; break; }
      if (good) { ok = true; break; }
    }
    if (ok) { m = start + i; break; }
  }
  const data0 = buf.subarray(m);
  if (data0.length < 8) return data0;
  const ct = sniffContentType(data0);
  if (ct === 'image/jpeg') {
    for (let p = buf.length - 2; p >= m; p--) {
      if (buf[p] === 0xFF && buf[p + 1] === 0xD9) return buf.subarray(m, p + 2);
    }
    return data0; // 无 EOI → 截断
  }
  if (ct === 'image/png') {
    for (let p = buf.length - 8; p >= m; p--) {
      if (buf[p] === 0 && buf[p + 1] === 0 && buf[p + 2] === 0 && buf[p + 3] === 0
        && buf[p + 4] === 0x49 && buf[p + 5] === 0x45 && buf[p + 6] === 0x4E && buf[p + 7] === 0x44) return buf.subarray(m, p + 8);
    }
    return data0;
  }
  return data0;
}

/** 兼容入口：只取封面（旧调用方） */
export function extractEmbeddedArt(buf: Uint8Array): EmbeddedArtOut | null {
  return parseAudioHead(buf).art || null;
}

/** 入口：解析音频文件头 → 封面 + ID3 标签 + 图片完整性 */
export function parseAudioHead(buf: Uint8Array): AudioHeadInfo {
  if (!buf || buf.length < 12) return {};
  // ID3v2（MP3 / AAC / 部分 WAV）
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    return parseID3v2(buf);
  }
  // FLAC
  if (buf[0] === 0x66 && buf[1] === 0x4C && buf[2] === 0x61 && buf[3] === 0x43) {
    const flac = parseFlac(buf);
    const out: AudioHeadInfo = { art: flac.art ?? null };
    if (flac.incomplete) out.artIncomplete = flac.incomplete;
    return out;
  }
  // MP4 / M4A / ALAC：ftyp 原子
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const mp4 = parseMp4(buf);
    const duration = findMp4Duration(buf);
    const out: AudioHeadInfo = { art: mp4.art ?? null };
    if (duration != null) out.duration = duration;
    if (mp4.incomplete) out.artIncomplete = mp4.incomplete;
    return out;
  }
  return {};
}

/** 从 MP4 头部找 moov/mvhd 提取时长（秒）；仅 faststart（moov 在头部）可拿到，非 faststart 返回 undefined */
function findMp4Duration(buf: Uint8Array): number | undefined {
  const end = buf.length;
  let pos = 0;
  while (pos + 8 <= end) {
    const size = u32(buf, pos);
    const type = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
    if (size === 0 || size < 8) break;
    const bodyStart = pos + 8;
    const bodyEnd = Math.min(pos + size, end);
    if (type === 'moov') return findMvhd(buf, bodyStart, bodyEnd);
    if (type === 'mdat') break; // mdat 之后才是 moov（非 faststart），放弃
    pos = bodyEnd;
  }
  return undefined;
}

function findMvhd(buf: Uint8Array, start: number, end: number): number | undefined {
  let pos = start;
  while (pos + 8 <= end) {
    const size = u32(buf, pos);
    const type = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
    if (size < 8) break;
    const bodyStart = pos + 8;
    const bodyEnd = Math.min(pos + size, end);
    if (type === 'mvhd') {
      const ver = buf[bodyStart] || 0;
      if (ver === 0) {
        if (bodyStart + 20 > bodyEnd) return undefined;
        const timescale = u32(buf, bodyStart + 12);
        const duration = u32(buf, bodyStart + 16);
        return timescale > 0 ? duration / timescale : undefined;
      }
      if (bodyStart + 32 > bodyEnd) return undefined;
      const timescale = u32(buf, bodyStart + 20);
      const duration = buf[bodyStart + 24] * 4294967296 + u32(buf, bodyStart + 28);
      return timescale > 0 ? duration / timescale : undefined;
    }
    pos = bodyEnd;
  }
  return undefined;
}

// ---------------- ID3v2 ----------------

function parseID3v2(buf: Uint8Array): AudioHeadInfo {
  const out: AudioHeadInfo = {};
  const major = buf[3];
  if (major < 2 || major > 4) return out;
  const flags = buf[5] || 0;
  const tagSize = u28syncsafe(buf, 6);
  const end = Math.min(10 + tagSize, buf.length);
  let pos = 10;
  // 扩展头（flags 0x40）：帧区起点要跳过它，否则第一个字节就错位。
  // v2.3：4 字节大小字段（不含自身）+ 内容；v2.4：synchsafe 大小（含自身）。
  if (flags & 0x40) {
    try {
      pos = major === 4 ? 10 + u28syncsafe(buf, 10) : 10 + 4 + u32(buf, 10);
      if (pos > end) return out;
    } catch { pos = 10; }
  }

  while (pos + 10 <= end) {
    // 帧 ID
    let id: string;
    let frameSize: number;
    let headerLen: number;
    if (major === 2) {
      id = String.fromCharCode(buf[pos], buf[pos + 1], buf[pos + 2]);
      frameSize = u24(buf, pos + 3);
      headerLen = 6;
    } else {
      id = String.fromCharCode(buf[pos], buf[pos + 1], buf[pos + 2], buf[pos + 3]);
      if (major >= 4) frameSize = u28syncsafe(buf, pos + 4);
      else frameSize = u32(buf, pos + 4);
      headerLen = 10;
    }
    if (frameSize <= 0) break;

    const frameEnd = pos + headerLen + frameSize;
    const isPic = (major === 2) ? id === 'PIC' : id === 'APIC';
    if (isPic) {
      if (frameEnd > buf.length) {
        // 图片帧被截断：记录需要二次抓取的文件偏移（帧结束位置）
        if (!out.artIncomplete || out.artIncomplete.needBytes < frameEnd) {
          out.artIncomplete = { needBytes: frameEnd };
        }
      } else if (!out.art) {
        const body = buf.subarray(pos + headerLen, frameEnd);
        const art = parseAPIC(major, body, buf, pos + headerLen);
        if (art) out.art = art;
      }
    } else if (frameEnd <= buf.length) {
      // 文本帧：标题 / 作者 / 专辑（v2.2 用 TT2/TP1/TAL，v2.3+ 用 TIT2/TPE1/TALB）
      const body = buf.subarray(pos + headerLen, frameEnd);
      const text = parseTextFrame(body);
      if (text !== undefined) {
        if (major === 2) {
          if (id === 'TT2' && !out.title) out.title = text;
          else if (id === 'TP1' && !out.artist) out.artist = text;
          else if (id === 'TAL' && !out.album) out.album = text;
          else if (id === 'TLE' && out.duration == null) {
            const ms = parseInt(text.replace(/[^\d]/g, ''), 10);
            if (ms > 0) out.duration = Math.round(ms / 1000);
          }
        } else {
          if (id === 'TIT2' && !out.title) out.title = text;
          else if (id === 'TPE1' && !out.artist) out.artist = text;
          else if (id === 'TALB' && !out.album) out.album = text;
          else if (id === 'TLEN' && out.duration == null) {
            const ms = parseInt(text.replace(/[^\d]/g, ''), 10);
            if (ms > 0) out.duration = Math.round(ms / 1000);
          }
        }
      }
    }
    pos = frameEnd;
  }
  return out;
}

/** 解析 ID3 文本帧（TIT2/TPE1/TALB 等）：编码 0=ISO-8859-1、1/2=UTF-16、3=UTF-8 */
function parseTextFrame(body: Uint8Array): string | undefined {
  if (body.length < 2) return undefined;
  const enc = body[0];
  const raw = body.subarray(1);
  try {
    if (enc === 0) {
      let s = '';
      for (let i = 0; i < raw.length && raw[i] !== 0; i++) s += String.fromCharCode(raw[i]);
      return s || undefined;
    }
    if (enc === 3) {
      let end = raw.length;
      while (end > 0 && raw[end - 1] === 0) end--;
      return utf8Decode(raw.subarray(0, end)) || undefined;
    }
    // UTF-16（LE；可选 BOM）
    let len = 0;
    while (len + 1 < raw.length && !(raw[len] === 0 && raw[len + 1] === 0)) len += 2;
    return utf16Decode(raw.subarray(0, len)) || undefined;
  } catch {
    return undefined;
  }
}

function utf8Decode(b: Uint8Array): string {
  try {
    const td = new (globalThis as any).TextDecoder('utf-8');
    return td.decode(b);
  } catch {
    let s = '';
    let i = 0;
    while (i < b.length) {
      const c0 = b[i];
      if (c0 < 0x80) { s += String.fromCharCode(c0); i++; }
      else if ((c0 & 0xE0) === 0xC0 && i + 1 < b.length) { s += String.fromCharCode(((c0 & 0x1F) << 6) | (b[i + 1] & 0x3F)); i += 2; }
      else if ((c0 & 0xF0) === 0xE0 && i + 2 < b.length) { s += String.fromCharCode(((c0 & 0x0F) << 12) | ((b[i + 1] & 0x3F) << 6) | (b[i + 2] & 0x3F)); i += 3; }
      else if ((c0 & 0xF8) === 0xF0 && i + 3 < b.length) {
        const cp = ((c0 & 0x07) << 18) | ((b[i + 1] & 0x3F) << 12) | ((b[i + 2] & 0x3F) << 6) | (b[i + 3] & 0x3F);
        const n = cp - 0x10000;
        s += String.fromCharCode(0xD800 + (n >> 10), 0xDC00 + (n & 0x3FF));
        i += 4;
      } else { i++; }
    }
    return s;
  }
}

function utf16Decode(b: Uint8Array): string {
  try {
    const td = new (globalThis as any).TextDecoder('utf-16le');
    let s = td.decode(b);
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    return s;
  } catch {
    let s = '';
    for (let i = 0; i + 1 < b.length; i += 2) {
      s += String.fromCharCode(b[i] | (b[i + 1] << 8));
    }
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    return s;
  }
}

function parseAPIC(major: number, body: Uint8Array, buf: Uint8Array, absBase: number): EmbeddedArtOut | null {
  if (body.length < 2) return null;
  let i = 0;
  const enc = body[i]; i++; // 文本编码
  // MIME 类型：null 结尾（ISO-8859-1）。v2.2 的 PIC 没有 MIME，而是一字节图像格式。
  let mime = '';
  if (major === 2) {
    // PIC：3 字节图像格式（'JPG'/'PNG'/…），跳过
    i += 3;
  } else {
    let mimeEnd = i;
    while (mimeEnd < body.length && body[mimeEnd] !== 0) mimeEnd++;
    if (mimeEnd >= body.length) return null;
    mime = '';
    for (let k = i; k < mimeEnd; k++) mime += String.fromCharCode(body[k]);
    i = mimeEnd + 1;
  }
  if (i >= body.length) return null;
  i++; // 图片类型（picture type）
  // 描述：null 结尾（enc=1/2 为 UTF-16，双字节 null）
  if (enc === 1 || enc === 2) {
    while (i + 1 < body.length && !(body[i] === 0 && body[i + 1] === 0)) i += 2;
    i += 2;
  } else {
    while (i < body.length && body[i] !== 0) i++;
    i += 1;
  }
  const data = extractFullImage(buf, absBase + i);
  if (data.length < 8) return null;
  // v2.2 无 MIME：直接用魔数推断
  const ct = mime ? mimeContentType(mime) : sniffContentType(data);
  return { contentType: ct, data };
}

function mimeContentType(mime: string): string {
  const m = mime.toLowerCase();
  if (m.indexOf('png') >= 0) return 'image/png';
  if (m.indexOf('gif') >= 0) return 'image/gif';
  if (m.indexOf('webp') >= 0) return 'image/webp';
  if (m.indexOf('bmp') >= 0) return 'image/bmp';
  if (m.indexOf('svg') >= 0) return 'image/svg+xml';
  return 'image/jpeg';
}

// ---------------- FLAC ----------------

interface FlacOut { art: EmbeddedArtOut | null; incomplete?: { needBytes: number } | null; }

function parseFlac(buf: Uint8Array): FlacOut {
  let pos = 4; // 跳过 'fLaC'
  let incomplete: { needBytes: number } | null = null;
  while (pos + 4 <= buf.length) {
    const last = (buf[pos] & 0x80) !== 0;
    const type = buf[pos] & 0x7F;
    const bsize = u24(buf, pos + 1);
    const bodyStart = pos + 4;
    if (bodyStart + bsize > buf.length) {
      // 该元数据块（多半是 PICTURE 封面）超出首抓缓冲：标记不完整，交上层按块结束偏移续抓。
      // 与 MP4 findCovr 对称——FLAC 大内嵌封面(>150KB)此前缺失续抓，被首抓 150KB 缓冲掐成半截 →
      // base64 内联后 JPEG 解码失败显示损坏网格图。
      incomplete = { needBytes: bodyStart + bsize };
      break;
    }
    if (type === 6) { // PICTURE
      const art = parseFlacPicture(buf, bodyStart);
      if (art) return { art, incomplete: null };
    }
    pos = bodyStart + bsize;
    if (last) break;
  }
  return { art: null, incomplete };
}

function parseFlacPicture(buf: Uint8Array, blockStart: number): EmbeddedArtOut | null {
  let i = blockStart + 4; // 跳过 picture type（4 字节）
  const mimeLen = u32(buf, i); i += 4;
  i += mimeLen; // 跳过 MIME
  const descLen = u32(buf, i); i += 4;
  i += descLen; // 跳过描述
  i += 16; // width(4)+height(4)+depth(4)+palette(4)
  const dataLen = u32(buf, i); i += 4;
  // 用 extractFullImage 从图片数据起点向后扫描真实终止符（FFD9/IEND），
  // 即便帧声明长度 dataLen 偏小（标签工具写错）也能取到完整图，而非截断的 dataLen 字节。
  const data = extractFullImage(buf, i);
  if (data.length < 8) return null;
  return { contentType: sniffContentType(data), data };
}

// ---------------- MP4 / M4A ----------------

interface Mp4Out { art: EmbeddedArtOut | null; incomplete?: { needBytes: number } | null; }

function parseMp4(buf: Uint8Array): Mp4Out {
  return findCovr(buf, 0, buf.length);
}

/**
 * 在 moov/meta/ilst 容器树里找 covr atom。
 * v1.4.53：大内嵌封面（covr 图片 > 首次抓取字节）被截断时，**记录帧结束绝对偏移到
 * incomplete 并放弃本次解析**，交由上层按该偏移二次抓取补齐 —— 绝不返回半截图
 * （否则浏览器显示破裂/半张封面）。旧实现直接 parseCovrData 截断的 bodyEnd，会把半截图当完整返回。
 */
function findCovr(buf: Uint8Array, start: number, end: number): Mp4Out {
  let pos = start;
  const out: Mp4Out = { art: null };
  while (pos + 8 <= end) {
    let size = u32(buf, pos);
    const type = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
    if (size === 0) break; // 到文件末尾
    if (size < 8) break;
    const bodyStart = pos + 8;
    const frameEnd = pos + size;
    const bodyEnd = Math.min(frameEnd, end);

    if (type === 'covr') {
      // 帧整体超出已抓取范围 → 截断，交二次抓取补齐（不返回半截）
      if (frameEnd > buf.length) {
        if (!out.incomplete || out.incomplete.needBytes < frameEnd) out.incomplete = { needBytes: frameEnd };
      } else {
        const art = parseCovrData(buf, bodyStart, bodyEnd);
        if (art) return { art };
      }
    }
    // 这些容器内部可能包含 covr
    if (type === 'meta' || type === 'ilst' || type === 'moov' || type === 'udta'
      || type === 'trak' || type === 'mdia' || type === 'minf' || type === 'stbl') {
      // meta 在头之后有 4 字节版本/标志
      const childStart = type === 'meta' ? bodyStart + 4 : bodyStart;
      const sub = findCovr(buf, childStart, bodyEnd);
      if (sub.art) return sub;
      if (sub.incomplete) {
        if (!out.incomplete || out.incomplete.needBytes < sub.incomplete.needBytes) out.incomplete = sub.incomplete;
      }
    }
    pos = bodyEnd;
  }
  return out;
}

function parseCovrData(buf: Uint8Array, start: number, end: number): EmbeddedArtOut | null {
  let pos = start;
  while (pos + 8 <= end) {
    const size = u32(buf, pos);
    const type = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
    if (size < 8) break;
    const bodyStart = pos + 8;
    const bodyEnd = Math.min(pos + size, end);
    if (type === 'data') {
      // data atom：4 字节版本/标志，其后是图片字节（部分工具在图片前还会写 4 字节 00 预留字段，需按魔数裁剪）。
      // 用 extractFullImage 向后扫描真实终止符：即便 covr 帧声明长度偏小也能取到完整图。
      const payload = extractFullImage(buf, bodyStart + 4);
      if (payload.length >= 8) return { contentType: sniffContentType(payload), data: payload };
    }
    pos = bodyEnd;
  }
  return null;
}
