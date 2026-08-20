# v1.4.3 前端补丁（Python 版）：列表骨架 + 按需补全
# 覆盖 8 处：封面懒加载 / 封面并发池 / makeCard needInfo / renderList / loadMoreList /
#           scheduleCardInfo+flushCardInfo / openAlbum+openArtist / openPlaylist
import io, sys

P = 'static/js/app.js'
js = io.open(P, 'r', encoding='utf-8', errors='replace').read()

def rep(old, new, label):
    global js
    n = js.count(old)
    if n != 1:
        print('FAIL %s: found %d (expect 1)' % (label, n)); sys.exit(1)
    js = js.replace(old, new)
    print('OK %s' % label)

# ---------- 1) makeCover → 懒加载 + lazyCover ----------
rep(
    r'function makeCover(t,e){const n=document.createElement("img");return n.className=t,n.alt="",n.src=DEFAULT_COVER,e&&setCover(n,e),n}',
    r'function makeCover(t,e){const n=document.createElement("img");return n.className=t,n.alt="",n.src=DEFAULT_COVER,e&&lazyCover(n,e),n}function lazyCover(t,e){if(!("IntersectionObserver"in window)){setCover(t,e);return}const n=new IntersectionObserver(s=>{for(const o of s)if(o.isIntersecting){n.disconnect(),setCover(t,e);break}},{root:document.getElementById("content")||null,rootMargin:"200px 0px"});n.observe(t)}',
    'makeCover lazy',
)

# ---------- 2) 封面并发池 + coverDataUrl 入队 ----------
rep(
    r'async function coverDataUrl(t){if(!t)return null;const e=currentSourceId;if(e===SONGLOFT_SOURCE_ID){const s=`${PLUGIN_BASE}/cover-data?songId=${encodeURIComponent(t)}`;if(coverGet(s))return coverGet(s);try{const i=await(await fetch(s,{headers:authHeaders()})).json();if(i.ok&&i.dataUrl)return coverSet(s,i.dataUrl),i.dataUrl}catch{}return null}const n=`${PLUGIN_BASE}/cover-data?sourceId=${encodeURIComponent(e)}&coverId=${encodeURIComponent(t)}`;if(coverGet(n))return coverGet(n);try{const o=await(await fetch(n,{headers:authHeaders()})).json();if(o.ok&&o.dataUrl)return coverSet(n,o.dataUrl),o.dataUrl}catch{}return null}',
    r'let _coverQueue=[],_coverActive=0;const _COVER_MAX=3;function _pumpCovers(){if(_coverActive>=_COVER_MAX)return;while(_coverActive<_COVER_MAX&&_coverQueue.length){const j=_coverQueue.shift();_coverActive++;j.fn().then(v=>{_coverActive--;j.res(v);_pumpCovers()},er=>{_coverActive--;j.rej(er);_pumpCovers()})}}function _coverThrottle(fn){return new Promise((res,rej)=>{_coverQueue.push({fn,res,rej});_pumpCovers()})}async function coverDataUrl(t){if(!t)return null;const e=currentSourceId;if(e===SONGLOFT_SOURCE_ID){const s=`${PLUGIN_BASE}/cover-data?songId=${encodeURIComponent(t)}`;if(coverGet(s))return coverGet(s);try{const i=await _coverThrottle(async()=>{const r=await fetch(s,{headers:authHeaders()});return r.json()});if(i.ok&&i.dataUrl)return coverSet(s,i.dataUrl),i.dataUrl}catch{}return null}const n=`${PLUGIN_BASE}/cover-data?sourceId=${encodeURIComponent(e)}&coverId=${encodeURIComponent(t)}`;if(coverGet(n))return coverGet(n);try{const o=await _coverThrottle(async()=>{const r=await fetch(n,{headers:authHeaders()});return r.json()});if(o.ok&&o.dataUrl)return coverSet(n,o.dataUrl),o.dataUrl}catch{}return null}',
    'cover pool',
)

