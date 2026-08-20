// 运行时动态 entryPath。
//
// 背景：SongLoft 宿主按歌曲的 plugin_entry_path 精确派发播放/歌词/封面请求，且插件存储
// （songloft.storage / persistentStorage）按 entryPath 命名空间隔离，没有任何跨命名空间
// 别名或回退机制（api_bridge.go: invoke 查不到插件即 502）。
//
// 规范入口名：multisource-music（plugin.json entryPath 与构建产物
// multisource-music.jsplugin.zip 统一；不再使用 pcyear-bridge 主包名，双名策略已废弃）。
//
// SDK 不暴露插件自身的 entryPath，但 onHTTPRequest(req) 的 req.path 含
// /api/v1/jsplugin/<entryPath>/...，可从中解析出当前插件被安装成的名字。

let _entryPath = 'multisource-music';

/** 在每次请求入口处调用，把运行时的真实 entryPath 记下来。 */
export function setEntryPath(p: string): void {
  if (p && p !== _entryPath) _entryPath = p;
}

/** 读取当前插件被宿主安装成的 entryPath。 */
export function getEntryPath(): string {
  return _entryPath;
}

/** 从请求路径解析 entryPath：/api/v1/jsplugin/<entry>/... */
export function resolveEntryPathFromPath(path: string): string {
  const m = (path || '').match(/^\/api\/v1\/jsplugin\/([^/]+)/);
  return m ? m[1] : _entryPath;
}
