import 'package:pcyear_bridge/core/models.dart';
import 'webdav_models.dart';
import 'webdav_client.dart';

/// 音频扩展名（与插件一致）
const List<String> audioExt = <String>[
  'mp3', 'flac', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'wma',
  'ape', 'dsf', 'dff', 'mka', 'tak', 'tta', 'weba', 'mp2', 'mp1',
];

/// WebDAV 元数据：文件 → Track、集合 id 编解码、音频/图片判断。
/// 行为对齐插件 `src/adapters/webdav/metadata.ts`。
class WebDavMetadata {
  final String sourceId;
  final List<String> roots;
  final Map<String, String> relToRoot = {};

  WebDavMetadata(this.sourceId, this.roots);

  List<String> get rootList => roots.isNotEmpty ? roots : const ['/'];

  String absUnder(String root, String rel) {
    final base = root == '/' ? '' : root;
    return WebDavClient.normalize((base.isNotEmpty ? '$base/' : '/') + (rel));
  }

  String absOf(String rel) {
    final root = relToRoot[rel] ?? roots.firstOrEmpty;
    final base = root == '/' ? '' : root;
    return WebDavClient.normalize((base.isNotEmpty ? '$base/' : '/') + rel);
  }

  bool isAudio(String name) {
    final i = name.lastIndexOf('.');
    if (i < 0) return false;
    return audioExt.contains(name.substring(i + 1).toLowerCase());
  }

  bool isImage(String name) {
    final i = name.lastIndexOf('.');
    if (i < 0) return false;
    final ext = name.substring(i + 1).toLowerCase();
    return ext == 'jpg' || ext == 'jpeg' || ext == 'png' || ext == 'webp' || ext == 'gif' || ext == 'bmp';
  }

  /// 从路径推断元数据（层级：a/b/file → artist=a, album=b）。
  Track fileToTrack(DavEntry e, String root) {
    final rel = e.href.substring(root == '/' ? 0 : root.length).replaceFirst(RegExp(r'^/+'), '');
    final segs = rel.split('/');
    final filename = segs.last;
    final dot = filename.lastIndexOf('.');
    final stem = dot > 0 ? filename.substring(0, dot) : filename;
    final ext = dot > 0 ? filename.substring(dot + 1).toLowerCase() : '';

    String artist = '未知艺术家';
    String album = segs.length >= 2 ? segs[segs.length - 2] : '未知专辑';
    if (segs.length >= 3) artist = segs[segs.length - 3];

    String title = stem;
    final dash = stem.split(' - ');
    if (dash.length >= 2) {
      final left = dash[0].replaceFirst(RegExp(r'^\d+[.\-\s]*'), '').trim();
      final right = dash.skip(1).join(' - ').trim();
      if (left.isNotEmpty && right.isNotEmpty) {
        if (artist == '未知艺术家') artist = left;
        title = right;
      }
    } else {
      title = stem.replaceFirst(RegExp(r'^\d+[.\-\s]+'), '').trim();
    }

    final trackNoM = RegExp(r'^(\d{1,3})[.\-\s]').firstMatch(filename);
    relToRoot[rel] = root;
    return Track(
      id: rel,
      title: title,
      artist: artist,
      album: album,
      trackNo: trackNoM != null ? int.tryParse(trackNoM.group(1)!) : null,
      size: e.size,
      mime: ext,
      sourceId: sourceId,
      coverId: rel,
    );
  }

  /// 集合 id ↔ (root, rel)。多 root 用 r<idx>: 前缀；兼容历史「艺术家||专辑」。
  String mkId(String root, String rel) {
    final idx = rootList.indexOf(root);
    return (rootList.length > 1 && idx > 0) ? 'r$idx:$rel' : rel;
  }

  ({String root, String rel}) parseCollectionId(String id) {
    final roots = rootList;
    if (id.contains('||')) {
      final parts = id.split('||');
      final artist = parts[0] == '未知艺术家' ? '' : parts[0];
      final album = (parts.length > 1 && parts[1] != '未知专辑') ? parts[1] : '';
      return (root: roots.first, rel: [artist, album].where((s) => s.isNotEmpty).join('/'));
    }
    final m = RegExp(r'^r(\d+):([\s\S]*)$').firstMatch(id);
    if (m != null) {
      final i = int.parse(m.group(1)!);
      final r = i < roots.length ? roots[i] : roots.first;
      return (root: r, rel: m.group(2)!);
    }
    final rel = (id == '未知艺术家' || id == '未知专辑') ? '' : (id);
    return (root: roots.first, rel: rel);
  }
}
