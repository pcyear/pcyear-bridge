/// 领域模型：与插件 `plugin/songloft/src/types.ts` 字段一一对应。
/// 双项目同步时，本文件的字段/命名/语义即「契约」，插件侧改动须同步此处。
///
/// 重要约定（与插件保持一致）：
/// - 集合 id（专辑/艺术家）编码规范见 [SourceAdapter] 的 mkId/parseCollectionId。
/// - WebDAV 曲目 artist/album 多为空，真实艺术家/专辑为文件夹名（见 search 推导口径）。

/// 音源类型
enum SourceType {
  webdav,
  subsonic,
  feiniu,
  songloft;

  static SourceType fromString(String s) {
    switch (s.toLowerCase()) {
      case 'subsonic':
      case 'navidrome':
        return SourceType.subsonic;
      case 'feiniu':
      case 'fnos':
        return SourceType.feiniu;
      case 'songloft':
      case 'pcyear-bridge':
        return SourceType.songloft;
      default:
        return SourceType.webdav;
    }
  }

  String get label {
    switch (this) {
      case SourceType.webdav:
        return 'WebDAV';
      case SourceType.subsonic:
        return 'Subsonic / Navidrome';
      case SourceType.feiniu:
        return '飞牛';
      case SourceType.songloft:
        return 'SongLoft';
    }
  }
}

/// 音源配置（可持久化到本地）。对应插件 SourceConfig。
class SourceConfig {
  final String id;
  final SourceType type;
  final String name;
  final String baseUrl;
  /// 多 root 支持（WebDAV 常见）
  final List<String> roots;
  final String? username;
  final String? password;
  /// 类型相关扩展参数（Subsonic 的 token、飞牛的额外字段等）
  final Map<String, dynamic> extra;

  const SourceConfig({
    required this.id,
    required this.type,
    required this.name,
    required this.baseUrl,
    this.roots = const [],
    this.username,
    this.password,
    this.extra = const {},
  });

  SourceConfig copyWith({
    String? id,
    SourceType? type,
    String? name,
    String? baseUrl,
    List<String>? roots,
    String? username,
    String? password,
    Map<String, dynamic>? extra,
  }) {
    return SourceConfig(
      id: id ?? this.id,
      type: type ?? this.type,
      name: name ?? this.name,
      baseUrl: baseUrl ?? this.baseUrl,
      roots: roots ?? this.roots,
      username: username ?? this.username,
      password: password ?? this.password,
      extra: extra ?? this.extra,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.name,
        'name': name,
        'baseUrl': baseUrl,
        'roots': roots,
        'username': username,
        'password': password,
        'extra': extra,
      };

  factory SourceConfig.fromJson(Map<String, dynamic> j) => SourceConfig(
        id: j['id'] as String,
        type: SourceType.fromString(j['type'] as String? ?? 'webdav'),
        name: j['name'] as String? ?? '',
        baseUrl: j['baseUrl'] as String? ?? '',
        roots: (j['roots'] as List<dynamic>? ?? []).map((e) => e as String).toList(),
        username: j['username'] as String?,
        password: j['password'] as String?,
        extra: Map<String, dynamic>.from(j['extra'] as Map? ?? {}),
      );
}

/// 音源简述（列表用，不含敏感信息）
class Source {
  final String id;
  final SourceType type;
  final String name;
  final String? baseUrl;
  final bool? online;

  const Source({
    required this.id,
    required this.type,
    required this.name,
    this.baseUrl,
    this.online,
  });
}

/// 曲目。对应插件 Track。
class Track {
  final String id; // 音源内唯一路径（如 /Music/foo/bar.mp3）
  final String? title;
  final String? artist;
  final String? album;
  final int? trackNo;
  final int? duration; // 毫秒
  final String? sourceId; // 所属音源 id
  final String? coverId; // 封面集合 id
  final String? albumId;
  final String? artistId;
  final int? size; // 字节
  final String? mime;
  /// 音源相关原始扩展数据（如 SongLoft 的 source_data JSON），
  /// 用于 App 直接调用插件端点反查 sourceId/trackId/coverId。
  final Map<String, dynamic>? extra;

