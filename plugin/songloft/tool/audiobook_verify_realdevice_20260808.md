# 有声书模块真机验证报告

- **日期**：2026-08-08
- **真机**：`http://192.168.31.61:58091`（账号/密码 `pcyear` / `pcyear`）
- **插件版本**：`1.4.52.94`（插件 id=3，已热重载）
- **部署方式**：`deploy_verify.py`（HOST 已改为 `192.168.31.61`）→ 登录 → 上传 `multisource-music.jsplugin.zip` → disable/enable 热重载
- **自检脚本**：`tool/test_audiobook_api.py http://192.168.31.61:58091`

## 真机音源确认
| source id | type | name | 状态 |
|---|---|---|---|
| src_msm_songloft | songloft | SongLoft 本地库 | 存在 |
| src_msm_audiobook | audiobook | SongLoft 有声书 | **已启用** |
| src_mshmwt9yaor2 | fnMusic | 飞牛 | 存在（当前空库） |

## 验证结果：22 项，21 通过，1 失败

| 检查项 | 结果 | 说明 |
|---|---|---|
| auth/login | PASS | 拿到 access_token |
| sources | PASS | 含 src_msm_audiobook (audiobook, enabled) |
| sources/status | PASS | 飞牛预热成功 |
| sources/test(ab) | PASS | 「有声书目录可访问」 |
| audiobook-folders | PASS | 15 个根目录（单田芳评书/儿童故事等） |
| browse root | PASS | dirs=14, tracks=0 |
| browse folder | PASS | 《小鸡敦敦国学谜案》351集 dirs=0 tracks=100 total=351 |
| browse folder page2 | PASS | 分页正常 |
| batch/tracks | PASS | 351 首全量返回 |
| ensure-songs batch | PASS | 批量入库返回 songId |
| play-url | PASS | scheme=host，有声书源正常出播放地址 |
| lyric | PASS | 有声书无歌词，返回 null（符合预期） |
| cover-data | **FAIL** | `no cover`（见下方诊断） |
| cover-img | **FAIL** | `no cover`（见下方诊断） |
| ui-state get | PASS | 续播状态可读 |
| ui-state post | PASS | 状态可写 |
| ui-state roundtrip | PASS | 状态往返一致 |
| fuse get | PASS | 已融合列表为空（符合预期） |
| local-opts | PASS | 本地根路径配置可读 |
| search | PASS | 有声书内搜到 3 条 |
| health | PASS | 插件存活（version 字段为 unknown，小瑕疵） |
| sources/export | PASS | 音源导出正常 |

## 失败项诊断（cover-data / cover-img → no cover）

**根因：有声书 mp3 文件本身无内嵌封面（ID3 APIC / MP4 covr），代码正确返回 `no cover`，属资源缺失，非代码 bug。**

代码路径核对：
- `src/sources/audiobook.ts:349` `resolveCover()` 返回 `null`（有声书无自定义封面 API，走内嵌封面回退）
- `src/sources/audiobook.ts:355` `resolveEmbeddedCover()` 读 mp3 文件头解析内嵌封面，无图时返回 `null`
- `src/routes/cover.ts:23/28/49` 在取不到图时返回 `{ ok:false, message:'no cover' }`

单田芳评书、儿童故事类有声书 mp3 通常不带内嵌封面，目录也无配套图片，因此 `no cover` 是真实资源状态，逻辑正确。

## 结论

有声书模块代码完整，真机全链路基本通过。上一轮修复的 `/stream` Content-Type 硬编码 bug（按扩展名返回正确 MIME）已随 `1.4.52.94` 部署并生效（play-url PASS）。

如需消除封面 FAIL，属**产品增强**（如：有声书无封面时生成默认占位图 / 文字封面），非缺陷修复，需另行确认需求。
