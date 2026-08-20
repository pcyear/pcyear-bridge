import sys

path = "static/js/app.js"
s = open(path, encoding="utf-8").read()

def j(cs):
    out = []
    for ch in cs:
        o = ord(ch)
        if o > 127:
            if o > 0xFFFF:
                out.append("\\u{%04x}" % o)
            else:
                out.append("\\u%04x" % o)
        else:
            out.append(ch)
    return "".join(out)

def rep(old, new, label):
    c = s.count(old)
    if c != 1:
        raise SystemExit("[FAIL %s] expected 1 occurrence, found %d\nold=%r" % (label, c, old[:80]))
    s2 = s.replace(old, new, 1)
    print("[OK %s] replaced" % label)
    return s2

# ---- E1: add remoteFavSet global ----
s = rep("currentVolume=1,favoriteIds=new Set;",
        "currentVolume=1,favoriteIds=new Set,remoteFavSet=new Set;", "E1")

# ---- E2: loadFavoriteIds also builds remoteFavSet ----
old2 = ('function loadFavoriteIds(){try{const t=await api(`${PLUGIN_BASE}/favorite-ids`);'
        't.ok&&Array.isArray(t.ids)&&(favoriteIds=new Set(t.ids.map(Number)))}'
        'catch(t){console.log("[fav] load failed",t)}renderExtraControls()}')
new2 = ('function loadFavoriteIds(){try{const t=await api(`${PLUGIN_BASE}/favorite-ids`);'
        't.ok&&Array.isArray(t.ids)&&(favoriteIds=new Set(t.ids.map(Number)),'
        'remoteFavSet=new Set((t.remote||[]).map(r=>r.sourceId+":"+r.trackId)))}'
        'catch(t){console.log("[fav] load failed",t)}renderExtraControls()}')
s = rep(old2, new2, "E2")

# ---- E3: insert new helper functions before isCurrentFavorite ----
newfuncs = j('''function isFavOf(t){if(!t)return!1;const e=songIdOf(t);if(e&&favoriteIds.has(Number(e)))return!0;const s=t.sourceId||currentSourceId;if(s&&t.id!=null)return remoteFavSet.has(s+":"+t.id);return!1}
function currentSourceType(){const s=sources.find(x=>x.id===currentSourceId);return s&&s.type||""}
async function toggleFavoriteTrack(t){const s=t.sourceId||currentSourceId;const id=t.id;if(!s||id==null)return;const fav=!isFavOf(t);const e=songIdOf(t);try{const b=e?{fav:fav,songId:Number(e)}:{fav:fav,sourceId:s,trackId:String(id)};const r=await api(PLUGIN_BASE+"/favorite","POST",b,2e4,{prio:1});if(!r.ok)throw new Error(r.message||"HTTP "+(r.status||""));favoriteIds=new Set((r.ids||[]).map(Number));remoteFavSet=new Set((r.remote||[]).map(x=>x.sourceId+":"+x.trackId));document.querySelectorAll(".fav-row").forEach(o=>{if(o.dataset.id==String(id)){setIcon(o,fav?"heartFill":"heart");o.classList.toggle("active",fav);o.title=fav?"已收藏":"收藏"}});if(view==="favorites")loadView("favorites");toast(fav?"已收藏到 SongLoft（歌单：多源音乐桥·收藏）":"已取消收藏")}catch(e){toast("收藏失败："+(e&&e.message||e))}}
function plEditModalEl(){const m=document.getElementById("plEditModal");if(m)return m;const n=document.createElement("div");n.className="modal-mask";n.id="plEditModal";n.innerHTML='<div class="modal" style="width:340px"><div class="modal-head"><h3 id="plEditTitle"></h3><button class="modal-x" id="plEditX">✕</button></div><div class="modal-body"><div class="field"><label>歌单名称</label><input id="plEditInput" placeholder="未命名歌单" /></div></div><div class="modal-foot"><div class="row"><button class="btn" id="plEditCancel">取消</button><button class="btn primary" id="plEditOk">确定</button></div></div></div>';document.body.appendChild(n);document.getElementById("plEditX").onclick=()=>n.classList.remove("show");document.getElementById("plEditCancel").onclick=()=>n.classList.remove("show");n.onclick=e=>{if(e.target===n)n.classList.remove("show")};return n}
function openPlaylistEditModal(mode,pl){const m=plEditModalEl();document.getElementById("plEditTitle").textContent=mode==="create"?"新建歌单":mode==="delete"?"删除歌单":"重命名歌单";const inp=document.getElementById("plEditInput");inp.style.display=mode==="delete"?"none":"block";if(mode!=="create"&&pl)inp.value=pl.name||"";m.classList.add("show");setTimeout(()=>inp.focus(),30);document.getElementById("plEditOk").onclick=()=>plEditConfirm(mode,pl)}
async function plEditConfirm(mode,pl){const m=plEditModalEl();const name=document.getElementById("plEditInput").value.trim();try{if(mode==="create"){const r=await api(PLUGIN_BASE+"/upstream-playlist","POST",{op:"create",sourceId:currentSourceId,name:name||"未命名歌单"},2e4,{prio:1});if(!r.ok)throw new Error(r.message||"失败")}else if(mode==="rename"){const r=await api(PLUGIN_BASE+"/upstream-playlist","POST",{op:"update",sourceId:currentSourceId,playlistId:pl.id,name:name},2e4,{prio:1});if(!r.ok)throw new Error(r.message||"失败")}else if(mode==="delete"){if(typeof confirm==="function"&&!confirm("确定删除该歌单？此操作不可恢复"))return;const r=await api(PLUGIN_BASE+"/upstream-playlist","POST",{op:"delete",sourceId:currentSourceId,playlistId:pl.id},2e4,{prio:1});if(!r.ok)throw new Error(r.message||"失败")}m.classList.remove("show");toast("操作成功");refreshPlaylists()}catch(e){toast("操作失败："+(e&&e.message||e))}}
function refreshPlaylists(){try{localStore.del("list:"+currentSourceId+":playlists")}catch{}try{delete memCache["list:"+currentSourceId+":playlists"]}catch{}forceRefresh=!0;loadView("playlists")}
async function removeTrackFromPlaylist(trackId){forceRefresh=!0;try{const r=await api(PLUGIN_BASE+"/upstream-playlist","POST",{op:"update",sourceId:currentSourceId,playlistId:drill.id,trackIdsToRemove:[String(trackId)]},2e4,{prio:1});if(!r.ok)throw new Error(r.message||"失败");toast("已移除");loadDrill()}catch(e){toast("移除失败："+(e&&e.message||e))}}
''')
old3 = "function isCurrentFavorite(){"
if s.count(old3) != 1:
    raise SystemExit("[FAIL E3] isCurrentFavorite anchor not unique: %d" % s.count(old3))
