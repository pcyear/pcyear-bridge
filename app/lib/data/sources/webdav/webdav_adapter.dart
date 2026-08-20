import 'package:pcyear_bridge/core/models.dart';
import 'package:pcyear_bridge/data/sources/source_adapter.dart';
import 'package:pcyear_bridge/data/sources/webdav/webdav_cache.dart';
import 'package:pcyear_bridge/data/sources/webdav/webdav_client.dart';
import 'package:pcyear_bridge/data/sources/webdav/webdav_metadata.dart';
import 'package:pcyear_bridge/data/sources/webdav/webdav_models.dart';

const int _countPropfindMs = 3000;
const int _countBudgetMs = 5000;
const int _countMaxFiles = 3000;
const int _countMaxDepth = 5;
const int _scanMaxFiles = 5000;
const int _scanMaxDepth = 12;

/// WebDAV 适配器：坚果云 / Nextcloud / Alist / Synology / IIS 等。
/// 行为对齐插件 `src/adapters/webdav/adapter.ts`。
class WebDavAdapter implements SourceAdapter {
  @override
  final SourceType type = SourceType.webdav;
  @override
  final String sourceId;

  final WebDavClient client;
  final WebDavMetadata meta;
  final WebDavCache cache;

  WebDavAdapter(SourceConfig cfg)
      : sourceId = cfg.id,
        client = WebDavClient(cfg),
        meta = WebDavMetadata(cfg.id, _rootsFrom(cfg)),
        cache = WebDavCache();

  static List<String> _rootsFrom(SourceConfig cfg) {
    final raw = cfg.extra['rootPaths'];
    if (raw is List && raw.isNotEmpty) return raw.map((e) => e as String).toList();
    if (cfg.extra['rootPath'] != null && (cfg.extra['rootPath'] as String).isNotEmpty) {
      return [cfg.extra['rootPath'] as String];
    }
    return const ['/'];
  }

  @override
  Future<void> testConnection() async {
    await client.propfind(client.basePath);
  }

  @override
  Future<List<DirEntry>> listDirectories(String? path) async {
    final base = (path != null && path.trim().isNotEmpty)
        ? WebDavClient.normalize(path.trim())
        : client.rootList.firstOrEmpty;
    final entries = await client.propfind(base);
    return entries.where((e) => e.isDir).map((e) => DirEntry(path: e.href, name: e.name)).toList();
  }

  @override
  Future<int> countSongsIn(String path) async {
    final base = path.trim().isNotEmpty
        ? WebDavClient.normalize(path.trim())
        : client.rootList.first; // rootList 不会空
    final deadline = DateTime.now().add(const Duration(milliseconds: _countBudgetMs));
    final queue = <(String, int)>[(base, 0)];
    int total = 0;
    while (queue.isNotEmpty) {
      if (DateTime.now().isAfter(deadline)) break;
      if (total >= _countMaxFiles) break;
      final (cur, depth) = queue.removeAt(0);
      List<DavEntry> entries;
      try {
        entries = await client.propfind(cur, timeoutMs: _countPropfindMs);
      } catch (_) {
        continue;
      }
      for (final e in entries) {
        if (e.isDir) {
          if (depth < _countMaxDepth) queue.add((e.href, depth + 1));
        } else if (meta.isAudio(e.name)) {
          total++;
        }
      }
    }
    return total;
  }

  Future<List<DavEntry>> _listDir(String absPath) async {
    final key = WebDavClient.normalize(absPath.isEmpty ? '/' : absPath);
    final hit = cache.getDir(key);
    if (hit != null) return hit;
    List<DavEntry> entries;
    try {
      entries = await client.propfind(key);
    } catch (_) {
      entries = [];
    }
    cache.setDir(key, entries);
    return entries;
  }

  Future<List<Track>> _tracksInDir(String root, String rel) async {
    final entries = await _listDir(meta.absUnder(root, rel));
    final out = <Track>[];
    for (final e in entries) {
      if (!e.isDir && meta.isAudio(e.name)) out.add(meta.fileToTrack(e, root));
    }
    return out;
  }

  Future<List<String>> _subDirs(String root, String rel) async {
    final entries = await _listDir(meta.absUnder(root, rel));
    return entries.where((e) => e.isDir).map((e) => e.name).toList();
  }

