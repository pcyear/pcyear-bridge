// v1.4.43：① 搜索框打开时折叠底部播放条、关闭还原（记录打开前状态）；② 搜索结果时浮框数量显示搜索数量
import fs from 'node:fs';
const p = 'static/js/app.js';
let s = fs.readFileSync(p, 'utf8');
function rep(old_, new_, label) {
  if (!s.includes(old_)) { console.error('NOT FOUND:', label); process.exit(1); }
  if (s.split(old_).length > 2) { console.error('NOT UNIQUE:', label); process.exit(1); }
  s = s.replace(old_, new_);
  console.log('OK', label);
}
// P1 全局声明
rep(
  'let listPage=0,listTotal=0,listLoading=!1,drillTotal=0,listScanning=!1,_scanPollTimer=null,_sbOpen=!1;',
  'let listPage=0,listTotal=0,listLoading=!1,drillTotal=0,listScanning=!1,_scanPollTimer=null,_sbOpen=!1,_playerWasMini=null,searchResultCount=null;',
  'P1 decl'
);
// P2 setSearchBarOpen 折叠/还原播放条
rep(
  'function setSearchBarOpen(t){_sbOpen=t;const b=$("searchBar"),c=$("content");if(!b)return;if(t){b.classList.add("show"),c&&(c.style.paddingTop=(16+b.offsetHeight)+"px");const i=$("searchInput");i&&setTimeout(()=>i.focus(),50)}else{b.classList.remove("show"),c&&(c.style.paddingTop="")}window._lfPlace&&window._lfPlace()}',
  'function setSearchBarOpen(t){_sbOpen=t;const b=$("searchBar"),c=$("content");if(!b)return;const pb=$("playerBar");if(t){b.classList.add("show"),c&&(c.style.paddingTop=(16+b.offsetHeight)+"px");if(pb){if(pb.classList.contains("mini"))_playerWasMini=!0;else _playerWasMini=!1,pb.classList.add("mini"),document.body.classList.add("mini-on")}const i=$("searchInput");i&&setTimeout(()=>i.focus(),50)}else{b.classList.remove("show"),c&&(c.style.paddingTop="");if(pb&&_playerWasMini===!1){pb.classList.remove("mini"),document.body.classList.remove("mini-on"),placeBulkBar()}_playerWasMini=null}window._lfPlace&&window._lfPlace()}',
  'P2 setSearchBarOpen player fold'
);
// P3 syncFloatCount 搜索分支
rep(
  'function syncFloatCount(){const f=$("listFloat"),n=$("lfCount");if(!f||!n)return;const e=drill?drillTotal:listTotal;if(!drill&&listScanning){n.textContent="扫描中…";return}if(!e)return;n.textContent=currentList.length+"/"+e}',
  'function syncFloatCount(){const f=$("listFloat"),n=$("lfCount");if(!f||!n)return;if(!drill&&searchActive&&searchResultCount!=null){n.textContent=searchResultCount;return}const e=drill?drillTotal:listTotal;if(!drill&&listScanning){n.textContent="扫描中…";return}if(!e)return;n.textContent=currentList.length+"/"+e}',
  'P3 syncFloatCount search branch'
);
// P4a doSearch 开头重置 searchResultCount
rep(
  'switchCtx("v:search"),searchActive=!0;',
  'switchCtx("v:search"),searchActive=!0,searchResultCount=null;',
  'P4a doSearch reset'
);
// P4b doSearch 成功计算搜索数量
rep(
  'listScanning=!1;if(!e.ok){$("content")',
  'listScanning=!1,searchResultCount=(e.tracks||[]).length+(e.albums||[]).length+(e.artists||[]).length,updateListCount();if(!e.ok){$("content")',
  'P4b doSearch count'
);
// P5a closeSearchBar 重置
rep(
  'function closeSearchBar(){setSearchBarOpen(!1);if(searchActive){searchActive=!1,$("searchInput").value="",loadView(view)}}',
  'function closeSearchBar(){setSearchBarOpen(!1);if(searchActive){searchActive=!1,searchResultCount=null,$("searchInput").value="",loadView(view)}}',
  'P5a closeSearchBar reset'
);
// P5b doSearch 无词重置
rep(
  'if(selected.clear(),!t){setSearchBarOpen(!1);searchActive=!1,loadView(view);return}',
  'if(selected.clear(),!t){setSearchBarOpen(!1);searchActive=!1,searchResultCount=null,loadView(view);return}',
  'P5b doSearch empty reset'
);
// P5c onSearchInput 清空重置
rep(
  'function onSearchInput(){if(!$("searchInput").value.trim()&&searchActive){searchActive=!1,loadView(view)}}',
  'function onSearchInput(){if(!$("searchInput").value.trim()&&searchActive){searchActive=!1,searchResultCount=null,loadView(view)}}',
  'P5c onSearchInput reset'
);
fs.writeFileSync(p, s, 'utf8');
console.log('ALL DONE');
