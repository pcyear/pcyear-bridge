# SongLoft 插件 SDK 功能需求建议：原生 Cookie 读取桥（`SongloftPlugin.getCookies`）

> 提交方：多源音乐桥（pcyear-bridge）插件开发者
> 日期：2026-08-03
> 目标：让网页插件获得与原生 App 同等的「应用内登录 → 自动获取登录态」能力，用于飞牛音乐（fnOS Music）FN Connect 远程访问等需要第三方站点会话的场景。

---

## 1. 背景与问题

插件「多源音乐桥」把飞牛音乐（fnOS Music）、WebDAV、Subsonic/Navidrome 接入 SongLoft。其中**飞牛音乐通过 FN Connect 远程访问**时，FN Connect 网关的鉴权依赖两个会话 Cookie：

- `os-access-code`：FN Connect 网关会话（标识已登录 FN ID 并选中设备）
- `music-token`：飞牛音乐登录态

已实测确认：

| 事实 | 说明 |
|---|---|
| 网关禁止服务端登录 | 在网关域上调用飞牛 `password-login` 返回 `code 100001`，无法服务端自登录 |
| 网关会话签名含服务端密钥 | `/api/v1/fn/con` 的 `fn-sign` 无法由客户端复现（实测 24 种签名模板均返回 `code:5000 invalid sign`） |
| 会话只存在于用户浏览器 | 无会话访问网关会被 302 甩到 FN ID 登录页，`Set-Cookie` 为空；用户浏览器已登录 FN Connect 时可无感直连 |

**结论**：FN Connect 的登录态只能从「用户已登录的浏览器 / webview 上下文」获取，纯服务端无法取得。

### 当前临时方案（体验差）

由于插件是运行在 SongLoft webview 里的网页，受浏览器同源策略限制，**JS 无法读取跨源站点的 Cookie**。当前实现是让用户：

1. 把插件生成的一段 `javascript:` 书签拖到浏览器收藏夹（一次性）；
2. 打开飞牛音乐页面并登录；
3. 点一下书签，把 `document.cookie` 回传给插件。

能用，但要求用户操作浏览器书签、且每台设备/浏览器都要装一次，体验与"应用内一键登录"差距明显。

### 参照实现

第三方音乐客户端 **Amcfy Music（箭头音乐）** 原生支持飞牛平台：用户在 App 内输入 FN ID → 应用内 webview 完成 FN Connect 登录 → **通过原生接口读取 webview Cookie**（`x-access-code` 头 / `music-token`）→ 完成配置。全程无书签、无手抄 Cookie，登录体验与普通 App 登录一致。

**网页插件与原生 App 的能力差距，恰好就差一个"原生读 Cookie"的桥。**

---

## 2. 为什么现有 SDK 无法实现

对 `@songloft/plugin-sdk`（`dist/index.d.ts`）完整清点：

| 现有能力 | 成员 |
|---|---|
| `SongloftPlugin` | `getToken` / `getHostUrl` / `getFileUrl` / `getNetworkAddresses` |
| `songloft.*` | storage、songs、playlists、comm、jsenv、fs、command、events、lyrics、covers、net（TCP/UDP 裸 socket，无 TLS）、crypto（aes/rc4/rsa/md5/sha1/sha256） |
| **缺失** | ❌ 无任何 Cookie 读取接口；❌ 无 webview 打开/授权页接口；❌ 无浏览器凭证桥 |

补充实测：FN Connect 网关所有响应（含 302、API 200、OPTIONS 预检）**均不带 `Access-Control-Allow-Origin` 头**，因此即便用户在 SongLoft webview 内登录了 FN Connect，插件页面跨源 `fetch(url, {credentials:'include'})` 也会被浏览器 CORS 拦截，读不到任何数据——网页层无法自愈。

---

## 3. 提议的 SDK 接口（最小方案）

在 `SongloftPlugin` 上新增一个方法：

```ts
interface SongloftPlugin {
  /**
   * 读取宿主 webview Cookie Store 中指定 origin 的 Cookie。
   * 原生层读取，不受浏览器同源策略 / HttpOnly 限制。
   *
   * @param origin 目标站点 origin，例如 "https://pcyear.5ddd.com"
   *               （含协议 + 主机 + 端口；路径忽略）
   * @returns name → value 映射；该 origin 无 Cookie 时返回空对象 {}。
   *          失败（origin 非法 / 宿主未初始化）时 reject 并给出错误信息。
   */
  getCookies(origin: string): Promise<Record<string, string>>;
}
```

### 设计要点

