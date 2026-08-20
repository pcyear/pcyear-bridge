import 'package:flutter/material.dart';
import 'package:pcyear_bridge/presentation/providers/favorites_provider.dart';
import 'package:pcyear_bridge/presentation/navigation.dart';
import 'package:pcyear_bridge/presentation/widgets/track_list_tile.dart';
import 'package:provider/provider.dart';

/// 收藏页。对齐插件：列表播放 + 长按进入多选 + 批量「移出收藏」。
/// 批量操作栏默认隐藏，选中一首后才出现（与插件行为一致）。
class FavoritesTab extends StatefulWidget {
  const FavoritesTab({super.key});

  @override
  State<FavoritesTab> createState() => _FavoritesTabState();
}

class _FavoritesTabState extends State<FavoritesTab> {
  final Set<String> _selected = {};
  bool _selecting = false;

  void _exitSelect() {
    setState(() {
      _selecting = false;
      _selected.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final fav = context.watch<FavoritesProvider>();
    final list = fav.favorites;

    if (list.isEmpty) {
      return const Center(child: Text('还没有收藏的歌曲'));
    }

    return Column(
      children: [
        if (_selecting) _buildBatchBar(context, fav, list.length),
        Expanded(
          child: ListView.builder(
            itemCount: list.length,
            itemBuilder: (_, i) {
              final t = list[i];
              if (_selecting) {
                final checked = _selected.contains(t.id);
                return ListTile(
                  leading: Checkbox(
                    value: checked,
                    onChanged: (v) => setState(() {
                      if (v == true) {
                        _selected.add(t.id);
                      } else {
                        _selected.remove(t.id);
                      }
                    }),
                  ),
                  title: Text(t.displayTitle,
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: t.artist != null && t.artist!.isNotEmpty
                      ? Text(t.artist!,
                          maxLines: 1, overflow: TextOverflow.ellipsis)
                      : null,
                  onTap: () => setState(() {
                    if (checked) {
                      _selected.remove(t.id);
                    } else {
                      _selected.add(t.id);
                    }
                  }),
                );
              }
              return GestureDetector(
                onLongPress: () => setState(() {
                  _selecting = true;
                  _selected.add(t.id);
                }),
                child: TrackListTile(
                  track: t,
                  onTap: () => playAndOpen(context, list, i, t.sourceId),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildBatchBar(
      BuildContext context, FavoritesProvider fav, int total) {
    final allSelected = _selected.length == total;
    return Material(
      color: Theme.of(context).colorScheme.secondaryContainer,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(
          children: [
            TextButton(
              onPressed: () => setState(() {
                if (allSelected) {
                  _selected.clear();
                } else {
                  _selected
                    ..clear()
                    ..addAll(fav.favorites.map((t) => t.id));
                }
              }),
              child: Text(allSelected ? '取消全选' : '全选'),
            ),
            Text('已选 ${_selected.length}'),
            const Spacer(),
            TextButton.icon(
              onPressed: _selected.isEmpty
                  ? null
                  : () async {
                      await fav.removeMany(_selected);
                      _exitSelect();
                    },
              icon: const Icon(Icons.heart_broken, size: 18),
              label: const Text('移出收藏'),
            ),
            IconButton(
              tooltip: '退出多选',
              icon: const Icon(Icons.close),
              onPressed: _exitSelect,
            ),
          ],
        ),
      ),
    );
  }
}
