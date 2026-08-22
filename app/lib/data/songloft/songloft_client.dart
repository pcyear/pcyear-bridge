import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:pcyear_bridge/core/result.dart';

/// SongLoft 官方 REST API 客户端。
///
/// 严格对齐官方仓库 songloft-org/songloft 的后端与 Web/Flutter 客户端（songloft-player）：
///   - 登录      POST /api/v1/auth/login  -> {access_token, refresh_token, expires_in, token_type}
///   - 刷新      POST /api/v1/auth/refresh -> 同上（body: {refresh_token}）
///   - 曲库      GET  /api/v1/songs        -> {songs:[Song], total, limit, offset}
///   - 分类聚合  GET  /api/v1/songs/facets?field=album|artist|genre...
///   - 播放      GET  /api/v1/songs/{id}/play
///   - 封面      GET  /api/v1/songs/{id}/cover
///   - 歌词      GET  /api/v1/songs/{id}/lyric
///
/// 鉴权：普通 API 请求走 `Authorization: Bearer`；而播放/封面/歌词流地址必须把
/// `access_token` 拼到 query 上（原生播放器内核 / <img> 无法自定义 Header，官方客户端即用此方式）。
class SongLoftTokens {
  final String accessToken;
  final String refreshToken;
  final int expiresIn;
  final String tokenType;

  SongLoftTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    this.tokenType = 'Bearer',
  });

  factory SongLoftTokens.fromJson(Map<String, dynamic> j) => SongLoftTokens(
        accessToken: j['access_token'] as String,
        refreshToken: j['refresh_token'] as String,
        expiresIn: (j['expires_in'] as int?) ?? 0,
        tokenType: j['token_type'] as String? ?? 'Bearer',
      );

  Map<String, dynamic> toJson() => {
        'access_token': accessToken,
        'refresh_token': refreshToken,
        'expires_in': expiresIn,
        'token_type': tokenType,
      };
}

/// 曲库分页结果（songs 为原始 JSON Map，由适配器映射为 App 的 [Track]）。
class SongLoftSongPage {
  final List<Map<String, dynamic>> songs;
  final int total;
  final int limit;
  final int offset;

  SongLoftSongPage({
    required this.songs,
    required this.total,
    required this.limit,
    required this.offset,
  });

  factory SongLoftSongPage.fromJson(Map<String, dynamic> j) => SongLoftSongPage(
        songs:
            (j['songs'] as List? ?? []).cast<Map<String, dynamic>>(),
        total: (j['total'] as int?) ?? 0,
        limit: (j['limit'] as int?) ?? 0,
        offset: (j['offset'] as int?) ?? 0,
      );
}

/// SongLoft 服务器客户端（官方接口）。
class SongLoftClient {
  final String baseUrl;
  String? accessToken;
  String? refreshToken;
  int expiresIn;

  /// token 刷新成功后回调（用于上层把新 token 持久化，避免重建/重启复用坏 token）。
  final void Function(String accessToken, String refreshToken, int expiresIn)?
      onTokensRefreshed;

  final http.Client _client = http.Client();

  SongLoftClient({
    required this.baseUrl,
    this.accessToken,
    this.refreshToken,
    this.expiresIn = 0,
    this.onTokensRefreshed,
  });

  String get _base => baseUrl.replaceAll(RegExp(r'/+$'), '');
  String get _api => '$_base/api/v1';

  Map<String, String> _headers({bool auth = true}) {
    final h = {'Content-Type': 'application/json', 'Accept': 'application/json'};
    if (auth && accessToken != null && accessToken!.isNotEmpty) {
      h['Authorization'] = 'Bearer $accessToken';
    }
    return h;
  }

  /// 登录（官方接口）。成功后保存 token。
  Future<Result<SongLoftTokens>> login(String user, String pass) async {
    try {
      final resp = await _client
          .post(
            Uri.parse('$_api/auth/login'),
            headers: _headers(auth: false),
            body: jsonEncode({'username': user, 'password': pass}),
          )
          .timeout(const Duration(seconds: 10));
      if (resp.statusCode == 200) {
        final t =
            SongLoftTokens.fromJson(jsonDecode(resp.body) as Map<String, dynamic>);
        accessToken = t.accessToken;
        refreshToken = t.refreshToken;
        expiresIn = t.expiresIn;
        return ok(t);
      }
      return err('登录失败（HTTP ${resp.statusCode}）');
    } catch (e) {
      return err('登录异常：$e');
    }
  }

  /// 刷新 token。成功后更新 accessToken 并触发持久化回调。
  Future<Result<SongLoftTokens>> refresh() async {
    if (refreshToken == null || refreshToken!.isEmpty) {
      return err('无 refresh_token，无法刷新');
    }
    try {
      final resp = await _client
          .post(
            Uri.parse('$_api/auth/refresh'),
            headers: _headers(auth: false),
            body: jsonEncode({'refresh_token': refreshToken}),
          )
          .timeout(const Duration(seconds: 10));
      if (resp.statusCode == 200) {
        final t =
            SongLoftTokens.fromJson(jsonDecode(resp.body) as Map<String, dynamic>);
        accessToken = t.accessToken;
        refreshToken = t.refreshToken;
        expiresIn = t.expiresIn;
        onTokensRefreshed?.call(accessToken!, refreshToken!, expiresIn);
        return ok(t);
      }
      return err('刷新失败（HTTP ${resp.statusCode}）');
    } catch (e) {
      return err('刷新异常：$e');
    }
  }

