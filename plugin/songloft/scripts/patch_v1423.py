# v1.4.23 移除注定失败的 miot 跨插件调用 + 回滚 sdkPathOf 改动
# 背景：宿主 SDK 的 apiGet/apiPost 对任何路径都强制加本插件前缀（v1.4.22 实测：
# 传完整路径 /api/v1/jsplugin/miot/mina/devices 后实际发出 multisource-music/api/v1/jsplugin/miot/mina/devices）；
# 前端拿不到 access_token（宿主不注入）、后端 fetch 宿主自身 URL 会挂起（铁律⑮）——
# 插件间 API 调用在宿主体系内不可行。miot 投屏（投到小米音箱）从未真正工作过（一直 404 静默降级）。
# 决定：移除 loadDevices 的 miot 请求（不再每次刷新插件发 404 噪音），投屏面板只保留本机；
# 恢复 sdkPathOf 原样（负向前瞻改动回滚，避免无关行为变化）。
import io

p = 'static/js/app.js'
s = io.open(p, 'r', encoding='utf-8').read()

# ---- 1. 回滚 sdkPathOf（v1.4.22 改动 → 原样）----
old_sdk = ('function sdkPathOf(t){let e=String(t||"");'
           'try{if(/^https?:\\/\\//i.test(e)){const n=new URL(e);e=n.pathname+(n.search||"")}'
           'if(/^\\/api\\/v1\\/jsplugin\\/(?!multisource-music\\/)[^/]+\\//.test(e))return e;'
           'e=e.replace(/^\\/api\\/v1\\/jsplugin\\/[^/]+\\/?/,"/"),e.startsWith("/")||(e="/"+e)}catch{}return e}')
new_sdk = ('function sdkPathOf(t){let e=String(t||"");'
           'try{if(/^https?:\\/\\//i.test(e)){const n=new URL(e);e=n.pathname+(n.search||"")}'
           'e=e.replace(/^\\/api\\/v1\\/jsplugin\\/[^/]+\\/?/,"/"),e.startsWith("/")||(e="/"+e)}catch{}return e}')
assert s.count(old_sdk) == 1, 'sdkPathOf anchor'
s = s.replace(old_sdk, new_sdk, 1)
print('OK: sdkPathOf 回滚')

# ---- 2. loadDevices 短路（移除 miot 请求）----
old_dev = ('async loadDevices(){this.devices=[];'
           'try{const t=await api("/api/v1/jsplugin/miot/mina/devices");'
           'if(!t.ok||!t.success||!Array.isArray(t.data)){this.hasMiot=!1;return}'
           'this.hasMiot=!0,t.data.forEach(e=>{(e.devices||[]).forEach(n=>this.devices.push({...n,account_id:e.account_id}))})}'
           'catch{this.hasMiot=!1}}')
new_dev = ('/* 宿主 SDK 不支持插件间 API 调用（apiGet 强制本插件前缀 + 前端无 token + 后端禁 fetch 宿主 URL），'
           'miot 智能音箱投屏暂不可用；宿主支持插件间调用后再恢复 loadDevices */'
           'async loadDevices(){this.devices=[];this.hasMiot=!1;return}')
assert s.count(old_dev) == 1, 'loadDevices anchor'
s = s.replace(old_dev, new_dev, 1)
print('OK: loadDevices 短路')

# ---- 3. 版本 1.4.22 -> 1.4.23 ----
s = s.replace('1.4.22', '1.4.23')
io.open(p, 'w', encoding='utf-8').write(s)

q = 'plugin.json'
t = io.open(q, 'r', encoding='utf-8').read()
t = t.replace('1.4.22', '1.4.23')
io.open(q, 'w', encoding='utf-8').write(t)
print('OK: 版本 1.4.23')
