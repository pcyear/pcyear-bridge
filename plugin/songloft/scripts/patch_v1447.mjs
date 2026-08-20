// v1.4.47：① topLoading 加半透明磨砂背景框；② 浮框宽度固定最小（拖动不再变宽）；③ 触摸/拖拽时隐藏时间延长（5s）
import fs from 'node:fs';

// ===== CSS =====
{
  const p = 'static/css/app.css';
  let c = fs.readFileSync(p, 'utf8');
  // ① topLoading 胶囊磨砂背景框
  const o1 = '.top-loading{position:fixed;left:0;right:0;display:none;align-items:center;justify-content:center;gap:8px;height:48px;z-index:46;color:var(--sub);font-size:12px;pointer-events:none}.top-loading.show{display:flex}.top-loading .ptr-spin{display:block}';
  const n1 = '.top-loading{position:fixed;left:50%;transform:translateX(-50%);display:none;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 16px;border-radius:999px;background:rgba(26,26,31,.68);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.1);box-shadow:0 4px 16px rgba(0,0,0,.25);z-index:46;color:var(--sub);font-size:12px;pointer-events:none;white-space:nowrap}.top-loading.show{display:flex}.top-loading .ptr-spin{display:block}[data-theme=light] .top-loading{background:rgba(255,255,255,.8);border-color:rgba(0,0,0,.08);box-shadow:0 4px 16px rgba(0,0,0,.12)}';
  if (!c.includes(o1)) { console.error('CSS1 NOT FOUND'); process.exit(1); }
  c = c.replace(o1, n1);
  // ② 浮框固定最小宽度 + 数量截断
  const o2 = '.list-float{position:fixed;right:10px;z-index:45;display:flex;flex-direction:column;align-items:stretch;gap:6px;';
  const n2 = '.list-float{position:fixed;right:10px;z-index:45;display:flex;flex-direction:column;align-items:stretch;gap:6px;width:48px;';
  if (!c.includes(o2)) { console.error('CSS2 NOT FOUND'); process.exit(1); }
  c = c.replace(o2, n2);
  // ③ .lf-count 截断
  const o3 = '.lf-count{font-size:11px;color:var(--sub);font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1}';
  const n3 = '.lf-count{font-size:11px;color:var(--sub);font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1;max-width:100%;overflow:hidden;text-overflow:ellipsis}';
  if (!c.includes(o3)) { console.error('CSS3 NOT FOUND'); process.exit(1); }
  c = c.replace(o3, n3);
  fs.writeFileSync(p, c, 'utf8');
  console.log('OK CSS');
}

// ===== JS =====
{
  const p = 'static/js/app.js';
  let s = fs.readFileSync(p, 'utf8');
  // ① poke 参数化（d 缺省 2s）
  const o1 = 'function poke(){f.classList.add("show"),syncFloatCount(),clearTimeout(timer),timer=setTimeout(hide,2e3)}';
  const n1 = 'function poke(d){f.classList.add("show"),syncFloatCount(),clearTimeout(timer),timer=setTimeout(hide,d||2e3)}';
  if (!s.includes(o1)) { console.error('JS1 NOT FOUND'); process.exit(1); }
  s = s.replace(o1, n1);
  // ② 拖拽 down/move/up 延长隐藏（5s）
  const o2 = 'const onDown=e=>{dragging=!0,moved=!1,sx=e.clientX,sy=e.clientY,dx=e.clientX-f.offsetLeft,dy=e.clientY-f.offsetTop,f.setPointerCapture&&f.setPointerCapture(e.pointerId)}';
  const n2 = 'const onDown=e=>{dragging=!0,moved=!1,sx=e.clientX,sy=e.clientY,dx=e.clientX-f.offsetLeft,dy=e.clientY-f.offsetTop,f.setPointerCapture&&f.setPointerCapture(e.pointerId),poke(5e3)}';
  if (!s.includes(o2)) { console.error('JS2 NOT FOUND'); process.exit(1); }
  s = s.replace(o2, n2);
  const o3 = 'moved=!0,_lfCustom=!0,e.preventDefault();const nx=Math.min(Math.max(6,e.clientX-dx),window.innerWidth-f.offsetWidth-6),ny=Math.min(Math.max(6,e.clientY-dy),window.innerHeight-f.offsetHeight-6);f.style.left=nx+"px",f.style.top=ny+"px"}';
  const n3 = 'moved=!0,_lfCustom=!0,e.preventDefault(),poke(5e3);const nx=Math.min(Math.max(6,e.clientX-dx),window.innerWidth-f.offsetWidth-6),ny=Math.min(Math.max(6,e.clientY-dy),window.innerHeight-f.offsetHeight-6);f.style.left=nx+"px",f.style.top=ny+"px"}';
  if (!s.includes(o3)) { console.error('JS3 NOT FOUND'); process.exit(1); }
  s = s.replace(o3, n3);
  const o4 = 'const onUp=()=>{if(!dragging)return;dragging=!1;if(moved){try{localStorage.setItem("lfFloatPos",JSON.stringify({left:f.offsetLeft,top:f.offsetTop}))}catch{}setTimeout(()=>{moved=!1},100)}}';
  const n4 = 'const onUp=()=>{if(!dragging)return;dragging=!1,poke(5e3);if(moved){try{localStorage.setItem("lfFloatPos",JSON.stringify({left:f.offsetLeft,top:f.offsetTop}))}catch{}setTimeout(()=>{moved=!1},100)}}';
  if (!s.includes(o4)) { console.error('JS4 NOT FOUND'); process.exit(1); }
  s = s.replace(o4, n4);
  // ③ content touchstart/touchmove/touchend 延长隐藏（5s）
  const o5 = 'c.addEventListener("scroll",()=>poke(),{passive:!0}),window.addEventListener("resize",place),place()}';
  const n5 = 'c.addEventListener("scroll",()=>poke(),{passive:!0}),c.addEventListener("touchstart",()=>poke(5e3),{passive:!0}),c.addEventListener("touchmove",()=>poke(5e3),{passive:!0}),c.addEventListener("touchend",()=>poke(5e3),{passive:!0}),window.addEventListener("resize",place),place()}';
  if (!s.includes(o5)) { console.error('JS5 NOT FOUND'); process.exit(1); }
  s = s.replace(o5, n5);
  fs.writeFileSync(p, s, 'utf8');
  console.log('OK JS');
}
console.log('ALL DONE');