  static Future<List<R>> _mapLimit<T, R>(
      List<T> items, int limit, Future<R> Function(T) fn) async {
    final out = List<R?>.filled(items.length, null);
    int i = 0;
    final n = limit < items.length ? limit : items.length;
    final workers = List.generate(n, (_) async {
      while (i < items.length) {
        final idx = i++;
        try {
          out[idx] = await fn(items[idx]);
        } catch (_) {
          out[idx] = null;
        }
      }
    });
    await Future.wait(workers);
    return out.whereType<R>().toList();
  }

  @override
  Future<PagedList<Album>> listAlbums({int limit = 50, int offset = 0}) async {
    final out = <Album>[];
    for (final root in client.rootList) {
      final top = await _listDir(meta.absUnder(root, ''));
      if (top.any((e) => !e.isDir && meta.isAudio(e.name))) {
        out.add(Album(id: meta.mkId(root, ''), name: '未知专辑', sourceId: sourceId));
      }
      final topDirs = top.where((e) => e.isDir).map((e) => e.name).toList();
      final infos = await _mapLimit(topDirs, 6, (d) async {
        final entries = await _listDir(meta.absUnder(root, d));
        return (
          dirs: entries.where((e) => e.isDir).map((e) => e.name).toList(),
          hasAudio: entries.any((e) => !e.isDir && meta.isAudio(e.name)),
        );
      });
      for (final it in infos) {
        if (it == null) continue;
        for (final sub in it.dirs) {
          out.add(Album(id: meta.mkId(root, '$d/$sub'), name: sub, sourceId: sourceId));
        }
        if (it.hasAudio) {
          out.add(Album(id: meta.mkId(root, d), name: d, sourceId: sourceId));
        }
      }
    }
    out.sort((a, b) => a.name.compareTo(b.name));
    final end = (offset + limit).clamp(0, out.length);
    return PagedList(out.sublist(offset.clamp(0, out.length), end), out.length);
  }

  @override
  Future<PagedList<Artist>> listArtists({int limit = 50, int offset = 0}) async {
    final out = <Artist>[];
    for (final root in client.rootList) {
      final top = await _listDir(meta.absUnder(root, ''));
      if (top.any((e) => !e.isDir && meta.isAudio(e.name))) {
        out.add(Artist(id: meta.mkId(root, ''), name: '未知艺术家', sourceId: sourceId));
      }
      for (final e in top) {
        if (e.isDir) {
          out.add(Artist(id: meta.mkId(root, e.name), name: e.name, sourceId: sourceId));
        }
      }
    }
    out.sort((a, b) => a.name.compareTo(b.name));
    final end = (offset + limit).clamp(0, out.length);
    return PagedList(out.sublist(offset.clamp(0, out.length), end), out.length);
  }

  @override
  Future<PagedList<Playlist>> listPlaylists({int limit = 50, int offset = 0}) =>
      Future.value(const PagedList([], 0));

  @override
  Future<PagedList<Track>> listTracks({int limit = 50, int offset = 0}) async {
    final all = await _scan();
    final end = (offset + limit).clamp(0, all.length);
    return PagedList(all.sublist(offset.clamp(0, all.length), end), all.length);
  }

  /// 有界 BFS 全量扫描（列表/搜索用）。超大库受 _scanMaxFiles 上限保护。
  Future<List<Track>> _scan() async {
    final all = <Track>[];
    final queue = <(String, int, String)>[];
    for (final root in client.rootList) {
      queue.add((meta.absUnder(root, ''), 0, root));
    }
    while (queue.isNotEmpty) {
      if (all.length >= _scanMaxFiles) break;
      final (cur, depth, root) = queue.removeAt(0);
      List<DavEntry> entries;
      try {
        entries = await client.propfind(cur);
      } catch (_) {
        continue;
      }
      for (final e in entries) {
        if (e.isDir) {
          if (depth < _scanMaxDepth) queue.add((e.href, depth + 1, root));
        } else if (meta.isAudio(e.name)) {
          all.add(meta.fileToTrack(e, root));
        }
      }
    }
    return all;
  }

