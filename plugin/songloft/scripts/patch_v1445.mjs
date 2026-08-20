// v1.4.45：① 切换列表页默认显示浮框 + 任意滑动都显示（2s 隐藏）；② 返回框与返回顶部框同宽对齐；③ 整框（含按钮）可拖动、位置记忆
import fs from 'node:fs';
const p = 'static/js/app.js';
let s = fs.readFileSync(p, 'utf8');
function rep(old_, new_, label) {
  if (!s.includes(old_)) { console.error('NOT FOUND:', label); process.exit(1); }
  if (s.split(old_).length > 2) { console.error('NOT UNIQUE:', label); process.exit(1); }
  s = s.replace(old_, new_);
  console.log('OK', label);
}

// P1 updateListCount 加 poke（切换列表页默认显示浮框）
rep(
  'function updateListCount(){syncFloatCount()}',
  'function updateListCount(){syncFloatCount();window._lfPoke&&window._lfPoke()}',
  'P1 updateListCount poke'
);

// P2 bindListFloat：暴露 _lfPoke + scroll 无条件 poke + 整框拖拽
rep(
  'window._lfPlace=place;let sx=0,sy=0,dx=0,dy=0,dragging=!1,moved=!1;const onDown=e=>{if(e.target.closest("button"))return;dragging=!0,moved=!1,sx=e.clientX,sy=e.clientY,dx=e.clientX-f.offsetLeft,dy=e.clientY-f.offsetTop,f.setPointerCapture&&f.setPointerCapture(e.pointerId),e.preventDefault()},onMove=e=>{if(!dragging)return;Math.hypot(e.clientX-sx,e.clientY-sy)>4&&(moved=!0);const nx=Math.min(Math.max(6,e.clientX-dx),window.innerWidth-f.offsetWidth-6),ny=Math.min(Math.max(6,e.clientY-dy),window.innerHeight-f.offsetHeight-6);_lfCustom=!0,f.style.left=nx+"px",f.style.top=ny+"px",e.preventDefault()},onUp=()=>{if(!dragging)return;dragging=!1;if(moved){try{localStorage.setItem("lfFloatPos",JSON.stringify({left:f.offsetLeft,top:f.offsetTop}))}catch{}}};f.addEventListener("pointerdown",onDown),window.addEventListener("pointermove",onMove),window.addEventListener("pointerup",onUp);',
  'window._lfPlace=place,window._lfPoke=poke;f.style.touchAction="none";let sx=0,sy=0,dx=0,dy=0,dragging=!1,moved=!1;const onDown=e=>{dragging=!0,moved=!1,sx=e.clientX,sy=e.clientY,dx=e.clientX-f.offsetLeft,dy=e.clientY-f.offsetTop,f.setPointerCapture&&f.setPointerCapture(e.pointerId)},onMove=e=>{if(!dragging)return;if(!moved&&Math.hypot(e.clientX-sx,e.clientY-sy)<4)return;moved=!0,_lfCustom=!0,e.preventDefault();const nx=Math.min(Math.max(6,e.clientX-dx),window.innerWidth-f.offsetWidth-6),ny=Math.min(Math.max(6,e.clientY-dy),window.innerHeight-f.offsetHeight-6);f.style.left=nx+"px",f.style.top=ny+"px"},onUp=()=>{if(!dragging)return;dragging=!1;if(moved){try{localStorage.setItem("lfFloatPos",JSON.stringify({left:f.offsetLeft,top:f.offsetTop}))}catch{}setTimeout(()=>{moved=!1},100)}};const suppressClick=e=>{if(moved){e.stopPropagation(),e.preventDefault();moved=!1}};f.addEventListener("pointerdown",onDown),window.addEventListener("pointermove",onMove),window.addEventListener("pointerup",onUp),f.addEventListener("click",suppressClick,!0);',
  'P2 drag all-area'
);

// P3 scroll 无条件 poke
rep(
  'c.addEventListener("scroll",()=>{if(c.scrollTop>2||c.scrollHeight>c.clientHeight+2)poke()},{passive:!0})',
  'c.addEventListener("scroll",()=>poke(),{passive:!0})',
  'P3 scroll any poke'
);

fs.writeFileSync(p, s, 'utf8');
console.log('app.js done');

// ===== CSS：两子框同宽 =====
{
  const cp = 'static/css/app.css';
  let c = fs.readFileSync(cp, 'utf8');
  // .list-float 去 align-items:center（默认 stretch → 两子框同宽）
  const o1 = '.list-float{position:fixed;right:10px;z-index:45;display:flex;flex-direction:column;align-items:center;gap:8px;';
  const n1 = '.list-float{position:fixed;right:10px;z-index:45;display:flex;flex-direction:column;gap:8px;';
  if (!c.includes(o1)) { console.error('CSS1 NOT FOUND'); process.exit(1); }
  c = c.replace(o1, n1);
  // .lf-back-box.show 加 justify-content:center
  const o2 = '.lf-back-box{display:none}.lf-back-box.show{display:flex}';
  const n2 = '.lf-back-box{display:none}.lf-back-box.show{display:flex;justify-content:center}';
  if (!c.includes(o2)) { console.error('CSS2 NOT FOUND'); process.exit(1); }
  c = c.replace(o2, n2);
  fs.writeFileSync(cp, c, 'utf8');
  console.log('OK CSS');
}
console.log('ALL DONE');
