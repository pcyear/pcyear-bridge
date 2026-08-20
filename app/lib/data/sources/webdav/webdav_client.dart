import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:xml/xml.dart' as xml;
import 'package:pcyear_bridge/core/models.dart';
import 'webdav_models.dart';

const String _propfindBody = '<?xml version="1.0" encoding="utf-8"?>'
    '<D:propfind xmlns:D="DAV:"><D:prop>'
    '<D:resourcetype/><D:getcontentlength/><D:getcontenttype/><D:displayname/>'
    '</D:prop></D:propfind>';

const String _propfindDeepBody = '<?xml version="1.0" encoding="utf-8"?>'
    '<D:propfind xmlns:D="DAV:"><D:prop>'
    '<D:resourcetype/><D:getcontenttype/><D:getcontentlength/>'
    '</D:prop></D:propfind>';

/// WebDAV 客户端：PROPFIND、路径编码、URL 构造、multistatus XML 解析。
/// 行为对齐插件 `src/adapters/webdav/client.ts`。
class WebDavClient {
  final String origin; // http://host:port
  final String mountPath; // baseUrl 的路径部分（openlist 挂在 /dav 下等）
  final List<String> roots; // 起始目录（绝对路径，'/' 表示根）
  final String auth; // Basic base64(user:pass)

  final http.Client _client = http.Client();

  WebDavClient(SourceConfig cfg)
      : origin = _originOf(cfg.baseUrl),
        mountPath = _mountPathOf(cfg.baseUrl),
        roots = _rootsOf(cfg),
        auth = 'Basic ' + base64Encode(utf8.encode('${cfg.username ?? ''}:${cfg.password ?? ''}'));

  static String _originOf(String baseUrl) {
    final raw = baseUrl.replaceAll(RegExp(r'/+$'), '');
    final m = RegExp(r'^(https?://[^/]+)(/.*)?$', caseSensitive: false).firstMatch(raw);
    return m?.group(1) ?? raw;
  }

  static String _mountPathOf(String baseUrl) {
    final raw = baseUrl.replaceAll(RegExp(r'/+$'), '');
    final m = RegExp(r'^(https?://[^/]+)(/.*)?$', caseSensitive: false).firstMatch(raw);
    return (m?.group(2) != null) ? m!.group(2)!.replaceAll(RegExp(r'/+$'), '') : '';
  }

  static List<String> _rootsOf(SourceConfig cfg) {
    final raw = cfg.extra['rootPaths'];
    List<String> list;
    if (raw is List && raw.isNotEmpty) {
      list = raw.map((e) => e as String).toList();
    } else if (cfg.extra['rootPath'] != null && (cfg.extra['rootPath'] as String).isNotEmpty) {
      list = [cfg.extra['rootPath'] as String];
    } else {
      list = [''];
    }
    return list.map((r) {
      final norm = '/' + r.replaceAll(RegExp(r'^/+|/+$'), '');
      return norm.replaceAll(RegExp(r'/+'), '/');
    }).map((r) => r == '/' ? '/' : r).toList();
  }

  String get basePath => roots.firstOrEmpty;

  List<String> get rootList => roots.isNotEmpty ? roots : const ['/'];

  String fullUrl(String path) {
    final p = _encodePath(path);
    final base = (origin + mountPath).replaceAll(RegExp(r'/+/$'), '');
    return p == '/' ? base + '/' : base + p;
  }

  String _encodePath(String path) => path.split('/').map(Uri.encodeComponent).join('/');

  static String normalize(String p) =>
      ('/' + p).replaceAll(RegExp(r'/+'), '/').replaceAll(RegExp(r'/?$'), '');

  Future<List<DavEntry>> propfind(String path, {int timeoutMs = 8000}) =>
      _doPropfind(path, depth: '1', body: _propfindBody, timeoutMs: timeoutMs);

  Future<List<DavEntry>> propfindDeep(String path, {int timeoutMs = 8000}) =>
      _doPropfind(path, depth: 'infinity', body: _propfindDeepBody, timeoutMs: timeoutMs);

