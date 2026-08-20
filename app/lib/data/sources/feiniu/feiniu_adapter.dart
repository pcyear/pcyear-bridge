import 'package:pcyear_bridge/core/models.dart';
import 'package:pcyear_bridge/data/sources/source_adapter.dart';
import 'package:pcyear_bridge/data/sources/webdav/webdav_adapter.dart';

/// 飞牛（FNOS）音乐：飞牛暴露 WebDAV 挂载，故直接复用 WebDAV 适配器实现。
/// 后续若要调用飞牛原生音乐 API（智能歌单 / 推荐等），在此层加适配即可，
/// 不影响上层 UI 与播放器。这保证「现有功能」可用且不引入与插件冲突的新逻辑。
class FeiNiuAdapter implements SourceAdapter {
  final WebDavAdapter _inner;

  FeiNiuAdapter(SourceConfig cfg) : _inner = WebDavAdapter(cfg);

  @override
  SourceType get type => SourceType.feiniu;

  @override
  String get sourceId => _inner.sourceId;

  @override
  Future<void> testConnection() => _inner.testConnection();

  @override
  Future<List<DirEntry>> listDirectories(String? path) => _inner.listDirectories(path);

  @override
  Future<int> countSongsIn(String path) => _inner.countSongsIn(path);

  @override
  Future<PagedList<Album>> listAlbums({int limit = 50, int offset = 0}) =>
      _inner.listAlbums(limit: limit, offset: offset);

  @override
  Future<PagedList<Artist>> listArtists({int limit = 50, int offset = 0}) =>
      _inner.listArtists(limit: limit, offset: offset);

  @override
  Future<PagedList<Playlist>> listPlaylists({int limit = 50, int offset = 0}) =>
      _inner.listPlaylists(limit: limit, offset: offset);

  @override
  Future<PagedList<Track>> listTracks({int limit = 50, int offset = 0}) =>
      _inner.listTracks(limit: limit, offset: offset);

  @override
  Future<PagedList<Track>> albumTracks(String albumId, {int limit = 9999, int offset = 0}) =>
      _inner.albumTracks(albumId, limit: limit, offset: offset);

  @override
  Future<PagedList<Track>> artistTracks(String artistId, {int limit = 9999, int offset = 0}) =>
      _inner.artistTracks(artistId, limit: limit, offset: offset);

  @override
  Future<List<CollectionInfo>> collectionInfo(List<String> ids) => _inner.collectionInfo(ids);

  @override
  Future<SearchResults> search(String query, {String? dir, int limit = 30}) =>
      _inner.search(query, dir: dir, limit: limit);

  @override
  Future<String?> lyric(String trackId) => _inner.lyric(trackId);

  @override
  Future<UpstreamRef> resolveStream(String trackId) => _inner.resolveStream(trackId);

  @override
  Future<UpstreamRef?> resolveCover(String? coverId) => _inner.resolveCover(coverId);

  @override
  Future<void> forceRefresh() => _inner.forceRefresh();

  @override
  void dispose() => _inner.dispose();
}
