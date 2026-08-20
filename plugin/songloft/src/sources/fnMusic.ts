// 飞牛音乐（fnOS Music / trim.music）适配器
// —— 基于官方 trim.music-0.9.11.fpk 逆向 + 对 192.168.31.28:5666 真机验证。
//
// 已实测确认的协议细节：
//  - 登录：POST {base}/music/api/v1/user/password-login
//          body { username, password: SHA256(明文, 小写 hex), deviceId } → data.userToken
//  - 鉴权：所有请求带 Cookie: music-token=<userToken>
//  - 流：  GET {base}/api/v1/track/stream?guid=<guid>
//          返回 audio/mpeg，支持 Range（实测 206 + Content-Range + Accept-Ranges: bytes）
//  - 封面：GET {base}/api/v1/static/cover?coverId=<coverId> → image/webp
//  - 歌词：GET {base}/api/v1/lyric/list?trackGUID=<guid> → data.list[].content（LRC）
//  - 列表：track/list、album/list、artist/list（limit/offset）
//  - 专辑曲目：track/album-detail/list?albumGUID=&page=&size=
//  - 艺术家曲目：track/artist-detail/list?artistGUID=&page=&size=
//  - 搜索：search/track|album|artist?q=&limit=&offset=
//  - duration 单位是「毫秒」，这里统一归一化为秒。

import { sha256, md5, randomDeviceId, base64 } from '../crypto';
import { parseAudioHeadFromUrl } from '../lib/audio-head';
import { getSetCookie } from '@songloft/plugin-sdk';
import {
  SourceAdapter, SourceConfig, Track, Album, Artist, Playlist, SearchResults, UpstreamRef,
} from '../types';

declare const songloft: any;

interface FnRawTrack {
  guid: string; title: string; coverId?: string | null; year?: number | null;
  discNo?: number; trackNo?: number; isrc?: string; duration?: number;
  album?: { guid: string; name: string; coverId?: string | null; releaseDate?: string };
  artists?: { guid: string; name: string; coverId?: string | null }[];
  audioSpec?: { bitrate?: number; codec?: string; sampleRate?: number; size?: number; path?: string };
}
interface FnRawAlbum {
  guid: string; name: string; coverId?: string | null; releaseDate?: string;
  artists?: { guid: string; name: string }[]; trackCount?: number;
}
interface FnRawArtist {
  guid: string; name: string; coverId?: string | null; trackCount?: number; albumCount?: number;
}
interface FnRawPlaylist {
  guid: string; name: string; coverId?: string | null; trackCount?: number; description?: string;
}

export class FnMusicAdapter implements SourceAdapter {
  readonly type = 'fnMusic' as const;
  readonly sourceId: string;

  private cfg: SourceConfig;
  private hostBase: string;
  private apiBase: string;
  private candidateBases: string[];   // 裸 FN ID 时展开为多个同级别网关 api 根（<id>.fnos.net 与 <id>.5ddd.com，均为子域名格式），密码登录与访问码验证逐个尝试、用哪个通哪个
  private token: string | null = null;
  private deviceId: string;
  private loginPromise: Promise<void> | null = null;
  // fnOS 访问码：网关层鉴权 cookie（os-access-code）。cookie 内含客户端 IP，后端必须自己申请。
  // 该 cookie 是 session cookie（无 Max-Age），fnOS 侧会话约每天过期，故不能永久缓存——
  // 用 gatewayCookieTs 记录换到的时间，超过 TTL 就主动重换，避免带着过期 cookie 去登录被拦。
  private gatewayCookie: string | null = null;
  private gatewayCookieTs: number = 0;
  // 穿透会话 cookie：access_code_verify 同响应下发的 os-access-code 之外的其余 Set-Cookie，
  // 是「访问码验证会话」与后续 password-login / 接口请求的绑定凭证（公网穿透场景必需）。
  // 局域网无穿透层，此字段为空，仅 os-access-code 即可鉴权。
  private gatewayExtraCookies: string | null = null;
  private gatewayCookiePromise: Promise<void> | null = null;
  private preferredBase: string | null = null;  // verifyAccessCode 验证通过的候选，login 优先复用，避免再白试死域名
  private static GATEWAY_TTL_MS = 5 * 60 * 1000; // 5 分钟主动刷新，远小于 fnOS 会话有效期
  // 裸 FN ID（如 pcyear）中继发现：<id>.fnos.net DNS 不存在、<id>.5ddd.com 是门户 SPA，均非设备 API 根。
  // 真实设备地址须经 FN Connect 中继发现（resolveFnId）填充，以下为相关状态与签名常量。
  private isBareFnId = false;
  private fnId = '';
  private fnIdResolved = false;
  private fnIdPromise: Promise<void> | null = null;
  private static readonly FN_CONNECT_HOST = '5ddd.com';
  // FN Connect 中继发现签名常量（硬编码于飞牛官方 fnconnect web bundle，无服务端密钥，纯客户端可算）
  private static readonly FN_CONNECT_PREFIX = 'NDzZTVxnRKP8Z0jXg1VAMonaG8akvh';
  private static readonly FN_CONNECT_APIKEY = 'zIGtkc3dqZnJpd29qZXJqa2w7c';

  constructor(cfg: SourceConfig) {
    this.cfg = cfg;
    this.sourceId = cfg.id;
    // 归一到 .../music/api/v1。支持三种输入：
    //  - 完整地址 http(s)://host:port[/music[/api/v1]]（局域网/可达网关）
    //  - 裸 FN ID（不含 :// 与 /，如 pcyear）→ 展开为两个网关 api 根，密码登录逐个尝试
    const raw = (cfg.baseUrl || '').trim();
    let bases: string[];
    this.isBareFnId = !/:\/\//.test(raw) && !/\//.test(raw);
    if (this.isBareFnId) {
      // 裸 FN ID：暂不打真实 API 根——<id>.fnos.net DNS 不存在、<id>.5ddd.com 是门户 SPA，均非设备 API。
      // 真实地址由 resolveFnId() 经 FN Connect 中继发现后填充（见下方方法）。
      this.fnId = raw;
      bases = []; // 占位，resolveFnId 覆盖
    } else {
      let base = raw.replace(/\/+$/, '');
      base = base.replace(/\/api\/v1$/, '');
      if (!/\/music$/.test(base)) base += '/music';
      bases = [base + '/api/v1'];
    }
    this.candidateBases = bases.length ? bases : ['http://localhost/music/api/v1'];
    this.apiBase = this.candidateBases[0];
    this.hostBase = this.apiBase.replace(/\/api\/v1$/, '');
    this.deviceId = (cfg.extra && cfg.extra.deviceId) || randomDeviceId();
  }

