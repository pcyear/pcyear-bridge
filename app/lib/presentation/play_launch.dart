import 'package:flutter/material.dart';
import 'package:pcyear_bridge/core/models.dart';
import 'package:pcyear_bridge/data/player/audio_player_service.dart';
import 'package:pcyear_bridge/presentation/screens/player_screen.dart';
import 'package:provider/provider.dart';

/// 以 [tracks] 为队列从 [index] 开始播放，并进入播放详情页。
///
/// 单独成叶子模块（不依赖任何页面），用于打断
/// `navigation ↔ collection_tracks_screen` 的循环 import：
/// `collection_tracks_screen` 仅需 `playAndOpen`，从本文件取即可，
/// 不必再依赖 `navigation`（后者又依赖 `collection_tracks_screen`）。
void playAndOpen(
    BuildContext context, List<Track> tracks, int index, String? sourceId) {
  context
      .read<AudioPlayerService>()
      .playQueue(tracks, startIndex: index, sourceId: sourceId);
  Navigator.push(
    context,
    MaterialPageRoute(builder: (_) => const PlayerScreen()),
  );
}
