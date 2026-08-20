// v1.4.39 列表右上角悬浮磨砂框（返回顶部箭头 + 当前加载数/总数，滑动显示、停 3s 隐藏）
import fs from 'node:fs';
const p = 'static/js/app.js';
let s = fs.readFileSync(p, 'utf8');

function must(cond, label) {
  if (!cond) { console.error('NOT FOUND:', label); process.exit(1); }
}

// ---- P1: init 调用处追加 bindListFloat ----
const o1 = 'bindListLazyLoad(),bindPullToRefresh()';
must(s.includes(o1), 'P1 init call');
s = s.replace(o1, 'bindListLazyLoad(),bindPullToRefresh(),bindListFloat()');
console.log('OK P1 init call');

// ---- P2: 在 bindPullToRefresh 定义前插入三个函数 ----
const anchor2 = 'function bindPullToRefresh(){';
must(s.includes(anchor2), 'P2 anchor');
const nw = 'function bindListFloat(){const c=$("content"),f=$("listFloat");if(!c||!f||f.dataset.bound)return;f.dataset.bound="1";let timer=null;const place=()=>{const r=c.getBoundingClientRect();f.style.top=(r.top+6)+"px"};const hide=()=>f.classList.remove("show");const poke=()=>{f.classList.add("show"),syncFloatCount(),clearTimeout(timer),timer=setTimeout(hide,3e3)};c.addEventListener("scroll",()=>{if(c.scrollTop>2||c.scrollHeight>c.clientHeight+2)poke()},{passive:!0}),window.addEventListener("resize",place),place()}function syncFloatCount(){const f=$("listFloat"),n=$("lfCount");if(!f||!n)return;const e=drill?drillTotal:listTotal;if(!drill&&listScanning){n.textContent="\u626B\u63CF\u4E2D\u2026";return}if(!e)return;n.textContent=currentList.length+"/"+e}function scrollListTop(){const c=$("content");if(!c)return;c.scrollTo({top:0,behavior:"smooth"})}';
s = s.replace(anchor2, nw + anchor2);
console.log('OK P2 functions inserted');

fs.writeFileSync(p, s, 'utf8');
console.log('patch_v1439 done, len', s.length);