# ---------- 3) makeCard 增加 needInfo 参数 ----------
rep(
    r'function makeCard(t,e,n,s,o,i){const a=document.createElement("div");a.className="card";const r=document.createElement("input");',
    r'function makeCard(t,e,n,s,o,i,m){const a=document.createElement("div");a.className="card";m&&(a.dataset.info="1");const r=document.createElement("input");',
    'makeCard needInfo',
)

# ---------- 4) renderList：提取整体替换 ----------
a = js.find('function renderList(t){')
b = js.find('function updateListCount()', a)
assert a >= 0 and b > a, 'renderList not found'
old_render = js[a:b]
new_render = (r'''function renderList(t){const e=$("content");if(e.innerHTML="",!currentList.length){e.innerHTML='<div class="empty">\u6682\u65E0\u5185\u5BB9</div>',updateListCount();return}if(t==="tracks"){const n=document.createElement("div");n.className="track-list";for(const s of currentList)n.appendChild(trackRow(s));e.appendChild(n)}else if(t==="albums"){const n=document.createElement("div");n.className="grid";for(const s of currentList){const m=s.artist==null&&s.trackCount==null&&s.albumCount==null;const o=makeCard(s,"album",s.artist,m?"":(s.trackCount||0)+" \u9996",()=>openAlbum(s),()=>playDirectory("album",s),m);n.appendChild(o)}e.appendChild(n)}else if(t==="artists"){const n=document.createElement("div");n.className="grid";for(const s of currentList){const m=s.albumCount==null&&s.trackCount==null;const o=makeCard(s,"artist","",m?"":artistCountLabel(s),()=>openArtist(s),()=>playDirectory("artist",s),m);n.appendChild(o)}e.appendChild(n)}else if(t==="playlists"){const n=document.createElement("div");n.className="grid";for(const s of currentList){const m=s.trackCount==null;const o=makeCard(s,"playlist","",m?"":s.trackCount+" \u9996",()=>openPlaylist(s),()=>playDirectory("playlist",s),m);n.appendChild(o)}e.appendChild(n)}scheduleCardInfo(t),updateListCount()}''')
js = js.replace(old_render, new_render)
print('OK renderList skeleton')

# ---------- 5) loadMoreList：提取整体替换 ----------
c = js.find(r'listLoading=!0;const e=`${PLUGIN_BASE}/', 22000)
d = js.find('function renderList', c)
assert c >= 0 and d > c, 'loadMore not found'
old_more = js[c:d]
new_more = (r'''listLoading=!0;const e=`${PLUGIN_BASE}/${view==="tracks"?"tracks":view==="albums"?"albums":view==="artists"?"artists":"playlists"}?sourceId=${currentSourceId}&limit=${LIST_PAGE_SIZE}&offset=${currentList.length}`,n=viewToken;try{const s=await api(e);if(n!==viewToken)return;if(s.ok&&Array.isArray(s.list)){currentList=currentList.concat(s.list),listTotal=s.total||currentList.length;const o=$("content"),i=view;if(i==="tracks"){const a=o.querySelector(".track-list")||o;for(const r of s.list)a.appendChild(trackRow(r))}else{let a=o.querySelector(".grid");a||(a=document.createElement("div"),a.className="grid",o.appendChild(a));for(const r of s.list){const m=i==="albums"?r.artist==null&&r.trackCount==null&&r.albumCount==null:i==="artists"?r.albumCount==null&&r.trackCount==null:r.trackCount==null;const l=i==="albums"?makeCard(r,"album",r.artist,m?"":(r.trackCount||0)+" \u9996",()=>openAlbum(r),()=>playDirectory("album",r),m):i==="artists"?makeCard(r,"artist","",m?"":artistCountLabel(r),()=>openArtist(r),()=>playDirectory("artist",r),m):makeCard(r,"playlist","",m?"":r.trackCount+" \u9996",()=>openPlaylist(r),()=>playDirectory("playlist",r),m);a.appendChild(l)}scheduleCardInfo(i)}updateBulkBar(),updateListCount()}}catch{}listLoading=!1}''')
js = js.replace(old_more, new_more)
print('OK loadMoreList skeleton')

