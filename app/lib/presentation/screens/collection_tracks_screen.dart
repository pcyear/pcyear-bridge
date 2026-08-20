import 'package:flutter/material.dart';
import 'package:pcyear_bridge/core/models.dart';
import 'package:pcyear_bridge/presentation/play_launch.dart';
import 'package:pcyear_bridge/presentation/providers/library_provider.dart';
import 'package:pcyear_bridge/presentation/widgets/track_list_tile.dart';
import 'package:provider/provider.dart';

/// 专辑 / 艺术家详情：加载曲目并支持播放。
///
/// 用 StatefulWidget 缓存 Future，避免 rebuild 时重复发起网络请求
/// （FutureBuilder 直接写 `future: fn()` 是常见性能陷阱）。
class CollectionTracksPage extends StatefulWidget {
  final String sourceId;
  final String collectionId;
  final String title;
  final bool isArtist;

  const CollectionTracksPage({
    super.key,
    required this.sourceId,
    required this.collectionId,
    required this.title,
    this.isArtist = false,
  });

  @override
  State<CollectionTracksPage> createState() => _CollectionTracksPageState();
}

class _CollectionTracksPageState extends State<CollectionTracksPage> {
  late Future<List<Track>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Track>> _load() {
    final lp = context.read<LibraryProvider>();
    return widget.isArtist
        ? lp.artistTracks(widget.sourceId, widget.collectionId)
        : lp.albumTracks(widget.sourceId, widget.collectionId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          IconButton(
            tooltip: '刷新',
            icon: const Icon(Icons.refresh),
            onPressed: () => setState(() => _future = _load()),
          ),
        ],
      ),
      body: FutureBuilder<List<Track>>(
        future: _future,
        builder: (ctx, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text('加载失败：${snap.error}'),
              ),
            );
          }
          final tracks = snap.data ?? const <Track>[];
          if (tracks.isEmpty) {
            return const Center(child: Text('该目录下没有音频文件'));
          }
          return ListView.builder(
            itemCount: tracks.length,
            itemBuilder: (_, i) => TrackListTile(
              track: tracks[i],
              onTap: () => playAndOpen(ctx, tracks, i, widget.sourceId),
            ),
          );
        },
      ),
    );
  }
}
