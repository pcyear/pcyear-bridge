// v1.4.42：① 键盘回车/前往触发搜索；② 搜索框弹出时列表下压不遮挡（与下拉刷新 paddingTop 协调）
import fs from 'node:fs';

// ===== template =====
{
  const p = 'static/index.template.html';
  let t = fs.readFileSync(p, 'utf8');
  const o = '<input id="searchInput" placeholder="搜索歌曲 / 专辑 / 艺术家…" oninput="onSearchInput()" />';
  const n = '<input id="searchInput" placeholder="搜索歌曲 / 专辑 / 艺术家…" oninput="onSearchInput()" onkeydown="if(event.key===\'Enter\'||event.keyCode===13)doSearch()" />';
  if (!t.includes(o)) { console.error('TPL NOT FOUND'); process.exit(1); }
  t = t.replace(o, n);
  fs.writeFileSync(p, t, 'utf8');
  console.log('OK TPL enter key');
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
  // P2 声明 _sbOpen
  rep(
    'let listPage=0,listTotal=0,listLoading=!1,drillTotal=0,listScanning=!1,_scanPollTimer=null;',
    'let listPage=0,listTotal=0,listLoading=!1,drillTotal=0,listScanning=!1,_scanPollTimer=null,_sbOpen=!1;',
    'P2 sbOpen decl'
  );
  // P3 toggle/close 重写为 setSearchBarOpen（展开时列表下压）
  rep(
    'function toggleSearchBar(){const b=$("searchBar");if(!b)return;const s=b.classList.toggle("show");if(s){const i=$("searchInput");i&&setTimeout(()=>i.focus(),50)}window._lfPlace&&window._lfPlace()}function closeSearchBar(){const b=$("searchBar");b&&b.classList.remove("show");window._lfPlace&&window._lfPlace();if(searchActive){searchActive=!1,$("searchInput").value="",loadView(view)}}',
    'function setSearchBarOpen(t){_sbOpen=t;const b=$("searchBar"),c=$("content");if(!b)return;if(t){b.classList.add("show"),c&&(c.style.paddingTop=(16+b.offsetHeight)+"px");const i=$("searchInput");i&&setTimeout(()=>i.focus(),50)}else{b.classList.remove("show"),c&&(c.style.paddingTop="")}window._lfPlace&&window._lfPlace()}function toggleSearchBar(){const b=$("searchBar");if(!b)return;setSearchBarOpen(!b.classList.contains("show"))}function closeSearchBar(){setSearchBarOpen(!1);if(searchActive){searchActive=!1,$("searchInput").value="",loadView(view)}}',
    'P3 setSearchBarOpen'
  );
  // P4 doSearch 无词分支用 setSearchBarOpen
  rep(
    'if(selected.clear(),!t){const b=$("searchBar");b&&b.classList.remove("show"),window._lfPlace&&window._lfPlace();searchActive=!1,loadView(view);return}',
    'if(selected.clear(),!t){setSearchBarOpen(!1);searchActive=!1,loadView(view);return}',
    'P4 doSearch empty'
  );
  // P5a ptr reset/go 协调 _sbOpen
  rep(
    'const reset=()=>{pd=0,c.style.paddingTop="",p.classList.remove("show","loading")};const go=()=>{ref=!0,p.classList.add("show","loading"),c.style.paddingTop="72px";',
    'const reset=()=>{pd=0,c.style.paddingTop=_sbOpen?(16+$("searchBar").offsetHeight)+"px":"",p.classList.remove("show","loading")};const go=()=>{ref=!0,p.classList.add("show","loading"),c.style.paddingTop=(16+(_sbOpen?$("searchBar").offsetHeight:0)+56)+"px";',
    'P5a ptr reset/go'
  );
  // P5b ptr move 协调 _sbOpen
  rep(
    'pd=Math.min(d,MAX),c.style.paddingTop=(16+pd)+"px",p.classList.add("show")',
    'pd=Math.min(d,MAX),c.style.paddingTop=(16+(_sbOpen?$("searchBar").offsetHeight:0)+pd)+"px",p.classList.add("show")',
    'P5b ptr move'
  );
  fs.writeFileSync(p, s, 'utf8');
  console.log('app.js done');
}
console.log('ALL DONE');