1. **只读，不写**：仅提供读取，不提供写入/删除 Cookie 的接口，避免插件污染其他站点会话。
2. **按 origin 精确匹配**：插件只能读取自己明确指定的 origin 的 Cookie，而非全量导出，降低隐私风险。
3. **包含 HttpOnly**：原生 CookieManager / WKWebsiteDataStore 可读取 HttpOnly Cookie（JS 的 `document.cookie` 读不到，但原生 API 可以），这正是本需求的关键价值。
4. **与宿主 webview 共享 Cookie Store**：要求返回的 Cookie 与宿主 webview 中真实存在的会话一致（用户在同一 webview 内登录过才存在）。

---

## 4. 实现指引（供宿主参考）

### Android

```java
// WebView Cookie 存储在 ApplicationContext 的 CookieManager 中，可直接读取（含 HttpOnly）
String raw = android.webkit.CookieManager.getInstance().getCookie(origin);
// raw 形如 "k1=v1; k2=v2"，解析为 Map 返回；无 Cookie 时 raw 为 null
```

注意：`CookieManager` 的 domain 匹配与 URL 的 host 一致即可命中；`origin` 需去掉末尾 `/` 再传入。

### iOS

```swift
import WebKit
let store = WKWebsiteDataStore.default().httpCookieStore
store.getAllCookies { cookies in
    // 过滤 domain 与 origin 匹配的 cookie，组装成 [String: String] 返回
}
```

### 权限与安全建议

- 无需新增敏感权限（读取自身 webview 的 Cookie Store 不涉及系统级隐私权限）。
- 建议在宿主侧对 `getCookies` 增加**调用频率限制**（如同一插件每分钟不超过 N 次），防止被滥用遍历。
- 可选：在 `PluginManifest` 增加一个可选权限声明（如 `"cookies.read"`），未声明权限的插件调用即被拒绝——**默认不授予**，需要官方评估后决定是否做这一层。

---

## 5. 可选增强接口（非必需，按需评估）

若希望插件侧更省事，可再提供一个一站式授权接口：

```ts
interface SongloftPlugin {
  /**
   * 在应用内打开授权页（模态 webview），等待用户完成登录后返回指定 origin 的 Cookie。
   * 宿主可监听导航/轮询，在用户关闭授权页或超时后返回当前 Cookie 快照。
   */
  openAuthPageAndGetCookies(
    url: string,
    cookieOrigins: string[],
    timeoutMs?: number, // 默认 5 分钟
  ): Promise<Record<string, string> | null>;
}
```

**建议分期实施**：先上线 `getCookies`（实现最简单、通用性最强），再评估 `openAuthPageAndGetCookies`。

---

## 6. 获得该能力后，插件的使用方式

拿到 `getCookies` 后，插件的 FN Connect 配置流程变为（对标箭头音乐）：

1. 用户添加飞牛音乐音源，地址填 FN ID（如 `pcyear`），插件自动拼 `https://pcyear.5ddd.com`；
2. 点击「🔗 FN Connect 一键同步」→ 插件在 SongLoft webview 内打开 `https://pcyear.5ddd.com/music/`；
3. 用户完成一次 FN Connect 登录（FN ID 记住登录态时基本一键）；
4. 回到插件点「已登录，获取会话」→ 调用 `songloft.plugin.getCookies('https://pcyear.5ddd.com')` 取回 `os-access-code` / `music-token`；
5. 写回插件后端配置，后续所有请求带该会话即可远程访问飞牛音乐。

**彻底移除书签 / 手抄 Cookie，与原生 App 登录体验一致。**

---

## 7. 该接口的通用价值

`getCookies(origin)` 是通用能力，不局限于飞牛音乐。任何需要第三方站点会话的插件场景都可受益：

- 各类 NAS / 网盘 / 流媒体平台的「Cookie 登录」式接入（Emby、Jellyfin、WebDAV 等已有平台之外的任意自建服务）；
- 需要复用用户已登录会话做数据抓取/同步的插件；
- 减少"让用户打开浏览器 F12 复制 Cookie"这一高危、高门槛操作。

对 SongLoft 插件生态是低成本（原生约 20~40 行）高收益的增量。

---

## 8. 附：FN Connect 鉴权事实清单（供评审复核）

- 网关地址：`https://<fnid>.5ddd.com`（如 `pcyear.5ddd.com`），未鉴权请求 302 → `https://5ddd.com/<fnid>/`（FN ID 登录页 SPA）。
- 鉴权依赖：`os-access-code`（网关会话）+ `music-token`（飞牛登录态）两个 Cookie 必填；`authx` 头、`fnos-token`、`entry-token` 均不需要。
- 网关禁止 `password-login`（`code 100001`）；`/api/v1/fn/con` 签名含服务端密钥，客户端无法复现。
- 网关所有响应不带 CORS 头（实测 302 / 200 / OPTIONS 均无 `Access-Control-Allow-Origin`）。
- 参照客户端 Amcfy Music：原生支持飞牛，应用内 webview 完成 FN Connect 登录后经原生 Cookie 读取（`x-access-code` 头）完成会话复用。
