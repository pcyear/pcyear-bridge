# 多源音乐桥底层重构方案

> 目标：优化代码逻辑性，降低后期开发与问题排查成本，同时提升用户体验。
> 基于当前代码版本 v1.3.16，最后盘点时间 2026-08-05。

---

## 一、现状诊断

### 1.1 代码规模与组织

| 文件 | 行数 | 问题 |
|------|------|------|
| `src/main.ts` | 1882 | 40+ 路由、缓存、封面解析、导入、收藏、播放器桥接全部堆在一起，单一文件职责爆炸 |
| `static/index.html` | 6404 | 单文件：820+ 行 CSS + 5200+ 行 JS，没有模块边界 |
| `src/sources/webdav.ts` | 955 | 协议层、扫描、元数据推导、封面解析、缓存全在一个类里 |
| `src/manager.ts` | 196 | 配置管理简单，但缺乏生命周期、健康检查、任务调度 |
| `src/types.ts` | 169 | `SourceAdapter` 接口较薄，未覆盖 warmup/health/events |

### 1.2 核心痛点

1. **main.ts 职责过重**
   - 路由定义、请求参数解析、缓存实现、封面/歌词/导入/收藏业务逻辑、工具函数全在一个文件。
   - 新增一个功能要改动多处，冲突概率高，代码审查困难。

2. **缓存实现碎片化**
   - `listMemCache`（列表内存缓存）
   - `dirListMem`（目录列表内存缓存）
   - `hostLyricCache`（宿主歌词缓存）
   - `favCache`（收藏缓存）
   - `cover2:`（KV 封面缓存）
   - WebDAV 内部的 `dirCache` / `dirCoverCache` / `noCoverCache` / `coverCache`
   - 每个缓存独立实现 TTL、版本、失效逻辑，容易漏清、错清。

3. **WebDAV 适配器复杂度过高**
   - `WebDavAdapter` 同时承担：HTTP 客户端、XML 解析、目录扫描、元数据推导、封面探测、内嵌封面解析、KV 持久化。
   - 单个类 955 行，单元测试几乎不可能；修改一处容易牵一发而动全身。

4. **缺乏统一的错误处理与日志**
   - 大量 `try { ... } catch { /* ignore */ }`，出错时无 requestId、无调用链、无上下文（sourceId/coverId）。
   - 问题定位靠临时 `debug-art` endpoint，生产环境没有系统化的诊断能力。

5. **类型安全与 any 滥用**
   - `adapter as any`、`req as any`、`e: any` 随处可见。
   - 几个核心数据结构（`Album`/`Artist`/`Track`）的 `_raw`/`coverCandidates` 字段语义不清晰。

6. **前端单文件难以维护**
   - 全局函数/变量混用，没有状态管理，事件监听分散。
   - CSS 与 JS 无法复用，改一个组件要翻几千行。

7. **扫描任务不可观测、不可取消**
   - `scanning` Promise 藏在 adapter 内部，外部只能等或超时。
   - 没有进度、没有取消、没有错误明细。

8. **缺少系统化的可观测性**
   - 没有请求耗时统计、缓存命中率、源健康状态。
   - 用户说"慢"时，只能靠猜或加临时日志。

---

## 二、重构目标

### 2.1 代码逻辑性

- **分层清晰**：基础设施 → 适配器抽象 → 业务路由 → 前端，每层只依赖下层。
- **单一职责**：一个文件/类只做一件事，降低认知负担。
- **接口稳定**：`SourceAdapter` 接口完整定义生命周期与事件，后续新增音源只需实现接口。

### 2.2 问题排查效率

- **统一日志**：每个请求带 `requestId`、`sourceId`、`operation`，链路清晰。
- **统一错误**：错误分类（用户输入错误 / 外部服务错误 / 超时 / 内部错误），响应带可追踪信息。
- **诊断端点**：替代临时 `debug-art`，提供 `/diag/*` 系统诊断接口。
- **指标暴露**：缓存命中率、扫描进度、各源响应时间可查询。

### 2.3 用户体验

- **更快**：统一缓存减少重复请求；封面/扫描继续优化。
- **更稳**：错误不卡死界面，失败可重试、可降级。
- **更可控**：扫描进度可见，大库首次加载有反馈。

---

## 三、分层架构设计

