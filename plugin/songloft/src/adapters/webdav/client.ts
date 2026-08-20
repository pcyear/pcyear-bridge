// WebDAV 客户端：PROPFIND、路径编码、URL 构造、XML 解析

import { base64 } from '../../crypto';
import { SourceConfig } from '../../types';
import { DavEntry, withTimeout } from './types';

export class WebDavClient {
  private cfg: SourceConfig;
  readonly origin: string;      // http://host:port
  readonly mountPath: string;   // baseUrl 的路径部分（如 openlist 挂在 /dav 下），所有请求与解析都基于它
  readonly roots: string[];     // 起始目录数组（相对服务器根的绝对路径，'/' 表示根）
  readonly auth: string;

  constructor(cfg: SourceConfig) {
    this.cfg = cfg;

    const raw = (cfg.baseUrl || '').replace(/\/+$/, '');
    const m = raw.match(/^(https?:\/\/[^/]+)(\/.*)?$/i);
    this.origin = m ? m[1] : raw;
    // 挂载子路径：openlist/Alist 等常把 WebDAV 挂在 /dav 之类子路径下，
    // 必须保留，否则所有 PROPFIND 都会被打到服务器根（http://host//），列不出目录。
    this.mountPath = m && m[2] ? m[2].replace(/\/+$/, '') : '';
    // 多起始目录：rootPaths 优先，兼容单值 rootPath；空数组表示「从根扫描」
    const rawRoots = (cfg.rootPaths && cfg.rootPaths.length)
      ? cfg.rootPaths
      : (cfg.rootPath ? [cfg.rootPath] : ['']);
    this.roots = rawRoots.map((r) => {
      const norm = ('/' + (r || '').replace(/^\/+|\/+$/g, '')).replace(/\/+/g, '/');
      return norm === '/' ? '/' : norm;
    });

    this.auth = 'Basic ' + base64(`${cfg.username || ''}:${cfg.password || ''}`);
  }

  /** 兼容占位：取第一根（testConnection 用） */
  get basePath(): string {
    return this.roots[0] || '/';
  }

  get rootList(): string[] {
    return this.roots.length ? this.roots : ['/'];
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { Authorization: this.auth };
    if (extra) Object.assign(h, extra);
    return h;
  }

  /** 把服务器路径编码回 URL（每段单独编码，保留 /），并带上挂载子路径 */
  fullUrl(path: string): string {
    const p = this.encodePath(path);
    const base = (this.origin + this.mountPath).replace(/\/+$/, '');
    return p === '/' ? base + '/' : base + p;
  }

  /** 路径分段编码（每段单独 encodeURIComponent，保留 /） */
  encodePath(path: string): string {
    return path.split('/').map((seg) => encodeURIComponent(seg)).join('/');
  }

  private normalize(p: string): string {
    return ('/' + p).replace(/\/+/g, '/').replace(/\/$/, '');
  }

  private decodeEntities(s: string): string {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  }