  Future<List<DavEntry>> _doPropfind(String path,
      {required String depth, required String body, int timeoutMs = 8000}) async {
    final u = fullUrl(path);
    final reqUrl = u.endsWith('/') ? u : u + '/';
    final altUrl = u.endsWith('/') ? u.substring(0, u.length - 1) : u + '/';
    var resp = await _propfindOnce(reqUrl, depth, body).timeout(Duration(milliseconds: timeoutMs));
    if (resp.statusCode == 405) {
      resp = await _propfindOnce(altUrl, depth, body).timeout(Duration(milliseconds: timeoutMs));
    }
    if (resp.statusCode == 401 || resp.statusCode == 403) {
      throw Exception('WebDAV 鉴权失败（HTTP ${resp.statusCode}），请检查用户名与密码');
    }
    if (resp.statusCode == 404) {
      throw Exception('WebDAV 路径不存在：${path.isEmpty ? '/' : path}');
    }
    if (resp.statusCode != 207 && resp.statusCode != 200) {
      throw Exception('WebDAV PROPFIND 失败（HTTP ${resp.statusCode}）');
    }
    return _parseMultistatus(resp.body, path);
  }

  Future<http.Response> _propfindOnce(String url, String depth, String body) async {
    final req = http.Request('PROPFIND', Uri.parse(url))
      ..headers['Authorization'] = auth
      ..headers['Depth'] = depth
      ..headers['Content-Type'] = 'application/xml; charset=utf-8'
      ..body = body;
    final streamed = await _client.send(req);
    return http.Response.fromStream(streamed);
  }

  List<DavEntry> _parseMultistatus(String xmlStr, String parentPath) {
    final out = <DavEntry>[];
    final selfPath = normalize(parentPath);
    late xml.XmlDocument doc;
    try {
      doc = xml.XmlDocument.parse(xmlStr);
    } catch (_) {
      return out;
    }
    final responses = doc.descendants
        .whereType<xml.XmlElement>()
        .where((e) => e.name.local == 'response');
    for (final block in responses) {
      final hrefEl = _childByLocal(block, 'href');
      if (hrefEl == null) continue;
      String href = _decodeEntities(hrefEl.text.trim());
      final abs = RegExp(r'^https?://[^/]+(\/.*)$', caseSensitive: false).firstMatch(href);
      if (abs != null) href = abs.group(1)!;
      for (int i = 0; i < 4; i++) {
        String d;
        try {
          d = Uri.decodeComponent(href);
        } catch (_) {
          break;
        }
        if (d == href) break;
        href = d;
      }
      String p = normalize(href);
      if (mountPath.isNotEmpty && p.startsWith(mountPath)) {
        p = normalize(p.substring(mountPath.length));
      }
      if (p == selfPath) continue;
      final isDir = _hasCollection(block);
      final lenEl = _childByLocal(block, 'getcontentlength');
      final ctEl = _childByLocal(block, 'getcontenttype');
      final segs = p.split('/');
      final name = segs.lastWhere((s) => s.isNotEmpty, orElse: () => p);
      out.add(DavEntry(
        href: p,
        name: name,
        isDir: isDir,
        size: lenEl != null ? int.tryParse(lenEl.text.trim()) : null,
        contentType: ctEl?.text.trim(),
      ));
    }
    return out;
  }

  static xml.XmlElement? _childByLocal(xml.XmlElement el, String local) {
    for (final c in el.children.whereType<xml.XmlElement>()) {
      if (c.name.local == local) return c;
    }
    return null;
  }

  static bool _hasCollection(xml.XmlElement block) {
    for (final el in block.descendants.whereType<xml.XmlElement>()) {
      final local = el.name.local.toLowerCase();
      if (local == 'resourcetype') {
        for (final c in el.children.whereType<xml.XmlElement>()) {
          if (c.name.local.toLowerCase() == 'collection') return true;
        }
      } else if (local == 'collection') {
        return true;
      }
    }
    return false;
  }

  static String _decodeEntities(String s) => s
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll("&#39;", "'")
      .replaceAll('&amp;', '&');

  /// 拉取文本（用于同名 .lrc 歌词）
  Future<String?> getText(String url, {int timeoutMs = 8000}) async {
    try {
      final resp = await _client
          .get(Uri.parse(url), headers: {'Authorization': auth})
          .timeout(Duration(milliseconds: timeoutMs));
      if (resp.statusCode == 200) return resp.body;
    } catch (_) {
      // 忽略错误，返回 null（无歌词）
    }
    return null;
  }

  void close() => _client.close();
}

extension _FirstOrEmpty on List<String> {
  String get firstOrEmpty => isEmpty ? '/' : first;
}