  const Track({
    required this.id,
    this.title,
    this.artist,
    this.album,
    this.trackNo,
    this.duration,
    this.sourceId,
    this.coverId,
    this.albumId,
    this.artistId,
    this.size,
    this.mime,
    this.extra,
  });

  String get displayTitle => title?.isNotEmpty == true ? title! : (id.split('/').lastWhere((s) => s.isNotEmpty, orElse: () => id));

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'artist': artist,
        'album': album,
        'trackNo': trackNo,
        'duration': duration,
        'sourceId': sourceId,
        'coverId': coverId,
        'albumId': albumId,
        'artistId': artistId,
        'size': size,
        'mime': mime,
        'extra': extra,
      };

  factory Track.fromJson(Map<String, dynamic> j) => Track(
        id: j['id'] as String,
        title: j['title'] as String?,
        artist: j['artist'] as String?,
        album: j['album'] as String?,
        trackNo: j['trackNo'] as int?,
        duration: j['duration'] as int?,
        sourceId: j['sourceId'] as String?,
        coverId: j['coverId'] as String?,
        albumId: j['albumId'] as String?,
        artistId: j['artistId'] as String?,
        size: j['size'] as int?,
        mime: j['mime'] as String?,
        extra: (j['extra'] as Map?)?.cast<String, dynamic>(),
      );
}

/// 专辑。对应插件 Album。
class Album {
  final String id;
  final String name;
  final String? artist;
  final int? trackCount;
  final int? albumCount;
  final String? coverId;
  final String? sourceId;

  const Album({
    required this.id,
    required this.name,
    this.artist,
    this.trackCount,
    this.albumCount,
    this.coverId,
    this.sourceId,
  });
}

/// 艺术家。对应插件 Artist。
class Artist {
  final String id;
  final String name;
  final int? trackCount;
  final int? albumCount;
  final String? coverId;
  final String? sourceId;

  const Artist({
    required this.id,
    required this.name,
    this.trackCount,
    this.albumCount,
    this.coverId,
    this.sourceId,
  });
}

/// 歌单。对应插件 Playlist。
class Playlist {
  final String id;
  final String name;
  final int? trackCount;
  final String? coverId;
  final String? sourceId;

  const Playlist({
    required this.id,
    required this.name,
    this.trackCount,
    this.coverId,
    this.sourceId,
  });
}

/// 搜索结果。对应插件 SearchResults。
///
/// 注意：字段是**可增长**列表。跨音源搜索时上层会对同一个实例逐音源 addAll，
/// 因此这里不能用 `const []` 作默认值（常量列表不可变，addAll 会抛
/// `Unsupported operation: Cannot add to an unmodifiable list`）。
class SearchResults {
  final List<Track> tracks;
  final List<Album> albums;
  final List<Artist> artists;

  SearchResults({
    List<Track>? tracks,
    List<Album>? albums,
    List<Artist>? artists,
  })  : tracks = tracks ?? <Track>[],
        albums = albums ?? <Album>[],
        artists = artists ?? <Artist>[];
}

/// 上游引用：可直连的流地址 + 必要请求头（如 Basic 鉴权）。对应插件 UpstreamRef。
class UpstreamRef {
  final String url;
  final Map<String, String>? headers;

  const UpstreamRef({required this.url, this.headers});
}

/// 逐字歌词行。对应插件解析后的歌词行。
class LyricLine {
  final Duration time;
  final String text;

  const LyricLine(this.time, this.text);
}

/// 集合二次元数据（封面/歌手/曲目数）。对应插件 collectionInfo 返回项。
class CollectionInfo {
  final String id;
  final String? name;
  final String? artist;
  final int? trackCount;
  final int? albumCount;
  final String? coverId;

  const CollectionInfo({
    required this.id,
    this.name,
    this.artist,
    this.trackCount,
    this.albumCount,
    this.coverId,
  });
}
