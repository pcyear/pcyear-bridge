// 投屏辅助路由：生成音箱可直连的免鉴权播放 URL
// 背景：miot 插件 /mina/play-url 会把 URL 原样（免鉴权、不做任何处理）下发给音箱，
// 音箱直接 HTTP 拉流。宿主 /api/v1/songs/{id}/play 需要鉴权（无 token 401），
// 但宿主认证中间件支持 access_token 作为 query 参数——miot 插件 URLBuilder 即用此法
// （serverHost + /api/v1/songs/{id}/play?access_token=<插件JWT>）。
// 本插件有同等的 songloft.plugin.getToken() 能力，因此由后端生成带 token 的绝对 URL。
// 协议选择：优先反代 X-Forwarded-Proto（https 站点不能拼成 http，音箱可能不跟随重定向）。

import { jsonResponse, type HTTPRequest, type HTTPResponse } from '@songloft/plugin-sdk';
import { hostBase } from '../lib/cover';

declare const songloft: any;

type Router = ReturnType<typeof import('@songloft/plugin-sdk').createRouter>;

/** 把宿主 SDK 的 POST body 解析为对象（兼容 string / Uint8Array / 已解析对象） */
function parseBody(b: any): any {
  if (!b) return {};
  if (typeof b === 'string') { try { return JSON.parse(b); } catch { return {}; } }
  if (b instanceof Uint8Array || Array.isArray(b) || (b && typeof b.length === 'number')) {
    try { return JSON.parse(new (globalThis as any).TextDecoder().decode(b as Uint8Array)); } catch { return {}; }
  }
  if (typeof b === 'object') return b;
  return {};
}

export function registerCastRoutes(router: Router): void {
  router.post('/cast/play-url', async (req: HTTPRequest): Promise<HTTPResponse> => {
    try {
      const body: any = parseBody((req as any).body);
      const songId = Number(body.song_id);
      if (!songId) return jsonResponse({ ok: false, message: 'song_id 必填' });
      // 歌曲相对播放路径：优先宿主返回的 url（兼容形态变化），缺省用固定端点
      let rel = '';
      let song: any = null;
      try {
        song = await songloft.songs.getById(songId);
        rel = (song && (song.url || song.source_url)) || '';
      } catch { /* ignore */ }
      if (!rel) rel = `/api/v1/songs/${songId}/play`;
      if (/^https?:\/\//i.test(rel)) return jsonResponse({ ok: true, url: rel });
      // 拼绝对地址。host 优先级：前端显式传的 location.origin（最准，=用户访问地址=音箱可达地址）
      // → 反代 X-Forwarded-Host → Referer/Origin 头 → hostBase() 兜底。
      // 注意：宿主 SDK 收到的 Host 头已被内部改写成 localhost:58091（宿主内部地址），
      // 音箱无法访问，绝不能直接用；协议优先反代 X-Forwarded-Proto（https 站点不能拼成 http）。
      const hdrs: any = (req as any).headers || {};
      const fwdProto = String(hdrs['x-forwarded-proto'] || hdrs['X-Forwarded-Proto'] || '');
      const proto = /^https$/i.test(fwdProto) ? 'https' : 'http';
      let host = String(body.host || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
      if (!host) {
        for (const k of ['x-forwarded-host', 'X-Forwarded-Host', 'host', 'Host']) {
          if (hdrs[k]) { host = String(hdrs[k]).replace(/^https?:\/\//, '').replace(/\/+$/, ''); break; }
        }
      }
      if (!host) {
        const ref = String(hdrs['referer'] || hdrs['Referer'] || hdrs['origin'] || hdrs['Origin'] || '');
        const m = ref.match(/^https?:\/\/[^/]+/i);
        if (m) host = m[0].replace(/^https?:\/\//i, '').replace(/\/+$/, '');
      }
      if (!host) {
        const base = await hostBase();
        if (base) host = base.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      }
      if (!host) return jsonResponse({ ok: false, message: '无法确定宿主地址' });
      const token = await songloft.plugin.getToken();
      if (!token) return jsonResponse({ ok: false, message: '无法获取宿主令牌' });
      const sep = rel.includes('?') ? '&' : '?';
      let url = `${proto}://${host}${rel}${sep}access_token=${token}`;
      // 可选 seek：从第 N 秒起播（服务端产出以该位置开头的流，供投屏暂停→恢复用；
      // 音箱 position 每 ~4.5s 周期归零不可信，恢复播放必须用 seek 让服务端从指定位置起播）。
      // 夹紧到 [1, duration-3)：贴近结尾的 seek 会让服务端零输出并降级成整首重播（miot 同款策略）。
      const seek = Math.floor(Number(body.seek));
      if (seek > 0) {
        let s = seek;
        if (song && song.duration > 0) s = Math.min(s, Math.max(1, Math.floor(song.duration) - 3));
        if (s > 0) url += '&seek=' + s;
      }
      return jsonResponse({ ok: true, url });
    } catch (e: any) {
      return jsonResponse({ ok: false, message: String((e && e.message) || e) });
    }
  });
}
