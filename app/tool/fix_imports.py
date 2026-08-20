#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把跳转逻辑迁到 navigation.dart 后，同步各页面的 import 与调用点。"""
import io, os

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def rd(p):
    return io.open(os.path.join(BASE, p), encoding='utf-8').read()


def wr(p, s):
    io.open(os.path.join(BASE, p), 'w', encoding='utf-8', newline='\n').write(s)


# ---------- library_screen.dart ----------
p = 'lib/presentation/screens/library_screen.dart'
s = rd(p)

old_imports = (
    "import 'package:flutter/material.dart';\n"
    "import 'package:pcyear_bridge/core/models.dart';\n"
    "import 'package:pcyear_bridge/data/player/audio_player_service.dart';\n"
    "import 'package:pcyear_bridge/presentation/providers/library_provider.dart';\n"
    "import 'package:pcyear_bridge/presentation/screens/favorites_screen.dart';\n"
    "import 'package:pcyear_bridge/presentation/screens/player_screen.dart';\n"
    "import 'package:pcyear_bridge/presentation/widgets/track_list_tile.dart';\n"
    "import 'package:provider/provider.dart';"
)
new_imports = (
    "import 'package:flutter/material.dart';\n"
    "import 'package:pcyear_bridge/presentation/navigation.dart';\n"
    "import 'package:pcyear_bridge/presentation/providers/library_provider.dart';\n"
    "import 'package:pcyear_bridge/presentation/screens/favorites_screen.dart';\n"
    "import 'package:pcyear_bridge/presentation/widgets/track_list_tile.dart';\n"
    "import 'package:provider/provider.dart';"
)
assert old_imports in s, 'library imports not matched'
s = s.replace(old_imports, new_imports)
s = s.replace('onTap: () => _openCollection(', 'onTap: () => openCollection(')

marker = '/// \u6253\u5f00\u4e13\u8f91/\u827a\u672f\u5bb6\u8be6\u60c5\u3002sourceId \u4e3a\u7a7a'
assert marker in s, 'library tail marker not found'
s = s[:s.index(marker)].rstrip() + '\n'
wr(p, s)
print('library_screen ok')

# ---------- search_screen.dart ----------
p = 'lib/presentation/screens/search_screen.dart'
s = rd(p)
old = ("import 'package:pcyear_bridge/presentation/providers/library_provider.dart';\n"
       "import 'package:pcyear_bridge/presentation/screens/library_screen.dart';")
new = ("import 'package:pcyear_bridge/presentation/navigation.dart';\n"
       "import 'package:pcyear_bridge/presentation/providers/library_provider.dart';")
assert old in s, 'search imports not matched'
s = s.replace(old, new)

old_open_start = '  void _open(String? sourceId, String id, String title, bool isArtist) {'
i = s.index(old_open_start)
j = s.index('\n  }\n', i) + len('\n  }\n')
new_open = ('  void _open(String? sourceId, String id, String title, bool isArtist) =>\n'
            '      openCollection(context,\n'
            '          sourceId: sourceId, id: id, title: title, isArtist: isArtist);\n')
s = s[:i] + new_open + s[j:]
wr(p, s)
print('search_screen ok')

# ---------- favorites_screen.dart ----------
p = 'lib/presentation/screens/favorites_screen.dart'
s = rd(p)
s = s.replace(
    "import 'package:pcyear_bridge/presentation/screens/library_screen.dart';",
    "import 'package:pcyear_bridge/presentation/navigation.dart';")
wr(p, s)
print('favorites_screen ok')

# ---------- main.dart ----------
p = 'lib/main.dart'
s = rd(p)
s = s.replace('void main() async {', 'Future<void> main() async {')
wr(p, s)
print('main ok')
