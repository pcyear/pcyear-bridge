import 'dart:convert';

import 'package:pcyear_bridge/core/models.dart';
import 'package:pcyear_bridge/core/result.dart';
import 'package:pcyear_bridge/data/songloft/songloft_client.dart';
import 'package:pcyear_bridge/data/sources/source_adapter.dart';
import 'package:pcyear_bridge/data/sources/source_repository.dart';

/// SongLoft 适配器：用官方 REST API 把 SongLoft 服务器作为一个一等音源接入。
///
/// 与 WebDAV / 飞牛 / Subsonic 适配器同构，统一走 [SourceAdapter] 契约；UI / 播放器
/// 不感知后端差异。登录态（access/refresh token）来自 [SourceConfig.extra]，由
/// 「连接到 SongLoft」流程写入；token 过期时本适配器自动 refresh 并重试，刷新后
/// 立即把新 token 写回 [SourceConfig.extra] 并持久化，避免重建/重启复用坏 token。
class SongLoftAdapter implements SourceAdapter {
  @override
  final SourceType type = SourceType.songloft;
  @override
  final String sourceId;

  final String baseUrl;
  final SongLoftClient _client;
  final SourceRepository? _repo;
  /// 当前生效的配置（token 刷新后据此 copyWith 写回）。
  SourceConfig _cfg;
  /// 曲目缓存：resolveStream / resolveCover / lyric 只拿到 trackId，
  /// 需要反查 source_data 时从这里取。
  final Map<String, Track> _trackCache = {};

  SongLoftAdapter(SourceConfig cfg, {SourceRepository? repo})
      : _cfg = cfg,
        _repo = repo,
        sourceId = cfg.id,
        baseUrl = cfg.baseUrl.replaceAll(RegExp(r'/+$'), ''),
        _client = SongLoftClient(
          baseUrl: cfg.baseUrl,
          accessToken: cfg.extra['accessToken'] as String?,
          refreshToken: cfg.extra['refreshToken'] as String?,
          expiresIn: (cfg.extra['expiresIn'] as int?) ?? 0,
        ) {
    // 绑定 token 刷新后的持久化回调（写回配置并落盘）。
    _client.onTokensRefreshed = (accessToken, refreshToken, expiresIn) {
      _cfg = _cfg.copyWith(
        extra: {
          ..._cfg.extra,
          'accessToken': accessToken,
          'refreshToken': refreshToken,
          'expiresIn': expiresIn,
        },
      );
      _repo?.persistConfigOnly(_cfg);
    };
  }

  Track _toTrack(Map<String, dynamic> m) {
    final id = '${m['id']}';
    // 保存宿主原始 source_data，供 App 直接调用 pcyear-bridge 插件端点反查
    Map<String, dynamic>? sourceData;
    final rawSd = m['source_data'];
    if (rawSd != null) {
      try {
        sourceData = rawSd is String
            ? (jsonDecode(rawSd) as Map<String, dynamic>)
            : (rawSd as Map).cast<String, dynamic>();
      } catch (_) {
        sourceData = null;
      }
    }
    final track = Track(
      id: id,
      title: m['title'] as String?,
      artist: m['artist'] as String?,
      album: m['album'] as String?,
      trackNo: _trackNo(m['track']),
      // 后端 duration 单位为秒，App 统一用毫秒
      duration: ((m['duration'] as num?)?.toDouble() ?? 0) * 1000,
      sourceId: sourceId,
      // 封面优先用 source_data 里的 coverId（真实文件路径），兜底用歌曲 id
      coverId: sourceData?['coverId']?.toString() ?? id,
      albumId: m['album'] as String?,
      artistId: m['artist'] as String?,
      size: (m['file_size'] as int?) ?? 0,
      mime: _mimeFromFormat(m['format'] as String?),
      extra: sourceData == null
          ? null
          : {'source_data': sourceData, 'songId': m['id']},
    );
    _trackCache[id] = track;
    return track;
  }

  int? _trackNo(dynamic v) {
    if (v == null) return null;
    final m = RegExp(r'(\d+)').firstMatch(v.toString());
    return m != null ? int.tryParse(m.group(1)!) : null;
  }

  String? _mimeFromFormat(String? fmt) {
    switch ((fmt ?? '').toLowerCase()) {
      case 'mp3':
        return 'audio/mpeg';
      case 'flac':
        return 'audio/flac';
      case 'm4a':
      case 'aac':
        return 'audio/mp4';
      case 'ogg':
      case 'opus':
        return 'audio/ogg';
      case 'wav':
        return 'audio/wav';
      case 'wma':
        return 'audio/x-ms-wma';
      default:
        return null;
    }
  }

