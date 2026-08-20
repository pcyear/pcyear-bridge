// WebDAV 封面解析：目录图片优先，回退音频内嵌封面

import { UpstreamRef } from '../../types';
import { getDirCover } from '../../lib/dircover';
import { parseAudioHead, EmbeddedArtOut } from '../../embedded_art';
import { WebDavCache } from './cache';
import { WebDavClient } from './client';
import { WebDavMetadata } from './metadata';
import { DavEntry, withTimeout } from './types';

export class WebDavCoverResolver {
  private client: WebDavClient;
  private meta: WebDavMetadata;
  private cache: WebDavCache;
  private sourceId: string;

  constructor(client: WebDavClient, meta: WebDavMetadata, cache: WebDavCache, sourceId: string) {
    this.client = client;
    this.meta = meta;
    this.cache = cache;
    this.sourceId = sourceId;
  }

  /** WebDAV 目录里常见的封面文件名；优先用它们（最快），否则回退到音频内嵌封面 */
  async resolveCover(coverId?: string): Promise<UpstreamRef | null> {
    if (!coverId) return null;
    if (this.cache.hasNoCover(coverId)) return null;
    // coverId 有两种：曲目相对路径（播放器/曲目列表），或专辑/艺术家的目录路径（浏览页封面）。
    // 目录型直接把该目录当封面所在目录，无需先取到某一首歌 —— 列表阶段因此一次网络请求都不用发。
    const { root, rel } = this.meta.parseCollectionId(coverId);
    const baseName = rel.split('/').pop() || '';
    const isFile = this.meta.isAudio(baseName);
    const dir = isFile
      ? this.meta.absOf(coverId).replace(/\/[^/]*$/, '')
      : this.meta.absUnder(root, rel);

    // 目录级无封面共享：只对「目录型 coverId（集合封面）」生效 —— 集合封面确认无图时其余集合直接跳过；
    // 单曲型不受影响（首曲无内嵌封面不代表目录里其它歌曲没有，不能误杀导致文件夹封面永远取不到）
    if (!isFile && this.cache.hasNoCoverDir(dir)) return null;

    // 1) 目录内独立封面文件（cover.jpg 等）：整个目录只探测一次
    let foundUrl = this.cache.getDirCover(dir);
    if (foundUrl === undefined) {
      foundUrl = await this.probeDirCover(dir);
      this.cache.setDirCover(dir, foundUrl);
    }
    if (foundUrl) return { url: foundUrl, headers: this.headers() };

    // 2) 回退到音频内嵌封面（ID3 APIC / FLAC PICTURE / MP4 covr）。
    //    目录型 coverId 只取「被动记录」的封面（用户打开目录看到歌曲封面后，由 cover-data
    //    把歌曲封面推到所属目录，见 dircover.ts）+ 子目录继承；绝不主动扫描目录内音频文件头。
    let audioRel: string | null = isFile ? rel : null;
    let art: EmbeddedArtOut | null = null;
    if (!audioRel) {
      audioRel = await this.recordedDirCover(coverId);
    }
    if (audioRel && !art) {
      try {
        art = await withTimeout(this.extractEmbeddedArt(audioRel), 8000);
      } catch { /* 忽略 */ }
    }
    if (art) return { url: '', headers: {}, inline: art };
    // 确认无封面：单曲级必标记（该 coverId 不再重复探测）；
    // 目录级只在「目录型」解析失败时标记（集合封面确认无），单曲失败不污染整目录
    this.cache.addNoCover(coverId);
    if (!isFile) this.cache.addNoCoverDir(dir);
    return null;
  }

  /** 目录型 coverId 的被动封面：自身记录 → 子目录继承（子→孙，深度 2） */
  private async recordedDirCover(coverId: string): Promise<string | null> {
    const own = await getDirCover(this.sourceId, coverId);
    if (own) return own;
    const { root, rel } = this.meta.parseCollectionId(coverId);
    if (!rel) return null;
    return await this.inheritRecorded(root, rel, 0);
  }

  private async inheritRecorded(root: string, rel: string, depth: number): Promise<string | null> {
    if (depth >= 2) return null;
    let entries: DavEntry[] = [];
    try { entries = await this.listDir(this.meta.absUnder(root, rel)); } catch { return null; }
    for (const e of entries) {
      if (!e.isDir) continue;
      const subRel = rel ? rel + '/' + e.name : e.name;
      const subCol = this.meta.mkId(root, subRel);
      const own = await getDirCover(this.sourceId, subCol);
      if (own) return own;
      const deep = await this.inheritRecorded(root, subRel, depth + 1);
      if (deep) return deep;
    }
    return null;
  }

  /**
   * 探测目录内的封面图片，返回其 URL。
   * 旧实现盲探 21 个固定文件名（cover.jpg/folder.jpg/封面.jpg…），每个发一次 GET Range——
   * 对「目录里根本没有封面文件」的库（很常见，ytdlp 下载的裸 mp3），21 次全 404 白跑，
   * 大库几百个专辑 × 21 次 = 上万次无效请求，把封面加载拖到几分钟（用户反馈「越搞越慢」的真凶）。
   * 改为：先读目录条目（命中 dirCache 则 0 次网络请求），从中找任意图片文件直接用其 URL；
   * 无图片文件则立即返回 null，跳过盲探。顺带支持「同名侧车图」（如 OH苏珊娜.jpg）。
   */
  async probeDirCover(dir: string): Promise<string | null> {
    const entries = await this.listDir(dir);
    const dirPrefix = dir ? dir + '/' : '/';
    for (const e of entries) {
      if (!e.isDir && this.meta.isImage(e.name)) {
        return this.client.fullUrl(this.normalize(dirPrefix + e.name));
      }
    }
    return null;
  }

