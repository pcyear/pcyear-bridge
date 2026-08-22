import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:pcyear_bridge/core/models.dart';
import 'package:pcyear_bridge/data/sources/source_adapter.dart';

/// 道理鱼（Daoliyu Music）适配器。
///
/// 接口契约（均经真机 `192.168.31.28:4000` 验证）：
/// - 鉴权：`POST /api/auth/login` → `{token}`；后续请求带 `Authorization: Bearer <token>`。
/// - 数据（base `/api`）：`/library/albums`、`/library/artists`、`/tracks`、
///   `/library/albums/{id}`（含 `tracks`）、`/library/artists/{id}`（含 `tracks`）、
///   `/tracks/{id}`（含 `lyrics`）、`/playlists`、`/playlists/{id}/tracks`。
/// - 分页：`take`（每页）/ `skip`（偏移）；搜索：列表接口加 `search` 查询参数。
/// - 流：`GET /api/tracks/{id}/stream` 需 Bearer 鉴权（默认转码 mp3）。
/// - 封面：`GET /api/cover?path=...` 可匿名访问，无需鉴权头。封面字段在
///   album/artist/track 对象上**条件出现**：曲目本身所属专辑有封面时即带
///   `coverArtUrl`/`coverArtPath`，无封面时为 null（空）。
///
/// 设计要点：
/// - token 缓存在内存，登录失败或 401 自动重新登录（JWT 无 exp，长期有效）。
/// - `coverId` 直接存**可匿名访问的绝对封面 URL**，兼容锁屏 artUri 与任意
///   `Image.network` 加载场景，且不放鉴权信息。
/// - 本适配器为纯新增，不修改任何既有音源逻辑。
class DaoLiyuAdapter implements SourceAdapter {
  @override
  final SourceType type = SourceType.daoliyu;
  @override
  final String sourceId;

  /// 服务根（去掉结尾的 `/` 与 `/api`）
  final String _root;
  final String _user;
  final String _password;
  final http.Client _client = http.Client();
  String? _token;

  DaoLiyuAdapter(SourceConfig cfg)
      : sourceId = cfg.id,
        _root = cfg.baseUrl.replaceAll(RegExp(r'/api/?$|/+$'), ''),
        _user = cfg.username ?? '',
        _password = cfg.password ?? '';

  String get _api => '$_root/api';

  Future<void> _ensureToken() async {
    if (_token != null) return;
    await _login();
  }

