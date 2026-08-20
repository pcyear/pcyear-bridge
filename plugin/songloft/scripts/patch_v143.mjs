// v1.4.3 前端补丁：列表骨架 + 按需补全（封面懒加载 / 集合元数据按需 / 封面并发池）
// 对 static/js/app.js（压缩单行）做精确字符串替换。用法：node scripts/patch_v143.mjs
// 注意：全部用单引号字符串，反引号用 BT 变量拼接，${} 保持字面，避免脚本自身插值。
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'static', 'js', 'app.js');
let js = readFileSync(path, 'utf8');
const BT = String.fromCharCode(96); // 反引号
const Q = "'";

function rep(oldStr, newStr, label) {
  const n = js.split(oldStr).length - 1;
  if (n !== 1) { console.error('FAIL ' + label + ': found ' + n + ' occurrences (expect 1)'); process.exit(1); }
  js = js.replace(oldStr, newStr);
  console.log('OK ' + label);
}

// ---------- 1) makeCover → 懒加载（进视口才取封面）+ lazyCover ----------
rep(
  'function makeCover(t,e){const n=document.createElement("img");return n.className=t,n.alt="",n.src=DEFAULT_COVER,e&&setCover(n,e),n}',
  'function makeCover(t,e){const n=document.createElement("img");return n.className=t,n.alt="",n.src=DEFAULT_COVER,e&&lazyCover(n,e),n}function lazyCover(t,e){if(!("IntersectionObserver"in window)){setCover(t,e);return}const n=new IntersectionObserver(s=>{for(const o of s)if(o.isIntersecting){n.disconnect(),setCover(t,e);break}},{root:document.getElementById("content")||null,rootMargin:"200px 0px"});n.observe(t)}',
  'makeCover lazy',
);

// ---------- 2) 封面并发池（最多 3 个在途）+ coverDataUrl 未命中缓存时入队 ----------
rep(
  'async function coverDataUrl(t){if(!t)return null;const e=currentSourceId;if(e===SONGLOFT_SOURCE_ID){const s=' + BT + '${PLUGIN_BASE}/cover-data?songId=${encodeURIComponent(t)}' + BT + ';if(coverGet(s))return coverGet(s);try{const i=await(await fetch(s,{headers:authHeaders()})).json();if(i.ok&&i.dataUrl)return coverSet(s,i.dataUrl),i.dataUrl}catch{}return null}const n=' + BT + '${PLUGIN_BASE}/cover-data?sourceId=${encodeURIComponent(e)}&coverId=${encodeURIComponent(t)}' + BT + ';if(coverGet(n))return coverGet(n);try{const o=await(await fetch(n,{headers:authHeaders()})).json();if(o.ok&&o.dataUrl)return coverSet(n,o.dataUrl),o.dataUrl}catch{}return null}',
  'let _coverQueue=[],_coverActive=0;const _COVER_MAX=3;function _pumpCovers(){if(_coverActive>=_COVER_MAX)return;while(_coverActive<_COVER_MAX&&_coverQueue.length){const j=_coverQueue.shift();_coverActive++;j.fn().then(v=>{_coverActive--;j.res(v);_pumpCovers()},er=>{_coverActive--;j.rej(er);_pumpCovers()})}}function _coverThrottle(fn){return new Promise((res,rej)=>{_coverQueue.push({fn,res,rej});_pumpCovers()})}async function coverDataUrl(t){if(!t)return null;const e=currentSourceId;if(e===SONGLOFT_SOURCE_ID){const s=' + BT + '${PLUGIN_BASE}/cover-data?songId=${encodeURIComponent(t)}' + BT + ';if(coverGet(s))return coverGet(s);try{const i=await _coverThrottle(async()=>{const r=await fetch(s,{headers:authHeaders()});return r.json()});if(i.ok&&i.dataUrl)return coverSet(s,i.dataUrl),i.dataUrl}catch{}return null}const n=' + BT + '${PLUGIN_BASE}/cover-data?sourceId=${encodeURIComponent(e)}&coverId=${encodeURIComponent(t)}' + BT + ';if(coverGet(n))return coverGet(n);try{const o=await _coverThrottle(async()=>{const r=await fetch(n,{headers:authHeaders()});return r.json()});if(o.ok&&o.dataUrl)return coverSet(n,o.dataUrl),o.dataUrl}catch{}return null}',
  'cover pool',
);

