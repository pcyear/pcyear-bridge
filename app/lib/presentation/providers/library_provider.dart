import 'package:flutter/foundation.dart';
import 'package:pcyear_bridge/core/models.dart';
import 'package:pcyear_bridge/data/sources/source_repository.dart';

/// 乐库浏览状态：跨音源聚合专辑/艺术家/曲目，按音源加载详情，跨音源搜索。
///
/// 加载策略与插件一致：列表只取骨架，取过一次就缓存在内存里，
/// 只有用户下拉刷新（force）或音源变更（[reset]）才重新拉取——
/// 避免 UI rebuild 触发重复网络请求。
class LibraryProvider extends ChangeNotifier {
  final SourceRepository repo;

  List<Album> albums = [];
  List<Artist> artists = [];
  List<Track> tracks = [];

  bool loadingAlbums = false;
  bool loadingArtists = false;
  bool loadingTracks = false;

  bool _albumsLoaded = false;
  bool _artistsLoaded = false;
  bool _tracksLoaded = false;

  String? error;

  LibraryProvider(this.repo);

  bool get loading => loadingAlbums || loadingArtists || loadingTracks;

  Future<void> loadAlbums({bool force = false}) async {
    if (_albumsLoaded && !force) return;
    loadingAlbums = true;
    error = null;
    notifyListeners();
    try {
      albums = await repo.allAlbums();
      _albumsLoaded = true;
    } catch (e) {
      error = e.toString();
      albums = [];
    }
    loadingAlbums = false;
    notifyListeners();
  }

  Future<void> loadArtists({bool force = false}) async {
    if (_artistsLoaded && !force) return;
    loadingArtists = true;
    notifyListeners();
    try {
      artists = await repo.allArtists();
      _artistsLoaded = true;
    } catch (e) {
      error = e.toString();
      artists = [];
    }
    loadingArtists = false;
    notifyListeners();
  }

  Future<void> loadTracks({bool force = false}) async {
    if (_tracksLoaded && !force) return;
    loadingTracks = true;
    notifyListeners();
    try {
      tracks = await repo.allTracks();
      _tracksLoaded = true;
    } catch (e) {
      error = e.toString();
      tracks = [];
    }
    loadingTracks = false;
    notifyListeners();
  }

  /// 用户显式刷新：让各音源丢弃目录缓存后重新聚合
  Future<void> refreshAll() async {
    for (final c in repo.configs) {
      try {
        await repo.adapter(c.id)?.forceRefresh();
      } catch (_) {}
    }
    await Future.wait([
      loadAlbums(force: true),
      loadArtists(force: true),
      loadTracks(force: true),
    ]);
  }

  /// 音源增删改后调用：清空缓存，下次进入各标签页重新加载
  void reset() {
    albums = [];
    artists = [];
    tracks = [];
    _albumsLoaded = false;
    _artistsLoaded = false;
    _tracksLoaded = false;
    error = null;
    notifyListeners();
  }

  Future<List<Track>> albumTracks(String sourceId, String albumId) async {
    final a = repo.adapter(sourceId);
    if (a == null) return [];
    final p = await a.albumTracks(albumId);
    return p.list;
  }

  Future<List<Track>> artistTracks(String sourceId, String artistId) async {
    final a = repo.adapter(sourceId);
    if (a == null) return [];
    final p = await a.artistTracks(artistId);
    return p.list;
  }

  Future<SearchResults> search(String query) async {
    final out = SearchResults();
    for (final c in repo.configs) {
      final a = repo.adapter(c.id);
      if (a == null) continue;
      try {
        final r = await a.search(query);
        out.tracks.addAll(r.tracks);
        out.albums.addAll(r.albums);
        out.artists.addAll(r.artists);
      } catch (_) {
        // 单个音源搜索失败不影响其它
      }
    }
    return out;
  }
}