  @override
  Future<void> testConnection() async {
    // 用带鉴权的曲库首屏探测（同时验证登录态是否有效）
    final r = await _client.fetchSongs(limit: 1);
    if (r is Err) throw Exception(r.error);
  }

  @override
  Future<List<DirEntry>> listDirectories(String? path) async => const [];

  @override
  Future<int> countSongsIn(String path) async => 0;

  @override
  Future<PagedList<Album>> listAlbums({int limit = 50, int offset = 0}) async {
    final r = await _client.facets('album', limit: limit, offset: offset);
    if (r is Err) throw Exception(r.error);
    final facets = (r.value['facets'] as List? ?? [])
        .cast<Map<String, dynamic>>();
    final list = facets.map<Album>((f) {
      final v = '${f['value']}';
      return Album(
        id: v,
        name: v,
        trackCount: (f['count'] as int?) ?? 0,
        sourceId: sourceId,
      );
    }).toList();
    final total = (r.value['total'] as int?) ?? list.length;
    return PagedList(list, total);
  }

  @override
  Future<PagedList<Artist>> listArtists({int limit = 50, int offset = 0}) async {
    final r = await _client.facets('artist', limit: limit, offset: offset);
    if (r is Err) throw Exception(r.error);
    final facets = (r.value['facets'] as List? ?? [])
        .cast<Map<String, dynamic>>();
    final list = facets.map<Artist>((f) {
      final v = '${f['value']}';
      return Artist(
        id: v,
        name: v,
        trackCount: (f['count'] as int?) ?? 0,
        sourceId: sourceId,
      );
    }).toList();
    final total = (r.value['total'] as int?) ?? list.length;
    return PagedList(list, total);
  }

  @override
  Future<PagedList<Playlist>> listPlaylists({int limit = 50, int offset = 0}) async =>
      const PagedList([], 0);

  @override
  Future<PagedList<Track>> listTracks({int limit = 50, int offset = 0}) async {
    final r = await _client.fetchSongs(limit: limit, offset: offset);
    if (r is Err) throw Exception(r.error);
    final list = r.value.songs.map<Track>(_toTrack).toList();
    return PagedList(list, r.value.total);
  }

  @override
  Future<PagedList<Track>> albumTracks(String albumId,
      {int limit = 9999, int offset = 0}) async {
    final r = await _client.fetchSongs(
        album: albumId, limit: limit, offset: offset);
    if (r is Err) throw Exception(r.error);
    final list = r.value.songs.map<Track>(_toTrack).toList();
    return PagedList(list, r.value.total);
  }

  @override
  Future<PagedList<Track>> artistTracks(String artistId,
      {int limit = 9999, int offset = 0}) async {
    final r = await _client.fetchSongs(
        artist: artistId, limit: limit, offset: offset);
    if (r is Err) throw Exception(r.error);
    final list = r.value.songs.map<Track>(_toTrack).toList();
    return PagedList(list, r.value.total);
  }

  @override
  Future<List<CollectionInfo>> collectionInfo(List<String> ids) async {
    final out = <CollectionInfo>[];
    for (final id in ids) {
      if (id.isEmpty) continue;
      try {
        final r = await _client.fetchSongs(album: id, limit: 1);
        if (r is Ok) {
          out.add(CollectionInfo(
            id: id,
            name: id,
            trackCount: r.value.total,
            sourceId: sourceId,
          ));
        } else {
          out.add(CollectionInfo(id: id));
        }
      } catch (_) {
        out.add(CollectionInfo(id: id));
      }
    }
    return out;
  }

  @override
  Future<SearchResults> search(String query,
      {String? dir, int limit = 30}) async {
    final r = await _client.fetchSongs(keyword: query, limit: limit);
    if (r is Err) throw Exception(r.error);
    final tracks =
        r.value.songs.map<Track>(_toTrack).take(limit).toList();
    // 顺带聚合命中的专辑 / 艺术家
    final albums = <Album>[];
    final artists = <Artist>[];
    try {
      final fa = await _client.facets('album', limit: (limit / 2).ceil());
      if (fa is Ok) {
        for (final f in (fa.value['facets'] as List? ?? [])) {
          final m = f as Map<String, dynamic>;
          final v = '${m['value']}';
          if (v.toLowerCase().contains(query.toLowerCase())) {
            albums.add(Album(
                id: v, name: v, trackCount: m['count'] as int?, sourceId: sourceId));
          }
        }
      }
      final fr = await _client.facets('artist', limit: (limit / 2).ceil());
      if (fr is Ok) {
        for (final f in (fr.value['facets'] as List? ?? [])) {
          final m = f as Map<String, dynamic>;
          final v = '${m['value']}';
          if (v.toLowerCase().contains(query.toLowerCase())) {
            artists.add(Artist(
                id: v, name: v, trackCount: m['count'] as int?, sourceId: sourceId));
          }
        }
      }
    } catch (_) {
      // 搜索结果降级为仅曲目
    }
    return SearchResults(tracks: tracks, albums: albums, artists: artists);
  }

