import 'package:flutter/material.dart';
import 'package:pcyear_bridge/core/models.dart';
import 'package:pcyear_bridge/data/player/audio_player_service.dart';
import 'package:pcyear_bridge/presentation/providers/favorites_provider.dart';
import 'package:provider/provider.dart';

/// 播放详情页：进度控制、上一首/下一首、倍速、播放模式、音量、收藏、
/// 歌词（高亮 + 自动滚动）、播放列表。功能口径对齐插件的播放详情页。
class PlayerScreen extends StatefulWidget {
  const PlayerScreen({super.key});

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  List<LyricLine>? _lyrics;
  bool _lyricLoading = false;
  String? _lyricTrackId; // 已加载歌词对应的曲目，用于切歌时重新拉取

  double? _dragValue; // 拖动进度条时的临时值
  final ScrollController _lyricScroll = ScrollController();

  /// 当前高亮行。用 ValueNotifier 而非 setState：
  /// 进度每秒变化数次，只让歌词列表局部重建，不牵动整页。
  final ValueNotifier<int> _lyricIdx = ValueNotifier<int>(-1);

  static const double _lyricLineHeight = 34;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncLyric());
  }

  @override
  void dispose() {
    _lyricScroll.dispose();
    _lyricIdx.dispose();
    super.dispose();
  }

  /// 曲目变化时重新加载歌词
  Future<void> _syncLyric() async {
    if (!mounted) return;
    final player = context.read<AudioPlayerService>();
    final t = player.current;
    if (t == null) return;
    if (_lyricTrackId == t.id) return;
    _lyricTrackId = t.id;

    final sid = t.sourceId;
    final adapter = sid == null ? null : player.repository?.adapter(sid);
    if (adapter == null) {
      setState(() => _lyrics = []);
      return;
    }
    setState(() {
      _lyricLoading = true;
      _lyrics = null;
    });
    _lyricIdx.value = -1;
    try {
      final text = await adapter.lyric(t.id);
      if (!mounted) return;
      setState(() {
        _lyrics = text != null ? parseLrc(text) : <LyricLine>[];
        _lyricLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _lyrics = <LyricLine>[];
        _lyricLoading = false;
      });
    }
  }

  /// 解析 LRC。支持 [mm:ss.xx] / [mm:ss.xxx]，以及一行多时间标签。
  static List<LyricLine> parseLrc(String text) {
    final lines = <LyricLine>[];
    final tagRe = RegExp(r'\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]');
    for (final raw in text.split(RegExp(r'\r?\n'))) {
      final tags = tagRe.allMatches(raw).toList();
      if (tags.isEmpty) continue;
      final content = raw.substring(tags.last.end).trim();
      if (content.isEmpty) continue;
      for (final m in tags) {
        final min = int.parse(m.group(1)!);
        final sec = double.parse(m.group(2)!.replaceAll(':', '.'));
        // 保留毫秒精度：先算总毫秒再取整，而不是先把秒四舍五入
        final ms = ((min * 60 + sec) * 1000).round();
        lines.add(LyricLine(Duration(milliseconds: ms), content));
      }
    }
    lines.sort((a, b) => a.time.compareTo(b.time));
    return lines;
  }

  int _indexOfLyric(Duration pos) {
    final ls = _lyrics;
    if (ls == null || ls.isEmpty) return -1;
    int lo = 0, hi = ls.length - 1, ans = -1;
    while (lo <= hi) {
      final mid = (lo + hi) >> 1;
      if (ls[mid].time <= pos) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  }

  void _autoScrollLyric(int i) {
    if (i < 0 || !_lyricScroll.hasClients) return;
    final target = (i * _lyricLineHeight - 80)
        .clamp(0.0, _lyricScroll.position.maxScrollExtent);
    _lyricScroll.animateTo(target,
        duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
  }

  String _fmt(Duration d) {
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final player = context.watch<AudioPlayerService>();
    final t = player.current;

    // 切歌后同步歌词（build 期间不能直接 setState，放到帧后）
    if (t != null && t.id != _lyricTrackId) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _syncLyric());
    }

    if (t == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('正在播放')),
        body: const Center(child: Text('没有正在播放的曲目')),
      );
    }

    final subtitle =
        [t.artist, t.album].where((s) => s != null && s!.isNotEmpty).join(' · ');
    final fav = context.watch<FavoritesProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('正在播放'),
        actions: [
          IconButton(
            tooltip: '播放列表',
            icon: const Icon(Icons.queue_music),
            onPressed: () => _showQueue(context, player),
          ),
          IconButton(
            tooltip: '收藏',
            icon: Icon(
                fav.isFavorite(t.id) ? Icons.favorite : Icons.favorite_border),
            onPressed: () => fav.toggle(t),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text(t.displayTitle,
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
            if (subtitle.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child:
                    Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
              ),
            const SizedBox(height: 16),
            _buildProgress(player),
            _buildTransport(player),
            const SizedBox(height: 4),
            _buildSecondaryControls(player),
            const Divider(height: 24),
            Expanded(child: _buildLyric()),
          ],
        ),
      ),
    );
  }

  Widget _buildProgress(AudioPlayerService player) {
    return StreamBuilder<Duration>(
      stream: player.positionStream,
      builder: (ctx, snap) {
        final dur = player.duration ?? Duration.zero;
        final maxMs = dur.inMilliseconds.toDouble();
        final posMs = (snap.data ?? player.position).inMilliseconds.toDouble();
        final value = (_dragValue ?? posMs).clamp(0.0, maxMs > 0 ? maxMs : 1.0);

        // 播放位置变化时推进歌词高亮。
        // 注意：不能在 build 期间直接改 ValueNotifier（会触发
        // "markNeedsBuild called during build"），统一放到帧后。
        final li = _indexOfLyric(Duration(milliseconds: posMs.toInt()));
        if (li != _lyricIdx.value) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            _lyricIdx.value = li;
            _autoScrollLyric(li);
          });
        }

        return Column(
          children: [
            Slider(
              value: value,
              max: maxMs > 0 ? maxMs : 1.0,
              onChanged: maxMs > 0
                  ? (v) => setState(() => _dragValue = v)
                  : null,
              onChangeEnd: (v) {
                player.seek(Duration(milliseconds: v.toInt()));
                setState(() => _dragValue = null);
              },
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(_fmt(Duration(milliseconds: value.toInt()))),
                Text(_fmt(dur)),
              ],
            ),
          ],
        );
      },
    );
  }

  Widget _buildTransport(AudioPlayerService player) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        IconButton(
          tooltip: '快退 10 秒',
          icon: const Icon(Icons.replay_10),
          onPressed: () {
            final p = player.position - const Duration(seconds: 10);
            player.seek(p < Duration.zero ? Duration.zero : p);
          },
        ),
        IconButton(
            icon: const Icon(Icons.skip_previous),
            onPressed: player.previous),
        IconButton(
          icon: Icon(player.isPlaying
              ? Icons.pause_circle_filled
              : Icons.play_circle_filled),
          iconSize: 52,
          onPressed: player.toggle,
        ),
        IconButton(
            icon: const Icon(Icons.skip_next), onPressed: player.next),
        IconButton(
          tooltip: '快进 10 秒',
          icon: const Icon(Icons.forward_10),
          onPressed: () {
            final dur = player.duration;
            var p = player.position + const Duration(seconds: 10);
            if (dur != null && p > dur) p = dur;
            player.seek(p);
          },
        ),
      ],
    );
  }

  Widget _buildSecondaryControls(AudioPlayerService player) {
    return Column(
      children: [
        Wrap(
          spacing: 8,
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            TextButton.icon(
              onPressed: player.cyclePlayMode,
              icon: Icon(_modeIcon(player.playMode), size: 18),
              label: Text(player.playMode.label),
            ),
            ...[0.75, 1.0, 1.25, 1.5].map(
              (s) => OutlinedButton(
                onPressed: () => player.setSpeed(s),
                style: OutlinedButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  side: BorderSide(
                    color: player.speed == s
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).dividerColor,
                  ),
                ),
                child: Text('${s}x'),
              ),
            ),
          ],
        ),
        Row(
          children: [
            const Icon(Icons.volume_down, size: 18),
            Expanded(
              child: Slider(
                value: player.volume,
                onChanged: player.setVolume,
              ),
            ),
            const Icon(Icons.volume_up, size: 18),
          ],
        ),
      ],
    );
  }

  static IconData _modeIcon(PlayMode m) {
    switch (m) {
      case PlayMode.sequential:
        return Icons.playlist_play;
      case PlayMode.repeatAll:
        return Icons.repeat;
      case PlayMode.repeatOne:
        return Icons.repeat_one;
      case PlayMode.shuffle:
        return Icons.shuffle;
    }
  }

  Widget _buildLyric() {
    if (_lyricLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    final ls = _lyrics;
    if (ls == null || ls.isEmpty) {
      return const Center(child: Text('暂无歌词'));
    }
    return ValueListenableBuilder<int>(
      valueListenable: _lyricIdx,
      builder: (_, cur, __) => ListView.builder(
        controller: _lyricScroll,
        itemCount: ls.length,
        itemExtent: _lyricLineHeight,
        itemBuilder: (ctx, i) {
          final active = i == cur;
          return Center(
            child: Text(
              ls[i].text,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: active
                    ? Theme.of(ctx).colorScheme.primary
                    : Theme.of(ctx)
                        .textTheme
                        .bodyMedium
                        ?.color
                        ?.withOpacity(0.6),
                fontWeight: active ? FontWeight.bold : FontWeight.normal,
                fontSize: active ? 16 : 14,
              ),
            ),
          );
        },
      ),
    );
  }

  void _showQueue(BuildContext context, AudioPlayerService player) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return SizedBox(
          height: MediaQuery.of(ctx).size.height * 0.6,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(12),
                child: Text('播放列表（${player.queue.length}）',
                    style: Theme.of(ctx).textTheme.titleMedium),
              ),
              Expanded(
                child: ListView.builder(
                  itemCount: player.queue.length,
                  itemBuilder: (_, i) {
                    final q = player.queue[i];
                    final cur = i == player.index;
                    return ListTile(
                      dense: true,
                      leading: cur
                          ? const Icon(Icons.volume_up, size: 18)
                          : Text('${i + 1}'),
                      title: Text(
                        q.displayTitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontWeight:
                              cur ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                      onTap: () {
                        player.playAt(i);
                        Navigator.pop(ctx);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
