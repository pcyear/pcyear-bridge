// v1.4.35：去掉导航刷新按钮，改为下拉刷新——列表顶部下拉出现指示器（下拉刷新/释放刷新），
// 超过阈值触发 refreshList，刷新中列表顶部悬浮转圈图标，完成后隐藏。
// ① refreshList 简化并返回 promise（loadDrill/loadView 均 async）；② 新增 bindPullToRefresh（touch+mouse）；
// ③ init 时绑定。
import fs from 'node:fs';
const p = 'C:/Users/王子奇/WorkBuddy/2026-07-31-08-45-02/fnmusic-bridge/static/js/app.js';
let s = fs.readFileSync(p, 'utf8');

function repBlock(old, nw, label) {
  if (!s.includes(old)) { console.error('NOT FOUND:', label); process.exit(1); }
  s = s.replace(old, nw);
  console.log('OK', label);
}

// 1) refreshList 简化并返回 promise（定位截取，避免 unicode 转义问题）
const r0=s.indexOf('function refreshList(){');
const r1=s.indexOf('}let listPage=0',r0);
if(r0<0||r1<0){console.error('P1 refreshList bounds');process.exit(1)}
s=s.replace(s.substring(r0,r1+1),'function refreshList(){forceRefresh=!0;return drill?loadDrill():loadView(view)}');
console.log('OK P1 refreshList promise');
// 2) bindPullToRefresh（插在 bindListLazyLoad 定义后）
repBlock(
  'function bindListLazyLoad(){const t=$("content");!t||t.dataset.lazyBound||(t.dataset.lazyBound="1",t.addEventListener("scroll",()=>{if(listLoading||!view||searchActive)return;const e=t,n=drill?drillTotal:listTotal;e.scrollTop+e.clientHeight>=e.scrollHeight-120&&currentList.length<n&&loadNextPage()},{passive:!0}))}',
  'function bindListLazyLoad(){const t=$("content");!t||t.dataset.lazyBound||(t.dataset.lazyBound="1",t.addEventListener("scroll",()=>{if(listLoading||!view||searchActive)return;const e=t,n=drill?drillTotal:listTotal;e.scrollTop+e.clientHeight>=e.scrollHeight-120&&currentList.length<n&&loadNextPage()},{passive:!0}))}function bindPullToRefresh(){const c=$("content"),p=$("ptr");if(!c||!p||c.dataset.ptrBound)return;c.dataset.ptrBound="1";let sy=null,pd=0,ref=!1;const H=48,MAX=80,TRIG=60,txt=$("ptrTxt");const place=()=>{const r=c.getBoundingClientRect();p.style.top=r.top+"px"};const reset=()=>{pd=0,p.style.transform="",p.classList.remove("show","loading"),txt&&(txt.textContent="下拉刷新")};const show=d=>{pd=Math.max(0,Math.min(d,MAX)),p.style.transform="translateY("+(pd-H)+"px)",txt&&(txt.textContent=pd>=TRIG?"释放刷新":"下拉刷新")};const go=()=>{ref=!0,p.classList.add("show","loading"),p.style.transform="";try{Promise.resolve(refreshList()).finally(()=>{ref=!1,reset()})}catch{ref=!1,reset()}};const start=y=>{if(ref||listLoading||!view||c.scrollTop>0)return;sy=y,pd=0};const move=y=>{if(sy==null)return;const d=y-sy;if(d<=0){pd>0&&(pd=0,reset());return}show(d)};const end=()=>{if(sy==null)return;sy=null,pd>=TRIG?go():reset()};place(),window.addEventListener("resize",place),c.addEventListener("touchstart",e=>start(e.touches[0].clientY),{passive:!0}),c.addEventListener("touchmove",e=>{if(sy==null)return;const d=e.touches[0].clientY-sy;if(d>0&&c.scrollTop<=0){e.preventDefault(),move(e.touches[0].clientY)}},{passive:!1}),c.addEventListener("touchend",end,{passive:!0}),c.addEventListener("mousedown",e=>{e.button===0&&start(e.clientY)}),c.addEventListener("mousemove",e=>{if(sy!=null){e.preventDefault(),move(e.clientY)}}),c.addEventListener("mouseup",end),c.addEventListener("mouseleave",()=>{if(sy!=null){sy=null,pd>=TRIG?go():reset()}})}',
  'P2 bindPullToRefresh');

// 3) init 绑定
repBlock(
  '$("content").addEventListener("scroll",()=>scheduleSaveState(),{passive:!0}),bindListLazyLoad();',
  '$("content").addEventListener("scroll",()=>scheduleSaveState(),{passive:!0}),bindListLazyLoad(),bindPullToRefresh();',
  'P3 init bind');

fs.writeFileSync(p, s, 'utf8');
console.log('ALL DONE');
