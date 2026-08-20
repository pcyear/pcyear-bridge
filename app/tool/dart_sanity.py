#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""离线 Dart 一致性检查：导入路径、括号配对、跨文件符号引用。
不能替代 dart analyze，但能抓出手写脚手架里最常见的低级错误。
"""
import os, re, sys, collections

# 本文件位于 <app>/tool/dart_sanity.py，故 app 根目录为父目录的父目录。
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, 'lib')

files = []
for dp, _, fns in os.walk(LIB):
    for fn in fns:
        if fn.endswith('.dart'):
            files.append(os.path.join(dp, fn))
files.sort()

problems = []
declared = {}          # symbol -> file
file_imports = {}      # file -> set(resolved abs path)
file_src = {}

DART_SDK_LIBS = {'dart:async','dart:convert','dart:math','dart:io','dart:typed_data','dart:ui','dart:collection'}

def strip_code(s):
    """去掉字符串字面量与注释，避免误判括号/符号。"""
    out = []
    i, n = 0, len(s)
    while i < n:
        c = s[i]
        if c == '/' and i + 1 < n and s[i+1] == '/':
            j = s.find('\n', i)
            i = n if j < 0 else j
            continue
        if c == '/' and i + 1 < n and s[i+1] == '*':
            j = s.find('*/', i + 2)
            i = n if j < 0 else j + 2
            continue
        if c in ('"', "'"):
            # 三引号
            if s.startswith(c*3, i):
                j = s.find(c*3, i+3)
                i = n if j < 0 else j + 3
                continue
            j = i + 1
            while j < n:
                if s[j] == '\\':
                    j += 2
                    continue
                if s[j] == c or s[j] == '\n':
                    break
                j += 1
            i = j + 1
            continue
        out.append(c)
        i += 1
    return ''.join(out)

def strip_comments(s):
    """只去注释、保留字符串字面量（用于 import 解析，避免误删 import 'package:..'）。"""
    out = []
    i, n = 0, len(s)
    while i < n:
        c = s[i]
        if c == '/' and i + 1 < n and s[i+1] == '/':
            j = s.find('\n', i)
            i = n if j < 0 else j
            continue
        if c == '/' and i + 1 < n and s[i+1] == '*':
            j = s.find('*/', i + 2)
            i = n if j < 0 else j + 2
            continue
        out.append(c)
        i += 1
    return ''.join(out)

# ---- 1. 读取 + 导入解析 + 括号配对 ----
for f in files:
    src = open(f, encoding='utf-8').read()
    file_src[f] = src
    code = strip_code(src)

    for name, ch in (('()', '()'), ('{}', '{}'), ('[]', '[]')):
        if code.count(ch[0]) != code.count(ch[1]):
            problems.append(f"[括号] {os.path.relpath(f, ROOT)}: {ch[0]}={code.count(ch[0])} {ch[1]}={code.count(ch[1])}")

    imps = set()
    for m in re.finditer(r"""import\s+['"]([^'"]+)['"]""", strip_comments(src)):
        p = m.group(1)
        if p.startswith('dart:'):
            if p not in DART_SDK_LIBS:
                problems.append(f"[导入] {os.path.relpath(f, ROOT)}: 少见的 dart 库 {p}")
            continue
        if p.startswith('package:pcyear_bridge/'):
            tgt = os.path.join(LIB, p[len('package:pcyear_bridge/'):])
        elif p.startswith('package:'):
            continue  # 第三方，交给 pub
        else:
            tgt = os.path.normpath(os.path.join(os.path.dirname(f), p))
        if not os.path.isfile(tgt):
            problems.append(f"[导入] {os.path.relpath(f, ROOT)}: 找不到 {p}")
        else:
            imps.add(os.path.normpath(tgt))
    file_imports[f] = imps

# ---- 2. 收集顶层声明 ----
DECL = re.compile(r'^(?:abstract\s+|sealed\s+|final\s+|base\s+|interface\s+|mixin\s+)*(?:class|enum|extension|typedef|mixin)\s+(\w+)', re.M)
TOPFN = re.compile(r'^(?:[\w<>,\s\?]+\s+)?(\w+)\s*(?:<[^>]*>)?\s*\([^;{]*\)\s*(?:async\s*)?\{', re.M)
for f in files:
    code = strip_code(file_src[f])
    for m in DECL.finditer(code):
        declared.setdefault(m.group(1), []).append(f)

# ---- 3. 跨文件引用检查（只查自定义大写符号）----
known_flutter = set("""
Widget StatelessWidget StatefulWidget State BuildContext Key MaterialApp Scaffold AppBar Text Icon Icons Column Row
Container SizedBox Padding EdgeInsets Center Expanded ListView ListTile TextField TextEditingController Colors Color
Theme ThemeData ColorScheme Brightness Navigator MaterialPageRoute Slider IconButton TextButton ElevatedButton
FilledButton OutlinedButton CircularProgressIndicator TabBar TabBarView TabController DefaultTabController Tab
NavigationBar NavigationDestination ChangeNotifier ChangeNotifierProvider MultiProvider Provider Consumer Duration
Future Stream String int double bool List Map Set Object Uri Exception Error DateTime StreamSubscription
WidgetsFlutterBinding runApp Align Alignment Stack Positioned Divider CircleAvatar Image NetworkImage BoxFit
InkWell GestureDetector SafeArea SnackBar ScaffoldMessenger AlertDialog Dialog showDialog Form FormField
ValueNotifier ValueListenableBuilder StreamBuilder FutureBuilder AsyncSnapshot Builder MediaQuery TextStyle
FontWeight TextAlign TextOverflow BorderRadius BoxDecoration LinearGradient Card Chip Wrap Spacer Opacity
AnimatedBuilder Animation AnimationController TickerProviderStateMixin SingleTickerProviderStateMixin
AudioPlayer AudioService AudioHandler BaseAudioHandler MediaItem PlaybackState AudioProcessingState
ProcessingState ConcatenatingAudioSource AudioSource LockCachingAudioSource SharedPreferences
XmlDocument XmlElement XmlNode HttpClient Client Response Request Base64Encoder Base64Decoder
Utf8Decoder Utf8Encoder Random num Iterable Comparable Function Type Never Null void dynamic
RegExp StringBuffer Completer Timer Uint8List ByteData Codec
""".split())

use_re = re.compile(r'\b([A-Z][A-Za-z0-9_]*)\b')
for f in files:
    code = strip_code(file_src[f])
    own = {m.group(1) for m in DECL.finditer(code)}
    reachable = set(own)
    for imp in file_imports[f]:
        icode = strip_code(file_src.get(imp, ''))
        reachable |= {m.group(1) for m in DECL.finditer(icode)}
        # 传递导出（export）
        for m in re.finditer(r"""export\s+['"]([^'"]+)['"]""", file_src.get(imp, '')):
            p = m.group(1)
            t = os.path.normpath(os.path.join(os.path.dirname(imp), p)) if not p.startswith('package:') \
                else os.path.join(LIB, p[len('package:pcyear_bridge/'):])
            reachable |= {mm.group(1) for mm in DECL.finditer(strip_code(file_src.get(t, '')))}
    for m in use_re.finditer(code):
        sym = m.group(1)
        if sym in reachable or sym in known_flutter:
            continue
        if sym in declared:
            problems.append(f"[引用] {os.path.relpath(f, ROOT)}: 使用了 {sym}（定义在 {os.path.relpath(declared[sym][0], ROOT)}）但未导入")

# ---- 4. 重复声明 ----
for sym, fs in declared.items():
    if len(fs) > 1:
        problems.append(f"[重复] 符号 {sym} 在多处声明: {[os.path.relpath(x, ROOT) for x in fs]}")

# ---- 5. 循环导入 ----
color = {}
def dfs(node, stack):
    color[node] = 1
    stack.append(node)
    for nxt in sorted(file_imports.get(node, ())):
        if color.get(nxt, 0) == 1:
            cyc = stack[stack.index(nxt):] + [nxt]
            problems.append("[循环] " + " -> ".join(os.path.relpath(x, ROOT) for x in cyc))
        elif color.get(nxt, 0) == 0:
            dfs(nxt, stack)
    stack.pop()
    color[node] = 2

for f in files:
    if color.get(f, 0) == 0:
        dfs(f, [])

# ---- 6. 未使用的项目内导入 ----
# 注意：必须扫描全部标识符（含小写函数名 playAndOpen/openCollection），
# 否则 use_re 的大写过滤会把它们误判为「未使用」。
all_id_re = re.compile(r'\b([A-Za-z_]\w*)\b')
for f in files:
    code = strip_code(file_src[f])
    used = set(all_id_re.findall(code))
    for imp in sorted(file_imports[f]):
        icode = strip_code(file_src.get(imp, ''))
        # 被导入文件暴露的顶层声明（class/enum/...）
        exported = {m.group(1) for m in DECL.finditer(icode)}
        # 被导入文件的顶层函数（如 playAndOpen / openCollection）
        fns = {m.group(1) for m in re.finditer(r'^[\w<>,\s\?]*\s(\w+)\s*\(', icode, re.M)}
        # 被导入文件 export 出去的符号（传递可用）
        exp_syms = set()
        for m in re.finditer(r"""export\s+['"]([^'"]+)['"]""", file_src.get(imp, '')):
            p = m.group(1)
            t = os.path.normpath(os.path.join(os.path.dirname(imp), p)) if not p.startswith('package:') \
                else os.path.join(LIB, p[len('package:pcyear_bridge/'):])
            exp_syms |= {mm.group(1) for mm in DECL.finditer(strip_code(file_src.get(t, '')))}
            exp_syms |= {mm.group(1) for mm in re.finditer(r'^[\w<>,\s\?]*\s(\w+)\s*\(', strip_code(file_src.get(t, '')), re.M)}
        names = exported | fns | exp_syms
        if names and not (names & used):
            problems.append(f"[未用] {os.path.relpath(f, ROOT)}: 导入了 {os.path.relpath(imp, ROOT)} 但未使用其符号")

seen = set()
uniq = [p for p in problems if not (p in seen or seen.add(p))]

print(f"扫描 {len(files)} 个 dart 文件，声明 {len(declared)} 个顶层符号")
if not uniq:
    print("✅ 未发现导入/括号/跨文件引用问题")
else:
    print(f"⚠️ 发现 {len(uniq)} 个问题:")
    for p in uniq:
        print("  " + p)
sys.exit(0)
