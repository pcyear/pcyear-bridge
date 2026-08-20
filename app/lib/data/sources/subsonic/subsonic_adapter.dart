import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart' as crypto;
import 'package:pcyear_bridge/core/models.dart';
import 'package:pcyear_bridge/data/sources/source_adapter.dart';
import 'package:http/http.dart' as http;

/// Subsonic / Navidrome 适配器（REST API v1.16.1，JSON 响应）。
/// 行为对齐插件对 Subsonic 源的支持。
class SubsonicAdapter implements SourceAdapter {
  @override
  final SourceType type = SourceType.subsonic;
  @override
  final String sourceId;

  final String baseUrl;
  final String user;
  final String? password;
  final String client = 'pcyear_bridge';
  final String apiVersion = '1.16.1';
  final http.Client _client = http.Client();

  SubsonicAdapter(SourceConfig cfg)
      : sourceId = cfg.id,
        baseUrl = cfg.baseUrl.replaceAll(RegExp(r'/+$'), ''),
        user = cfg.username ?? '',
        password = cfg.password;

  String _salt() {
    final r = Random().nextDouble().toString() + DateTime.now().microsecondsSinceEpoch.toString();
    return r.replaceAll(RegExp(r'[^0-9]'), '').padRight(12, '0').substring(0, 12);
  }

  String _token(String salt) =>
      crypto.md5.convert(utf8.encode(salt + (password ?? ''))).toString();

  Future<Map<String, dynamic>> _call(String method, Map<String, String> params) async {
    final salt = _salt();
    final uri = Uri.parse('$baseUrl/rest/$method').replace(queryParameters: {
      'u': user,
      't': _token(salt),
      's': salt,
      'v': apiVersion,
      'c': client,
      'f': 'json',
      ...params,
    });
    final resp = await _client.get(uri);
    if (resp.statusCode != 200) {
      throw Exception('Subsonic $method 失败（HTTP ${resp.statusCode}）');
    }
    final json = jsonDecode(resp.body) as Map<String, dynamic>;
    final sub = json['subsonic-response'] as Map<String, dynamic>;
    if (sub['status'] != 'ok') {
      throw Exception('Subsonic 错误：${sub['error']?['message'] ?? 'unknown'}');
    }
    return sub;
  }

  String _streamUrl(String id) {
    final salt = _salt();
    final uri = Uri.parse('$baseUrl/rest/stream').replace(queryParameters: {
      'u': user,
      't': _token(salt),
      's': salt,
      'v': apiVersion,
      'c': client,
      'f': 'json',
      'id': id,
    });
    return uri.toString();
  }

  String _coverUrl(String? coverId) {
    if (coverId == null || coverId.isEmpty) return '';
    final salt = _salt();
    final uri = Uri.parse('$baseUrl/rest/getCoverArt').replace(queryParameters: {
      'u': user,
      't': _token(salt),
      's': salt,
      'v': apiVersion,
      'c': client,
      'f': 'json',
      'id': coverId,
    });
    return uri.toString();
  }

  @override
  Future<void> testConnection() async => _call('ping', {});

  @override
  Future<List<DirEntry>> listDirectories(String? path) async => const [];

  @override
  Future<int> countSongsIn(String path) async => 0;

  @override
  Future<PagedList<Album>> listAlbums({int limit = 50, int offset = 0}) async {
    final r = await _call('getAlbumList2',
        {'type': 'alphabeticalByName', 'size': '$limit', 'offset': '$offset'});
    final raw = (r['albumList2']?['album'] as List? ?? []);
    final list = raw.map<Album>((a) {
      final m = a as Map<String, dynamic>;
      return Album(
        id: '${m['id']}',
        name: m['name'] ?? '',
        artist: m['artist'],
        coverId: m['coverArt'],
        sourceId: sourceId,
      );
    }).toList();
    return PagedList(list, offset + list.length);
  }

  @override
  Future<PagedList<Artist>> listArtists({int limit = 50, int offset = 0}) async {
    final r = await _call('getArtists', {});
    final indexes = (r['artists']?['index'] as List? ?? []);
    final List<dynamic> raw = [];
    for (final idx in indexes) {
      raw.addAll((idx as Map<String, dynamic>)['artist'] as List? ?? []);
    }
    final sliced = raw.skip(offset).take(limit).toList();
    final list = sliced.map<Artist>((a) {
      final m = a as Map<String, dynamic>;
      return Artist(
        id: '${m['id']}',
        name: m['name'] ?? '',
        coverId: m['coverArt'],
        sourceId: sourceId,
      );
    }).toList();
    return PagedList(list, raw.length);
  }

  @override
  Future<PagedList<Playlist>> listPlaylists({int limit = 50, int offset = 0}) async {
    final r = await _call('getPlaylists', {});
    final raw = (r['playlists']?['playlist'] as List? ?? [])
        .skip(offset)
        .take(limit)
        .toList();
    final list = raw.map<Playlist>((a) {
      final m = a as Map<String, dynamic>;
      return Playlist(
        id: '${m['id']}',
        name: m['name'] ?? '',
        trackCount: m['songCount'],
        coverId: m['coverArt'],
        sourceId: sourceId,
      );
    }).toList();
    return PagedList(list, (r['playlists']?['playlist'] as List? ?? []).length);
  }