  /// 统一的带鉴权请求：遇 401 自动 refresh 一次后重试，仍失败才返回 401 错误。
  /// [request] 在每次执行前都已应用最新 accessToken，刷新重试安全。
  Future<Result<T>> _authRequest<T>(Future<Result<T>> Function() request) async {
    final first = await request();
    if (first is Err && _isUnauthorized(first)) {
      final r = await refresh();
      if (r is Ok) {
        final retry = await request();
        return retry;
      }
      return err('登录已过期，请重新连接 SongLoft');
    }
    return first;
  }

  bool _isUnauthorized(Result<dynamic> r) {
    if (r is! Err) return false;
    final e = (r as Err).error;
    return e.contains('401') || e.contains('无效的 token');
  }

  /// 获取单首歌曲详情（含 source_data）。
  Future<Result<Map<String, dynamic>>> fetchSong(dynamic id) async {
    return _authRequest(() async {
      try {
        final resp = await _client
            .get(Uri.parse('$_api/songs/$id'), headers: _headers())
            .timeout(const Duration(seconds: 10));
        if (resp.statusCode == 200) {
          return ok(jsonDecode(resp.body) as Map<String, dynamic>);
        }
        if (resp.statusCode == 401) {
          return err('获取歌曲详情失败（HTTP 401）');
        }
        return err('获取歌曲详情失败（HTTP ${resp.statusCode}）');
      } catch (e) {
        return err('获取歌曲详情异常：$e');
      }
    });
  }

  /// 拉取曲库（官方 /api/v1/songs）。filters 透传关键词 / 分类维度。
  Future<Result<SongLoftSongPage>> fetchSongs({
    String? type,
    String? keyword,
    String? album,
    String? artist,
    String? genre,
    int limit = 50,
    int offset = 0,
    String sort = 'added_at',
    String order = 'desc',
  }) async {
    final qp = <String, String>{
      'limit': '$limit',
      'offset': '$offset',
      'sort': sort,
      'order': order,
      // 列出全部歌曲（含 hidden 标签的），默认 exclude_playlist_labels=hidden 会遗漏
      'exclude_playlist_labels': 'none',
    };
    if (type != null && type.isNotEmpty) qp['type'] = type;
    if (keyword != null && keyword.isNotEmpty) qp['keyword'] = keyword;
    if (album != null && album.isNotEmpty) qp['album'] = album;
    if (artist != null && artist.isNotEmpty) qp['artist'] = artist;
    if (genre != null && genre.isNotEmpty) qp['genre'] = genre;

    Future<Result<SongLoftSongPage>> doGet() async {
      try {
        final resp = await _client
            .get(Uri.parse('$_api/songs').replace(queryParameters: qp),
                headers: _headers())
            .timeout(const Duration(seconds: 15));
        if (resp.statusCode == 200) {
          return ok(SongLoftSongPage.fromJson(
              jsonDecode(resp.body) as Map<String, dynamic>));
        }
        if (resp.statusCode == 401) {
          return err('获取曲库失败（HTTP 401）');
        }
        return err('获取曲库失败（HTTP ${resp.statusCode}）');
      } catch (e) {
        return err('获取曲库异常：$e');
      }
    }

    return _authRequest(doGet);
  }

  /// 歌曲分类聚合（album / artist / genre / language / style / year / decade）。
  /// 返回 {field, facets:[{value,count}], total, limit, offset}。
  Future<Result<Map<String, dynamic>>> facets(String field,
      {int limit = 50, int offset = 0}) async {
    final qp = {'field': field, 'limit': '$limit', 'offset': '$offset'};
    return _authRequest(() async {
      try {
        final resp = await _client
            .get(Uri.parse('$_api/songs/facets').replace(queryParameters: qp),
                headers: _headers())
            .timeout(const Duration(seconds: 15));
        if (resp.statusCode == 200) {
          return ok(jsonDecode(resp.body) as Map<String, dynamic>);
        }
        if (resp.statusCode == 401) {
          return err('获取分类失败（HTTP 401）');
        }
        return err('获取分类失败（HTTP ${resp.statusCode}）');
      } catch (e) {
        return err('获取分类异常：$e');
      }
    });
  }

  /// 连接性 + 鉴权探测（公开端点 /health，不耗配额）。
  Future<Result<void>> ping() async {
    try {
      final resp = await _client
          .get(Uri.parse('$_api/health'), headers: _headers(auth: false))
          .timeout(const Duration(seconds: 8));
      if (resp.statusCode == 200) return ok(null);
      return err('服务不可达（HTTP ${resp.statusCode}）');
    } catch (e) {
      return err('连接异常：$e');
    }
  }

