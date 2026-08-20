import 'package:flutter/foundation.dart';
import 'package:pcyear_bridge/core/models.dart';
import 'package:pcyear_bridge/core/result.dart';
import 'package:pcyear_bridge/data/songloft/songloft_client.dart';
import 'package:pcyear_bridge/data/sources/source_repository.dart';

/// 音源管理状态：增删改、连接测试、从 SongLoft 服务器导入音源配置。
class SourcesProvider extends ChangeNotifier {
  final SourceRepository repo;
  bool busy = false;

  SourcesProvider(this.repo);

  List<SourceConfig> get configs => repo.configs;

  Future<void> addSource(SourceConfig cfg) async {
    busy = true;
    notifyListeners();
    await repo.addSource(cfg);
    busy = false;
    notifyListeners();
  }

  Future<void> removeSource(String id) async {
    await repo.removeSource(id);
    notifyListeners();
  }

  /// 保存前连接测试（临时构建适配器，不写入仓储）
  Future<Result<void>> testSource(SourceConfig cfg) async {
    final a = repo.createAdapter(cfg);
    try {
      await a.testConnection();
      return ok(null);
    } catch (e) {
      return err(e.toString());
    } finally {
      a.dispose();
    }
  }

  /// 连接到 SongLoft 服务器（官方 REST API 登录），并将其作为一等音源加入本机。
  ///
  /// 登录成功后把 access/refresh token 写入 [SourceConfig.extra]，后续浏览/播放由
  /// [SongLoftAdapter] 凭 token 调用官方接口完成（不再走 Subsonic 兼容层）。
  Future<Result<SourceConfig>> connectSongLoft(
      String baseUrl, String user, String pass) async {
    final client = SongLoftClient(baseUrl: baseUrl);
    final login = await client.login(user, pass);
    if (login is Err) {
      client.dispose();
      return err(login.error);
    }
    final t = login.value;
    final cfg = SourceConfig(
      id: repo.newId(),
      type: SourceType.songloft,
      name: 'SongLoft · ${baseUrl.replaceAll(RegExp(r'https?://'), '')}',
      baseUrl: baseUrl,
      username: user,
      password: pass,
      extra: {
        'accessToken': t.accessToken,
        'refreshToken': t.refreshToken,
        'expiresIn': t.expiresIn,
      },
    );
    await repo.addSource(cfg);
    client.dispose();
    notifyListeners();
    return ok(cfg);
  }
}
