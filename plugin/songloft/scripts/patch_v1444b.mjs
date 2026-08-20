// v1.4.44b：浮框返回按钮去箭头、上下两个独立子框（各自磨砂边框）
import fs from 'node:fs';

// ===== CSS =====
{
  const p = 'static/css/app.css';
  let c = fs.readFileSync(p, 'utf8');
  // 1) .list-float 去磨砂，新增 .lf-box（子框磨砂）+ .lf-back-box
  const o1 = '.list-float{position:fixed;right:10px;z-index:45;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 7px;border-radius:12px;background:rgba(26,26,31,.6);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.08);box-shadow:0 4px 18px rgba(0,0,0,.28);opacity:0;pointer-events:none;transform:translateY(-6px);transition:opacity .18s,transform .18s;color:var(--text)}';
  const n1 = '.list-float{position:fixed;right:10px;z-index:45;display:flex;flex-direction:column;align-items:center;gap:8px;opacity:0;pointer-events:none;transform:translateY(-6px);transition:opacity .18s,transform .18s;color:var(--text)}.lf-box{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 8px;border-radius:12px;background:rgba(26,26,31,.6);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.08);box-shadow:0 4px 18px rgba(0,0,0,.28)}.lf-back-box{display:none}.lf-back-box.show{display:flex}';
  if (!c.includes(o1)) { console.error('CSS1 NOT FOUND'); process.exit(1); }
  c = c.replace(o1, n1);
  // 2) .lf-back 由父框控制显示
  const o2 = '.lf-back{display:none;width:auto;min-width:54px;height:30px;border:none;border-radius:8px;background:transparent;color:var(--sub);cursor:pointer;align-items:center;justify-content:center;gap:3px;padding:0 8px;font-size:12px;font-weight:500;transition:background .15s,color .15s}.lf-back.show{display:flex}';
  const n2 = '.lf-back{width:auto;min-width:54px;height:30px;border:none;border-radius:8px;background:transparent;color:var(--sub);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:3px;padding:0 8px;font-size:12px;font-weight:500;transition:background .15s,color .15s}';
  if (!c.includes(o2)) { console.error('CSS2 NOT FOUND'); process.exit(1); }
  c = c.replace(o2, n2);
  // 3) light 适配移到 .lf-box
  const o3 = '[data-theme=light] .list-float{background:rgba(255,255,255,.72);border-color:rgba(0,0,0,.08);box-shadow:0 4px 18px rgba(0,0,0,.12)}';
  const n3 = '[data-theme=light] .lf-box{background:rgba(255,255,255,.72);border-color:rgba(0,0,0,.08);box-shadow:0 4px 18px rgba(0,0,0,.12)}';
  if (!c.includes(o3)) { console.error('CSS3 NOT FOUND'); process.exit(1); }
  c = c.replace(o3, n3);
  fs.writeFileSync(p, c, 'utf8');
  console.log('OK CSS');
}

// ===== JS：toggle target 改 lfBackBox =====
{
  const p = 'static/js/app.js';
  let s = fs.readFileSync(p, 'utf8');
  const o = 'const bk=$("lfBack");bk&&bk.classList.toggle("show",!!drill);';
  const n = 'const bk=$("lfBackBox");bk&&bk.classList.toggle("show",!!drill);';
  if (!s.includes(o)) { console.error('JS NOT FOUND'); process.exit(1); }
  s = s.replace(o, n);
  fs.writeFileSync(p, s, 'utf8');
  console.log('OK JS lfBackBox');
}
console.log('ALL DONE');
