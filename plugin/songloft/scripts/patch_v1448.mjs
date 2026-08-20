// v1.4.48：WebDAV 歌曲时长取不到时，显示文件大小（PROPFIND getcontentlength，无需额外抓取）
import fs from 'node:fs';
const p = 'static/js/app.js';
let s = fs.readFileSync(p, 'utf8');
function rep(old_, new_, label) {
  if (!s.includes(old_)) { console.error('NOT FOUND:', label); process.exit(1); }
  s = s.replace(old_, new_);
  console.log('OK', label);
}
// ① fmt 后加 fmtSize
rep(
  'function fmt(t){if(!t)return"0:00";const e=Math.floor(Number(t));return Math.floor(e/60)+":"+String(e%60).padStart(2,"0")}',
  'function fmt(t){if(!t)return"0:00";const e=Math.floor(Number(t));return Math.floor(e/60)+":"+String(e%60).padStart(2,"0")}function fmtSize(b){if(!b||b<=0)return"";if(b>=1073741824)return(b/1073741824).toFixed(1)+"GB";if(b>=1048576)return(b/1048576).toFixed(1)+"MB";if(b>=1024)return Math.round(b/1024)+"KB";return b+"B"}',
  'P1 fmtSize'
);
// ② trackRow 时长：duration>0 显示时长，否则 size 显示大小
rep(
  'a.className="dur",a.textContent=fmt(t.duration),e.appendChild(a)',
  'a.className="dur",a.textContent=t.duration>0?fmt(t.duration):(t.size?fmtSize(t.size):"0:00"),e.appendChild(a)',
  'P2 trackRow dur'
);
fs.writeFileSync(p, s, 'utf8');
console.log('ALL DONE');
