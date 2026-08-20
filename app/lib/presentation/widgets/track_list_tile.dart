import 'package:flutter/material.dart';
import 'package:pcyear_bridge/core/models.dart';
import 'package:pcyear_bridge/presentation/providers/favorites_provider.dart';
import 'package:provider/provider.dart';

/// 曲目行：标题 / 歌手·专辑 / 收藏按钮 / 点击播放。
class TrackListTile extends StatelessWidget {
  final Track track;
  final VoidCallback? onTap;

  const TrackListTile({super.key, required this.track, this.onTap});

  @override
  Widget build(BuildContext context) {
    final fav = context.watch<FavoritesProvider>();
    final subtitle = [track.artist, track.album]
        .where((s) => s != null && s!.isNotEmpty)
        .join(' · ');
    return ListTile(
      leading: const Icon(Icons.music_note),
      title: Text(track.displayTitle,
          maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: subtitle.isNotEmpty
          ? Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis)
          : null,
      trailing: IconButton(
        icon: Icon(fav.isFavorite(track.id)
            ? Icons.favorite
            : Icons.favorite_border),
        onPressed: () => fav.toggle(track),
      ),
      onTap: onTap,
    );
  }
}
