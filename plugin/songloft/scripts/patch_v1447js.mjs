// v1.4.47 JS 部分（CSS 已写入）：poke 参数化 + 拖拽/触摸延长隐藏 5s
import fs from 'node:fs';
const p = 'static/js/app.js';
let s = fs.readFileSync(p, 'utf8');
function rep(old_, new_, label) {
  if (!s.includes(old_)) { console.error('NOT FOUND:', label); process.exit(1); }
  s = s.replace(old_, new_);
  console.log('OK', label);
}
// ① poke 参数化（d 缺省 2s）
rep(
  'function poke(){f.classList.add("show"),syncFloatCount(),clearTimeout(timer),timer=setTimeout(hide,2e3)}',
  'function poke(d){f.classList.add("show"),syncFloatCount(),clearTimeout(timer),timer=setTimeout(hide,d||2e3)}',
  'JS1 poke param'
);
// ② 拖拽 down 延长
rep(
  'setPointerCapture(e.pointerId)},onMove=',
  'setPointerCapture(e.pointerId),poke(5e3)},onMove=',
  'JS2 onDown poke'
);
// ③ 拖拽 move 延长
rep(
  'moved=!0,_lfCustom=!0,e.preventDefault();const nx=',
  'moved=!0,_lfCustom=!0,e.preventDefault(),poke(5e3);const nx=',
  'JS3 onMove poke'
);
// ④ 拖拽 up 延长（修正锚点：逗号连接形式）
rep(
  ',onUp=()=>{if(!dragging)return;dragging=!1;if(moved){',
  ',onUp=()=>{if(!dragging)return;dragging=!1,poke(5e3);if(moved){',
  'JS4 onUp poke'
);
// ⑤ content touch 延长
rep(
  'c.addEventListener("scroll",()=>poke(),{passive:!0}),window.addEventListener("resize",place),place()}',
  'c.addEventListener("scroll",()=>poke(),{passive:!0}),c.addEventListener("touchstart",()=>poke(5e3),{passive:!0}),c.addEventListener("touchmove",()=>poke(5e3),{passive:!0}),c.addEventListener("touchend",()=>poke(5e3),{passive:!0}),window.addEventListener("resize",place),place()}',
  'JS5 touch poke'
);
fs.writeFileSync(p, s, 'utf8');
console.log('ALL DONE');