  Future<void> _login() async {
    final resp = await _client.post(
      Uri.parse('$_api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': _user, 'password': _password}),
    );
    if (resp.statusCode != 200) {
      throw Exception('道理鱼登录失败（HTTP ${resp.statusCode}）');
    }
    final d = jsonDecode(resp.body) as Map<String, dynamic>;
    _token = d['token'] as String?;
    if (_token == null || _token!.isEmpty) {
      throw Exception('道理鱼登录未返回 token');
    }
  }

  /// 统一 GET：自动带 Bearer；遇 401 重新登录后重试一次。
  Future<Map<String, dynamic>> _get(String path,
      {Map<String, String>? query}) async {
    await _ensureToken();
    for (int attempt = 0; attempt < 2; attempt++) {
      final uri =
          Uri.parse('$_api$path').replace(queryParameters: query);
      final resp = await _client.get(uri, headers: {
        'Authorization': 'Bearer $_token',
      });
      if (resp.statusCode == 401) {
        _token = null;
        await _login();
        continue;
      }
      if (resp.statusCode != 200) {
        throw Exception('道理鱼请求失败 $path（HTTP ${resp.statusCode}）');
      }
      return jsonDecode(resp.body) as Map<String, dynamic>;
    }
    throw Exception('道理鱼请求失败 $path（鉴权重试后仍失败）');
  }

  /// 从对象中取封面原始服务器路径（优先 coverArtPath，否则从 coverArtUrl 反解）。
  String? _coverPath(Map<String, dynamic> m) {
    final p = m['coverArtPath'] as String?;
    if (p != null && p.isNotEmpty) return p;
    final url = m['coverArtUrl'] as String?;
    if (url == null || url.isEmpty) return null;
    try {
      return Uri.parse(url).queryParameters['path'];
    } catch (_) {
      return null;
    }
  }

  /// 把封面原始路径转成可匿名访问的绝对 URL（封面端点无需鉴权）。
  String? _coverUrl(String? path) {
    if (path == null || path.isEmpty) return null;
    return '$_api/cover?path=${Uri.encodeQueryComponent(path)}';
  }

  Track _toTrack(Map<String, dynamic> m) {
    final album = m['album'] as Map<String, dynamic>?;
    final artistMap = m['artist'];
    final artistName = (m['artistName'] as String?) ??
        (artistMap is Map ? (artistMap['name'] as String?) : null);
    // 封面：track 自身优先，其次所属 album 对象（二者任一有即取）。
    final coverPath = _coverPath(m) ?? _coverPath(album ?? {});
    return Track(
      id: '${m['id']}',
      title: m['title'] as String?,
      artist: artistName,
      album: album?['title'] as String?,
      duration: ((m['durationSeconds'] as int?) ?? 0) * 1000,
      sourceId: sourceId,
      coverId: _coverUrl(coverPath),
      albumId: album?['id'] as String?,
      artistId: m['artistId'] as String?,
      size: m['fileSize'] as int?,
      mime: (m['fileFormat'] as String?) ?? (m['detectedCodec'] as String?),
    );
  }

  Album _toAlbum(Map<String, dynamic> m) => Album(
        id: '${m['id']}',
        name: m['title'] ?? '',
        artist: m['albumArtist'] as String?,
        trackCount: m['trackCount'] as int?,
        coverId: _coverUrl(_coverPath(m)),
        sourceId: sourceId,
      );

  Artist _toArtist(Map<String, dynamic> m) => Artist(
        id: '${m['id']}',
        name: m['name'] ?? '',
        trackCount: m['trackCount'] as int?,
        albumCount: m['albumCount'] as int?,
        coverId: _coverUrl(_coverPath(m)),
        sourceId: sourceId,
      );

  @override
  Future<void> testConnection() async {
    await _get('/library/albums', query: {'take': '1', 'skip': '0'});
  }

  @override
  Future<List<DirEntry>> listDirectories(String? path) async => const [];

  @override
  Future<int> countSongsIn(String path) async => 0;

  @override
  Future<PagedList<Album>> listAlbums(
      {int limit = 50, int offset = 0}) async {
    final r = await _get('/library/albums',
        query: {'take': '$limit', 'skip': '$offset'});
    final items = (r['items'] as List?) ?? [];
    final list = items.map<Album>((a) => _toAlbum(a as Map<String, dynamic>)).toList();
    return PagedList(list, (r['total'] ?? list.length) as int);
  }

  @override
  Future<PagedList<Artist>> listArtists(
      {int limit = 50, int offset = 0}) async {
    final r = await _get('/library/artists',
        query: {'take': '$limit', 'skip': '$offset'});
    final items = (r['items'] as List?) ?? [];
    final list = items.map<Artist>((a) => _toArtist(a as Map<String, dynamic>)).toList();
    return PagedList(list, (r['total'] ?? list.length) as int);
  }

  @override
  Future<PagedList<Playlist>> listPlaylists(
      {int limit = 50, int offset = 0}) async {
    await _ensureToken();
    final uri = Uri.parse('$_api/playlists')
        .replace(queryParameters: {'take': '$limit', 'skip': '$offset'});
    final resp = await _client.get(uri, headers: {
      'Authorization': 'Bearer $_token',
    });
    if (resp.statusCode != 200) {
      throw Exception('道理鱼请求失败 /playlists（HTTP ${resp.statusCode}）');
    }
    final d = jsonDecode(resp.body);
    final List items = d is List ? d : (d is Map ? (d['items'] as List? ?? []) : []);
    final total = d is Map ? (d['total'] ?? items.length) : items.length;
    final list = items
        .map<Playlist>((a) {
          final m = a as Map<String, dynamic>;
          return Playlist(
            id: '${m['id']}',
            name: m['name'] ?? '',
            trackCount: m['trackCount'] as int?,
            coverId: _coverUrl(_coverPath(m)),
            sourceId: sourceId,
          );
        })
        .toList();
    return PagedList(list, total is int ? total : list.length);
  }

  @override
  Future<PagedList<Track>> listTracks(
      {int limit = 50, int offset = 0}) async {
    final r =
        await _get('/tracks', query: {'take': '$limit', 'skip': '$offset'});
    final items = (r['items'] as List?) ?? [];
    final list =
        items.map<Track>((t) => _toTrack(t as Map<String, dynamic>)).toList();
    return PagedList(list, (r['total'] ?? list.length) as int);
  }

  @override
  Future<PagedList<Track>> albumTracks(String albumId,
      {int limit = 9999, int offset = 0}) async {
    final r = await _get('/library/albums/$albumId');
    final raw = (r['tracks'] as List?) ?? [];
    final total = r['trackCount'] ?? raw.length;
    final list = raw
        .skip(offset)
        .take(limit)
        .map<Track>((t) => _toTrack(t as Map<String, dynamic>))
        .toList();
    return PagedList(list, total is int ? total : raw.length);
  }

  @override
  Future<PagedList<Track>> artistTracks(String artistId,
      {int limit = 9999, int offset = 0}) async {
    final r = await _get('/library/artists/$artistId');
    final raw = (r['tracks'] as List?) ?? [];
    final total = r['trackCount'] ?? raw.length;
    final list = raw
        .skip(offset)
        .take(limit)
        .map<Track>((t) => _toTrack(t as Map<String, dynamic>))
        .toList();
    return PagedList(list, total is int ? total : raw.length);
  }

  @override
  Future<List<CollectionInfo>> collectionInfo(List<String> ids) async {
    final out = <CollectionInfo>[];
    for (final id in ids) {
      if (id.isEmpty) continue;
      try {
        if (id.startsWith('alb_')) {
          final r = await _get('/library/albums/$id');
          out.add(CollectionInfo(
            id: id,
            name: r['title'] as String?,
            artist: r['albumArtist'] as String?,
            trackCount: r['trackCount'] as int?,
            coverId: _coverUrl(_coverPath(r)),
          ));
        } else if (id.startsWith('art_')) {
          final r = await _get('/library/artists/$id');
          out.add(CollectionInfo(
            id: id,
            name: r['name'] as String?,
            trackCount: r['trackCount'] as int?,
            coverId: _coverUrl(_coverPath(r)),
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
    final q = query.trim();
    if (q.isEmpty) {
      return SearchResults(tracks: const [], albums: const [], artists: const []);
    }
    await _ensureToken();
    final results = await Future.wait([
      _get('/tracks', query: {'search': q, 'take': '$limit', 'skip': '0'}),
      _get('/library/albums',
          query: {'search': q, 'take': '$limit', 'skip': '0'}),
      _get('/library/artists',
          query: {'search': q, 'take': '$limit', 'skip': '0'}),
    ]);
    final tracks = ((results[0]['items'] as List?) ?? [])
        .map<Track>((t) => _toTrack(t as Map<String, dynamic>))
        .toList();
    final albums = ((results[1]['items'] as List?) ?? [])
        .map<Album>((a) => _toAlbum(a as Map<String, dynamic>))
        .toList();
    final artists = ((results[2]['items'] as List?) ?? [])
        .map<Artist>((a) => _toArtist(a as Map<String, dynamic>))
        .toList();
    return SearchResults(tracks: tracks, albums: albums, artists: artists);
  }

  @override
  Future<String?> lyric(String trackId) async {
    try {
      final r = await _get('/tracks/$trackId');
      final l = r['lyrics'];
      return (l is String && l.isNotEmpty) ? l : null;
    } catch (_) {
      return null;
    }
  }

  @override
  Future<UpstreamRef> resolveStream(String trackId) async {
    await _ensureToken();
    return UpstreamRef(
      url: '$_api/tracks/$trackId/stream',
      headers: {'Authorization': 'Bearer $_token'},
    );
  }

  @override
  Future<UpstreamRef?> resolveCover(String? coverId) async {
    // 构建时 coverId 已是完整匿名封面 URL；若传入原始 path 则兜底构造。
    if (coverId == null || coverId.isEmpty) return null;
    final url = coverId.startsWith('http://') || coverId.startsWith('https://')
        ? coverId
        : _coverUrl(coverId);
    return (url == null || url.isEmpty) ? null : UpstreamRef(url: url);
  }

  @override
  Future<void> forceRefresh() async {}

  @override
  void dispose() => _client.close();
}