  /**
   * 裸 FN ID（如 pcyear）的中继发现：飞牛 FN Connect 网关并不把 <id>.fnos.net / <id>.5ddd.com
   * 暴露成设备 API 根（前者 DNS 不存在，后者是门户 SPA 网页）。真实设备地址需经 FN Connect 中继发现：
   *   POST https://5ddd.com/api/v1/fn/con  body { fnId }
   *     头 fn-sign = SHA256("trim_connect`"+fnId+"`"+ts+"`anna")   // 盐 anna 写死，无服务端密钥
   *         authx  = nonce=<6位>&timestamp=<ms>&sign=MD5(PREFIX_url_nonce_ts_MD5(body)_apiKey)  // 常量硬编码于 bundle
   * 返回 data.{ ipv4[], publicIpv4[], fn[], port } —— 主机名:端口候选，逐个试 password-login 用通的那个。
   * 并发去重；仅裸 FN ID 时工作，局域网/完整地址源跳过。无需宿主任何新接口（宿主 HTTP 层可直连 5ddd.com）。
   */
  private async resolveFnId(): Promise<void> {
    if (!this.isBareFnId || this.fnIdResolved) return;
    if (this.fnIdPromise) return this.fnIdPromise;
    this.fnIdPromise = (async () => {
      const fnId = this.fnId;
      const url = '/api/v1/fn/con';
      const ts = Date.now();
      const fnsign = sha256(`trim_connect\`${fnId}\`${ts}\`anna`);
      const nonce = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
      const bodyStr = JSON.stringify({ fnId });
      const sign = md5([
        FnMusicAdapter.FN_CONNECT_PREFIX, url, nonce, String(ts), md5(bodyStr), FnMusicAdapter.FN_CONNECT_APIKEY,
      ].join('_'));
      const authx = `nonce=${nonce}&timestamp=${ts}&sign=${sign}`;
      const headers = { 'Content-Type': 'application/json', 'fn-sign': fnsign, 'authx': authx };
      const resp = await this.fetchMaybe(`https://${FnMusicAdapter.FN_CONNECT_HOST}${url}`, {
        method: 'POST',
        headers,
        body: bodyStr,
      });
      const status = resp.status;
      const raw = await resp.text();
      let data: any = null;
      try { data = JSON.parse(raw); } catch { /* 非 JSON（如门户 HTML） */ }
      if (!data || data.code !== 0 || !data.data) {
        throw new Error(`飞牛ID「${fnId}」中继发现失败（HTTP ${status}：${data && data.msg ? data.msg : raw.slice(0, 120)}）。请确认 FN ID 正确；或改用「局域网/反代地址 + 访问码」接入。`);
      }
      const d = data.data;
      const httpsPort = (d.port && d.port.httpsPort) || 5667;
      const hosts: string[] = [];
      // 注意：d.fn（如 pcyear.5ddd.com:443）是 FN Connect 中继门户，直打设备 API 只会返回
      // 门户 SPA（302），真正的远程访问要走 WebSocket 隧道（暂未实现）。故这里只取可直接
      // HTTPS 访问的设备地址：局域网 ipv4 与公网 publicIpv4（均需 X-Fetch-Insecure 跳过自签证书）。
      if (Array.isArray(d.publicIpv4)) for (const ip of d.publicIpv4) hosts.push(`${ip}:${httpsPort}`);
      if (Array.isArray(d.ipv4)) for (const ip of d.ipv4) hosts.push(`${ip}:${httpsPort}`);
      const uniq = [...new Set(hosts)];
      if (!uniq.length) {
        throw new Error(`飞牛ID「${fnId}」中继发现返回了设备，但解析不出可用地址（${JSON.stringify(d).slice(0, 120)}）`);
      }
      const bases = uniq.map((h) => `https://${h}/music/api/v1`);
      this.candidateBases = bases;
      this.apiBase = bases[0];
      this.hostBase = bases[0].replace(/\/api\/v1$/, '');
      this.fnIdResolved = true;
    })().finally(() => { this.fnIdPromise = null; });
    return this.fnIdPromise;
  }

  /** fetch 封装（统一出口，便于将来扩展超时/重试）。
   *  访问码 cookie（os-access-code）由 verifyAccessCode 用 SDK getSetCookie 显式读取（兼容新老宿主），
   *  并经由 cookieWithGateway 附加到后续请求，不依赖宿主自动维护 cookie jar。 */
  private async fetchMaybe(url: string, init?: any): Promise<any> {
    // 飞牛设备几乎都是自签 HTTPS（局域网 x.x.x.x:5667 / 公网直连端口），宿主默认 TLS 校验会失败。
    // 注入 X-Fetch-Insecure 让宿主跳过校验（当前宿主若未识别该头会自动忽略，零副作用）。
    const headers = Object.assign({ 'X-Fetch-Insecure': '1' }, (init && init.headers) || {});
    return fetch(url, { credentials: 'include', ...(init || {}), headers });
  }

  /** 从响应头取一个字段（兼容 Headers 对象 / 普通对象） */
  private getHeader(resp: any, name: string): string | null {
    if (!resp || !resp.headers) return null;
    const lower = name.toLowerCase();
    if (typeof resp.headers.get === 'function') {
      return resp.headers.get(name) || resp.headers.get(lower) || null;
    }
    return resp.headers[name] || resp.headers[lower] || null;
  }

