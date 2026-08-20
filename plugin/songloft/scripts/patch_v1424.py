# v1.4.24 真正解决 miot 跨插件调用：后端 /miot-proxy 代拉（带插件 token）
# 恢复被 v1.4.23 误移除的 loadDevices，并把 CastManager 全部 miot 调用改走本插件代理。
import io

p = 'static/js/app.js'
s = io.open(p, 'r', encoding='utf-8').read()

def rep(old, new, tag):
    global s
    c = s.count(old)
    assert c == 1, 'anchor[%s] count=%d' % (tag, c)
    s = s.replace(old, new, 1)
    print('OK:', tag)

# ---- 1. 恢复 loadDevices + 改走代理 ----
rep(
  '/* 宿主 SDK 不支持插件间 API 调用（apiGet 强制本插件前缀 + 前端无 token + 后端禁 fetch 宿主 URL），'
  'miot 智能音箱投屏暂不可用；宿主支持插件间调用后再恢复 loadDevices */'
  'async loadDevices(){this.devices=[];this.hasMiot=!1;return}',
  'async loadDevices(){this.devices=[];'
  'try{const t=await api(PLUGIN_BASE+"/miot-proxy?path="+encodeURIComponent("mina/devices"));'
  'if(!t.ok||!t.success||!Array.isArray(t.data)){this.hasMiot=!1;return}'
  'this.hasMiot=!0,t.data.forEach(e=>{(e.devices||[]).forEach(n=>this.devices.push({...n,account_id:e.account_id}))})}'
  'catch{this.hasMiot=!1}}',
  'loadDevices 恢复+代理')

# ---- 2. player/play ×2 ----
rep(
  'api("/api/v1/jsplugin/miot/player/play","POST",{account_id:this.current.accountId,device_id:this.current.id,playlist_id:s,start_index:n,play_mode:o})',
  'api(PLUGIN_BASE+"/miot-proxy?path="+encodeURIComponent("player/play"),"POST",{account_id:this.current.accountId,device_id:this.current.id,playlist_id:s,start_index:n,play_mode:o})',
  'player/play #1')
rep(
  'api("/api/v1/jsplugin/miot/player/play","POST",{account_id:this.current.accountId,device_id:this.current.id,playlist_id:this.castPlaylistId,start_index:t,p',
  'api(PLUGIN_BASE+"/miot-proxy?path="+encodeURIComponent("player/play"),"POST",{account_id:this.current.accountId,device_id:this.current.id,playlist_id:this.castPlaylistId,start_index:t,p',
  'player/play #2')

# ---- 3. player/toggle ×2（模板串）----
rep(
  'api(`/api/v1/jsplugin/miot/player/toggle?account_id=${this.current.accountId}&device_id=${this.current.id}`,"POST")',
  'api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("player/toggle")}&account_id=${this.current.accountId}&device_id=${this.current.id}`,"POST")',
  'player/toggle #1')
rep(
  'api(`/api/v1/jsplugin/miot/player/toggle?account_id=${t.accountId}&device_id=${t.id}`,"POST")',
  'api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("player/toggle")}&account_id=${t.accountId}&device_id=${t.id}`,"POST")',
  'player/toggle #2')

# ---- 4. player/status ×2（模板串）----
rep(
  'api(`/api/v1/jsplugin/miot/player/status?account_id=${t.accountId}&device_id=${t.id}`)',
  'api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("player/status")}&account_id=${t.accountId}&device_id=${t.id}`)',
  'player/status #1')
rep(
  'api(`/api/v1/jsplugin/miot/player/status?account_id=${this.current.accountId}&device_id=${this.current.id}`)',
  'api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("player/status")}&account_id=${this.current.accountId}&device_id=${this.current.id}`)',
  'player/status #2')

# ---- 5. 版本 1.4.23 -> 1.4.24 ----
s = s.replace('1.4.23', '1.4.24')
io.open(p, 'w', encoding='utf-8').write(s)

q = 'plugin.json'
t = io.open(q, 'r', encoding='utf-8').read()
t = t.replace('1.4.23', '1.4.24')
io.open(q, 'w', encoding='utf-8').write(t)
print('OK: 版本 1.4.24')
