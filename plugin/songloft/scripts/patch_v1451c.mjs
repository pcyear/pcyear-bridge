// v1.4.51c：搜索结果直接用 renderList 渲染（与原列表完全相同的卡片，彻底消除"缩小"）
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
const vt=drill?"tracks":view==="albums"?"albums":view==="artists"?"artists":"tracks";
switchCtx("v:search"),searchActive=!0,searchResultCount=null;
const e=await api(\`\${PLUGIN_BASE}/search?sourceId=\${currentSourceId}&q=\${encodeURIComponent(t)}&limit=30\${drill?\`&dir=\${encodeURIComponent(drill.id)}\`:""}\`,"GET",void 0,2e4,{prio:1});
listScanning=!1;
if(!e.ok){$("content").innerHTML=\`<div class="empty">\${esc(e.message||"搜索失败")}</div>\`;return}
let cnt=0;
if(vt==="tracks"&&(e.tracks||[]).length){cnt=e.tracks.length,currentList=e.tracks}
else if(vt==="albums"&&(e.albums||[]).length){cnt=e.albums.length,currentList=e.albums}
else if(vt==="artists"&&(e.artists||[]).length){cnt=e.artists.length,currentList=e.artists}
searchResultCount=cnt;
if(cnt)renderList(vt);else $("content").innerHTML='<div class="empty">未找到结果</div>';
updateBulkBar(),scheduleSaveState()
}`;
s = s.substring(0, start) + nw + s.substring(end);
fs.writeFileSync(p, s, 'utf8');
console.log('doSearch rewritten (renderList reuse)');
