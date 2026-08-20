# 架构与双项目同步策略（多源音乐桥）

`pcyear-bridge/plugin/songloft/`（SongLoft 插件，TypeScript）与 `pcyear-bridge/app/`（原生 App，Dart/Flutter）
**共存于同一 Git 仓库、同一分支**，但代码管理互不干扰、互不影响构建。

---

## 1. 为什么这样组织

| 诉求 | 方案 |
|------|------|
| 原生 App（安卓 / iOS / 鸿蒙）+ 自带播放器 | **Flutter**：单一 Dart 代码库，鸿蒙走 OHOS 适配分支；`just_audio`+`audio_service` 提供原生播放能力 |
| 不要与现有插件代码冲突 | App 放在独立目录 `pcyear-bridge/app/`，语言/构建/依赖完全独立；插件 `pcyear-bridge/plugin/songloft/` 的 TS 代码**不改、不依赖** App |
| 两个项目同步修改 | 见第 3 节「共享契约 + 同仓同步」 |
| 结构规范、易维护扩展 | 严格分层（core / data / presentation），依赖单向：presentation → data → core，禁止反向 |

---

## 2. 分层与依赖方向

```
presentation (UI / providers)
      │  调用
      ▼
data (sources 适配器 / songloft 客户端 / player 服务)
      │  调用
      ▼
core (领域模型 models.dart + 通用类型 result.dart)
```
- **core**：纯 Dart 数据模型，无第三方依赖、无平台代码。是「双项目同步」的事实契约源。
- **data/sources**：每种音源实现一个 `SourceAdapter`（WebDAV / Subsonic / 飞牛）。新增音源 = 新增一个适配器，不动其他代码。
- **data/player**：自有播放器服务，封装 `just_audio`+`audio_service`，对 UI 暴露简单接口。
- **presentation**：UI 与状态，依赖 data 层拿数据、调播放器。

---

## 3. 双项目同步的「契约」（关键）

同步不是复制代码，而是**对齐契约**。任何一侧改动功能，另一侧按契约同步：

### 3.1 领域模型契约 —— `lib/core/models.dart` ↔ 插件 `plugin/songloft/src/types.ts`
字段、命名、语义必须一一对应。当前对齐：
`Source`/`SourceConfig`、`Track`、`Album`、`Artist`、`Playlist`、`SearchResults`、`UpstreamRef`、`LyricLine`。
> 改了插件 `plugin/songloft/src/types.ts` 的字段 → 必须同步 `lib/core/models.dart`。

### 3.2 音源适配器接口契约 —— `lib/data/sources/source_adapter.dart` ↔ 插件 `plugin/songloft/src/adapters/*/adapter.ts` 的 `SourceAdapter`
两端方法签名与语义对齐：
`testConnection / listDirectories / countSongsIn / listAlbums / listArtists / listTracks /
albumTracks / artistTracks / collectionInfo / search / lyric / resolveStream / resolveCover /
forceRefresh / dispose`。
> 插件给某适配器加了方法/改了语义 → App 对应适配器同步。

### 3.3 行为契约（WebDAV 为例，易踩坑，须两端一致）
- 集合 id 规范：`mkId(root, rel)` / `parseCollectionId(id)` 的编码方式**两端必须一致**，否则收藏/历史在两端不互通。
- 目录结构推断元数据：艺术家=一级目录名、专辑=二级目录名、散装音频归「未知艺术家/未知专辑」——与插件 `search()` 推导口径一致。
- 懒加载：`listDir` 单层 `PROPFIND` + 目录缓存；列表只返回 `{id,name}` 骨架，二次元数据走 `collectionInfo`。**禁止**在列表接口里夹带扫描/读音频头。
- 封面：`resolveCover` 先找目录内图片文件，再回退音频内嵌 APIC（无 APIC 即回落默认图，不要当错误）。
- 鉴权：HTTP Basic `Authorization: Basic base64(user:pass)`；流地址 `GET` 带同一 `Authorization`。

### 3.4 文件映射表（便于定位同步点）
| 插件（TS） | App（Dart） | 说明 |
|---|---|---|
| `plugin/songloft/src/types.ts` | `lib/core/models.dart` | 领域模型 |
| `plugin/songloft/src/adapters/base.ts` `SourceAdapter` | `lib/data/sources/source_adapter.dart` | 适配器接口 |
| `plugin/songloft/src/adapters/webdav/*.ts` | `lib/data/sources/webdav/*.dart` | WebDAV 实现 |
| `plugin/songloft/src/adapters/subsonic` (如有) | `lib/data/sources/subsonic/subsonic_adapter.dart` | Subsonic 实现 |
| 飞牛源 | `lib/data/sources/feiniu/feiniu_adapter.dart` | 飞牛实现 |
| 插件后端扫描/封面/歌词 | App 直连音源时**自行实现等价逻辑** | APP 直连音源模式 |
| `plugin/songloft/src/routes/*`（插件后端 HTTP 接口） | — | App 不调用（APP 直连音源）；仅 SongLoft 账号/音源配置走 `data/songloft` |

---

## 4. 同步工作流（每次改功能）
1. 在 `pcyear-bridge/plugin/songloft/` 改插件，本地验证通过。
2. 判断改动是否触及「契约」（模型字段 / 适配器接口 / 行为口径）。
3. 触及 → 在 `pcyear-bridge/app/` 同步：改 `core/models.dart` 或对应适配器；功能 UI 在 `presentation/` 补上。
4. **同一次提交**同时包含插件与 App 的改动（同一分支、同一 PR），禁止只改一边留下半对齐。
5. 在下方「功能对齐清单」勾选/更新。

---

## 5. APP 与 SongLoft 服务器的关系（已确认）
- 模式：**APP 直连音源**。WebDAV / 飞牛 / Subsonic 的连接、浏览、扫描、封面、歌词、播放流，全部由 App 自己实现（Dart），不依赖插件后端。
- SongLoft 服务器（`http://192.168.31.28:58091` 等）仅用于：**账号登录** + **导入该账号下已配置的音源**（免去在 App 里重复填 WebDAV 账密）。
- `lib/data/songloft/songloft_client.dart` 是这一层客户端；其接口已定义，具体 HTTP 契约需对照 SongLoft Web 端 API 在真机/局域网环境补全（沙箱无法访问该 LAN 地址）。

---

## 6. 功能对齐清单（与插件现有功能）
- [x] 音源管理：WebDAV / 飞牛 / Subsonic（增删改 + 连接测试）
- [x] 乐库浏览：艺术家 / 专辑 / 曲目（目录结构推断 + 懒加载）
- [x] 搜索：曲目 / 专辑 / 艺术家
- [x] 封面：目录图片 / 内嵌 APIC
- [x] 歌词：同名 `.lrc` 逐字歌词
- [x] 收藏（本地持久化）
- [x] 批量入库（加入 App 歌单）
- [x] 自带播放器（播放/暂停/上下首/进度/倍速/歌词联动）
- [x] 接入 SongLoft 服务器（导入音源配置）
- [ ] 智能音箱投放 / 投屏（插件 `cast.ts`/`miot.ts`）——App 侧后续按平台能力接入（DLNA / Cast / 系统投屏）
- [ ] 桌面歌词 / 逐字高亮精细对齐（基础 LRC 已支持，精细时间轴后续迭代）

> 当前为脚手架 + 核心链路（WebDAV 浏览/播放、搜索、收藏、SongLoft 导入骨架）。
> Subsonic / 飞牛适配器为接口对齐的可用骨架，投屏为后续迭代项。
