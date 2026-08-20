// 修复 v1.4.44b 损坏的 template listFloat 段
import fs from 'node:fs';
const p = 'static/index.template.html';
let t = fs.readFileSync(p, 'utf8');
const start = t.indexOf('id="listFloat">');
const end = t.indexOf('<div class="content"', start);
if (start < 0 || end < 0) { console.error('BOUNDS', start, end); process.exit(1); }
const nw = 'id="listFloat"><div class="lf-box"><button class="lf-top" id="lfTop" onclick="scrollListTop()" title="返回顶部" aria-label="返回顶部"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6H6"/><path d="M12 18V8"/><path d="m8 12 4-4 4 4"/></svg></button><span class="lf-count" id="lfCount"></span></div><div class="lf-box lf-back-box" id="lfBackBox"><button class="lf-back" id="lfBack" onclick="lfBack()" title="返回">返回</button></div></div>';
t = t.substring(0, start) + nw + t.substring(end);
fs.writeFileSync(p, t, 'utf8');
console.log('fixed; lf-count count:', t.split('id="lfCount"').length - 1, '; listFloat:', t.includes('lfBackBox'), '; content ok:', t.includes('<div class="content"'));
