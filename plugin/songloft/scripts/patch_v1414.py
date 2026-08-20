# -*- coding: utf-8 -*-
# v1.4.14 前端：文件夹形式只显示音频数量（去「N 项」）
import io, re

P = 'static/js/app.js'
js = io.open(P, 'r', encoding='utf-8').read()

# 1. flushCardInfo 副标题：只显示「N 首」，去掉 albumCount「N 项」
pat1 = re.compile(r'const c=\[\];s\.artist&&c\.push\(s\.artist\);s\.trackCount!=null\?c\.push\([^)]*\):s\.albumCount!=null&&c\.push\([^)]*\);a\.textContent=c\.join\("[^"]*"\)')
new1 = 'const c=[];s.artist&&c.push(s.artist);s.trackCount!=null&&c.push(s.trackCount+" \\u9996");a.textContent=c.join(" \\xB7 ")'
m1 = pat1.search(js)
assert m1, 'flushCardInfo pattern not found'
print('flushCardInfo old:', repr(m1.group(0))[:120])
js = js[:m1.start()] + new1 + js[m1.end():]
print('OK: flushCardInfo 只显示首')

# 2. artistCountLabel：统一只显示 trackCount 首
pat2 = re.compile(r'function artistCountLabel\(t\)\{[^}]*\}')
new2 = 'function artistCountLabel(t){return (t.trackCount||0)+" \\u9996"}'
m2 = pat2.search(js)
assert m2, 'artistCountLabel pattern not found'
print('artistCountLabel old:', repr(m2.group(0))[:120])
js = js[:m2.start()] + new2 + js[m2.end():]
print('OK: artistCountLabel 只显示首')

# 3. 版本 1.4.13 -> 1.4.14
js = js.replace('1.4.13', '1.4.14')
io.open(P, 'w', encoding='utf-8').write(js)
s = io.open('plugin.json', 'r', encoding='utf-8').read()
s = s.replace('1.4.13', '1.4.14')
io.open('plugin.json', 'w', encoding='utf-8').write(s)
print('written v1.4.14')