```
┌─────────────────────────────────────────────────────────────┐
│  前端 (static/)                                              │
│  ├─ components/   列表/播放器/弹窗/设置                       │
│  ├─ services/     api.js / player.js / state.js              │
│  └─ styles/       base.css / layout.css / components.css     │
├─────────────────────────────────────────────────────────────┤
│  业务路由 (src/routes/)                                      │
│  ├─ sources.ts    音源 CRUD / 测试 / 目录选择                 │
│  ├─ library.ts    tracks / albums / artists / playlists      │
│  ├─ search.ts     搜索                                       │
│  ├─ cover.ts      封面解析                                   │
│  ├─ lyric.ts      歌词                                       │
│  ├─ import.ts     导入 / 批量 / play-url                     │
│  ├─ favorite.ts   收藏                                       │
│  ├─ diag.ts       诊断 / 健康检查 / 指标                     │
│  └─ middlewares/  日志 / 错误 / 超时 / sourceId 解析          │
├─────────────────────────────────────────────────────────────┤
│  音源管理 (src/core/)                                        │
│  ├─ manager.ts    配置持久化 + 适配器生命周期                 │
│  ├─ cache.ts      统一缓存（mem + KV + TTL + 版本）           │
│  ├─ logger.ts     结构化日志                                 │
│  ├─ errors.ts     错误分类                                   │
│  ├─ metrics.ts    简单指标                                   │
│  └─ task.ts       后台任务管理（扫描/取消/进度）              │
├─────────────────────────────────────────────────────────────┤
│  适配器抽象 (src/adapters/)                                  │
│  ├─ types.ts      强化 SourceAdapter 接口 + 事件              │
│  ├─ base.ts       BaseAdapter（日志/指标/错误包装）           │
│  └─ webdav/                                                   │
│      ├─ adapter.ts       WebDavAdapter（组合）                │
│      ├─ client.ts        WebDAV 协议客户端                    │
│      ├─ scanner.ts       目录扫描器（BFS/并发/进度/取消）      │
│      ├─ metadata.ts      路径 → 元数据推导                    │
│      ├─ cover.ts         封面解析（sidecar / embedded）       │
│      └─ cache.ts         WebDAV 专用缓存                      │
│  └─ fnMusic.ts / subsonic.ts / songloft.ts（标准化）         │
├─────────────────────────────────────────────────────────────┤
│  工具与协议 (src/lib/)                                       │
│  ├─ fetch.ts      带超时/取消/重试的 fetch 封装               │
│  ├─ xml.ts        XML 解析工具                               │
│  ├─ bytes.ts      base64 / bytes 转换                        │
│  └─ embedded_art.ts  内嵌封面解析                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、分阶段实施计划

### Phase 1：基础设施（低风险、高维护收益）

**目标**：建立统一的日志、错误、缓存、请求上下文，不改动业务逻辑。

1. 新建 `src/core/logger.ts`
   - `Logger.for(ctx)` 创建带 `requestId` / `sourceId` 的子日志。
   - 统一调用 `songloft.log`，但包装成结构化格式：`[requestId][sourceId][op] message`。

2. 新建 `src/core/errors.ts`
   - `UserError`（400）：参数缺失、配置错误。
   - `ExternalError`（502/504）：上游 WebDAV/Subsonic 失败。
   - `TimeoutError`（504）：操作超时。
   - `NotFoundError`（404）。
   - 错误响应统一 `{ ok: false, code, message, requestId }`。

3. 新建 `src/core/cache.ts`
   - 统一封装 memory + KV 两层。
   - 支持 namespace、TTL、version（升级自动失效）。
   - 统一 `invalidate(sourceId)` 清理该源所有缓存。
   - 把现有的 `listMemCache`、`dirListMem`、`hostLyricCache`、`favCache` 迁移到此。

4. 新建 `src/core/context.ts`
   - 每个请求生成 `requestId`。
   - 提供 `resolveSourceId(req)` 的封装，自动记录日志。

5. 新建 `src/core/metrics.ts`
   - 简单计数器：请求数、错误数、缓存命中/未命中。
   - 计时器：按 operation 统计耗时。

### Phase 2：路由拆分（中风险）

**目标**：把 `main.ts` 拆成按业务领域组织的路由模块。

1. 新建 `src/routes/middlewares/`
   - `logger.ts`：进入/离开日志 + 耗时。
   - `error.ts`：统一错误捕获与响应。
   - `source.ts`：`resolveSourceId` + adapter 注入。

2. 新建业务路由文件
   - `src/routes/sources.ts`：/sources、/sources/test、/sources/directories、/sources/directory-count。
   - `src/routes/library.ts`：/tracks、/albums、/artists、/playlists、/album/tracks、/artist/tracks、/playlist/tracks。
   - `src/routes/search.ts`：/search。
   - `src/routes/cover.ts`：/cover-data、/cover-img、/cover-search。
   - `src/routes/lyric.ts`：/lyric、/host-lyric、/lyric-search。
   - `src/routes/import.ts`：/import、/play-url、/batch/tracks、/ensure-songs。
   - `src/routes/favorite.ts`：/favorite-ids、/favorite、/favorite-songs。
   - `src/routes/diag.ts`：/health、/diag/sources、/diag/cover、/diag/scan、/diag/metrics。

3. 改造 `src/main.ts`
   - 只保留：SDK 钩子 `/api/search`、`/api/music/url`、serveIndex、路由注册。
   - 其余全部委托给 `src/routes/index.ts`。

### Phase 3：WebDAV 模块化（中高风险，收益最大）

**目标**：把 955 行的 `webdav.ts` 拆成职责单一的小模块。

1. 新建 `src/adapters/webdav/client.ts`
   - 只负责 PROPFIND / GET / HEAD、路径编码、XML 解析、401/404 错误。
   - 从当前 `propfind` / `parseMultistatus` / `fullUrl` / `encodePath` 提取。

2. 新建 `src/adapters/webdav/metadata.ts`
   - `fileToTrack(rel)`：路径 → artist/album/title/codec/size。
   - `mkId(root, rel)` / `parseCollectionId(id)`：集合 ID 编解码。

3. 新建 `src/adapters/webdav/scanner.ts`
   - 实现 `ScanTask`：BFS + 并发 BATCH + 取消信号 + 进度回调。
   - 不再把 `scanning` Promise 藏在 adapter 里，而是交给 `TaskManager`。

4. 新建 `src/adapters/webdav/cover.ts`
   - `DirCoverResolver`：从目录条目找图片文件。
   - `EmbeddedCoverResolver`：调用 `extractEmbeddedArt`。
   - `CoverResolver`：组合两者 + noCoverCache。

5. 新建 `src/adapters/webdav/cache.ts`
   - 封装 `dirCache`、`dirCoverCache`、`coverCache`、`noCoverCache`。

6. 重写 `src/adapters/webdav/adapter.ts`
   - 组合以上模块，只保留 `SourceAdapter` 接口实现。
   - 目标行数控制在 250 行以内。

### Phase 4：前端模块化（中风险，体验收益）

**目标**：把 6400 行单文件拆成可维护的前端模块。

1. 拆分 CSS
   - `static/css/base.css`：变量、reset。
   - `static/css/layout.css`：layout / sidebar / toolbar。
   - `static/css/components.css`：列表、卡片、播放器、弹窗。

2. 拆分 JS
   - `static/js/api.js`：统一 `api()`、`apiGet()`、`apiPost()`，集中错误处理。
   - `static/js/state.js`：全局状态（currentSource、view、player、queue）。
   - `static/js/ui.js`：通用 DOM 操作、toast、modal。
   - `static/js/views.js`：各视图渲染（tracks/albums/artists/playlists/favorites）。
   - `static/js/player.js`：播放器桥接、进度同步。
   - `static/js/app.js`：初始化、事件绑定。

3. 构建脚本
   - `scripts/gen-ui.mjs` 改为把多个 CSS/JS 文件合并 inline 到 HTML；或验证宿主是否支持外链资源。

### Phase 5：诊断与可观测性（低风险，排查收益高）

**目标**：替代临时 debug endpoint，提供系统化诊断能力。

1. `/health`
   - 返回插件版本、各源连通性、缓存统计、扫描任务状态。

2. `/diag/cover`
   - 输入 sourceId + coverId，返回完整封面解析链路：
     - 是否命中缓存
     - 目录封面探测结果
     - 内嵌封面命中位置
     - 耗时与错误

3. `/diag/scan`
   - 返回指定 source 的扫描进度（已完成、总计、百分比、错误数）。

4. `/diag/metrics`
   - 返回请求数、错误数、缓存命中率、各 operation 平均耗时。

### Phase 6：其他适配器标准化（低风险）

**目标**：让 fnMusic / Subsonic / SongLoft 适配器也继承 BaseAdapter，统一日志/错误/缓存。

1. `src/adapters/base.ts` 实现后，改造三个适配器。
2. 提取公共工具到 `src/lib/fetch.ts`。

---

## 五、文件组织（重构后）

```
src/
├── main.ts                 # 入口：SDK 钩子 + 路由注册 + serveIndex
├── subsonic-server.ts      # Subsonic 服务端（保持独立）
├── crypto.ts               # 已有，不动
├── embedded_art.ts         # 已有，可微调
├── types.ts                # 扩展 SourceAdapter 接口
├── lib/
│   ├── fetch.ts            # 超时/重试 fetch
│   ├── bytes.ts            # base64 / bytes
│   └── xml.ts              # XML 解析
├── core/
│   ├── logger.ts
│   ├── errors.ts
│   ├── cache.ts
│   ├── metrics.ts
│   ├── context.ts
│   ├── task.ts
│   └── manager.ts          # 从根目录移入
├── adapters/
│   ├── types.ts            # SourceAdapter + AdapterEvents
│   ├── base.ts             # BaseAdapter
│   ├── fnMusic.ts          # 从 sources/ 移入
│   ├── subsonic.ts
│   ├── songloft.ts
│   └── webdav/
│       ├── adapter.ts
│       ├── client.ts
│       ├── scanner.ts
│       ├── metadata.ts
│       ├── cover.ts
│       └── cache.ts
└── routes/
    ├── index.ts            # 注册所有路由
    ├── middlewares/
    │   ├── logger.ts
    │   ├── error.ts
    │   └── source.ts
    ├── sources.ts
    ├── library.ts
    ├── search.ts
    ├── cover.ts
    ├── lyric.ts
    ├── import.ts
    ├── favorite.ts
    └── diag.ts