s = s.replace(old3, newfuncs + old3, 1)
print("[OK E3] inserted helpers")

# ---- E5: per-row heart + (subsonic playlist) remove button ----
old5 = 'r.appendChild(l),e.appendChild(r)}return e}'
new5 = j('r.appendChild(l);const hb=mkBtn("",()=>toggleFavoriteTrack(t));hb.className="btn sm fav-row";hb.dataset.id=String(t.id);setIcon(hb,isFavOf(t)?"heartFill":"heart");hb.title=isFavOf(t)?"已收藏":"收藏";hb.classList.toggle("active",isFavOf(t));r.appendChild(hb);if(drill&&drill.type==="playlist"&&currentSourceType()==="subsonic"){const rb=mkBtn("✕",()=>removeTrackFromPlaylist(t.id));rb.className="btn sm danger";r.appendChild(rb)}e.appendChild(r)}return e}')
s = rep(old5, new5, "E5")

# ---- E6: playlists view — create card + per-card rename/delete (subsonic only) ----
start = s.find('else if(t==="playlists"){const n=document.createElement("div");n.className="grid";')
if start < 0:
    raise SystemExit("[FAIL E6] start anchor not found")
end_marker = 'e.appendChild(n)}'
end = s.find(end_marker, start)
if end < 0:
    raise SystemExit("[FAIL E6] end anchor not found")
old6 = s[start:end+len(end_marker)]
new6 = j('''else if(t==="playlists"){const n=document.createElement("div");n.className="grid";if(currentSourceType()==="subsonic"){const nc=document.createElement("div");nc.className="card new-pl";nc.innerHTML='<div class="cov ph">+</div><div class="info"><div class="text-body"><div class="t">新建歌单</div></div></div>';nc.onclick=()=>openPlaylistEditModal("create");n.appendChild(nc)}for(const s of currentList){const m=s.trackCount==null;const o=makeCard(s,"playlist","",m?"":s.trackCount+" 首",()=>openPlaylist(s),()=>playDirectory("playlist",s),m);if(currentSourceType()==="subsonic"){let ta=o.querySelector(".top-act");if(!ta){ta=document.createElement("div");ta.className="top-act";o.appendChild(ta)}const eb=document.createElement("button");eb.className="btn sm";eb.textContent="✎";eb.title="重命名";eb.onclick=e=>{e.stopPropagation();openPlaylistEditModal("rename",s)};const db=document.createElement("button");db.className="btn sm danger";db.textContent="✕";db.title="删除";db.onclick=e=>{e.stopPropagation();openPlaylistEditModal("delete",s)};ta.appendChild(eb);ta.appendChild(db)}n.appendChild(o)}e.appendChild(n)}''')
if s.count(old6) != 1:
    raise SystemExit("[FAIL E6] old6 not unique: %d" % s.count(old6))
s = s.replace(old6, new6, 1)
print("[OK E6] replaced playlists render")

open(path, "w", encoding="utf-8").write(s)
print("ALL DONE")