// ---------- 3) makeCard 增加 needInfo 参数 → 骨架卡片打 data-info 标记 ----------
rep(
  'function makeCard(t,e,n,s,o,i){const a=document.createElement("div");a.className="card";const r=document.createElement("input");',
  'function makeCard(t,e,n,s,o,i,m){const a=document.createElement("div");a.className="card";m&&(a.dataset.info="1");const r=document.createElement("input");',
  'makeCard needInfo',
);

// ---------- 4) renderList 三分支：骨架副标题为空 + 渲染后 scheduleCardInfo ----------
rep(
  '}else if(t==="albums"){const n=document.createElement("div");n.className="grid";for(const s of currentList){const o=makeCard(s,"album",s.artist,(s.trackCount||0)+" \u9996",()=>openAlbum(s),()=>playDirectory("album",s));n.appendChild(o)}e.appendChild(n)}else if(t==="artists"){const n=document.createElement("div");n.className="grid";for(const s of currentList){const o=makeCard(s,"artist","",artistCountLabel(s),()=>openArtist(s),()=>playDirectory("artist",s));n.appendChild(o)}e.appendChild(n)}else if(t==="playlists"){const n=document.createElement("div");n.className="grid";for(const s of currentList){const o=makeCard(s,"playlist","",s.trackCount!=null?s.trackCount+" \u9996":"",()=>openPlaylist(s),()=>playDirectory("playlist",s));n.appendChild(o)}e.appendChild(n)}updateListCount()',
  '}else if(t==="albums"){const n=document.createElement("div");n.className="grid";for(const s of currentList){const m=s.artist==null&&s.trackCount==null&&s.albumCount==null;const o=makeCard(s,"album",s.artist,m?"":(s.trackCount||0)+" \u9996",()=>openAlbum(s),()=>playDirectory("album",s),m);n.appendChild(o)}e.appendChild(n)}else if(t==="artists"){const n=document.createElement("div");n.className="grid";for(const s of currentList){const m=s.albumCount==null&&s.trackCount==null;const o=makeCard(s,"artist","",m?"":artistCountLabel(s),()=>openArtist(s),()=>playDirectory("artist",s),m);n.appendChild(o)}e.appendChild(n)}else if(t==="playlists"){const n=document.createElement("div");n.className="grid";for(const s of currentList){const m=s.trackCount==null;const o=makeCard(s,"playlist","",m?"":s.trackCount+" \u9996",()=>openPlaylist(s),()=>playDirectory("playlist",s),m);n.appendChild(o)}e.appendChild(n)}scheduleCardInfo(t),updateListCount()',
  'renderList skeleton',
);

// ---------- 5) loadMoreList 三分支：同样骨架化 + scheduleCardInfo ----------
rep(
  'for(const r of s.list){const l=i==="albums"?makeCard(r,"album",r.artist,(r.trackCount||0)+" \u9996",()=>openAlbum(r),()=>playDirectory("album",r)):i==="artists"?makeCard(r,"artist","",artistCountLabel(r),()=>openArtist(r),()=>playDirectory("artist",r)):makeCard(r,"playlist","",r.trackCount!=null?r.trackCount+" \u9996":"",()=>openPlaylist(r),()=>playDirectory("playlist",r));a.appendChild(l)}}updateBulkBar(),updateListCount()',
  'for(const r of s.list){const m=i==="albums"?r.artist==null&&r.trackCount==null&&r.albumCount==null:i==="artists"?r.albumCount==null&&r.trackCount==null:r.trackCount==null;const l=i==="albums"?makeCard(r,"album",r.artist,m?"":(r.trackCount||0)+" \u9996",()=>openAlbum(r),()=>playDirectory("album",r),m):i==="artists"?makeCard(r,"artist","",m?"":artistCountLabel(r),()=>openArtist(r),()=>playDirectory("artist",r),m):makeCard(r,"playlist","",m?"":r.trackCount+" \u9996",()=>openPlaylist(r),()=>playDirectory("playlist",r),m);a.appendChild(l)}scheduleCardInfo(i),updateBulkBar(),updateListCount()',
  'loadMoreList skeleton',
);