# ---------- 6) scheduleCardInfo / flushCardInfo（插在 renderList 前） ----------
rep(
    r'function renderList(t){const e=$("content");',
    r'''let _infoTimer=null,_infoIds=[];function scheduleCardInfo(t){const e=$("content");const n=e.querySelectorAll(".card[data-info]");if(!n.length)return;if(!("IntersectionObserver"in window)){for(const s of n){const a=s.dataset.id;a&&_infoIds.indexOf(a)<0&&_infoIds.push(a)}_infoTimer&&clearTimeout(_infoTimer);_infoTimer=setTimeout(flushCardInfo,50);return}const s=new IntersectionObserver(o=>{for(const r of o)if(r.isIntersecting){s.unobserve(r.target);const a=r.target.dataset.id;if(a&&_infoIds.indexOf(a)<0)_infoIds.push(a);_infoTimer&&clearTimeout(_infoTimer);_infoTimer=setTimeout(flushCardInfo,50)}},{root:e,rootMargin:"200px 0px"});for(const o of n)s.observe(o)}async function flushCardInfo(){_infoTimer=null;const t=_infoIds;_infoIds=[];if(!t.length)return;try{const e=await api(`${PLUGIN_BASE}/collections/info`,"POST",{sourceId:currentSourceId,ids:t},15e3);if(!e||!e.ok||!Array.isArray(e.list))return;const n=$("content");for(const s of e.list){if(!s||s.id==null)continue;const o=n.querySelectorAll(".card");for(const r of o){if(r.dataset.id!==s.id)continue;r.dataset.info="done";const a=r.querySelector(".s");if(a){const c=[];s.artist&&c.push(s.artist);s.trackCount!=null?c.push(s.trackCount+" \u9996"):s.albumCount!=null&&c.push(s.albumCount+" \u9879");a.textContent=c.join(" \xB7 ")}if(s.coverId){const c=r.querySelector(".cov");c&&c.src===DEFAULT_COVER&&setCover(c,s.coverId)}}}}catch{}}function renderList(t){const e=$("content");''',
    'scheduleCardInfo+flushCardInfo',
)

# ---------- 7) openAlbum / openArtist：无 coverId 先取元数据 ----------
rep(
    r'function openAlbum(t){drill={type:"album",id:t.id,name:t.name,coverId:t.coverId},loadDrill()}function openArtist(t){drill={type:"artist",id:t.id,name:t.name,coverId:t.coverId},loadDrill()}',
    r'''function openAlbum(t){drill={type:"album",id:t.id,name:t.name,coverId:t.coverId},drill.coverId?loadDrill():ensureDrillCover(t.id)}function openArtist(t){drill={type:"artist",id:t.id,name:t.name,coverId:t.coverId},drill.coverId?loadDrill():ensureDrillCover(t.id)}async function ensureDrillCover(t){try{const n=await api(`${PLUGIN_BASE}/collections/info`,"POST",{sourceId:currentSourceId,ids:[t]},15e3);if(n&&n.ok&&n.list&&n.list[0]&&n.list[0].coverId)drill.coverId=n.list[0].coverId}catch{}loadDrill()}''',
    'openAlbum/openArtist coverId fill',
)

# ---------- 8) openPlaylist ----------
rep(
    r'function openPlaylist(t){drill={type:"playlist",id:t.id,name:t.name},loadDrill()}',
    r'function openPlaylist(t){drill={type:"playlist",id:t.id,name:t.name,coverId:t.coverId},drill.coverId?loadDrill():ensureDrillCover(t.id)}',
    'openPlaylist coverId fill',
)

io.open(P, 'w', encoding='utf-8').write(js)
print('PATCHED OK, length:', len(js))