  @override
  Future<PagedList<Track>> albumTracks(String albumId,
      {int limit = 9999, int offset = 0}) async {
    final (root, rel) = meta.parseCollectionId(albumId);
    var list = await _tracksInDir(root, rel);
    if (list.isEmpty) {
      final dirs = await _subDirs(root, rel);
      if (dirs.isNotEmpty) {
        final nested = await _mapLimit(
            dirs, 6, (d) => _tracksInDir(root, rel.isNotEmpty ? '$rel/$d' : d));
        list = nested.expand((e) => e).toList();
      }
    }
    list.sort((a, b) =>
        (a.trackNo ?? 0).compareTo(b.trackNo ?? 0) ||
        (a.title ?? '').compareTo(b.title ?? ''));
    final end = (offset + limit).clamp(0, list.length);
    return PagedList(list.sublist(offset.clamp(0, list.length), end), list.length);
  }

  @override
  Future<PagedList<Track>> artistTracks(String artistId,
      {int limit = 9999, int offset = 0}) async {
    final (root, rel) = meta.parseCollectionId(artistId);
    final direct = await _tracksInDir(root, rel);
    final dirs = await _subDirs(root, rel);
    final nested = await _mapLimit(
        dirs, 6, (d) => _tracksInDir(root, rel.isNotEmpty ? '$rel/$d' : d));
    final list = [...direct, ...nested.expand((e) => e)];
    list.sort((a, b) =>
        (a.album ?? '').compareTo(b.album ?? '') ||
        (a.trackNo ?? 0).compareTo(b.trackNo ?? 0) ||
        (a.title ?? '').compareTo(b.title ?? ''));
    final end = (offset + limit).clamp(0, list.length);
    return PagedList(list.sublist(offset.clamp(0, list.length), end), list.length);
  }

  @override
  Future<List<CollectionInfo>> collectionInfo(List<String> ids) async {
    final unique = ids.where((s) => s.isNotEmpty).toSet().toList();
    return _mapLimit(unique, 4, (id) async {
      final cached = cache.getCollectionInfo(id);
      if (cached != null) return cached;
      final (root, rel) = meta.parseCollectionId(id);
      final entries = await _listDir(meta.absUnder(root, rel));
      final segs = rel.split('/').where((s) => s.isNotEmpty).toList();
      final name = segs.isNotEmpty ? segs.last : '';
      final parent = segs.length >= 2 ? segs[segs.length - 2] : '';
      final audioCount = entries.where((e) => !e.isDir && meta.isAudio(e.name)).length;
      final subDirs = entries.where((e) => e.isDir).map((e) => e.name).toList();
      final isAlbum = rel.isNotEmpty && subDirs.isEmpty && audioCount > 0;
      int trackCount;
      if (isAlbum || subDirs.isEmpty) {
        trackCount = audioCount;
      } else if (subDirs.length <= 20) {
        try {
          final deep = await client.propfindDeep(meta.absUnder(root, rel));
          trackCount = deep.where((e) => !e.isDir && meta.isAudio(e.name)).length;
        } catch (_) {
          trackCount = audioCount;
        }
      } else {
        trackCount = audioCount;
      }
      final result = CollectionInfo(
        id: id,
        name: name,
        artist: isAlbum && parent.isNotEmpty ? parent : null,
        trackCount: trackCount > 0 ? trackCount : null,
        albumCount: subDirs.isNotEmpty ? subDirs.length : null,
        coverId: id,
      );
      cache.setCollectionInfo(id, result);
      return result;
    });
  }

