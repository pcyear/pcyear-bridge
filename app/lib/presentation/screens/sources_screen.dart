import 'package:flutter/material.dart';
import 'package:pcyear_bridge/core/models.dart';
import 'package:pcyear_bridge/core/result.dart';
import 'package:pcyear_bridge/data/sources/source_adapter.dart';
import 'package:pcyear_bridge/data/sources/source_repository.dart';
import 'package:pcyear_bridge/presentation/providers/library_provider.dart';
import 'package:pcyear_bridge/presentation/providers/sources_provider.dart';
import 'package:provider/provider.dart';

/// 音源管理页。对齐插件现有能力：
/// 新增/编辑/删除音源、连接测试、WebDAV/飞牛 目录多层钻取多选、从 SongLoft 导入。
class SourcesScreen extends StatelessWidget {
  const SourcesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final sp = context.watch<SourcesProvider>();
    final configs = sp.configs;
    return Scaffold(
      appBar: AppBar(
        title: const Text('音源'),
        actions: [
          IconButton(
            tooltip: '从 SongLoft 导入',
            icon: const Icon(Icons.cloud_download),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const SongLoftImportPage()),
            ),
          ),
        ],
      ),
      body: configs.isEmpty
          ? const Center(child: Text('还没有音源，点右下角 + 添加'))
          : ListView.builder(
              itemCount: configs.length,
              itemBuilder: (_, i) {
                final c = configs[i];
                final sub = <String>[
                  c.type.label,
                  c.baseUrl,
                  if (c.roots.isNotEmpty) '${c.roots.length} 个目录',
                ].join(' · ');
                return ListTile(
                  leading: Icon(_iconOf(c.type)),
                  title: Text(c.name.isEmpty ? c.baseUrl : c.name),
                  subtitle:
                      Text(sub, maxLines: 2, overflow: TextOverflow.ellipsis),
                  trailing: PopupMenuButton<String>(
                    onSelected: (v) async {
                      if (v == 'edit') {
                        await Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => SourceEditPage(origin: c)),
                        );
                      } else if (v == 'delete') {
                        final okDel = await _confirm(context, '删除音源',
                            '确定删除「${c.name.isEmpty ? c.baseUrl : c.name}」？本地收藏不受影响。');
                        if (okDel && context.mounted) {
                          await context.read<SourcesProvider>().removeSource(c.id);
                          if (context.mounted) {
                            context.read<LibraryProvider>().reset();
                          }
                        }
                      }
                    },
                    itemBuilder: (_) => const [
                      PopupMenuItem(value: 'edit', child: Text('编辑')),
                      PopupMenuItem(value: 'delete', child: Text('删除')),
                    ],
                  ),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => SourceEditPage(origin: c)),
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const SourceEditPage()),
        ),
        child: const Icon(Icons.add),
      ),
    );
  }

  static IconData _iconOf(SourceType t) {
    switch (t) {
      case SourceType.webdav:
        return Icons.folder_shared;
      case SourceType.subsonic:
        return Icons.dns;
      case SourceType.feiniu:
        return Icons.cloud;
      case SourceType.songloft:
        return Icons.cloud_done;
      case SourceType.daoliyu:
        return Icons.graphic_eq;
    }
  }
}

Future<bool> _confirm(BuildContext context, String title, String body) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
        TextButton(
            onPressed: () => Navigator.pop(ctx, true), child: const Text('确定')),
      ],
    ),
  );
  return r ?? false;
}

/// 新增 / 编辑音源
class SourceEditPage extends StatefulWidget {
  final SourceConfig? origin;
  const SourceEditPage({super.key, this.origin});

  @override
  State<SourceEditPage> createState() => _SourceEditPageState();
}

class _SourceEditPageState extends State<SourceEditPage> {
  late SourceType _type;
  late TextEditingController _name;
  late TextEditingController _url;
  late TextEditingController _user;
  late TextEditingController _pass;
  late List<String> _roots;

  bool _testing = false;
  String? _testMsg;
  bool _testOk = false;

  @override
  void initState() {
    super.initState();
    final o = widget.origin;
    _type = o?.type ?? SourceType.webdav;
    _name = TextEditingController(text: o?.name ?? '');
    _url = TextEditingController(text: o?.baseUrl ?? '');
    _user = TextEditingController(text: o?.username ?? '');
    _pass = TextEditingController(text: o?.password ?? '');
    _roots = List<String>.from(o?.roots ?? const <String>[]);
  }