// ---------- 6) scheduleCardInfo / flushCardInfo：可见卡片批量取集合元数据 ----------
rep(
  'function renderList(t){const e=$("content");',
  'let _infoTimer=null,_infoIds=[];function scheduleCardInfo(t){const e=$("content");const n=e.querySelectorAll(".card[data-info]");if(!n.length)return;if(!("IntersectionObserver"in window)){for(const s of n){const a=s.dataset.id;a&&_infoIds.indexOf(a)<0&&_infoIds.push(a)}_infoTimer&&clearTimeout(_infoTimer);_infoTimer=setTimeout(flushCardInfo,50);return}const s=new IntersectionObserver(o=>{for(const r of o)if(r.isIntersecting){s.unobserve(r.target);const a=r.target.dataset.id;if(a&&_infoIds.indexOf(a)<0)_infoIds.push(a);_infoTimer&&clearTimeout(_infoTimer);_infoTimer=setTimeout(flushCardInfo,50)}},{root:e,rootMargin:"200px 0px"});for(const o of n)s.observe(o)}async function flushCardInfo(){_infoTimer=null;const t=_infoIds;_infoIds=[];if(!t.length)return;try{const e=await api(' + BT + '${PLUGIN_BASE}/collections/info' + BT + ',"POST",{sourceId:currentSourceId,ids:t},15e3);if(!e||!e.ok||!Array.isArray(e.list))return;const n=$("content");for(const s of e.list){if(!s||s.id==null)continue;const o=n.querySelectorAll(".card");for(const r of o){if(r.dataset.id!==s.id)continue;r.dataset.info="done";const a=r.querySelector(".s");if(a){const c=[];s.artist&&c.push(s.artist);s.trackCount!=null?c.push(s.trackCount+" \u9996"):s.albumCount!=null&&c.push(s.albumCount+" \u9879");a.textContent=c.join(" \xB7 ")}if(s.coverId){const c=r.querySelector(".cov");c&&c.src===DEFAULT_COVER&&setCover(c,s.coverId)}}}}catch{}}function renderList(t){const e=$("content");',
  'scheduleCardInfo+flushCardInfo',
);

// ---------- 7) openAlbum / openArtist：无 coverId 时先取集合元数据再进详情 ----------
rep(
  'function openAlbum(t){drill={type:"album",id:t.id,name:t.name,coverId:t.coverId},loadDrill()}function openArtist(t){drill={type:"artist",id:t.id,name:t.name,coverId:t.coverId},loadDrill()}',
  'function openAlbum(t){drill={type:"album",id:t.id,name:t.name,coverId:t.coverId},drill.coverId?loadDrill():ensureDrillCover(t.id)}function openArtist(t){drill={type:"artist",id:t.id,name:t.name,coverId:t.coverId},drill.coverId?loadDrill():ensureDrillCover(t.id)}async function ensureDrillCover(t){try{const n=await api(' + BT + '${PLUGIN_BASE}/collections/info' + BT + ',"POST",{sourceId:currentSourceId,ids:[t]},15e3);if(n&&n.ok&&n.list&&n.list[0]&&n.list[0].coverId)drill.coverId=n.list[0].coverId}catch{}loadDrill()}',
  'openAlbum/openArtist coverId fill',
);

// ---------- 8) openPlaylist：同样兜底 ----------
rep(
  'function openPlaylist(t){drill={type:"playlist",id:t.id,name:t.name},loadDrill()}',
  'function openPlaylist(t){drill={type:"playlist",id:t.id,name:t.name,coverId:t.coverId},drill.coverId?loadDrill():ensureDrillCover(t.id)}',
  'openPlaylist coverId fill',
);

writeFileSync(path, js, 'utf8');
console.log('PATCHED OK, length:', js.length);