  /// 歌词文本（GET /api/v1/songs/{id}/lyric，已带 access_token）。
  Future<Result<String?>> fetchLyric(dynamic id) async {
    return _authRequest(() async {
      try {
        final resp = await _client
            .get(Uri.parse(songLyricUrl(id)))
            .timeout(const Duration(seconds: 10));
        if (resp.statusCode == 200) {
          // 歌词端点可能返回纯文本或 JSON，尽量提取文本
          final body = resp.body;
          if (body.trim().startsWith('{')) {
            final j = jsonDecode(body) as Map<String, dynamic>;
            return ok(j['lyric'] as String? ?? body);
          }
          return ok(body);
        }
        if (resp.statusCode == 404) return ok(null);
        if (resp.statusCode == 401) return err('获取歌词失败（HTTP 401）');
        return err('获取歌词失败（HTTP ${resp.statusCode}）');
      } catch (e) {
        return err('获取歌词异常：$e');
      }
    });
  }

  /// 播放流地址（native 必须把 access_token 拼到 query，播放器无法自定义 Header）。
  String songPlayUrl(dynamic id) => _authUrl('$_api/songs/$id/play');

  /// 封面地址（同上）。本机封面由服务端代理外部 CDN，故统一走此端点即可。
  String songCoverUrl(dynamic id) => _authUrl('$_api/songs/$id/cover');

  /// 歌词地址（同上）。
  String songLyricUrl(dynamic id) => _authUrl('$_api/songs/$id/lyric');

  /// 插件播放地址解析：绕过宿主 /songs/{id}/play，直接让插件返回可播放 URL。
  /// 对 WebDAV/Subsonic 返回已带鉴权的直链；对飞牛等需宿主播放器的场景返回 scheme:host。
  ///
  /// [pluginEntryPath] 必须匹配歌曲 source_data 里的 provider：旧歌为 `multisource-music`
  /// （现已作为别名插件并存安装，其音源配置只在该命名空间下），新歌为 `pcyear-bridge`。
  /// 硬编码 pcyear-bridge 会让旧歌因 sourceId 命名空间不匹配而 404，进而回退到宿主
  /// /play 触发 502，导致「下一首切不过去、一直停在首歌」。
  Future<Result<Map<String, dynamic>>> pluginPlayUrl(
      String sourceId, String trackId,
      {String? title,
      String? artist,
      String pluginEntryPath = 'pcyear-bridge'}) async {
    try {
      final resp = await _client
          .post(
            Uri.parse('$_base/api/v1/jsplugin/$pluginEntryPath/play-url'),
            headers: _headers(),
            body: jsonEncode({
              'sourceId': sourceId,
              'trackId': trackId,
              'track': {
                if (title != null) 'title': title,
                if (artist != null) 'artist': artist,
              },
            }),
          )
          .timeout(const Duration(seconds: 15));
      if (resp.statusCode == 200) {
        return ok(jsonDecode(resp.body) as Map<String, dynamic>);
      }
      return err('解析插件播放地址失败（HTTP ${resp.statusCode}）');
    } catch (e) {
      return err('解析插件播放地址异常：$e');
    }
  }

  /// 插件封面直链：/cover-img 是 public_path，用 sourceId + coverId 即可。
  /// [pluginEntryPath] 同上，须匹配歌曲 provider。
  String pluginCoverImgUrl(String sourceId, String coverId,
          {String pluginEntryPath = 'pcyear-bridge'}) =>
      _authUrl('$_base/api/v1/jsplugin/$pluginEntryPath/cover-img?sourceId=${Uri.encodeQueryComponent(sourceId)}&coverId=${Uri.encodeQueryComponent(coverId)}');

  /// 插件歌词：通过 songId 反查 source_data 后返回歌词文本。
  /// [pluginEntryPath] 同上，须匹配歌曲 provider（旧歌 multisource-music / 新歌 pcyear-bridge）。
  Future<Result<String?>> pluginFetchLyric(dynamic songId,
      {String pluginEntryPath = 'pcyear-bridge'}) async {
    try {
      final resp = await _client
          .get(
            Uri.parse(_authUrl(
                '$_base/api/v1/jsplugin/$pluginEntryPath/lyric?songId=$songId')),
            headers: _headers(auth: false),
          )
          .timeout(const Duration(seconds: 10));
      if (resp.statusCode == 200) {
        final j = jsonDecode(resp.body) as Map<String, dynamic>;
        final lyric = j['lyric'];
        return ok(lyric is String ? lyric : null);
      }
      return err('获取插件歌词失败（HTTP ${resp.statusCode}）');
    } catch (e) {
      return err('获取插件歌词异常：$e');
    }
  }

  String _authUrl(String path) {
    final sep = path.contains('?') ? '&' : '?';
    final token = accessToken ?? '';
    return '$path${sep}access_token=$token';
  }

  void dispose() => _client.close();
}
