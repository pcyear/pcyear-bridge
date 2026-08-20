import 'dart:math';

import 'package:audio_service/audio_service.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:pcyear_bridge/core/models.dart';
import 'package:pcyear_bridge/data/sources/source_repository.dart';

/// 播放模式，与插件底部播放条的「顺序 / 列表循环 / 单曲循环 / 随机」一致。
enum PlayMode {
  sequential, // 顺序播放，播完最后一首停止
  repeatAll, // 列表循环
  repeatOne, // 单曲循环
  shuffle; // 随机

  String get label {
    switch (this) {
      case PlayMode.sequential:
        return '顺序播放';
      case PlayMode.repeatAll:
        return '列表循环';
      case PlayMode.repeatOne:
        return '单曲循环';
      case PlayMode.shuffle:
        return '随机播放';
    }
  }

  PlayMode get next => PlayMode.values[(index + 1) % PlayMode.values.length];
}

/// 自带播放器服务：封装 just_audio（解码）+ audio_service（后台/锁屏控制）。
///
/// 设计要点：
/// - 播放地址由 [SourceAdapter.resolveStream] 提供，可携带 Basic 鉴权头。
/// - 位置更新走 [positionStream]，**不**触发 notifyListeners，
///   避免每秒数次全局 rebuild；UI 用 StreamBuilder 局部刷新。
/// - 播放完成按 [playMode] 自动续播。
class AudioPlayerService extends ChangeNotifier {
  late final AudioPlayer player;
  AudioHandler? handler;

  List<Track> _queue = [];
  int _index = -1;
  String? _sourceId;
  final SourceRepository? _repo;
  final Random _rng = Random();

  PlayMode _mode = PlayMode.sequential;
  double _volume = 1.0;
  double _speed = 1.0;
  bool _advancing = false;

  AudioPlayerService({SourceRepository? repo}) : _repo = repo;

  List<Track> get queue => _queue;
  int get index => _index;
  Track? get current =>
      (_index >= 0 && _index < _queue.length) ? _queue[_index] : null;
  SourceRepository? get repository => _repo;
  bool get isPlaying => player.playing;
  Duration get position => player.position;
  Duration? get duration => player.duration;
  Stream<Duration> get positionStream => player.positionStream;
  PlayMode get playMode => _mode;
  double get volume => _volume;
  double get speed => _speed;

  Future<void> init() async {
    player = AudioPlayer();
    try {
      handler = await AudioService.init(
        builder: () => _Handler(player, this),
        config: const AudioServiceConfig(
          androidNotificationChannelId: 'com.pcyear.fnmusic.channel.audio',
          androidNotificationChannelName: '多源音乐桥',
          androidNotificationOngoing: true,
        ),
      );
    } catch (e) {
      // 后台服务初始化失败（如平台未配置）不应阻断播放本身
      debugPrint('AudioService 初始化失败，降级为前台播放: $e');
    }

    // 只在「播放/暂停/缓冲」等状态变化时通知 UI，位置更新交给 positionStream
    player.playerStateStream.listen((s) {
      notifyListeners();
      if (s.processingState == ProcessingState.completed) {
        _onCompleted();
      }
    });
  }

  Future<void> _onCompleted() async {
    if (_advancing) return;
    _advancing = true;
    try {
      switch (_mode) {
        case PlayMode.repeatOne:
          await player.seek(Duration.zero);
          await player.play();
          break;
        case PlayMode.shuffle:
          if (_queue.length > 1) {
            int n;
            do {
              n = _rng.nextInt(_queue.length);
            } while (n == _index);
            _index = n;
            await _playCurrent();
          }
          break;
        case PlayMode.repeatAll:
          _index = (_index + 1) % _queue.length;
          await _playCurrent();
          break;
        case PlayMode.sequential:
          if (_index < _queue.length - 1) {
            _index++;
            await _playCurrent();
          }
          break;
      }
    } finally {
      _advancing = false;
    }
  }

  void setPlayMode(PlayMode m) {
    _mode = m;
    notifyListeners();
  }

  void cyclePlayMode() => setPlayMode(_mode.next);

  Future<void> setVolume(double v) async {
    _volume = v.clamp(0.0, 1.0);
    await player.setVolume(_volume);
    notifyListeners();
  }

  /// 用一批曲目替换播放队列并播放
  Future<void> playQueue(List<Track> tracks,
      {int startIndex = 0, String? sourceId}) async {
    if (tracks.isEmpty) return;
    _queue = List<Track>.from(tracks);
    _sourceId = sourceId;
    _index = startIndex.clamp(0, tracks.length - 1);
    await _playCurrent();
  }

  /// 跳到队列中指定位置播放
  Future<void> playAt(int i) async {
    if (i < 0 || i >= _queue.length) return;
    _index = i;
    await _playCurrent();
  }