  @override
  void dispose() {
    _name.dispose();
    _url.dispose();
    _user.dispose();
    _pass.dispose();
    super.dispose();
  }

  SourceConfig _build(BuildContext context) {
    final repo = context.read<SourceRepository>();
    return SourceConfig(
      id: widget.origin?.id ?? repo.newId(),
      type: _type,
      name: _name.text.trim(),
      baseUrl: _url.text.trim(),
      roots: _roots,
      username: _user.text.trim().isEmpty ? null : _user.text.trim(),
      password: _pass.text.isEmpty ? null : _pass.text,
      extra: widget.origin?.extra ?? const {},
    );
  }

  Future<void> _test() async {
    setState(() {
      _testing = true;
      _testMsg = null;
    });
    final cfg = _build(context);
    final Result<void> r = await context.read<SourcesProvider>().testSource(cfg);
    if (!mounted) return;
    setState(() {
      _testing = false;
      _testOk = r.isOk;
      _testMsg = r.isOk ? '连接成功' : '连接失败：${r.error}';
    });
  }

  Future<void> _save() async {
    if (_url.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('请填写服务器地址')));
      return;
    }
    final cfg = _build(context);
    await context.read<SourcesProvider>().addSource(cfg);
    if (!mounted) return;
    context.read<LibraryProvider>().reset();
    Navigator.pop(context);
  }

  Future<void> _pickDirs() async {
    if (_url.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('请先填写服务器地址')));
      return;
    }
    final cfg = _build(context);
    final picked = await Navigator.push<List<String>>(
      context,
      MaterialPageRoute(
        builder: (_) => DirectoryPickerPage(config: cfg, selected: _roots),
      ),
    );
    if (picked != null && mounted) setState(() => _roots = picked);
  }

  @override
  Widget build(BuildContext context) {
    final canPickDirs =
        _type == SourceType.webdav || _type == SourceType.feiniu;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.origin == null ? '添加音源' : '编辑音源'),
        actions: [
          TextButton(onPressed: _save, child: const Text('保存')),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DropdownButtonFormField<SourceType>(
            value: _type,
            decoration: const InputDecoration(labelText: '类型'),
            items: SourceType.values
                .map((t) =>
                    DropdownMenuItem(value: t, child: Text(t.label)))
                .toList(),
            onChanged: (v) => setState(() => _type = v ?? _type),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _name,
            decoration: const InputDecoration(
                labelText: '名称', hintText: '留空则显示服务器地址'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _url,
            decoration: InputDecoration(
              labelText: '服务器地址',
              hintText: _type == SourceType.subsonic
                  ? 'http://host:4533'
                  : _type == SourceType.daoliyu
                      ? 'http://host:4000'
                      : 'http://host:5005/dav',
            ),
            keyboardType: TextInputType.url,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _user,
            decoration: const InputDecoration(labelText: '用户名'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _pass,
            decoration: const InputDecoration(labelText: '密码'),
            obscureText: true,
          ),
          if (canPickDirs) ...[
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: Text(_roots.isEmpty
                      ? '音乐目录：未选择（默认整库）'
                      : '已选 ${_roots.length} 个目录'),
                ),
                TextButton.icon(
                  onPressed: _pickDirs,
                  icon: const Icon(Icons.folder_open),
                  label: const Text('选择目录'),
                ),
              ],
            ),
            if (_roots.isNotEmpty)
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _roots
                    .map((r) => Chip(
                          label: Text(r,
                              overflow: TextOverflow.ellipsis),
                          onDeleted: () => setState(() => _roots.remove(r)),
                        ))
                    .toList(),
              ),
          ],
          const SizedBox(height: 24),
          Row(
            children: [
              FilledButton.tonalIcon(
                onPressed: _testing ? null : _test,
                icon: _testing
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.wifi_tethering),
                label: const Text('测试连接'),
              ),
              const SizedBox(width: 12),
              if (_testMsg != null)
                Expanded(
                  child: Text(
                    _testMsg!,
                    style: TextStyle(
                        color: _testOk ? Colors.green : Colors.red),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// 目录多层钻取多选器（对齐插件的目录选择器）
class DirectoryPickerPage extends StatefulWidget {
  final SourceConfig config;
  final List<String> selected;
  const DirectoryPickerPage(
      {super.key, required this.config, required this.selected});

  @override
  State<DirectoryPickerPage> createState() => _DirectoryPickerPageState();
}

class _DirectoryPickerPageState extends State<DirectoryPickerPage> {
  late SourceAdapter _adapter;
  final List<String> _stack = []; // 钻取路径栈
  List<DirEntry> _entries = const [];
  late Set<String> _picked;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _adapter = context.read<SourceRepository>().createAdapter(widget.config);
    _picked = widget.selected.toSet();
    _load(null);
  }

  @override
  void dispose() {
    _adapter.dispose();
    super.dispose();
  }

  Future<void> _load(String? path) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await _adapter.listDirectories(path);
      if (!mounted) return;
      setState(() {
        _entries = list;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _enter(DirEntry d) {
    _stack.add(d.path);
    _load(d.path);
  }

  bool _back() {
    if (_stack.isEmpty) return false;
    _stack.removeLast();
    _load(_stack.isEmpty ? null : _stack.last);
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final crumb = _stack.isEmpty ? '/' : _stack.last;
    // 不用 PopScope：其回调签名在 Flutter 3.24 前后不一致（onPopInvoked /
    // onPopInvokedWithResult），跨 SDK 版本易编译失败。改为自管返回按钮，行为等价。
    return Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () {
              if (!_back()) Navigator.pop(context);
            },
          ),
          title: const Text('选择目录'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, _picked.toList()),
              child: Text('完成(${_picked.length})'),
            ),
          ],
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(32),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(crumb,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall),
              ),
            ),
          ),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text('读取失败：$_error'),
                    ),
                  )
                : ListView(
                    children: [
                      if (_stack.isNotEmpty)
                        ListTile(
                          leading: const Icon(Icons.arrow_upward),
                          title: const Text('返回上一层'),
                          onTap: _back,
                        ),
                      ..._entries.map((d) {
                        final checked = _picked.contains(d.path);
                        return ListTile(
                          leading: Checkbox(
                            value: checked,
                            onChanged: (v) => setState(() {
                              if (v == true) {
                                _picked.add(d.path);
                              } else {
                                _picked.remove(d.path);
                              }
                            }),
                          ),
                          title: Text(d.name),
                          subtitle: d.count == null
                              ? null
                              : Text('${d.count} 首'),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => _enter(d),
                        );
                      }),
                      if (_entries.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(24),
                          child: Center(child: Text('该层没有子目录')),
                        ),
                    ],
                  ),
    );
  }
}

