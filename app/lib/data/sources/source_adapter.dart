import 'package:pcyear_bridge/core/models.dart';

/// 分页列表
class PagedList<T> {
  final List<T> list;
  final int total;
  const PagedList(this.list, this.total);
}

/// 目录项（钻取用）
class DirEntry {
  final String path;
  final String name;
  final int? count;
  const DirEntry({required this.path, required this.name, this.count});
}

/// 音源适配器统一接口：与插件 `src/adapters/*/adapter.ts` 的 `SourceAdapter` 对齐。
///
/// 约定（与插件一致）：
/// - 列表接口只返回 {id,name} 骨架，二次元数据走 [collectionInfo]（禁止在列表里夹带扫描/读音频头）。
/// - [albumTracks]/[artistTracks]/[search] 的 id 语义与 [mkId]/[parseCollectionId] 一致。
/// - 出错直接 throw，由上层（SourceRepository / Provider）包成 Result 供 UI 展示。
abstract class SourceAdapter {
  SourceType get type;
  String get sourceId;

  /// 连接测试
  Future<void> testConnection();

  /// 列出某目录下的子目录（path 为空列根一层）
  Future<List<DirEntry>> listDirectories(String? path);

  /// 递归统计某目录下（含子目录）的歌曲总数（有界，避免巨目录卡死）
  Future<int> countSongsIn(String path);

  Future<PagedList<Album>> listAlbums({int limit = 50, int offset = 0});
  Future<PagedList<Artist>> listArtists({int limit = 50, int offset = 0});
  Future<PagedList<Playlist>> listPlaylists({int limit = 50, int offset = 0});
  Future<PagedList<Track>> listTracks({int limit = 50, int offset = 0});

  Future<PagedList<Track>> albumTracks(String albumId, {int limit = 9999, int offset = 0});
  Future<PagedList<Track>> artistTracks(String artistId, {int limit = 9999, int offset = 0});

  /// 批量获取集合（专辑/艺术家）的二次元数据
  Future<List<CollectionInfo>> collectionInfo(List<String> ids);

  Future<SearchResults> search(String query, {String? dir, int limit = 30});

  /// 同目录同名 .lrc 歌词文本
  Future<String?> lyric(String trackId);

  /// 解析可直连的播放流地址（含鉴权头）
  Future<UpstreamRef> resolveStream(String trackId);

  /// 解析封面地址（目录内图片优先；音频内嵌 APIC 后续迭代）
  Future<UpstreamRef?> resolveCover(String? coverId);

  /// 用户显式刷新
  Future<void> forceRefresh();

  void dispose();
}
