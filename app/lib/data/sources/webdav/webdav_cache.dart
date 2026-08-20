import 'package:pcyear_bridge/core/models.dart';
import 'webdav_models.dart';

class _Entry<T> {
  final T value;
  final DateTime expiry;
  _Entry(this.value, this.expiry);
  bool get alive => DateTime.now().isBefore(expiry);
}

/// WebDAV 内存缓存：目录列表 + 集合二次元数据，带 TTL。
/// 对应插件 `WebDavCache`（懒加载关键，避免每次浏览都重扫盘）。
class WebDavCache {
  final Map<String, _Entry<List<DavEntry>>> _dirs = {};
  final Map<String, _Entry<CollectionInfo>> _colInfo = {};
  final Duration ttl;

  WebDavCache({this.ttl = const Duration(minutes: 5)});

  List<DavEntry>? getDir(String key) {
    final e = _dirs[key];
    if (e != null && e.alive) return e.value;
    _dirs.remove(key);
    return null;
  }

  void setDir(String key, List<DavEntry> v) =>
      _dirs[key] = _Entry(v, DateTime.now().add(ttl));

  CollectionInfo? getCollectionInfo(String id) {
    final e = _colInfo[id];
    if (e != null && e.alive) return e.value;
    _colInfo.remove(id);
    return null;
  }

  void setCollectionInfo(String id, CollectionInfo v) =>
      _colInfo[id] = _Entry(v, DateTime.now().add(ttl));

  void clearDirs() => _dirs.clear();
  void clearCollections() => _colInfo.clear();

  void dispose() {
    _dirs.clear();
    _colInfo.clear();
  }
}