  Future<void> _playCurrent() async {
    final t = current;
    if (t == null) return;
    notifyListeners(); // 先让 UI 切到新曲目信息

    // 曲目自身的 sourceId 优先于队列的 sourceId（搜索结果可能跨音源）
    final sid = t.sourceId ?? _sourceId;
    UpstreamRef? ref;
    if (sid != null) {
      final adapter = _repo?.adapter(sid);
      if (adapter != null) {
        try {
          ref = await adapter.resolveStream(t.id);
        } catch (e) {
          debugPrint('解析播放地址失败: $e');
        }
      }
    }
    final url = ref?.url ?? '';
    if (url.isEmpty) return;
    try {
      await player.setUrl(url, headers: ref?.headers);
      await player.setVolume(_volume);
      await player.setSpeed(_speed);
      await player.play();
    } catch (e) {
      debugPrint('播放失败: $e');
    }
    await _publishMediaItem(t, sid);
    notifyListeners();
  }

  /// 广播当前曲目到系统（锁屏/通知栏/蓝牙）
  Future<void> _publishMediaItem(Track t, String? sid) async {
    final h = handler;
    if (h == null) return;
    Uri? art;
    // 只有能解析出真实 http(s) 封面地址才设置 artUri，避免系统去加载无效 scheme
    if (t.coverId != null && sid != null) {
      try {
        final ref = await _repo?.adapter(sid)?.resolveCover(t.coverId);
        final u = ref?.url;
        if (u != null && (u.startsWith('http://') || u.startsWith('https://'))) {
          art = Uri.parse(u);
        }
      } catch (_) {}
    }
    h.mediaItem.add(MediaItem(
      id: t.id,
      title: t.displayTitle,
      artist: t.artist,
      album: t.album,
      duration: t.duration != null
          ? Duration(milliseconds: t.duration!)
          : player.duration,
      artUri: art,
    ));
  }

  Future<void> play() async {
    await player.play();
    notifyListeners();
  }

  Future<void> pause() async {
    await player.pause();
    notifyListeners();
  }

  Future<void> toggle() async {
    if (player.playing) {
      await pause();
    } else {
      await play();
    }
  }

  Future<void> seek(Duration d) async {
    await player.seek(d);
    notifyListeners();
  }

  Future<void> next() async {
    if (_queue.isEmpty) return;
    if (_mode == PlayMode.shuffle && _queue.length > 1) {
      int n;
      do {
        n = _rng.nextInt(_queue.length);
      } while (n == _index);
      _index = n;
    } else if (_index < _queue.length - 1) {
      _index++;
    } else if (_mode == PlayMode.repeatAll) {
      _index = 0;
    } else {
      return;
    }
    await _playCurrent();
  }

  Future<void> previous() async {
    if (_queue.isEmpty) return;
    if (_index > 0) {
      _index--;
    } else if (_mode == PlayMode.repeatAll) {
      _index = _queue.length - 1;
    } else {
      return;
    }
    await _playCurrent();
  }

  Future<void> setSpeed(double s) async {
    _speed = s;
    await player.setSpeed(s);
    notifyListeners();
  }

  @override
  void dispose() {
    player.dispose();
    super.dispose();
  }
}

/// audio_service 处理器：把播放器状态广播到系统，并接收系统侧控制。
class _Handler extends BaseAudioHandler {
  final AudioPlayer player;
  final AudioPlayerService svc;

  _Handler(this.player, this.svc) {
    player.playbackEventStream.listen(_onEvent);
  }

  static const _stateMap = {
    ProcessingState.idle: AudioProcessingState.idle,
    ProcessingState.loading: AudioProcessingState.loading,
    ProcessingState.buffering: AudioProcessingState.buffering,
    ProcessingState.ready: AudioProcessingState.ready,
    ProcessingState.completed: AudioProcessingState.completed,
  };

  void _onEvent(PlaybackEvent e) {
    playbackState.add(PlaybackState(
      controls: [
        MediaControl.skipToPrevious,
        player.playing ? MediaControl.pause : MediaControl.play,
        MediaControl.skipToNext,
      ],
      systemActions: const {MediaAction.seek},
      androidCompactActionIndices: const [0, 1, 2],
      processingState:
          _stateMap[e.processingState] ?? AudioProcessingState.idle,
      playing: player.playing,
      updatePosition: player.position,
      bufferedPosition: player.bufferedPosition,
      speed: player.speed,
    ));
  }

  @override
  Future<void> play() => svc.play();

  @override
  Future<void> pause() => svc.pause();

  @override
  Future<void> seek(Duration position) => svc.seek(position);

  @override
  Future<void> skipToNext() => svc.next();

  @override
  Future<void> skipToPrevious() => svc.previous();

  @override
  Future<void> stop() async {
    await player.stop();
    await super.stop();
  }
}