/// 从 SongLoft 服务器导入账号下已配置的音源
class SongLoftImportPage extends StatefulWidget {
  const SongLoftImportPage({super.key});

  @override
  State<SongLoftImportPage> createState() => _SongLoftImportPageState();
}

class _SongLoftImportPageState extends State<SongLoftImportPage> {
  final _url = TextEditingController(text: 'http://192.168.31.28:58091');
  final _user = TextEditingController();
  final _pass = TextEditingController();
  bool _busy = false;
  String? _msg;

  @override
  void dispose() {
    _url.dispose();
    _user.dispose();
    _pass.dispose();
    super.dispose();
  }

  Future<void> _import() async {
    setState(() {
      _busy = true;
      _msg = null;
    });
    final r = await context.read<SourcesProvider>().connectSongLoft(
          _url.text.trim(),
          _user.text.trim(),
          _pass.text,
        );
    if (!mounted) return;
    setState(() {
      _busy = false;
      _msg = r.isOk ? '已连接 SongLoft' : '连接失败：${r.error}';
    });
    if (r.isOk && mounted) {
      context.read<LibraryProvider>().reset();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('连接到 SongLoft')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('登录 SongLoft 服务器，导入该账号下已配置好的音源。'),
          const SizedBox(height: 16),
          TextField(
            controller: _url,
            decoration: const InputDecoration(labelText: '服务器地址'),
            keyboardType: TextInputType.url,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _user,
            decoration: const InputDecoration(labelText: '用户名'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _pass,
            decoration: const InputDecoration(labelText: '密码'),
            obscureText: true,
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: _busy ? null : _import,
            icon: _busy
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.cloud_download),
            label: const Text('登录并导入'),
          ),
          if (_msg != null) ...[
            const SizedBox(height: 16),
            Text(_msg!),
          ],
        ],
      ),
    );
  }
}
