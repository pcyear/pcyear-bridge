# -*- coding: utf-8 -*-
# v1.4.15 前端：artistCountLabel 无 trackCount 显示空
import io, re

P = 'static/js/app.js'
js = io.open(P, 'r', encoding='utf-8').read()

# 当前文件里的 artistCountLabel（可能是真实字符或字面转义，用宽松正则）
pat = re.compile(r'function artistCountLabel\(t\)\{[^}]*\}')
m = pat.search(js)
assert m, 'artistCountLabel not found'
print('old:', repr(m.group(0)))
new = 'function artistCountLabel(t){return t.trackCount!=null?t.trackCount+" \\u9996":""}'
js = js[:m.start()] + new + js[m.end():]
print('OK: artistCountLabel 空态')

js = js.replace('1.4.14', '1.4.15')
io.open(P, 'w', encoding='utf-8').write(js)
s = io.open('plugin.json', 'r', encoding='utf-8').read()
s = s.replace('1.4.14', '1.4.15')
io.open('plugin.json', 'w', encoding='utf-8').write(s)
print('written v1.4.15')