static/
├── index.html              # 轻量入口
├── css/
│   ├── base.css
│   ├── layout.css
│   └── components.css
└── js/
    ├── api.js
    ├── state.js
    ├── ui.js
    ├── views.js
    ├── player.js
    └── app.js
```

---

## 六、风险与回退策略

| 风险 | 影响 | 应对 |
|------|------|------|
| 重构引入回归 bug | 高 | 每 Phase 独立分支，真机验证通过后再合并；保留旧实现做 git 回退 |
| 前端拆分后构建失败 | 中 | 先验证宿主是否支持外链 CSS/JS；不支持则用脚本 inline |
| 缓存统一后旧缓存格式不兼容 | 中 | Cache 层带 version，升级自动失效旧缓存 |
| WebDAV 拆分后路径解析出错 | 高 | 保留现有路径归一化测试用例，重构后用同一套真机数据回归 |
| 扫描任务抽象后并发行为改变 | 中 | 保留 BATCH=4，重构后实测大库扫描时间 |

---

## 七、验证计划

每 Phase 完成后：

1. `npm run build` 通过，产物体积不暴增。
2. 部署到远程 `mimusic.035151.xyz:1024` id=22 与本机 id=13。
3. 验证核心路径：
   - `/ui-state` < 0.2s
   - `/albums`、`/artists` < 0.5s
   - `/album/tracks`、`/artist/tracks` 返回非空
   - `/cover-data` 有内嵌封面的歌成功，无封面的快速失败
   - `/tracks` 首次触发扫描，20s 内渐进可用
   - `/search` 返回结果
   - 导入到 SongLoft、播放、收藏正常
4. 使用 `/diag/*` 检查链路耗时与缓存命中率。

---

## 八、建议的启动顺序

按**收益/风险比**排序：

1. **Phase 1（基础设施）+ Phase 5（诊断）先行**：改动小，排查能力立竿见影。
2. **Phase 2（路由拆分）次之**：main.ts 瘦身，后续改动更安全。
3. **Phase 3（WebDAV 模块化）跟进**：这是性能与可维护性的核心。
4. **Phase 6（其他适配器标准化）**：低优先级，可顺带做。
5. **Phase 4（前端模块化）**：放在后面，因为需要验证宿主资源加载方式。

---

## 九、本次重构不涉及的范围

- 不新增音源类型。
- 不改插件对外 API 路径（保持现有 `/api/v1/jsplugin/pcyear-bridge/*`）。
- 不改 `entryPath`、`source_data` 格式、已入库歌曲兼容性。
- 不修改发布策略（仍按铁律⑭，需你显式说"发布"才同步发布仓）。
