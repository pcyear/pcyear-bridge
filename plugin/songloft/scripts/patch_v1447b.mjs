// v1.4.47b：① 浮框宽度跟随内容（字显示全，去固定宽/截断）；② 触摸/拖拽松手后 2 秒关闭（poke(5e3)→poke()）
import fs from 'node:fs';

// ===== CSS：去固定宽/截断 =====
{
  const p = 'static/css/app.css';
  let c = fs.readFileSync(p, 'utf8');
  // 1) .list-float 去 width:48px
  const o1 = '.list-float{position:fixed;right:10px;z-index:45;display:flex;flex-direction:column;align-items:stretch;gap:6px;width:48px;';
  const n1 = '.list-float{position:fixed;right:10px;z-index:45;display:flex;flex-direction:column;align-items:stretch;gap:6px;';
  if (!c.includes(o1)) { console.error('CSS1 NOT FOUND'); process.exit(1); }
  c = c.replace(o1, n1);
  // 2) .lf-count 去截断（显示全字）
  const o2 = '.lf-count{font-size:11px;color:var(--sub);font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1;max-width:100%;overflow:hidden;text-overflow:ellipsis}';
  const n2 = '.lf-count{font-size:11px;color:var(--sub);font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1}';
  if (!c.includes(o2)) { console.error('CSS2 NOT FOUND'); process.exit(1); }
  c = c.replace(o2, n2);
  fs.writeFileSync(p, c, 'utf8');
  console.log('OK CSS');
}

// ===== JS：poke(5e3) → poke() =====
{
  const p = 'static/js/app.js';
  let s = fs.readFileSync(p, 'utf8');
  // touch 三监听
  const o1 = 'c.addEventListener("touchstart",()=>poke(5e3),{passive:!0}),c.addEventListener("touchmove",()=>poke(5e3),{passive:!0}),c.addEventListener("touchend",()=>poke(5e3),{passive:!0})';
  const n1 = 'c.addEventListener("touchstart",()=>poke(),{passive:!0}),c.addEventListener("touchmove",()=>poke(),{passive:!0}),c.addEventListener("touchend",()=>poke(),{passive:!0})';
  if (!s.includes(o1)) { console.error('JS1 NOT FOUND'); process.exit(1); }
  s = s.replace(o1, n1);
  // 拖拽三处
  const o2 = 'setPointerCapture(e.pointerId),poke(5e3)},onMove=';
  const n2 = 'setPointerCapture(e.pointerId),poke()},onMove=';
  if (!s.includes(o2)) { console.error('JS2 NOT FOUND'); process.exit(1); }
  s = s.replace(o2, n2);
  const o3 = 'moved=!0,_lfCustom=!0,e.preventDefault(),poke(5e3);const nx=';
  const n3 = 'moved=!0,_lfCustom=!0,e.preventDefault(),poke();const nx=';
  if (!s.includes(o3)) { console.error('JS3 NOT FOUND'); process.exit(1); }
  s = s.replace(o3, n3);
  const o4 = ',onUp=()=>{if(!dragging)return;dragging=!1,poke(5e3);if(moved){';
  const n4 = ',onUp=()=>{if(!dragging)return;dragging=!1,poke();if(moved){';
  if (!s.includes(o4)) { console.error('JS4 NOT FOUND'); process.exit(1); }
  s = s.replace(o4, n4);
  // 确认 5e3 清除
  const cnt = (s.match(/poke\(5e3\)/g) || []).length;
  if (cnt > 0) { console.error('5e3 residual:', cnt); process.exit(1); }
  fs.writeFileSync(p, s, 'utf8');
  console.log('OK JS, 5e3 residual:', cnt);
}
console.log('ALL DONE');