  /** PROPFIND 列出一层目录（timeoutMs 控制单个请求超时，统计扫描时用更短的值） */
  async propfind(path: string, timeoutMs = 8000): Promise<DavEntry[]> {
    const body = '<?xml version="1.0" encoding="utf-8"?>'
      + '<D:propfind xmlns:D="DAV:"><D:prop>'
      + '<D:resourcetype/><D:getcontentlength/><D:getcontenttype/><D:displayname/>'
      + '</D:prop></D:propfind>';

    // 超时保护：单个目录请求挂起不阻塞整个扫描（WebDAV 服务卡顿/网络问题时列表不至于永久加载中）
    const u = this.fullUrl(path);
    const reqUrl = u.endsWith('/') ? u : u + '/';
    const altUrl = u.endsWith('/') ? u.slice(0, -1) : u + '/';
    let resp = await withTimeout(
      fetch(reqUrl, {
        method: 'PROPFIND',
        headers: this.headers({ Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' }),
        body,
      }),
      timeoutMs,
    );
    // openlist/Alist 等：集合 URL 对尾斜杠敏感，带斜杠返回 405 时去掉/补上重试一次
    if (resp.status === 405) {
      resp = await withTimeout(
        fetch(altUrl, {
          method: 'PROPFIND',
          headers: this.headers({ Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' }),
          body,
        }),
        timeoutMs,
      );
    }
    if (resp.status === 401 || resp.status === 403) {
      throw new Error(`WebDAV 鉴权失败（HTTP ${resp.status}），请检查用户名与密码`);
    }
    if (resp.status === 404) throw new Error(`WebDAV 路径不存在：${path || '/'}`);
    if (resp.status !== 207 && resp.status !== 200) {
      throw new Error(`WebDAV PROPFIND 失败（HTTP ${resp.status}）`);
    }
    const xml = await withTimeout(resp.text(), timeoutMs);
    return this.parseMultistatus(xml, path);
  }

  /** v1.4.16：Depth: infinity 单次 PROPFIND 拉取整个目录树（统计全树音频数用）。
   *  只请求必要属性（resourcetype/getcontenttype/getcontentlength）减小返回体；
   *  大目录可能超时或服务器拒绝（403/507），调用方需 fallback。
   *  返回所有层级的条目（含子目录与文件），沿用 parseMultistatus 解析。 */
  async propfindDeep(path: string, timeoutMs = 8000): Promise<DavEntry[]> {
    const body = '<?xml version="1.0" encoding="utf-8"?>'
      + '<D:propfind xmlns:D="DAV:"><D:prop>'
      + '<D:resourcetype/><D:getcontenttype/><D:getcontentlength/>'
      + '</D:prop></D:propfind>';

    const u = this.fullUrl(path);
    const reqUrl = u.endsWith('/') ? u : u + '/';
    const altUrl = u.endsWith('/') ? u.slice(0, -1) : u + '/';
    let resp = await withTimeout(
      fetch(reqUrl, {
        method: 'PROPFIND',
        headers: this.headers({ Depth: 'infinity', 'Content-Type': 'application/xml; charset=utf-8' }),
        body,
      }),
      timeoutMs,
    );
    if (resp.status === 405) {
      resp = await withTimeout(
        fetch(altUrl, {
          method: 'PROPFIND',
          headers: this.headers({ Depth: 'infinity', 'Content-Type': 'application/xml; charset=utf-8' }),
          body,
        }),
        timeoutMs,
      );
    }
    if (resp.status === 401 || resp.status === 403) {
      throw new Error(`WebDAV 深度 PROPFIND 鉴权失败（HTTP ${resp.status}）`);
    }
    if (resp.status !== 207 && resp.status !== 200) {
      throw new Error(`WebDAV 深度 PROPFIND 失败（HTTP ${resp.status}）`);
    }
    const xml = await withTimeout(resp.text(), timeoutMs);
    return this.parseMultistatus(xml, path);
  }

  /** 解析 multistatus XML（QuickJS 无 DOMParser，用正则；已处理命名空间前缀） */
  private parseMultistatus(xml: string, parentPath: string): DavEntry[] {
    const out: DavEntry[] = [];
    const selfPath = this.normalize(parentPath);
    const responseRe = /<(?:[a-zA-Z0-9]+:)?response[\s>][\s\S]*?<\/(?:[a-zA-Z0-9]+:)?response>/g;
    const matches = xml.match(responseRe) || [];

    for (const block of matches) {
      const hrefM = block.match(/<(?:[a-zA-Z0-9]+:)?href[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?href>/i);
      if (!hrefM) continue;
      let href = this.decodeEntities(hrefM[1].trim());
      // href 可能是绝对 URL，也可能是绝对路径
      const abs = href.match(/^https?:\/\/[^/]+(\/.*)$/i);
      if (abs) href = abs[1];
      // 循环解码到稳定：部分 WebDAV 服务返回的 href 是双重（甚至多重）URL 编码，
      // 只 decode 一次会残留 %2F/%E7 等，导致后续 resolveStream 再编码成 %252F 而 404。
      for (let i = 0; i < 4; i++) {
        try {
          const d = decodeURIComponent(href);
          if (d === href) break;
          href = d;
        } catch { break; }
      }
      let path = this.normalize(href);
      // 部分 WebDAV（openlist/Alist）返回的 href 带挂载前缀（/dav/music），
      // 部分不带（/music）。统一剥离挂载前缀，使路径相对挂载根，配合 fullUrl 的 mountPath 拼回正确 URL。
      if (this.mountPath && path.startsWith(this.mountPath)) {
        path = this.normalize(path.slice(this.mountPath.length));
      }
      if (path === selfPath) continue; // 跳过自身条目

      const isDir = /<(?:[a-zA-Z0-9]+:)?resourcetype[^>]*>[\s\S]*?<(?:[a-zA-Z0-9]+:)?collection[\s/>]/i.test(block)
        || /<(?:[a-zA-Z0-9]+:)?collection[\s/>]/i.test(block);
      const lenM = block.match(/<(?:[a-zA-Z0-9]+:)?getcontentlength[^>]*>(\d+)<\//i);
      const ctM = block.match(/<(?:[a-zA-Z0-9]+:)?getcontenttype[^>]*>([^<]*)<\//i);
      const segs = path.split('/');
      const name = segs[segs.length - 1] || path;

      out.push({
        href: path,
        name,
        isDir,
        size: lenM ? parseInt(lenM[1], 10) : undefined,
        contentType: ctM ? ctM[1].trim() : undefined,
      });
    }
    return out;
  }
}
