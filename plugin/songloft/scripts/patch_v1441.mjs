// v1.4.41 修复 4 个问题：
// ① 扫描中状态一直显示（listScanning 无复位机制→加轮询检测）
// ② 搜索框弹出时返回顶部浮框下移不遮挡（place 加 offset）
// ③ 搜索结果页下拉刷新保持搜索结果（refreshList 走 doSearch）
// ④ 搜索交互改造（不自动搜、有词不收起、返回按钮）
import fs from 'node:fs';

// ===== template =====
{
  const p = 'static/index.template.html';
  let t = fs.readFileSync(p, 'utf8');
  const o = '<button class="btn" onclick="doSearch()">搜索</button></div></div>';
  const n = '<button class="btn" onclick="doSearch()">搜索</button><button class="btn" id="searchBackBtn" onclick="closeSearchBar()">返回</button></div></div>';
  if (!t.includes(o)) { console.error('TPL NOT FOUND'); process.exit(1); }
  t = t.replace(o, n);
  fs.writeFileSync(p, t, 'utf8');
  console.log('OK TPL search back btn');
}

// ===== app.js =====
{
  const p = 'static/js/app.js';
  let s = fs.readFileSync(p, 'utf8');
  function rep(old_, new_, label) {
    if (!s.includes(old_)) { console.error('NOT FOUND:', label); process.exit(1); }
    if (s.split(old_).length > 2) { console.error('NOT UNIQUE:', label); process.exit(1); }
    s = s.replace(old_, new_);
    console.log('OK', label);
  }
  // P2 refreshList 保持搜索结果
  rep(
    'function refreshList(){forceRefresh=!0;return drill?loadDrill():loadView(view)}',
    'function refreshList(){forceRefresh=!0;if(searchActive&&$("searchInput").value.trim())return doSearch();return drill?loadDrill():loadView(view)}',
    'P2 refreshList'
  );
  // P3 声明 _scanPollTimer
  rep(
    'let listPage=0,listTotal=0,listLoading=!1,drillTotal=0,listScanning=!1;',
    'let listPage=0,listTotal=0,listLoading=!1,drillTotal=0,listScanning=!1,_scanPollTimer=null;',
    'P3 scanPollTimer decl'
  );
  // P4 loadView partial 时启动轮询
  rep(
    'listScanning=!!a.partial,listScanning||(listTotal=a.total||currentList.length)',
    'listScanning=!!a.partial,listScanning&&pollScanDone(),listScanning||(listTotal=a.total||currentList.length)',
    'P4 loadView poll'
  );
  // P5 loadNextPage partial 时启动轮询
  rep(
    'listScanning=!!s.partial,listScanning||(listTotal=s.total||currentList.length)',
    'listScanning=!!s.partial,listScanning&&pollScanDone(),listScanning||(listTotal=s.total||currentList.length)',
    'P5 loadNextPage poll'
  );
  // P6 onSearchInput 去自动搜索
  rep(
    'let searchTimer=null;function onSearchInput(){if(clearTimeout(searchTimer),!$("searchInput").value.trim()){searchActive=!1,loadView(view);return}searchTimer=setTimeout(doSearch,400)}',
    'function onSearchInput(){if(!$("searchInput").value.trim()&&searchActive){searchActive=!1,loadView(view)}}',
    'P6 onSearchInput'
  );
  // P7 doSearch 开头：有词不收起；无词收起+回列表
  rep(
    'async function doSearch(){const b=$("searchBar");b&&b.classList.remove("show");const t=$("searchInput").value.trim();if(selected.clear(),!t){searchActive=!1,loadView(view);return}',
    'async function doSearch(){const t=$("searchInput").value.trim();if(selected.clear(),!t){const b=$("searchBar");b&&b.classList.remove("show"),window._lfPlace&&window._lfPlace();searchActive=!1,loadView(view);return}',
    'P7 doSearch head'
  );
  // P8 删搜索结果页左上角 back 元素
  const backOld = 'const n=$("content");n.innerHTML="";const s=document.createElement("div");if(s.className="back",s.textContent="\\u2190 \\u8FD4\\u56DE",s.onclick=()=>{searchActive=!1,$("searchInput").value="",loadView(view)},n.appendChild(s),(e.tracks||[]).length){';
  if (!s.includes(backOld)) { console.error('NOT FOUND: P8 back el'); process.exit(1); }
  s = s.replace(backOld, 'const n=$("content");n.innerHTML="";if((e.tracks||[]).length){');
  console.log('OK P8 back el removed');
  // P9 toggleSearchBar 加 _lfPlace + closeSearchBar 新增
  rep(
    'function toggleSearchBar(){const b=$("searchBar");if(!b)return;const s=b.classList.toggle("show");if(s){const i=$("searchInput");i&&setTimeout(()=>i.focus(),50)}}',
    'function toggleSearchBar(){const b=$("searchBar");if(!b)return;const s=b.classList.toggle("show");if(s){const i=$("searchInput");i&&setTimeout(()=>i.focus(),50)}window._lfPlace&&window._lfPlace()}function closeSearchBar(){const b=$("searchBar");b&&b.classList.remove("show");window._lfPlace&&window._lfPlace();if(searchActive){searchActive=!1,$("searchInput").value="",loadView(view)}}',
    'P9 toggleSearchBar+closeSearchBar'
  );
  // P11 bindListFloat place 加 search-bar offset + 暴露 _lfPlace
  rep(
    'function bindListFloat(){const c=$("content"),f=$("listFloat");if(!c||!f||f.dataset.bound)return;f.dataset.bound="1";let timer=null;const place=()=>{const r=c.getBoundingClientRect();f.style.top=(r.top+6)+"px"};',
    'function bindListFloat(){const c=$("content"),f=$("listFloat");if(!c||!f||f.dataset.bound)return;f.dataset.bound="1";let timer=null;const place=()=>{const r=c.getBoundingClientRect(),sb=$("searchBar"),off=sb&&sb.classList.contains("show")?sb.offsetHeight:0;f.style.top=(r.top+6+off)+"px"};window._lfPlace=place;',
    'P11 bindListFloat place'
  );
  // P12 pollScanDone 插入 bindListFloat 前
  rep(
    'function bindListFloat(){',
    'function pollScanDone(){clearTimeout(_scanPollTimer),_scanPollTimer=setTimeout(async()=>{if(!listScanning||!currentSourceId)return;try{const r=await api(`${PLUGIN_BASE}/tracks?sourceId=${currentSourceId}&limit=1&offset=0`,"GET",void 0,15e3);if(r.ok&&r.list)r.partial?pollScanDone():(listScanning=!1,updateListCount())}catch{pollScanDone()}},8e3)}function bindListFloat(){',
    'P12 pollScanDone'
  );
  fs.writeFileSync(p, s, 'utf8');
  console.log('app.js done');
}
console.log('ALL DONE');