  @override
  Future<PagedList<Track>> listTracks({int limit = 50, int offset = 0}) async {
    final r = await _call('getAlbumList2',
        {'type': 'alphabeticalByName', 'size': '$limit', 'offset': '$offset'});
    final raw = (r['albumList2']?['album'] as List? ?? []);
    final tracks = <Track>[];
    for (final a in raw) {
      final albumId = (a as Map<String, dynamic>)['id'] as String;
      final songs = await albumTracks(albumId, limit: limit, offset: 0);
      tracks.addAll(songs.list);
    }
    return PagedList(tracks, offset + tracks.length);
  }

  @override
  Future<PagedList<Track>> albumTracks(String albumId,
      {int limit = 9999, int offset = 0}) async {
    final r = await _call('getAlbum', {'id': albumId});
    final raw = (r['album']?['song'] as List? ?? [])
        .skip(offset)
        .take(limit)
        .toList();
    final list = raw.map<Track>((s) => _toTrack(s as Map<String, dynamic>)).toList();
    return PagedList(list, (r['album']?['song'] as List? ?? []).length);
  }

  @override
  Future<PagedList<Track>> artistTracks(String artistId,
      {int limit = 9999, int offset = 0}) async {
    final r = await _call('getArtist', {'id': artistId});
    final albums = (r['artist']?['album'] as List? ?? []);
    final tracks = <Track>[];
    for (final a in albums) {
      final albumId = (a as Map<String, dynamic>)['id'] as String;
      final songs = await albumTracks(albumId, limit: 9999, offset: 0);
      tracks.addAll(songs.list);
    }
    final start = offset.clamp(0, tracks.length);
    final end = (offset + limit).clamp(0, tracks.length);
    return PagedList(tracks.sublist(start, end), tracks.length);
  }

  @override
  Future<List<CollectionInfo>> collectionInfo(List<String> ids) async {
    final out = <CollectionInfo>[];
    for (final id in ids) {
      if (id.isEmpty) continue;
      try {
        final r = await _call('getAlbum', {'id': id});
        final m = r['album'] as Map<String, dynamic>;
        out.add(CollectionInfo(
          id: id,
          name: m['name'],
          artist: m['artist'],
          trackCount: (m['songCount'] as int?) ?? (m['song'] as List?)?.length,
          coverId: m['coverArt'],
        ));
      } catch (_) {
        out.add(CollectionInfo(id: id));
      }
    }
    return out;
  }

  @override
  Future<SearchResults> search(String query, {String? dir, int limit = 30}) async {
    final r = await _call('search3', {'query': query});
    final raw = r['searchResult3'];
    final tracks = ((raw?['song'] as List?) ?? [])
        .map<Track>((s) => _toTrack(s as Map<String, dynamic>))
        .take(limit)
        .toList();
    final albums = ((raw?['album'] as List?) ?? [])
        .map<Album>((a) {
          final m = a as Map<String, dynamic>;
          return Album(
            id: '${m['id']}',
            name: m['name'] ?? '',
            artist: m['artist'],
            coverId: m['coverArt'],
            sourceId: sourceId,
          );
        })
        .take((limit / 2).ceil())
        .toList();
    final artists = ((raw?['artist'] as List?) ?? [])
        .map<Artist>((a) {
          final m = a as Map<String, dynamic>;
          return Artist(
            id: '${m['id']}',
            name: m['name'] ?? '',
            coverId: m['coverArt'],
            sourceId: sourceId,
          );
        })
        .take((limit / 2).ceil())
        .toList();
    return SearchResults(tracks: tracks, albums: albums, artists: artists);
  }

  @override
  Future<String?> lyric(String trackId) async {
    try {
      final r = await _call('getLyrics', {'id': trackId});
      return r['lyrics']?['value'] as String?;
    } catch (_) {
      return null;
    }
  }

  @override
  Future<UpstreamRef> resolveStream(String trackId) async =>
      UpstreamRef(url: _streamUrl(trackId));

  @override
  Future<UpstreamRef?> resolveCover(String? coverId) async {
    final url = _coverUrl(coverId);
    return url.isEmpty ? null : UpstreamRef(url: url);
  }

  @override
  Future<void> forceRefresh() async {}

  @override
  void dispose() => _client.close();

  Track _toTrack(Map<String, dynamic> m) => Track(
        id: '${m['id']}',
        title: m['title'],
        artist: m['artist'],
        album: m['album'],
        trackNo: m['track'] is int ? m['track'] : int.tryParse('${m['track'] ?? ''}'),
        duration: (m['duration'] is int ? m['duration'] as int : 0) * 1000,
        sourceId: sourceId,
        coverId: m['coverArt'],
        size: m['size'],
        mime: m['contentType'],
      );
}