  /// 解析播放地址：优先走插件 /play-url（绕过宿主 /songs/{id}/play 的 502/插件名不兼容问题），
  /// 仅在插件返回 scheme:host（飞牛等必须宿主播放器）时才回退到宿主 /play。
  @override
  Future<UpstreamRef> resolveStream(String trackId) async {
    final sd = _sourceDataOf(trackId);
    if (sd != null) {
      final sid = sd['sourceId']?.toString();
      final tid = sd['trackId']?.toString();
      if (sid != null &&
          sid.isNotEmpty &&
          tid != null &&
          tid.isNotEmpty &&
          sd['sourceType']?.toString() != 'fnMusic') {
        try {
          final r = await _client.pluginPlayUrl(
            sid,
            tid,
            title: sd['title']?.toString(),
            artist: sd['artist']?.toString(),
            pluginEntryPath: _pluginEntryPathOf(sd),
          );
          if (r is Ok) {
            final scheme = r.value['scheme']?.toString();
            final url = r.value['url']?.toString();
            // WebDAV/Subsonic 返回 scheme=direct + 已鉴权直链
            if (scheme == 'direct' && url != null && url.isNotEmpty) {
              return UpstreamRef(url: url);
            }
            // 飞牛等必须宿主播放器：继续走下方宿主 /play
          }
        } catch (_) {
          // 插件端点失败（如未配置音源）则回退到宿主 /play
        }
      }
    }
    return UpstreamRef(url: _client.songPlayUrl(trackId));
  }

  @override
  Future<UpstreamRef?> resolveCover(String? coverId) async {
    if (coverId == null || coverId.isEmpty) return null;
    final sd = _sourceDataOf(coverId);
    final sid = sd?['sourceId']?.toString();
    final cid = sd?['coverId']?.toString() ?? coverId;
    if (sid != null && sid.isNotEmpty && cid.isNotEmpty) {
      return UpstreamRef(
          url: _client.pluginCoverImgUrl(sid, cid,
              pluginEntryPath: _pluginEntryPathOf(sd)),
          // /cover-img 是 public_path，无需自定义 header
          headers: const {});
    }
    // 兜底：走宿主封面（可能 401，但保留旧逻辑）
    return UpstreamRef(url: _client.songCoverUrl(coverId));
  }

  @override
  Future<String?> lyric(String trackId) async {
    final songId = _songIdOf(trackId);
    if (songId != null) {
      final ep = _pluginEntryPathOf(_sourceDataOf(trackId));
      final r = await _client.pluginFetchLyric(songId, pluginEntryPath: ep);
      if (r is Ok) return r.value;
    }
    final r = await _client.fetchLyric(trackId);
    if (r is Err) return null;
    return r.value;
  }

  Map<String, dynamic>? _sourceDataOf(String trackId) {
    // 当前 Track.id 就是宿主歌曲 id（字符串化后），source_data 存在 extra 里
    final extra = _trackExtra(trackId);
    final raw = extra?['source_data'];
    if (raw is Map<String, dynamic>) return raw;
    if (raw is Map) return raw.cast<String, dynamic>();
    return null;
  }

  /// 由歌曲 source_data 推断应调用的插件接入点（entryPath）。
  /// 旧歌 provider 为 `multisource-music`（旧插件名，现已作为别名并存安装），其音源
  /// 配置只存在于该命名空间，必须命中对应别名插件才能解析；新歌 provider 为
  /// `pcyear-bridge`，用新插件。两者命名空间隔离，sourceId 不可混用。
  static const Set<String> _knownPluginEntryPaths = {
    'pcyear-bridge',
    'multisource-music',
  };
  String _pluginEntryPathOf(Map<String, dynamic>? sd) {
    final p = sd?['provider']?.toString();
    if (p != null && _knownPluginEntryPaths.contains(p)) return p;
    return 'pcyear-bridge';
  }

  int? _songIdOf(String trackId) {
    final extra = _trackExtra(trackId);
    final v = extra?['songId'];
    if (v is int) return v;
    if (v is String) return int.tryParse(v);
    return int.tryParse(trackId);
  }

  Map<String, dynamic>? _trackExtra(String trackId) {
    final t = _trackCache[trackId];
    if (t != null) return t.extra;
    // 缓存未命中时尝试用 trackId 当 songId 反查（容错）
    return null;
  }

  @override
  Future<void> forceRefresh() async {}

  @override
  void dispose() => _client.dispose();
}
