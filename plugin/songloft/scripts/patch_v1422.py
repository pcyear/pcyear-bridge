# v1.4.22 修复跨插件调用被 sdkPathOf 误改写：miot 投屏接口 404
# 根因：CastManager.loadDevices() 调 miot 插件的 /api/v1/jsplugin/miot/mina/devices，
# sdkPathOf 把「jsplugin/<任意插件>/」段剥掉 → SDK apiGet 自动加本插件前缀
# → 实际发出 /api/v1/jsplugin/multisource-music/mina/devices → 404（投屏设备永远加载不到）。
# 修复：跨插件完整路径（jsplugin/<非本插件>/）原样返回，不剥除；本插件路径保持原行为。
import io

p = 'static/js/app.js'
s = io.open(p, 'r', encoding='utf-8').read()

old = ('function sdkPathOf(t){let e=String(t||"");'
       'try{if(/^https?:\\/\\//i.test(e)){const n=new URL(e);e=n.pathname+(n.search||"")}'
       'e=e.replace(/^\\/api\\/v1\\/jsplugin\\/[^/]+\\/?/,"/"),e.startsWith("/")||(e="/"+e)}catch{}return e}')
new = ('function sdkPathOf(t){let e=String(t||"");'
       'try{if(/^https?:\\/\\//i.test(e)){const n=new URL(e);e=n.pathname+(n.search||"")}'
       'if(/^\\/api\\/v1\\/jsplugin\\/(?!multisource-music\\/)[^/]+\\//.test(e))return e;'
       'e=e.replace(/^\\/api\\/v1\\/jsplugin\\/[^/]+\\/?/,"/"),e.startsWith("/")||(e="/"+e)}catch{}return e}')
assert s.count(old) == 1, 'sdkPathOf anchor'
s = s.replace(old, new, 1)
print('OK: sdkPathOf 跨插件保护')

# 版本 1.4.21 -> 1.4.22
s = s.replace('1.4.21', '1.4.22')
io.open(p, 'w', encoding='utf-8').write(s)

q = 'plugin.json'
t = io.open(q, 'r', encoding='utf-8').read()
t = t.replace('1.4.21', '1.4.22')
io.open(q, 'w', encoding='utf-8').write(t)
print('OK: 版本 1.4.22')
