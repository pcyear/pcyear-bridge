import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:pcyear_bridge/core/models.dart';
import 'package:pcyear_bridge/data/sources/source_adapter.dart';
import 'package:pcyear_bridge/data/songloft/songloft_adapter.dart';
import 'package:pcyear_bridge/data/sources/feiniu/feiniu_adapter.dart';
import 'package:pcyear_bridge/data/sources/subsonic/subsonic_adapter.dart';
import 'package:pcyear_bridge/data/sources/webdav/webdav_adapter.dart';
import 'package:pcyear_bridge/data/sources/daoliyu/daoliyu_adapter.dart';

const String _kSources = 'fnmusic_sources';

/// 音源仓储：聚合所有音源适配器，并持久化音源配置（shared_preferences）。
/// UI / 播放器只依赖本类，不直接 new 适配器。
class SourceRepository {
  final List<SourceConfig> _configs = [];
  final Map<String, SourceAdapter> _adapters = {};

  List<SourceConfig> get configs => List.unmodifiable(_configs);

  SourceAdapter? adapter(String id) => _adapters[id];

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_kSources);
    if (raw != null) {
      final list = (jsonDecode(raw) as List)
          .map((e) => SourceConfig.fromJson(e as Map<String, dynamic>))
          .toList();
      _configs.addAll(list);
    }
    _buildAdapters();
  }

  void _buildAdapters() {
    for (final c in _configs) {
      _adapters[c.id] = _build(c);
    }
  }

  /// 公开工厂：供连接测试等场景在保存前临时构建适配器
  SourceAdapter createAdapter(SourceConfig cfg) => _build(cfg);

  SourceAdapter _build(SourceConfig cfg) {
    switch (cfg.type) {
      case SourceType.webdav:
        return WebDavAdapter(cfg);
      case SourceType.subsonic:
        return SubsonicAdapter(cfg);
      case SourceType.feiniu:
        return FeiNiuAdapter(cfg);
      case SourceType.songloft:
        return SongLoftAdapter(cfg, repo: this);
      case SourceType.daoliyu:
        return DaoLiyuAdapter(cfg);
    }
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
        _kSources, jsonEncode(_configs.map((c) => c.toJson()).toList()));
  }

  String newId() =>
      'src_${DateTime.now().microsecondsSinceEpoch}_${(_configs.length + 1)}';

  Future<void> addSource(SourceConfig cfg) async {
    _configs.removeWhere((c) => c.id == cfg.id);
    _configs.add(cfg);
    _adapters[cfg.id]?.dispose();
    _adapters[cfg.id] = _build(cfg);
    await _persist();
  }

  Future<void> removeSource(String id) async {
    _configs.removeWhere((c) => c.id == id);
    _adapters.remove(id)?.dispose();
    await _persist();
  }

  Future<void> updateSource(SourceConfig cfg) => addSource(cfg);

  /// 仅持久化配置更新（用于 token 刷新后回写），不 dispose / 重建适配器，
  /// 避免打断正在进行的请求。调用方已持有该适配器实例。
  Future<void> persistConfigOnly(SourceConfig cfg) async {
    final idx = _configs.indexWhere((c) => c.id == cfg.id);
    if (idx < 0) {
      _configs.add(cfg);
    } else {
      _configs[idx] = cfg;
    }
    await _persist();
  }

  /// 跨音源聚合的通用实现：逐音源取一页，单个音源失败不影响其它。
  Future<List<T>> _aggregate<T>(
    Future<PagedList<T>> Function(SourceAdapter a) fetch,
    String Function(T item) sortKey, {
    required int limit,
    required int offset,
  }) async {
    final out = <T>[];
    for (final c in _configs) {
      final a = _adapters[c.id];
      if (a == null) continue;
      try {
        final p = await fetch(a);
        out.addAll(p.list);
      } catch (_) {
        // 单个音源失败不影响其它
      }
    }
    out.sort((x, y) => sortKey(x).compareTo(sortKey(y)));
    final start = offset.clamp(0, out.length);
    final end = (offset + limit).clamp(0, out.length);
    return out.sublist(start, end);
  }

  /// 跨音源聚合：所有专辑（用于「乐库」首页）
  Future<List<Album>> allAlbums({int limit = 100, int offset = 0}) =>
      _aggregate<Album>((a) => a.listAlbums(limit: limit, offset: 0),
          (x) => x.name,
          limit: limit, offset: offset);

  /// 跨音源聚合：所有艺术家
  Future<List<Artist>> allArtists({int limit = 100, int offset = 0}) =>
      _aggregate<Artist>((a) => a.listArtists(limit: limit, offset: 0),
          (x) => x.name,
          limit: limit, offset: offset);

  /// 跨音源聚合：曲目（仅用于「曲目」标签页的首屏，不做全库扫描）
  Future<List<Track>> allTracks({int limit = 100, int offset = 0}) =>
      _aggregate<Track>((a) => a.listTracks(limit: limit, offset: 0),
          (x) => x.displayTitle,
          limit: limit, offset: offset);

  void dispose() {
    for (final a in _adapters.values) a.dispose();
    _adapters.clear();
  }
}