  /** 内嵌封面只拉文件头部这个长度：150KB 足够覆盖绝大多数 ID3/FLAC 封面（APIC/PICTURE 都在文件头区域），
   *  远小于整首歌几十 MB。图片超过 150KB 时按 APIC 帧头 picture_size 二次抓取到实际位置。
   *  MP4 的 covr 在 moov 里、非 faststart 时 moov 在文件尾取不到（已知限制，mp3 场景无碍）。 */
  static readonly EMBED_READ_LIMIT = 150 * 1024;
  /** 分段续抓总上限：单个内嵌封面超过此值视为异常帧声明，放弃（防异常 size 拖垮单线程后端） */
  static readonly EMBED_MAX_FETCH = 16 * 1024 * 1024;

  /**
   * 取音频文件前若干字节并解析内嵌封面。
   * 流程（WebDAV 兼容标准 Range）：HEAD 拿文件总大小（不下载内容）→ GET Range 只拉头部
   * EMBED_READ_LIMIT 字节 → 本地解析；图片被截断（APIC 帧头 picture_size 算出帧结束偏移超过已抓取字节）
   * 时按实际位置二次抓取；服务器不支持 Range（返回 200 而非 206）时**直接放弃**，绝不完整下载整首歌。
   * 解析结果（封面 + ID3 标签标题/作者/专辑）一并缓存到 headCache，供曲目列表用真实标签覆盖文件名推导。
   */
  async extractEmbeddedArt(rel: string): Promise<EmbeddedArtOut | null> {
    const cached = this.cache.getHead(rel);
    if (cached) return cached.art || null;
    let buf = await this.fetchBytes(rel, WebDavCoverResolver.EMBED_READ_LIMIT);
    if (!buf || buf.length < 16) {
      this.cache.setHead(rel, { art: null });
      return null;
    }
    let info = parseAudioHead(buf);
    // v1.4.53：分段续抓 —— 图片被截断时按帧结束偏移多次抓取补齐，直至拿到完整封面或触及总上限。
    // 旧实现只抓一次且上限 1MB，>1MB 大封面（含 MP4 covr 半截）直接放弃。
    let need = info.artIncomplete?.needBytes ?? 0;
    while (need > 0 && need <= WebDavCoverResolver.EMBED_MAX_FETCH) {
      const buf2 = await this.fetchBytes(rel, need);
      if (buf2 && buf2.length >= 16) {
        const info2 = parseAudioHead(buf2);
        if (info2.art) { info = info2; break; }
        if (info2.artIncomplete?.needBytes && info2.artIncomplete.needBytes > need) {
          need = info2.artIncomplete.needBytes;
          continue;
        }
        if (!info2.artIncomplete) info = info2;
      }
      break;
    }
    info.artIncomplete = null;
    this.cache.setHead(rel, info);
    return info.art || null;
  }

  private async fetchBytes(rel: string, limit: number): Promise<Uint8Array | null> {
    const url = this.client.fullUrl(this.meta.absOf(rel));
    try {
      // 1) HEAD 拿文件总大小：不下载内容，用于确认文件存在（404 提前失败）并让 Range 上限贴合实际文件大小
      let size = -1;
      try {
        const h = await withTimeout(fetch(url, { method: 'HEAD', headers: this.headers() }), 5000);
        if (h) {
          const hdrs = h.headers || {};
          const cl = hdrs['content-length'] ?? hdrs['Content-Length'] ?? hdrs['content_length'];
          if (cl != null) size = parseInt(String(cl), 10) || -1;
          else if (h.status === 404 || h.status === 410) return null;
        }
      } catch { /* HEAD 失败（405/501 等）不阻塞，继续 GET Range */ }
      // 2) GET Range 只拉头部 limit 字节；小文件（size < limit）按实际大小取
      const end = size > 0 && size < limit ? size - 1 : limit - 1;
      const resp = await withTimeout(
        fetch(url, { method: 'GET', headers: this.headers({ Range: `bytes=0-${end}` }) }),
        8000,
      );
      // 3) 只接受 206（服务器支持 Range）；200 说明服务器忽略 Range 会回传整文件，
      //    大音频整文件下载会拖垮单线程后端 → 快速失败，宁可无封面也不整包下载
      if (!resp || resp.status !== 206) return null;
      const buf = await this.bodyBytes(resp);
      // 防御：即使服务器异常返回超限数据也只取前 limit 字节解析，余下立即丢弃
      return buf.length > limit ? buf.slice(0, limit) : buf;
    } catch {
      return null;
    }
  }

  private async bodyBytes(resp: any): Promise<Uint8Array> {
    if (resp && typeof resp.arrayBuffer === 'function') return new Uint8Array(await resp.arrayBuffer());
    if (resp && resp.body != null) {
      if (resp.body instanceof Uint8Array) return resp.body;
      if (typeof resp.body === 'string') return new TextEncoder().encode(resp.body);
    }
    if (resp && typeof resp.bytes === 'function') return new Uint8Array(await resp.bytes());
    if (resp && typeof resp.text === 'function') return new TextEncoder().encode(await resp.text());
    return new Uint8Array(0);
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { Authorization: this.client.auth };
    if (extra) Object.assign(h, extra);
    return h;
  }

  private normalize(p: string): string {
    return ('/' + p).replace(/\/+/g, '/').replace(/\/$/, '');
  }

  private async listDir(absPath: string): Promise<DavEntry[]> {
    const key = this.normalize(absPath || '/');
    const hit = this.cache.getDir(key);
    if (hit) return hit;
    let entries: DavEntry[] = [];
    try {
      entries = await this.client.propfind(key);
    } catch {
      entries = [];
    }
    this.cache.setDir(key, entries);
    return entries;
  }
}
