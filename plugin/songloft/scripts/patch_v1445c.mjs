// v1.4.45c：返回按钮/框收窄（不再与返回顶部框强制同宽）
import fs from 'node:fs';
const p = 'static/css/app.css';
let c = fs.readFileSync(p, 'utf8');

// 1) .list-float 恢复 align-items:center（两子框各自内容宽，返回框可窄于返回顶部框）
const o1 = '.list-float{position:fixed;right:10px;z-index:45;display:flex;flex-direction:column;gap:8px;';
const n1 = '.list-float{position:fixed;right:10px;z-index:45;display:flex;flex-direction:column;align-items:center;gap:8px;';
if (!c.includes(o1)) { console.error('CSS1 NOT FOUND'); process.exit(1); }
c = c.replace(o1, n1);

// 2) .lf-back 收窄（去 min-width:54、padding 0 8px → 0 5px）
const o2 = '.lf-back{width:auto;min-width:54px;height:30px;border:none;border-radius:8px;background:transparent;color:var(--sub);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:3px;padding:0 8px;font-size:12px;font-weight:500;transition:background .15s,color .15s}';
const n2 = '.lf-back{width:auto;min-width:0;height:30px;border:none;border-radius:8px;background:transparent;color:var(--sub);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:3px;padding:0 5px;font-size:12px;font-weight:500;transition:background .15s,color .15s}';
if (!c.includes(o2)) { console.error('CSS2 NOT FOUND'); process.exit(1); }
c = c.replace(o2, n2);

// 3) .lf-back-box 内边距紧凑（覆盖 .lf-box 的 6px 8px）
const o3 = '.lf-back-box{display:none}.lf-back-box.show{display:flex;justify-content:center}';
const n3 = '.lf-back-box{display:none;padding:5px 6px}.lf-back-box.show{display:flex;justify-content:center}';
if (!c.includes(o3)) { console.error('CSS3 NOT FOUND'); process.exit(1); }
c = c.replace(o3, n3);

fs.writeFileSync(p, c, 'utf8');
console.log('CSS done');
