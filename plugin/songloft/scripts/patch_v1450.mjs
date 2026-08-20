// v1.4.50：搜索按当前栏目过滤（歌曲→歌曲、专辑→专辑、艺术家→艺术家；歌单/收藏拦截）
import fs from 'node:fs';
const p = 'static/js/app.js';
let s = fs.readFileSync(p, 'utf8');
const start = s.indexOf('async function doSearch(){');
const end = s.indexOf('function openAdd', start);
if (start < 0 || end < 0) { console.error('BOUNDS', start, end); process.exit(1); }
const nw = `async function doSearch(){
const t=$("searchInput").value.trim();
if(selected.clear(),!t){setSearchBarOpen(!1);searchActive=!1,searchResultCount=null,loadView(view);return}
if(view==="favorites")return toast("收藏视图暂不支持搜索，请切换到音源视图搜索");
if(view==="playlists")return toast("歌单视图暂不支持搜索，请切换到音源视图搜索");
if(!currentSourceId)return toast("请先选择音源");
const vt=view==="albums"?"albums":view==="artists"?"artists":"tracks";
switchCtx("v:search"),searchActive=!0,searchResultCount=null;
const e=await api(\`\${PLUGIN_BASE}/search?sourceId=\${currentSourceId}&q=\${encodeURIComponent(t)}&limit=30\`,"GET",void 0,2e4,{prio:1});
listScanning=!1;
if(!e.ok){$("content").innerHTML=\`<div class="empty">\${esc(e.message||"搜索失败")}</div>\`;return}
const n=$("content");n.innerHTML="";let cnt=0;
if(vt==="tracks"&&(e.tracks||[]).length){const o=document.createElement("h3");o.textContent="歌曲",o.style.margin="6px 0 10px",n.appendChild(o);const i=document.createElement("div");i.className="track-list";for(const a of e.tracks)i.appendChild(trackRow(a));n.appendChild(i),cnt=e.tracks.length}
if(vt==="albums"&&(e.albums||[]).length){const o=document.createElement("h3");o.textContent="专辑",o.style.margin="6px 0 10px",n.appendChild(o);const i=document.createElement("div");i.className="grid";for(const a of e.albums){const r=document.createElement("div");r.className="card",r.appendChild(makeCover("cov",a.coverId));const l=document.createElement("div");l.className="info",l.innerHTML=\`<div class="text-body"><div class="t">\${esc(a.name)}</div><div class="s">\${esc(a.artist||"")}</div></div>\`,r.appendChild(l),r.onclick=()=>openAlbum(a),i.appendChild(r)}n.appendChild(i),cnt=e.albums.length}
if(vt==="artists"&&(e.artists||[]).length){const o=document.createElement("h3");o.textContent="艺术家",o.style.margin="6px 0 10px",n.appendChild(o);const i=document.createElement("div");i.className="grid";for(const a of e.artists){const r=document.createElement("div");r.className="card",r.appendChild(makeCover("cov",a.coverId));const l=document.createElement("div");l.className="info",l.innerHTML=\`<div class="text-body"><div class="t">\${esc(a.name)}</div></div>\`,r.appendChild(l),r.onclick=()=>openArtist(a),i.appendChild(r)}n.appendChild(i),cnt=e.artists.length}
!cnt&&n.appendChild(Object.assign(document.createElement("div"),{className:"empty",textContent:"未找到结果"})),searchResultCount=cnt,updateListCount(),updateBulkBar(),scheduleSaveState()
}`;
s = s.substring(0, start) + nw + s.substring(end);
fs.writeFileSync(p, s, 'utf8');
console.log('doSearch rewritten (view-filtered)');
