import 'package:flutter/material.dart';
import 'package:pcyear_bridge/core/models.dart';
import 'package:pcyear_bridge/presentation/navigation.dart';
import 'package:pcyear_bridge/presentation/providers/library_provider.dart';
import 'package:pcyear_bridge/presentation/widgets/track_list_tile.dart';
import 'package:provider/provider.dart';

/// 跨音源搜索：曲目 / 专辑 / 艺术家。
/// 与插件口径一致——WebDAV 的艺术家/专辑由目录结构推导，而非音频标签。
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _c = TextEditingController();
  SearchResults? _res;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  Future<void> _doSearch() async {
    final q = _c.text.trim();
    if (q.isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await context.read<LibraryProvider>().search(q);
      if (!mounted) return;
      setState(() {
        _res = r;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('搜索')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _c,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                labelText: '搜索曲目 / 专辑 / 艺术家',
                suffixIcon: IconButton(
                    icon: const Icon(Icons.search), onPressed: _doSearch),
              ),
              onSubmitted: (_) => _doSearch(),
            ),
          ),
          if (_loading) const LinearProgressIndicator(),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text('搜索失败：$_error'),
            ),
          if (_res != null) Expanded(child: _buildResults(_res!)),
        ],
      ),
    );
  }

  Widget _buildResults(SearchResults r) {
    if (r.tracks.isEmpty && r.albums.isEmpty && r.artists.isEmpty) {
      return const Center(child: Text('没有找到匹配的内容'));
    }
    return ListView(
      children: [
        if (r.tracks.isNotEmpty) const _SectionHeader('曲目'),
        ...r.tracks.asMap().entries.map(
              (e) => TrackListTile(
                track: e.value,
                onTap: () =>
                    playAndOpen(context, r.tracks, e.key, e.value.sourceId),
              ),
            ),
        if (r.albums.isNotEmpty) const _SectionHeader('专辑'),
        ...r.albums.map(
          (a) => ListTile(
            leading: const Icon(Icons.album),
            title: Text(a.name),
            subtitle:
                a.artist != null && a.artist!.isNotEmpty ? Text(a.artist!) : null,
            onTap: () => _open(a.sourceId, a.id, a.name, false),
          ),
        ),
        if (r.artists.isNotEmpty) const _SectionHeader('艺术家'),
        ...r.artists.map(
          (ar) => ListTile(
            leading: const Icon(Icons.person),
            title: Text(ar.name),
            onTap: () => _open(ar.sourceId, ar.id, ar.name, true),
          ),
        ),
      ],
    );
  }

  void _open(String? sourceId, String id, String title, bool isArtist) =>
      openCollection(context,
          sourceId: sourceId, id: id, title: title, isArtist: isArtist);
}

class _SectionHeader extends StatelessWidget {
  final String text;
  const _SectionHeader(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
      child: Text(text,
          style: Theme.of(context)
              .textTheme
              .titleSmall
              ?.copyWith(fontWeight: FontWeight.bold)),
    );
  }
}
