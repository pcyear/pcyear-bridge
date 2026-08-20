/// WebDAV PROPFIND 解析出的单个条目
class DavEntry {
  final String href; // 相对挂载根的绝对路径（如 /Music/foo）
  final String name;
  final bool isDir;
  final int? size; // 字节
  final String? contentType;
  const DavEntry({
    required this.href,
    required this.name,
    required this.isDir,
    this.size,
    this.contentType,
  });
}
