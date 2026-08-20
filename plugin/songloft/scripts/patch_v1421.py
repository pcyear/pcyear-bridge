# v1.4.21 插件更新检测：打开时查 Gitee 发布仓 manifest，有更新则在二维码下版本号旁
# 显示「立即更新 / 不再提示」（不再提示 = 记录忽略版本，下一版本才再提示）
import io

# ---------- app.js ----------
p = 'static/js/app.js'
s = io.open(p, 'r', encoding='utf-8').read()

# 1. .ver div 加 id
old1 = '<div class="ver">v\'+PLUGIN_VERSION+"</div>"'
new1 = '<div class="ver" id="verLine">v\'+PLUGIN_VERSION+"</div>"'
assert s.count(old1) == 1, 'ver anchor'
s = s.replace(old1, new1, 1)
print('OK: verLine id')

# 2. loadSources 尾部调 checkPluginUpdate()
old2 = '(!uiStateRestored||!drill&&currentList.length===0)&&(renderSources(),drill?await loadDrill():await loadView(view))}function showSrcE'
new2 = ('(!uiStateRestored||!drill&&currentList.length===0)&&(renderSources(),drill?await loadDrill():await loadView(view));'
        'checkPluginUpdate()}'
        'function cmpVer(a,b){const p=String(a||"0").split(".").map(x=>parseInt(x,10)||0),q=String(b||"0").split(".").map(x=>parseInt(x,10)||0);'
        'for(let i=0;i<Math.max(p.length,q.length);i++){const x=p[i]||0,y=q[i]||0;if(x!==y)return x>y?1:-1}return 0}'
        'let _updVer=null,_updUrl=null;'
        'function renderUpdateTip(){const v=$("verLine");if(!v)return;const base=v.innerHTML;'
        'v.innerHTML=base+\' <span class="upd">\\uD83D\\uDD14 v\'+esc(_updVer)+\'</span> <button class="btn sm upd-btn" id="updGo">立即更新</button> <button class="btn sm" id="updSkip">不再提示</button>\';'
        'const g=$("updGo"),sk=$("updSkip");'
        'g&&(g.onclick=()=>doUpdate());'
        'sk&&(sk.onclick=()=>{try{localStore.set("mm:update_ignore_ver",_updVer)}catch{};v.innerHTML=base})}'
        'async function checkPluginUpdate(){try{const r=await api(PLUGIN_BASE+"/update-check","GET",void 0,8e3);'
        'if(!r||!r.ok||!r.hasUpdate)return;let ig="";try{ig=localStore.get("mm:update_ignore_ver")||""}catch{}'
        'if(ig&&cmpVer(r.latest,ig)<=0)return;_updVer=r.latest;_updUrl=r.downloadUrl||"";renderUpdateTip()}catch{}}'
        'async function doUpdate(){if(!_updUrl)return;'
        'try{const r=await api(PLUGIN_BASE+"/update-fetch?url="+encodeURIComponent(_updUrl),"GET",void 0,6e4);'
        'r&&r.ok?toast(r.message||"已下载，请到插件管理页更新"):toast((r&&r.message)||"更新下载失败")}'
        'catch(e){toast("更新下载失败："+((e&&e.message)||e))}}'
        'function showSrcE')
assert s.count(old2) == 1, 'loadSources anchor'
s = s.replace(old2, new2, 1)
print('OK: checkPluginUpdate + 函数')

# 3. 版本 1.4.20 -> 1.4.21
s = s.replace('1.4.20', '1.4.21')
io.open(p, 'w', encoding='utf-8').write(s)
print('OK: app.js 版本 1.4.21')

# ---------- app.css ----------
p2 = 'static/css/app.css'
c = io.open(p2, 'r', encoding='utf-8').read()
old_c = '.qrbox'
i = c.rfind('.qrbox')
if i >= 0:
    # 在 .qrbox 区块结束后追加（简单起见在文件末尾加，CSS 顺序不影响类）
    pass
c += '\n/* v1.4.21 更新提示 */\n.qrbox .upd{color:#ffa726;font-size:11px;margin-left:4px;vertical-align:middle}\n.qrbox .upd-btn{margin-left:6px}\n'
io.open(p2, 'w', encoding='utf-8').write(c)
print('OK: app.css 更新提示样式')

# ---------- plugin.json ----------
q = 'plugin.json'
t = io.open(q, 'r', encoding='utf-8').read()
t = t.replace('1.4.20', '1.4.21')
io.open(q, 'w', encoding='utf-8').write(t)
print('OK: plugin.json 1.4.21')
print('done')
