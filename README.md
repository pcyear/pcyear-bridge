# PcyearBridge（多源音乐桥）

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

**PcyearBridge（多源音乐桥）** 是一个多源音乐聚合项目，将飞牛音乐、WebDAV、Subsonic / Navidrome 等多种音源统一接入 [SongLoft](https://github.com/songloft-org/songloft) 生态，并提供配套跨平台原生 App，实现「一套音源，随处播放」。

## 项目地址

| 平台 | 地址 |
|------|------|
| Gitee | https://gitee.com/pcyear/pcyear-bridge |
| GitHub | https://github.com/pcyear/pcyear-bridge |

## 核心能力

### SongLoft 插件 (`plugin/songloft`)

以 **TypeScript (QuickJS)** 编写的 SongLoft 插件，是本项目的核心产物：

- **多源接入**：飞牛音乐、WebDAV、Subsonic / Navidrome 统一适配
- **乐库浏览与搜索**：艺术家、专辑、曲目按目录结构懒加载，支持全文搜索
- **统一播放体验**：浏览、搜索、播放、收藏、批量入库一站式完成
- **歌词支持**：逐字歌词 / 桌面歌词联动
- **智能音箱投放**：支持将歌曲推送到智能音箱设备
- **抖音方式切割**：音频分段处理能力

技术栈：TypeScript 5.x + `@songloft/plugin-builder` / `@songloft/plugin-sdk`

### 原生 App (`app`)

基于 **Flutter (Dart)** 的跨平台原生 App，自带完整播放器：

- **平台覆盖**：Android / iOS / 鸿蒙（Flutter OHOS 适配）
- **直连音源**：无需中间层，直接连接 WebDAV / 飞牛 / Subsonic 音源
- **内置播放器**：`just_audio` + `audio_service`，支持后台播放、锁屏控制、播放队列、倍速播放
- **歌词联动**：同目录 `.lrc` 逐字歌词实时同步
- **SongLoft 服务器对接**：可导入 SongLoft 账号下已配置的音源

技术栈：Flutter 3.19+ / Dart 3.3+ / Provider 状态管理

## 仓库结构

```
pcyear-bridge/
├── plugin/
│   └── songloft/              # SongLoft JS 插件（TS 前端 + QuickJS 后端）
│       ├── src/               # 源码
│       ├── static/            # 静态资源（图标、二维码等）
│       ├── scripts/           # 构建脚本
│       └── package.json       # 插件配置
├── app/                       # Flutter 原生 App
│   ├── lib/
│   │   ├── core/             # 领域模型 + 共享契约
│   │   ├── data/             # 音源适配器 / 播放器服务
│   │   └── presentation/     # UI 层
│   └── pubspec.yaml          # Flutter 配置
├── tool/                      # 辅助工具脚本
├── LICENSE                    # Apache-2.0 许可证
└── README.md                  # 本文件
```

## 快速开始

### 插件构建

```bash
cd plugin/songloft
npm install
npm run build        # 构建插件 zip 包
npm run dev          # 开发模式（热重载）
```

### App 运行

```bash
cd app
flutter pub get
flutter run           # 默认 Android
flutter run -d ios    # iOS
flutter run -d ohos   # 鸿蒙（需 OHOS 环境）
```

## 版本说明

- **正式版**：主版本号.子版本号.修订版本号（如 `1.4.60`）
- **测试版**：正式版版本号.测试版本号（如 `1.4.60.1`）
- 版本单一来源：仅修改 `plugin/songloft/plugin.json` 中的 version 字段

## 许可证

本项目采用 [Apache License 2.0](LICENSE) 开源协议。

```
Copyright 2026 pcyear

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## 关注我们

微信扫码关注 **「pcyear」** 公众号，获取项目更新通知与技术分享：

![pcyear公众号](plugin/songloft/static/qrcode.png)
