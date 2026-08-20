import 'package:flutter/material.dart';
import 'package:pcyear_bridge/presentation/navigation.dart';
import 'package:pcyear_bridge/presentation/providers/library_provider.dart';
import 'package:pcyear_bridge/presentation/screens/favorites_screen.dart';
import 'package:pcyear_bridge/presentation/widgets/track_list_tile.dart';
import 'package:provider/provider.dart';

/// 乐库：专辑 / 艺术家 / 曲目 三个标签页，各自懒加载 + 下拉刷新。
class LibraryScreen extends StatelessWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('乐库'),
          bottom: const TabBar(isScrollable: true, tabs: [
            Tab(text: '专辑'),
            Tab(text: '艺术家'),
            Tab(text: '曲目'),
            Tab(text: '收藏'),
          ]),
        ),
        body: const TabBarView(children: [
          _AlbumTab(),
          _ArtistTab(),
          _TrackTab(),
          FavoritesTab(),
        ]),
      ),
    );
  }
}

/// 各标签页共用的加载骨架：首次进入触发加载，支持下拉刷新。
class _LazyTab extends StatefulWidget {
  final Future<void> Function(LibraryProvider lp, {bool force}) loader;
  final Widget Function(BuildContext context, LibraryProvider lp) builder;
  final bool Function(LibraryProvider lp) isLoading;

  const _LazyTab({
    required this.loader,
    required this.builder,
    required this.isLoading,
  });

  @override
  State<_LazyTab> createState() => _LazyTabState();
}

class _LazyTabState extends State<_LazyTab>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      widget.loader(context.read<LibraryProvider>());
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final lp = context.watch<LibraryProvider>();
    return RefreshIndicator(
      onRefresh: () => widget.loader(lp, force: true),
      child: widget.isLoading(lp)
          ? const Center(child: CircularProgressIndicator())
          : widget.builder(context, lp),
    );
  }
}

/// 列表为空时也要能下拉刷新，所以用可滚动容器承载空态文案
Widget _emptyView(String text) => LayoutBuilder(
      builder: (_, c) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: SizedBox(
          height: c.maxHeight,
          child: Center(child: Text(text)),
        ),
      ),
    );

class _AlbumTab extends StatelessWidget {
  const _AlbumTab();

  @override
  Widget build(BuildContext context) {
    return _LazyTab(
      loader: (lp, {bool force = false}) => lp.loadAlbums(force: force),
      isLoading: (lp) => lp.loadingAlbums && lp.albums.isEmpty,
      builder: (ctx, lp) {
        if (lp.albums.isEmpty) return _emptyView('暂无专辑，请先添加音源');
        return ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          itemCount: lp.albums.length,
          itemBuilder: (_, i) {
            final a = lp.albums[i];
            return ListTile(
              leading: const Icon(Icons.album),
              title: Text(a.name),
              subtitle: a.artist != null && a.artist!.isNotEmpty
                  ? Text(a.artist!)
                  : null,
              onTap: () => openCollection(
                ctx,
                sourceId: a.sourceId,
                id: a.id,
                title: a.name,
                isArtist: false,
              ),
            );
          },
        );
      },
    );
  }
}

class _ArtistTab extends StatelessWidget {
  const _ArtistTab();

  @override
  Widget build(BuildContext context) {
    return _LazyTab(
      loader: (lp, {bool force = false}) => lp.loadArtists(force: force),
      isLoading: (lp) => lp.loadingArtists && lp.artists.isEmpty,
      builder: (ctx, lp) {
        if (lp.artists.isEmpty) return _emptyView('暂无艺术家，请先添加音源');
        return ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          itemCount: lp.artists.length,
          itemBuilder: (_, i) {
            final ar = lp.artists[i];
            return ListTile(
              leading: const Icon(Icons.person),
              title: Text(ar.name),
              onTap: () => openCollection(
                ctx,
                sourceId: ar.sourceId,
                id: ar.id,
                title: ar.name,
                isArtist: true,
              ),
            );
          },
        );
      },
    );
  }
}

class _TrackTab extends StatelessWidget {
  const _TrackTab();

  @override
  Widget build(BuildContext context) {
    return _LazyTab(
      loader: (lp, {bool force = false}) => lp.loadTracks(force: force),
      isLoading: (lp) => lp.loadingTracks && lp.tracks.isEmpty,
      builder: (ctx, lp) {
        if (lp.tracks.isEmpty) return _emptyView('暂无曲目，请先添加音源');
        final tracks = lp.tracks;
        return ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          itemCount: tracks.length,
          itemBuilder: (_, i) => TrackListTile(
            track: tracks[i],
            onTap: () => playAndOpen(ctx, tracks, i, tracks[i].sourceId),
          ),
        );
      },
    );
  }
}
