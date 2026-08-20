// v1.4.27：封面队列可见性管理——封面请求带 coverId tag，滚出可见区域即从队列移除；
// 被取消的封面不写失败缓存（滚回可见可重新加载）；懒加载/用户点击请求已全 P1（复核 16 处）。
import fs from 'node:fs';
const p = 'C:/Users/王子奇/WorkBuddy/2026-07-31-08-45-02/fnmusic-bridge/static/js/app.js';
let s = fs.readFileSync(p, 'utf8');

function repBlock(old, nw, label) {
  if (!s.includes(old)) { console.error('NOT FOUND:', label); process.exit(1); }
  s = s.replace(old, nw);
  console.log('OK', label);
}

// 1) _coverThrottle 支持 tag（封面带 'c:'+coverId）
repBlock(
  'function _coverThrottle(fn){return queueRequest(fn,{prio:2})}',
  'function _coverThrottle(fn,tag){return queueRequest(fn,{prio:2,tag:tag||_ctxTag})}',
  'coverThrottle tag');

// 2) _coverReq：封面任务带 tag + 被取消（cancelled）不写失败缓存
repBlock(
  'const p=_coverThrottle(async()=>{const r=await fetch(t,{headers:authHeaders()});return r.json()}).then(j=>{if(j&&j.ok&&j.dataUrl)return coverSet(t,j.dataUrl),j.dataUrl;return _coverFailCache.set(t,Date.now()),null}).catch(()=>{return _coverFailCache.set(t,Date.now()),null})',
  'const p=_coverThrottle(async()=>{const r=await fetch(t,{headers:authHeaders()});return r.json()}, "c:"+t).then(j=>{if(j&&j.ok&&j.dataUrl)return coverSet(t,j.dataUrl),j.dataUrl;return _coverFailCache.set(t,Date.now()),null}).catch(e=>{if(e&&e.cancelled)return null;return _coverFailCache.set(t,Date.now()),null})',
  'coverReq tag+cancel-aware');

// 3) lazyCover：滚出可见区域 → 从队列移除该封面请求（未开始执行的）
repBlock(
  'const n=new IntersectionObserver(s=>{for(const o of s)if(o.isIntersecting){n.disconnect(),setCover(t,e);break}},{root:document.getElementById("content")||null,rootMargin:listPreloadPx()+"px 0px"});n.observe(t)',
  'const n=new IntersectionObserver(s=>{for(const o of s){if(o.isIntersecting){n.disconnect(),setCover(t,e);return}cancelRequests(q=>q.tag==="c:"+e)}},{root:document.getElementById("content")||null,rootMargin:listPreloadPx()+"px 0px"});n.observe(t)',
  'lazyCover cancel on leave');

fs.writeFileSync(p, s, 'utf8');
console.log('ALL DONE');
