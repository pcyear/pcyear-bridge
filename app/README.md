# 多源音乐桥 · 原生 App（fnmusic_app）

把 **多源音乐桥** SongLoft 插件改造成一个**跨平台原生 App**（安卓 / iOS / 鸿蒙），
自带播放器，直连用户的音乐音源（WebDAV / 飞牛 / Subsonic·Navidrome），并支持接入 SongLoft 服务器。

> 本 App 与 `pcyear-bridge/plugin/songloft/`（现有 SongLoft 插件）**共存于同一仓库、同一分支**，
> 两个项目各自独立代码管理、互不冲突；功能迭代通过「共享契约 + 同仓同步」保持一致。
> 详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 技术栈
- **Flutter (Dart)**：单一代码库覆盖 安卓 / iOS / 鸿蒙（鸿蒙走 Flutter OHOS 适配分支）。
- **自带播放器**：`just_audio` + `audio_service`（支持后台播放、锁屏控制、播放队列）。
- **状态管理**：`provider`（轻量稳定，后期可平滑迁移到 Riverpod / Bloc）。
- **网络**：`http` + `xml`（WebDAV `PROPFIND` 的 multistatus XML 解析）。
- **本地存储**：`shared_preferences`（音源配置、收藏、播放进度）。

## 目录结构
```
pcyear-bridge/app/
├── lib/
│   ├── core/                 # 领域模型 + 通用类型（与插件 types 一一对应）
│   ├── data/
│   │   ├── sources/          # 音源适配器（WebDAV / Subsonic / 飞牛），实现统一 SourceAdapter 接口
│   │   ├── songloft/         # SongLoft 服务器客户端（账号 / 导入音源配置）
│   │   └── player/           # 自带播放器服务（just_audio + audio_service）
│   └── presentation/         # UI：providers（状态）+ screens（页面）+ widgets（组件）
├── pubspec.yaml
└── ARCHITECTURE.md           # 双项目同步策略、功能对齐清单
```

## 现有功能范围（与插件对齐，**不新增其他功能**）
- 音源管理：WebDAV / 飞牛 / Subsonic·Navidrome（增删改、连接测试）
- 乐库浏览：艺术家 / 专辑 / 曲目（按目录结构推断，懒加载）
- 搜索：曲目 / 专辑 / 艺术家
- 封面：目录内图片文件 / 音频内嵌 APIC
- 歌词：同目录同名 `.lrc`（逐字歌词）
- 收藏（本地）、批量入库（加入 App 歌单）
- 自带播放器：播放 / 暂停 / 上一首 / 下一首 / 进度 / 倍速 / 歌词联动
- 接入 SongLoft 服务器：导入账号下已配置的音源

## 本地运行
```bash
cd pcyear-bridge/app
flutter pub get
# 安卓
flutter run
# iOS
flutter run -d ios
# 鸿蒙（需 Flutter OHOS 环境）
flutter run -d ohos
```
> 当前沙箱未安装 Flutter SDK，文件为手写脚手架，请在本机执行 `flutter pub get` 后构建验证。

## 与插件同步（要点）
每次在 `pcyear-bridge/plugin/songloft/` 插件侧新增 / 修改某个功能，**必须**在 `pcyear-bridge/app/` 同步实现，
并遵循 `core/models.dart` 的字段契约与 `data/sources/source_adapter.dart` 的接口签名。
具体规则见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