  /** 把 Set-Cookie（数组或字符串）转成 Cookie 请求头的 name=value 串，用于 3xx 跟随重定向时回带 */
  private joinCookies(setCookie: any): string | null {
    const list = Array.isArray(setCookie) ? setCookie : (typeof setCookie === 'string' && setCookie ? [setCookie] : []);
    const parts: string[] = [];
    for (const c of list) {
      const nv = String(c).split(';')[0].trim();
      if (nv) parts.push(nv);
    }
    return parts.length ? parts.join('; ') : null;
  }

  /** 解析相对 Location（支持绝对、根相对、相对路径） */
  private resolveUrl(base: string, rel: string): string {
    if (/^https?:\/\//i.test(rel)) return rel;
    try {
      if (typeof URL !== 'undefined') return new URL(rel, base).href;
    } catch { /* fallthrough */ }
    if (rel.startsWith('/')) {
      const m = /^https?:\/\/[^/]+/.exec(base);
      return (m ? m[0] : '') + rel;
    }
    const baseRoot = base.replace(/\/[^/]*$/, '/');
    return baseRoot + rel;
  }

  /**
   * 把网关访问码 cookie 并入：丢弃 base 中可能残留的旧访问码（IP 绑定会失效），
   * 用后端自申请的新鲜 os-access-code 覆盖，确保网关放行。
   */
  private cookieWithGateway(base?: string): string | undefined {
    const parts: string[] = [];
    if (base) {
      for (const part of base.split(';')) {
        const p = part.trim();
        if (!p) continue;
        if (/^access-code=/i.test(p)) continue; // 仅丢弃裸露的 access-code（IP 绑定可能已失效）；保留 os-access-code（FN Connect 网关会话）
        parts.push(p);
      }
    }
    if (this.gatewayCookie) parts.push(`os-access-code=${this.gatewayCookie}`);
    if (this.gatewayExtraCookies) parts.push(this.gatewayExtraCookies);
    return parts.length ? parts.join('; ') : undefined;
  }

  private authHeaders(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = {};
    const base = this.token ? `music-token=${this.token}` : undefined;
    const cookie = this.cookieWithGateway(base);
    if (cookie) h['Cookie'] = cookie;
    if (extra) Object.assign(h, extra);
    return h;
  }

  /** 并发安全的登录：多个请求同时触发时只发一次登录 */
  private async login(): Promise<void> {
    if (this.loginPromise) return this.loginPromise;
    await this.resolveFnId();
    if (this.loginPromise) return this.loginPromise;
    // 飞牛开启访问码：login 前必须先换 os-access-code cookie（testConnection 直接调 login，
    // 不走 ensureAuth，故此处自行保证；verifyAccessCode 已并发去重，重复调用安全）。
    if (this.cfg.accessCode) {
      try {
        await this.verifyAccessCode();
      } catch (e: any) {
        throw new Error((e && e.message) || '访问码错误');
      }
    }
    this.loginPromise = (async () => {
      // 裸 FN ID 时逐个网关尝试密码登录（局域网/完整地址只有 1 个候选）。
      // 优先用 verifyAccessCode 已验证通过的候选（preferredBase），省去一次白试死域名。
      const order = this.preferredBase
        ? [this.preferredBase, ...this.candidateBases.filter((b) => b !== this.preferredBase)]
        : this.candidateBases;
      const errs: string[] = [];
      for (const b of order) {
        this.apiBase = b;
        this.hostBase = b.replace(/\/api\/v1$/, '');
        const where = `[${b}/user/password-login]`;   // 在 try 外声明，catch 可见
        const pwHash = sha256(this.cfg.password || '');
        // 飞牛开启访问码：password-login 也走网关，需带 os-access-code cookie
        const loginHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        // 密码登录也经网关：带全量网关 cookie（os-access-code + 穿透会话），缺其一都会被拦
        const gwCookie = this.cookieWithGateway(undefined);
        if (gwCookie) loginHeaders['Cookie'] = gwCookie;
        try {
          const resp = await this.fetchMaybe(`${b}/user/password-login`, {
            method: 'POST',
            headers: loginHeaders,
            body: JSON.stringify({
              username: this.cfg.username || '',
              password: pwHash,
              deviceId: this.deviceId,
            }),
          });
          const status = resp.status;
          const raw = await resp.text();
          let data: any = null;
          try { data = JSON.parse(raw); } catch { /* 非 JSON */ }
          if (data && data.code === 0 && data.data && data.data.userToken) {
            this.token = data.data.userToken;
            return;
          }
          if (data) {
            // 含请求 URL + HTTP 状态码 + 服务端原文，便于定位是密码错还是连错主机/被代理拦
            errs.push(`飞牛登录失败 ${where} HTTP ${status}: ${data.msg || 'code=' + data.code}（用户名/密码请核对）`);
          } else if (/^\s*<(!doctype|html)/i.test(raw)) {
            // 登录返回 HTML：飞牛网关拦截页（访问码未通过时返回登录页）。
            const isGatewayIntercept = /飞牛\s*fnOS|访问码|fnOS|access[_-]?code|需要登录|请先登录|登录飞牛/i.test(raw);
            if (isGatewayIntercept) {
              errs.push(this.cfg.accessCode
                ? `${where}：访问码已通过，但网关仍返回登录页（os-access-code 未被该网关接受，请确认访问码与飞牛网关一致）`
                : `${where}：网关要求访问码（请在音源配置填写访问码）`);
            } else {
              errs.push(`${where}：返回的不是飞牛音乐数据（请检查「基础地址」是否指向飞牛音乐的 /music 接口）`);
            }
          } else {
            errs.push(`飞牛登录失败 ${where} HTTP ${status} body=${raw.slice(0, 200)}`);
          }
        } catch (e) {
          const reason = (e && (e.message || String(e))) || String(e);
          errs.push(`飞牛登录请求异常 ${where}：${reason}`);
        }
      }
      throw new Error('飞牛音乐登录失败，全部候选网关均不可用：\n' + errs.join('\n'));
    })();
    // 无论成败都要释放锁，失败时允许下次重试
    this.loginPromise.catch(() => { /* 交由调用方处理 */ }).then(() => { this.loginPromise = null; });
    return this.loginPromise;
  }

  /**
   * 原生 TCP 直连读取网关下发的 os-access-code cookie。
   * 关键：本运行时的 fetch 会把 forbidden header（Set-Cookie）彻底隐藏，JS 永远读不到，
   * 也不自动维护 cookie jar。而 fnOS 网关是 HTTP（局域网），可用 songloft.net.tcpConnect
   * 直接发 HTTP/1.1 请求、读原始响应头拿到 Set-Cookie，从而显式持有并附加该 cookie。
   * 仅 http（无 TLS）可用；https（公网 FN ID）无 TLS 握手能力，返回 null 走 fetch 兜底。
   * 任何异常（无 net 权限 / SSRF 拦截 / 超时）都返回 null，由上层回退 fetch。
   */
  private async fetchGatewayCookieViaRawSocket(origin: string, b64: string): Promise<string | null> {
    if (!/^https?:\/\//i.test(origin)) return null;
    if (/^https:/i.test(origin)) return null; // 无 TLS，走 fetch 兜底（FN Connect 场景）
    const m = /^(?:http:\/\/)?([^/:]+)(?::(\d+))?/i.exec(origin);
    if (!m) return null;
    const g = globalThis as any;
    const net = g.songloft && g.songloft.net;
    if (!net || typeof net.tcpConnect !== 'function') return null;
    const host = m[1];
    const port = m[2] ? parseInt(m[2], 10) : 80;
    let sock: any;
    try {
      sock = await net.tcpConnect(host, port, { timeout: 10000 });
    } catch {
      return null; // 无 net 权限 / SSRF 拦截 / 连接失败 → 回退 fetch
    }
    let acc = '';
    let settled = false;
    const resultP = new Promise<string>((resolve) => {
      const finish = (hdr: string) => {
        if (settled) return;
        settled = true;
        const scm = /set-cookie:\s*([^\r\n]+)/i.exec(hdr);
        const om = scm ? /os-access-code=([^;\s]+)/.exec(scm[1]) : null;
        resolve(om ? om[1] : '');
      };
      sock.onData((b64data: string) => {
        try {
          acc += (g.atob ? g.atob(b64data) : Buffer.from(b64data, 'base64').toString('latin1'));
          const i = acc.indexOf('\r\n\r\n');
          if (i >= 0) finish(acc.slice(0, i));
        } catch { /* ignore chunk */ }
      });
      sock.onClose(() => {
        const i = acc.indexOf('\r\n\r\n');
        finish(i >= 0 ? acc.slice(0, i) : acc);
      });
    });
    // 读取超时保护：超时不抛，回退 fetch
    const timeoutP = new Promise<string>((resolve) => {
      const t = g.setTimeout ? g.setTimeout(() => { if (!settled) { settled = true; resolve(''); } }, 12000) : null;
      if (t && t.unref) try { t.unref(); } catch { /* ignore */ }
    });
    try {
      const reqLines = [
        'GET /access_code_verify HTTP/1.1',
        `Host: ${host}${port === 80 ? '' : ':' + port}`,
        'Connection: close',
        'Accept: */*',
        'User-Agent: songloft-bridge',
        'x-access-code: ' + b64,
        'x-access-source: web',
        '',
        '',
      ];
      await sock.send(reqLines.join('\r\n'));
      const cookie = await Promise.race([resultP, timeoutP]);
      return cookie || null;
    } catch {
      return null;
    } finally {
      try { await sock.close(); } catch { /* ignore */ }
    }
  }

  /**
   * fnOS 开启「访问码」后的网关层鉴权：后端必须自己用访问码向网关换 os-access-code cookie。
   * （该 cookie 内含客户端 IP，不能让用户手填——IP 不一致校验会失败。）
   * 验证：GET {origin}/access_code_verify，header x-access-code: base64(码) + x-access-source: web
   *       成功 → 204 + Set-Cookie: os-access-code=<v>
   * 裸 FN ID 会展开成多个同级别网关（<id>.fnos.net 与 <id>.5ddd.com，均为子域名格式），用户随机分到其一，
   * 必须逐个尝试、用哪个通哪个——故这里遍历全部候选 origin，而非仅 hostBase[0]。
   * 缓存策略：cookie 是 session cookie，fnOS 侧会话约每天过期，故不永久缓存——超过 GATEWAY_TTL_MS
   * 就主动重换；force=true 时无视 TTL 立即重换（被网关拦截后调用）。并发去重：同时只验一次。
   */
  private verifyAccessCode(force: boolean = false): Promise<void> {
    if (!this.cfg.accessCode) return Promise.resolve();
    if (this.gatewayCookie && !force && Date.now() - this.gatewayCookieTs < FnMusicAdapter.GATEWAY_TTL_MS) {
      return Promise.resolve();
    }
    if (this.gatewayCookiePromise) return this.gatewayCookiePromise;
    // 全部候选网关的 origin（剥掉 /music/api/v1）：<id>.fnos.net 与 <id>.5ddd.com 等。
    const origins = this.candidateBases.map((b) => b.replace(/\/music\/api\/v1$/, ''));
    const b64 = base64(String(this.cfg.accessCode));
    this.gatewayCookiePromise = (async () => {
      const verifyErrs: string[] = [];
      for (const origin of origins) {
        // 1) 原生 TCP 直连：直接读原始 Set-Cookie（绕过运行时隐藏 forbidden header）。
        //    仅 http 局域网可用；https（FN ID 公网）无 TLS，返回 null 走下方 fetch 兜底。
        const rawCookie = await this.fetchGatewayCookieViaRawSocket(origin, b64);
        if (rawCookie) {
          this.gatewayCookie = rawCookie;
          this.gatewayCookieTs = Date.now();
          this.preferOrigin(origin);
          return;
        }
        // 2) fetch 兜底：SDK 的 getSetCookie(resp) 兼容新老宿主读取 204 的 Set-Cookie
        //    （无损数组 / 启发式回退）；X-Fetch-No-Redirect 防止默认重定向吞掉中间 Set-Cookie。
        //    网络异常（域名不可达/超时）不中断整体，记下来继续试下一个候选。
        //    关键：网关 access_code_verify 在【根路径】（与局域网原生 socket 一致，见 fetchGatewayCookieViaRawSocket
        //    的 GET /access_code_verify），绝不在 /music 下。origin 是 …/music，故剥掉 /music 取网关根。
        let resp: any;
        const verifyRoot = origin.replace(/\/music$/, '');
        const verifyUrl = `${verifyRoot}/access_code_verify`;
        try {
          resp = await this.fetchMaybe(verifyUrl, {
            method: 'GET',
            headers: { 'x-access-code': b64, 'x-access-source': 'web', 'X-Fetch-No-Redirect': '1' },
          });
        } catch (e: any) {
          verifyErrs.push(`访问码验证 ${verifyUrl} 请求异常：${(e && e.message) || String(e)}`);
          continue;
        }
        // 公网 FN Connect 中继可能先返回 3xx 重定向（如跳转到验证页 / 带参数端点）。
        // 必须手动跟随一次，并把 302 响应上的 Set-Cookie 一并带过去，否则拿不到最终 os-access-code。
        let redirectExtraCookies = '';
        if (resp.status >= 300 && resp.status < 400) {
          const redirectCookies = this.joinCookies(getSetCookie(resp));
          const loc = this.getHeader(resp, 'location');
          if (loc) {
            const followHeaders: Record<string, string> = {
              'x-access-code': b64,
              'x-access-source': 'web',
              'X-Fetch-No-Redirect': '1',
            };
            if (redirectCookies) {
              followHeaders['Cookie'] = redirectCookies;
              redirectExtraCookies = redirectCookies;
            }
            try {
              resp = await this.fetchMaybe(this.resolveUrl(verifyUrl, loc), {
                method: 'GET',
                headers: followHeaders,
              });
            } catch (e: any) {
              verifyErrs.push(`访问码验证 ${verifyUrl} 返回 ${resp.status} → ${loc}，跟随重定向异常：${(e && e.message) || String(e)}`);
              continue;
            }
          }
        }
        const arr = getSetCookie(resp);
        // 保留全量 Set-Cookie：os-access-code 单独管（IP 绑定 / TTL），其余穿透会话 cookie 一并保存。
        // 公网 FN Connect 场景，password-login / 接口请求必须同时带二者，网关才放行。
        let osCode: string | null = null;
        const extra: string[] = [];
        const list = Array.isArray(arr) ? arr : (typeof arr === 'string' && arr ? [arr] : []);
        for (const c of list) {
          const cm = /^\s*os-access-code=([^;\s]+)/i.exec(c);
          if (cm) osCode = cm[1];
          else {
            // 仅取 name=value（去掉 Path/HttpOnly/Expires 等属性），作为会话 cookie 回带
            const nv = c.split(';')[0].trim();
            if (nv) extra.push(nv);
          }
        }
        if (osCode) {
          this.gatewayCookie = osCode;
          // 合并 302 上的会话 cookie 与最终响应上的会话 cookie，都作为穿透会话凭证回带
          const mergedExtra = redirectExtraCookies
            ? [...new Set([...redirectExtraCookies.split(';').map((s) => s.trim()).filter(Boolean), ...extra])]
            : extra;
          this.gatewayExtraCookies = mergedExtra.length ? mergedExtra.join('; ') : null;
          this.gatewayCookieTs = Date.now();
          this.preferOrigin(origin);
          return;
        }
        if (resp.status === 204 || (resp.status >= 200 && resp.status < 300)) {
          // 2xx/204 但未下发 os-access-code：该 origin 并未真正放行访问码（地址不对 /
          // 访问码错误 / 该网关本就没开访问码）。绝不能误判为「已放行」——否则后续 login
          // 不带任何网关 cookie 裸奔、被网关拦成登录页。已填访问码时继续试下一候选。
          if (this.cfg.accessCode) {
            verifyErrs.push(`访问码验证 ${verifyUrl} 返回 ${resp.status} 但未下发 os-access-code（请确认访问码正确，且该地址确实开启了访问码）`);
            continue;
          }
          // 未填访问码：2xx 视为网关无需访问码，直接放行
          this.gatewayCookieTs = Date.now();
          this.preferOrigin(origin);
          return;
        }
        // 非 2xx 且未拿到 os-access-code：该候选的访问码接口不可用（路径错/网关拦截/重定向后仍失败），记下来试下一个
        const locFinal = this.getHeader(resp, 'location');
        const locHint = locFinal ? `（Location: ${locFinal}）` : '';
        verifyErrs.push(`访问码验证 ${verifyUrl} 返回 HTTP ${resp.status}${locHint}（该地址的访问码接口不可用）`);
      }
      throw new Error('访问码验证失败，全部候选网关均不可用：\n' + verifyErrs.join('\n'));
    })().finally(() => { this.gatewayCookiePromise = null; });
    return this.gatewayCookiePromise;
  }

  /** 命中可用网关后，把 apiBase/hostBase 锚定到该 origin 的候选，并记下 preferredBase，
   *  让后续 login 优先复用、少一次失败尝试（避免每次都白试死域名）。 */
  private preferOrigin(origin: string): void {
    for (const b of this.candidateBases) {
      if (b.replace(/\/music\/api\/v1$/, '') === origin) {
        this.apiBase = b;
        this.hostBase = b.replace(/\/api\/v1$/, '');
        this.preferredBase = b;
        break;
      }
    }
  }

  async ensureAuth(): Promise<void> {
    await this.resolveFnId();
    if (this.cfg.accessCode) await this.verifyAccessCode();
    if (!this.token) await this.login();
  }

  private buildUrl(path: string, query?: Record<string, any>): string {
    let url = `${this.apiBase}${path}`;
    if (query) {
      const q = Object.keys(query)
        .filter((k) => query[k] !== undefined && query[k] !== null && query[k] !== '')
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(query[k]))}`)
        .join('&');
      if (q) url += (url.indexOf('?') >= 0 ? '&' : '?') + q;
    }
    return url;
  }

  private async req<T = any>(
    method: string,
    path: string,
    opts: { query?: Record<string, any>; body?: any; retry?: boolean; retryGateway?: boolean } = {},
  ): Promise<T> {
    await this.ensureAuth();
    const url = this.buildUrl(path, opts.query);
    const headers = this.authHeaders(opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined);
    const resp = await this.fetchMaybe(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    // 飞牛开启访问码：网关拦截返回 200 + HTML 拦截页（非 JSON），需先重验访问码再重试。
    // 拦截页特征：content-type: text/html 且正文含「飞牛 fnOS」。
    const ct = resp.headers && typeof resp.headers.get === 'function'
      ? (resp.headers.get('content-type') || '')
      : (resp.headers && (resp.headers['content-type'] || resp.headers['Content-Type']) || '');
    const isHtml = typeof ct === 'string' && ct.indexOf('text/html') >= 0;
    if (isHtml) {
      const sample = await resp.text();
      if (sample.indexOf('飞牛 fnOS') >= 0 || ct.indexOf('text/html') >= 0) {
        if (!opts.retryGateway && this.cfg.accessCode) {
          this.gatewayCookie = null;            // 旧 cookie 失效，清掉
          this.gatewayExtraCookies = null;      // 穿透会话一并清掉，强制重验时重新获取全量
          this.gatewayCookieTs = 0;             // 强制重新验码（无视 TTL）
          try { await this.verifyAccessCode(true); } catch { /* 重验失败，下方抛错 */ }
          return this.req<T>(method, path, { ...opts, retryGateway: true });
        }
        throw new Error(this.cfg.accessCode
          ? '访问码已通过，但网关仍返回拦截页：请确认访问码与飞牛网关一致，或改用局域网 / 可达地址'
          : '请在音源配置填写访问码（飞牛已开启访问码）');
      }
    }
    // token 失效 → 重登一次
    if ((resp.status === 401 || resp.status === 403) && !opts.retry) {
      this.token = null;
      return this.req<T>(method, path, { ...opts, retry: true });
    }
    let data: any = null;
    try { data = await resp.json(); } catch {
      throw new Error(`飞牛音乐返回了非 JSON 响应（HTTP ${resp.status}，路径 ${path}）`);
    }
    if (data.code !== 0) {
      // 部分部署用 code 100003 表示未授权
      if (!opts.retry && (data.code === 100003 || data.code === 401)) {
        this.token = null;
        return this.req<T>(method, path, { ...opts, retry: true });
      }
      throw new Error(`飞牛音乐接口错误：${data.msg || 'code=' + data.code}（${path}）`);
    }
    return data as T;
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      this.token = null;
      await this.login();
      const me: any = await this.req('GET', '/user/me');
      const name = (me.data && me.data.name) || this.cfg.username;
      const role = (me.data && me.data.role) || '';
      return { ok: true, message: `连接成功，已登录用户 ${name}${role ? '（' + role + '）' : ''}` };
    } catch (e: any) {
      const msg = (e && e.message) || String(e);
      return { ok: false, message: msg };
    }
  }

  // ---------------- 映射 ----------------
  private mapTrack(t: FnRawTrack): Track {
    const artists = (t.artists || []).map((a) => a.name).filter(Boolean);
    return {
      id: t.guid,
      title: t.title || '未知曲目',
      artist: artists.length ? artists.join(', ') : '未知艺术家',
      album: t.album ? t.album.name : undefined,
      year: t.year != null ? t.year : (t.album && t.album.releaseDate ? parseInt(t.album.releaseDate.slice(0, 4), 10) : undefined),
      trackNo: t.trackNo,
      discNo: t.discNo,
      // 上游是毫秒，统一转秒
      duration: t.duration ? Math.round(t.duration / 1000) : undefined,
      coverId: t.coverId || (t.album && t.album.coverId) || undefined,
      size: t.audioSpec && t.audioSpec.size,
      bitrate: t.audioSpec && t.audioSpec.bitrate,
      codec: t.audioSpec && t.audioSpec.codec,
      path: t.audioSpec && t.audioSpec.path,
      _source: this.sourceId,
    };
  }

  private mapAlbum(a: FnRawAlbum): Album {
    const artists = (a.artists || []).map((x) => x.name).filter(Boolean);
    return {
      id: a.guid,
      name: a.name || '未知专辑',
      artist: artists.length ? artists.join(', ') : undefined,
      year: a.releaseDate ? parseInt(a.releaseDate.slice(0, 4), 10) : undefined,
      coverId: a.coverId || undefined,
      trackCount: a.trackCount,
      _source: this.sourceId,
    };
  }

  private mapArtist(a: FnRawArtist): Artist {
    return {
      id: a.guid,
      name: a.name || '未知艺术家',
      coverId: a.coverId || undefined,
      trackCount: a.trackCount,
      albumCount: a.albumCount,
      _source: this.sourceId,
    };
  }

  private mapPlaylist(p: FnRawPlaylist): Playlist {
    return {
      id: p.guid,
      name: p.name || '未命名歌单',
      description: p.description,
      coverId: p.coverId || undefined,
      trackCount: p.trackCount,
      _source: this.sourceId,
    };
  }

  private unwrap<T>(r: any, mapper: (x: any) => T): { list: T[]; total: number } {
    const list = (r && r.data && r.data.list) || [];
    const total = (r && r.data && typeof r.data.total === 'number') ? r.data.total : list.length;
    return { list: list.map(mapper), total };
  }

  // ---------------- 列表 ----------------
  // 注意：飞牛 /track/list 等列表接口的分页是 page/size（page 从 1 起），不是 limit/offset！
  // 实测 limit/offset 的 offset 会被忽略、永远返回第一页 → 第二页与第一页完全重复（全选去重后少选）。
  // 这里统一把外部 limit/offset 换算成 page/size（与 albumTracks/artistTracks 一致）。
  private pageQuery(opts: { limit?: number; offset?: number }): { page: number; size: number } {
    const size = opts.limit || 50;
    const page = Math.floor((opts.offset || 0) / size) + 1;
    return { page, size };
  }

  async listTracks(opts: { limit?: number; offset?: number }) {
    const r = await this.req('GET', '/track/list', { query: this.pageQuery(opts) });
    return this.unwrap(r, (t: FnRawTrack) => this.mapTrack(t));
  }

  async listAlbums(opts: { limit?: number; offset?: number }) {
    const r = await this.req('GET', '/album/list', { query: this.pageQuery(opts) });
    const raw: FnRawAlbum[] = (r && r.data && r.data.list) || [];
    const total = (r && r.data && typeof r.data.total === 'number') ? r.data.total : raw.length;
    // 专辑封面为空 → 取专辑内第一首歌封面兜底（仅对空封面补，失败静默跳过）
    const enriched = await Promise.all(raw.map(async (a) => {
      if (a.coverId) return this.mapAlbum(a);
      try {
        const songs: any = await this.req('GET', '/track/album-detail/list', { query: { albumGUID: a.guid, page: 1, size: 1 } });
        const first = songs && songs.data && songs.data.list && songs.data.list[0];
        if (first) return this.mapAlbum({ ...a, coverId: first.coverId || (first.album && first.album.coverId) || undefined });
      } catch { /* ignore */ }
      return this.mapAlbum(a);
    }));
    return { list: enriched, total };
  }

  async listArtists(opts: { limit?: number; offset?: number }) {
    const r = await this.req('GET', '/artist/list', { query: this.pageQuery(opts) });
    const raw: FnRawArtist[] = (r && r.data && r.data.list) || [];
    const total = (r && r.data && typeof r.data.total === 'number') ? r.data.total : raw.length;
    // 修复：
    //  ① 封面为空 → 取艺术家第一首歌封面兜底；
    //  ② trackCount 不准（飞牛按"已分组专辑"统计，散落歌曲漏算，如「未知艺术家」12 首显示 1 项）→
    //     并发调 /track/artist-detail/list size=1 取 data.total 作为真实歌曲数（仅补不阻塞）。
    const enriched = await Promise.all(raw.map(async (a) => {
      let coverId = a.coverId || undefined;
      let realTrackCount: number | undefined;
      try {
        const songs: any = await this.req('GET', '/track/artist-detail/list', { query: { artistGUID: a.guid, page: 1, size: 1 } });
        if (songs && songs.data) {
          if (typeof songs.data.total === 'number') realTrackCount = songs.data.total;
          if (!coverId) {
            const first = songs.data.list && songs.data.list[0];
            if (first) coverId = first.coverId || (first.album && first.album.coverId) || undefined;
          }
        }
      } catch { /* 补真实数量/封面失败静默跳过 */ }
      return this.mapArtist({
        ...a,
        coverId: coverId || undefined,
        trackCount: realTrackCount != null ? realTrackCount : a.trackCount,
      });
    }));
    return { list: enriched, total };
  }

  async listPlaylists(opts: { limit?: number; offset?: number }) {
    const r = await this.req('GET', '/playlist/list', { query: this.pageQuery(opts) });
    const raw: FnRawPlaylist[] = (r && r.data && r.data.list) || [];
    const total = (r && r.data && typeof r.data.total === 'number') ? r.data.total : raw.length;
    // 实测：/playlist/list 返回的歌单不含 trackCount（仅 guid/name/coverId/createdAt/updatedAt），
    // 数量只在 /playlist/detail 返回。对每个歌单并发补一次 detail（本地毫秒级），失败静默跳过。
    // 若歌单封面为空，取歌单第一首歌的封面兜底（专辑封面）。
    const enriched = await Promise.all(raw.map(async (p) => {
      let coverId = p.coverId || undefined;
      if (p.trackCount == null || !coverId) {
        try {
          const d: any = await this.req('GET', '/playlist/detail', { query: { guid: p.guid } });
          const dt = (d && d.data) || {};
          if (!coverId) coverId = dt.coverId || undefined;
          if (p.trackCount == null && dt.trackCount != null) p = { ...p, trackCount: dt.trackCount };
        } catch { /* 补数量/封面失败不阻塞 */ }
      }
      if (!coverId) {
        // 封面仍为空 → 取第一首歌封面
        try {
          const songs: any = await this.req('GET', '/track/playlist-detail/list', { query: { playlistGUID: p.guid, page: 1, size: 1 } });
          const first = songs && songs.data && songs.data.list && songs.data.list[0];
          if (first) coverId = first.coverId || (first.album && first.album.coverId) || undefined;
        } catch { /* ignore */ }
      }
      return this.mapPlaylist({ ...p, coverId: coverId || undefined });
    }));
    return { list: enriched, total };
  }

  async albumTracks(albumId: string, opts: { limit?: number; offset?: number }) {
    const size = opts.limit || 100;
    const page = Math.floor((opts.offset || 0) / size) + 1;
    const r = await this.req('GET', '/track/album-detail/list', { query: { albumGUID: albumId, page, size } });
    return this.unwrap(r, (t: FnRawTrack) => this.mapTrack(t));
  }

  async artistTracks(artistId: string, opts: { limit?: number; offset?: number }) {
    const size = opts.limit || 100;
    const page = Math.floor((opts.offset || 0) / size) + 1;
    const r = await this.req('GET', '/track/artist-detail/list', { query: { artistGUID: artistId, page, size } });
    return this.unwrap(r, (t: FnRawTrack) => this.mapTrack(t));
  }

  async playlistTracks(playlistId: string, opts: { limit?: number; offset?: number }): Promise<{ list: Track[]; total: number }> {
    // 实测确认（2026-08-04）：飞牛音乐有歌单歌曲接口，与专辑/艺术家同命名规律：
    //   GET /track/playlist-detail/list?playlistGUID=<id>&page=&size=  → data.list + data.total（歌单实际歌曲数）
    // 注意：/track/list?playlistGUID= 会忽略该参数返回全局曲目（不能用）；/playlist/detail 只返回元数据（含 trackCount）。
    const size = opts.limit || 100;
    const page = Math.floor((opts.offset || 0) / size) + 1;
    const r = await this.req('GET', '/track/playlist-detail/list', { query: { playlistGUID: playlistId, page, size } });
    return this.unwrap(r, (t: FnRawTrack) => this.mapTrack(t));
  }

  async search(query: string, opts: { limit?: number; dir?: string }): Promise<SearchResults> {
    const lim = opts.limit || 30;
    const half = Math.max(5, Math.ceil(lim / 2));
    const safe = async (p: string, q: Record<string, any>) => {
      try { return await this.req('GET', p, { query: q }); } catch { return null; }
    };
    const [t, a, ar] = await Promise.all([
      safe('/search/track', { q: query, limit: lim, offset: 0 }),
      safe('/search/album', { q: query, limit: half, offset: 0 }),
      safe('/search/artist', { q: query, limit: half, offset: 0 }),
    ]);
    return {
      tracks: t ? this.unwrap(t, (x: FnRawTrack) => this.mapTrack(x)).list : [],
      albums: a ? this.unwrap(a, (x: FnRawAlbum) => this.mapAlbum(x)).list : [],
      artists: ar ? this.unwrap(ar, (x: FnRawArtist) => this.mapArtist(x)).list : [],
    };
  }

  async lyric(trackId: string): Promise<string | null> {
    try {
      const r: any = await this.req('GET', '/lyric/list', { query: { trackGUID: trackId } });
      const list = (r.data && r.data.list) || [];
      for (const l of list) if (l && l.content) return l.content;
    } catch { /* 无歌词不算错误 */ }
    return null;
  }

  // ---------------- 上游解析 ----------------
  async resolveStream(trackId: string): Promise<UpstreamRef> {
    await this.ensureAuth();
    return {
      url: this.buildUrl('/track/stream', { guid: trackId }),
      headers: this.authHeaders(),
    };
  }

  async resolveCover(coverId?: string): Promise<UpstreamRef | null> {
    if (!coverId) return null;
    await this.ensureAuth();
    return {
      url: this.buildUrl('/static/cover', { coverId }),
      headers: this.authHeaders(),
    };
  }

  /** v1.4.13：音源自定义封面缺失时，用曲目流 URL 抓文件头解析内嵌封面（Range 150KB + APIC 二次抓取 + ID3）。
   *  前提：coverId 恰好是曲目 guid（前端 cover-data 传曲目 id 时成立）；音源 API 的封面/标题/作者仍优先。 */
  async resolveEmbeddedCover(trackId?: string): Promise<{ contentType: string; data: Uint8Array } | null> {
    if (!trackId) return null;
    try {
      await this.ensureAuth();
      const { url, headers } = await this.resolveStream(trackId);
      const info = await parseAudioHeadFromUrl(url, headers);
      return info.art || null;
    } catch {
      return null;
    }
  }

  /** 清掉当前 token 并重置登录状态，供 resolveCoverBytes 在 401 时调用以自动重试 */
  resetToken(): void {
    this.token = null;
    this.loginPromise = null;
  }

  // ---------------- 平台原生收藏（飞牛音乐服务端收藏）----------------
  // 接口（取自飞牛音乐 web bundle 的 generated API client，favoriteTrack 端点组）：
  //   读取：GET /favorite-track/list?page=&size=  → data.list[]（与 /track/list 同形状，含 isFavorite:true）
  //   收藏：POST /favorite-track/create  body { trackGUID }
  //   取消：POST /favorite-track/delete  body { trackGUID }
  private _favIdsCache: { at: number; ids: Set<string> } | null = null;

  async favoriteIds(): Promise<string[]> {
    if (this._favIdsCache && Date.now() - this._favIdsCache.at < 30000) return [...this._favIdsCache.ids];
    const ids = new Set<string>();
    const size = 200;
    let page = 1;
    for (;;) {
      const r: any = await this.req('GET', '/favorite-track/list', { query: { page, size } });
      const list: FnRawTrack[] = (r && r.data && r.data.list) || [];
      for (const t of list) if (t.guid) ids.add(String(t.guid));
      const total = (r && r.data && typeof r.data.total === 'number') ? r.data.total : list.length;
      if (list.length === 0 || ids.size >= total || list.length < size) break;
      page++;
    }
    this._favIdsCache = { at: Date.now(), ids };
    return [...ids];
  }

  async listFavorites(opts: { limit?: number; offset?: number }): Promise<{ list: Track[]; total: number }> {
    const size = opts.limit || 200;
    const page = Math.floor((opts.offset || 0) / size) + 1;
    const r: any = await this.req('GET', '/favorite-track/list', { query: { page, size } });
    const raw: FnRawTrack[] = (r && r.data && r.data.list) || [];
    const list = raw.map((t) => this.mapTrack(t));
    const total = (r && r.data && typeof r.data.total === 'number') ? r.data.total : list.length;
    return { list, total };
  }

  async setFavorite(trackId: string, fav: boolean): Promise<void> {
    const cur = new Set(await this.favoriteIds());
    const isFav = cur.has(String(trackId));
    if (isFav === fav) return; // 已在目标状态
    if (fav) await this.req('POST', '/favorite-track/create', { body: { trackGUID: trackId } });
    else await this.req('POST', '/favorite-track/delete', { body: { trackGUID: trackId } });
    // 更新内存缓存
    if (!this._favIdsCache) this._favIdsCache = { at: Date.now(), ids: new Set() };
    if (fav) this._favIdsCache.ids.add(String(trackId));
    else this._favIdsCache.ids.delete(String(trackId));
    this._favIdsCache.at = Date.now();
  }

  dispose(): void {
    this.token = null;
    this.loginPromise = null;
    this.gatewayCookie = null;
    this.gatewayExtraCookies = null;
    this.gatewayCookieTs = 0;
    this.gatewayCookiePromise = null;
  }
}