  @override
  Future<SearchResults> search(String query, {String? dir, int limit = 30}) async {
    final all = await _scan();
    final q = query.toLowerCase();
    final scope = <Track>[];
    if (dir != null && dir.trim().isNotEmpty) {
      final (root, rel) = meta.parseCollectionId(dir);
      final prefix = rel.isNotEmpty ? '$rel/' : '';
      scope.addAll(all.where((t) =>
          (t.id).startsWith(prefix) || t.id == rel));
    } else {
      scope.addAll(all);
    }
    final tracks = scope.where((t) {
      final hay = '${t.title ?? ''} ${t.artist ?? ''} ${t.album ?? ''}'.toLowerCase();
      return hay.contains(q);
    }).take(limit).toList();

    ({String artistName, String albumName, String artistId, String albumId})? derive(Track t) {
      final (root, rel) = meta.parseCollectionId(t.id);
      final segs = rel.split('/').where((s) => s.isNotEmpty).toList();
      if (segs.isEmpty) return null;
      final artistMeta = (t.artist != null && t.artist!.trim().isNotEmpty && t.artist!.trim() != '未知艺术家')
          ? t.artist!.trim()
          : '';
      final albumMeta = (t.album != null && t.album!.trim().isNotEmpty && t.album!.trim() != '未知专辑')
          ? t.album!.trim()
          : '';
      if (segs.length == 1) {
        return (
          artistName: artistMeta.isNotEmpty ? artistMeta : '未知艺术家',
          albumName: albumMeta.isNotEmpty ? albumMeta : '未知专辑',
          artistId: meta.mkId(root, ''),
          albumId: meta.mkId(root, ''),
        );
      }
      final top = segs.first;
      final parent = segs.sublist(0, segs.length - 1).join('/');
      return (
        artistName: artistMeta.isNotEmpty ? artistMeta : top,
        albumName: albumMeta.isNotEmpty ? albumMeta : parent,
        artistId: meta.mkId(root, top),
        albumId: meta.mkId(root, parent),
      );
    }

    final albumCnt = <String, int>{};
    final artistCnt = <String, int>{};
    for (final t in scope) {
      final d = derive(t);
      if (d != null) {
        artistCnt[d.artistName] = (artistCnt[d.artistName] ?? 0) + 1;
        albumCnt[d.albumName] = (albumCnt[d.albumName] ?? 0) + 1;
      }
    }
    final albumMap = <String, Album>{};
    final artistMap = <String, Artist>{};
    final hitIds = scope.where((t) => tracks.contains(t)).toSet();
    for (final t in scope) {
      final d = derive(t);
      if (d == null) continue;
      final byTrack = hitIds.contains(t);
      final albumHit = d.albumName.toLowerCase().contains(q);
      final artistHit = d.artistName.toLowerCase().contains(q);
      if ((albumHit || byTrack) && !albumMap.containsKey(d.albumName)) {
        albumMap[d.albumName] = Album(
          id: d.albumId,
          name: d.albumName,
          artist: d.artistName,
          trackCount: albumCnt[d.albumName] ?? 0,
          coverId: d.albumId,
          sourceId: sourceId,
        );
      }
      if ((artistHit || byTrack) && !artistMap.containsKey(d.artistName)) {
        artistMap[d.artistName] = Artist(
          id: d.artistId,
          name: d.artistName,
          trackCount: artistCnt[d.artistName] ?? 0,
          coverId: d.artistId,
          sourceId: sourceId,
        );
      }
    }
    final half = (limit / 2).ceil().clamp(5, limit);
    return SearchResults(
      tracks: tracks,
      albums: albumMap.values.take(half).toList(),
      artists: artistMap.values.take(half).toList(),
    );
  }

  @override
  Future<String?> lyric(String trackId) async {
    final dot = trackId.lastIndexOf('.');
    final lrcRel = (dot > 0 ? trackId.substring(0, dot) : trackId) + '.lrc';
    final url = client.fullUrl(meta.absOf(lrcRel));
    return client.getText(url);
  }

  @override
  Future<UpstreamRef> resolveStream(String trackId) async {
    return UpstreamRef(
      url: client.fullUrl(meta.absOf(trackId)),
      headers: {'Authorization': client.auth},
    );
  }

  @override
  Future<UpstreamRef?> resolveCover(String? coverId) async {
    if (coverId == null || coverId.isEmpty) return null;
    final (root, rel) = meta.parseCollectionId(coverId);
    final dirRel = rel.contains('/') ? rel.substring(0, rel.lastIndexOf('/')) : '';
    final entries = await _listDir(meta.absUnder(root, dirRel));
    final imgs = entries.where((e) => !e.isDir && meta.isImage(e.name)).toList();
    if (imgs.isEmpty) return null;
    const preferred = ['cover', 'folder', 'front', 'album', 'artwork'];
    imgs.sort((a, b) {
      int score(String n) {
        final base = n.replaceAll(RegExp(r'\.[^.]+$'), '').toLowerCase();
        final i = preferred.indexWhere((p) => base.contains(p));
        return i < 0 ? 999 : i;
      }

      return score(a.name).compareTo(score(b.name));
    });
    final chosen = imgs.first;
    final abs = meta.absUnder(root, dirRel.isNotEmpty ? '$dirRel/${chosen.name}' : chosen.name);
    return UpstreamRef(
      url: client.fullUrl(abs),
      headers: {'Authorization': client.auth},
    );
  }

  @override
  Future<void> forceRefresh() async {
    cache.clearDirs();
    cache.clearCollections();
  }

  @override
  void dispose() {
    cache.dispose();
    client.close();
  }
}
