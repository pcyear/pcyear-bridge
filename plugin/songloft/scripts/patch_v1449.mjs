// v1.4.49：手动拖动过浮框后，若位置与搜索框重叠，打开搜索框时自动下移；关闭恢复
import fs from 'node:fs';
const p = 'static/js/app.js';
let s = fs.readFileSync(p, 'utf8');

// ① 全局声明
{
  const o = 'searchResultCount=null,_lfCustom=!1;';
  const n = 'searchResultCount=null,_lfCustom=!1,_lfShifted=!1,_lfOrigTop=null;';
  if (!s.includes(o)) { console.error('P1 NOT FOUND'); process.exit(1); }
  s = s.replace(o, n);
  console.log('OK P1 decl');
}

// ② 定位截取重写 setSearchBarOpen（整体替换，括号结构清晰）
{
  const start = s.indexOf('function setSearchBarOpen(t){');
  const end = s.indexOf('function toggleSearchBar(', start);
  if (start < 0 || end < 0) { console.error('P2 BOUNDS', start, end); process.exit(1); }
  const nw = 'function setSearchBarOpen(t){_sbOpen=t;const b=$("searchBar"),c=$("content");if(!b)return;const pb=$("playerBar");if(t){b.classList.add("show"),c&&(c.style.paddingTop=(16+b.offsetHeight)+"px");if(pb){if(pb.classList.contains("mini"))_playerWasMini=!0;else _playerWasMini=!1,pb.classList.add("mini"),document.body.classList.add("mini-on")}const i=$("searchInput");i&&setTimeout(()=>i.focus(),50);if(_lfCustom&&c){const f=$("listFloat");if(f){const sbBottom=c.getBoundingClientRect().top+b.offsetHeight;if(f.offsetTop<sbBottom){_lfOrigTop=f.offsetTop,f.style.top=(sbBottom+6)+"px",_lfShifted=!0}}}}else{b.classList.remove("show"),c&&(c.style.paddingTop="");if(pb&&_playerWasMini===!1){pb.classList.remove("mini"),document.body.classList.remove("mini-on"),placeBulkBar()}_playerWasMini=null;if(_lfShifted&&_lfOrigTop!=null){const f=$("listFloat");f&&(f.style.top=_lfOrigTop+"px"),_lfShifted=!1,_lfOrigTop=null}}window._lfPlace&&window._lfPlace()}';
  s = s.substring(0, start) + nw + s.substring(end);
  console.log('OK P2 setSearchBarOpen rewritten');
}

// ③ 拖拽 move 清除下移状态
{
  const o = 'moved=!0,_lfCustom=!0,e.preventDefault(),poke();const nx=';
  const n = 'moved=!0,_lfCustom=!0,_lfShifted=!1,_lfOrigTop=null,e.preventDefault(),poke();const nx=';
  if (!s.includes(o)) { console.error('P3 NOT FOUND'); process.exit(1); }
  s = s.replace(o, n);
  console.log('OK P3 drag clear');
}

fs.writeFileSync(p, s, 'utf8');
console.log('ALL DONE');
