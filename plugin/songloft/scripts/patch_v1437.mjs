// v1.4.37：WebDAV 渐进扫描下歌曲列表数量 502→573 跳变——扫描未完成（partial）时数量区显示「扫描中…」，
// 扫描完成后才显示最终总数；滚动懒加载在扫描中无条件续页（total 不可信）。favorites/缓存/搜索视图复位扫描标志。
import fs from 'node:fs';
const p = 'C:/Users/王子奇/WorkBuddy/2026-07-31-08-45-02/fnmusic-bridge/static/js/app.js';
let s = fs.readFileSync(p, 'utf8');

function repBlock(old, nw, label) {
  if (!s.includes(old)) { console.error('NOT FOUND:', label); process.exit(1); }
  s = s.replace(old, nw);
  console.log('OK', label);
}

// 1) 全局 listScanning 标志
repBlock(
  'let listPage=0,listTotal=0,listLoading=!1,drillTotal=0;',
  'let listPage=0,listTotal=0,listLoading=!1,drillTotal=0,listScanning=!1;',
  'P1 listScanning flag');

// 2) updateListCount：扫描中显示「扫描中…」（用定位截取，避开 unicode）
const u0 = s.indexOf('function updateListCount(){');
const u1 = s.indexOf('function artistCountLabel', u0);
if (u0 < 0 || u1 < 0) { console.error('updateListCount bounds'); process.exit(1); }
const updNew = 'function updateListCount(){const t=$("listCount");if(!t)return;const e=drill?drillTotal:listTotal,n=currentList.length;if(!drill&&listScanning){t.textContent="扫描中…",t.title="正在扫描音源，完成前数量为估算值";return}if(!e){t.textContent="",t.title="";return}t.textContent=`${n}/${e}`,t.title="已加载 "+n+" / 共 "+e+" 首"}';
s = s.substring(0, u0) + updNew + s.substring(u1);
console.log('OK P2 updateListCount scanning');

// 3) loadView 网络分支：partial → 扫描中（保留旧 listTotal）
repBlock(
  'currentList=a.list||[],listTotal=a.total||currentList.length;',
  'currentList=a.list||[],listScanning=!!a.partial,listScanning||(listTotal=a.total||currentList.length);',
  'P3 loadView partial');

// 4) loadNextPage 非 drill：partial → 扫描中
repBlock(
  'currentList=currentList.concat(s.list),listTotal=s.total||currentList.length;',
  'currentList=currentList.concat(s.list),listScanning=!!s.partial,listScanning||(listTotal=s.total||currentList.length);',
  'P4 loadNextPage partial');

// 5) 滚动懒加载条件：扫描中无条件续页
repBlock(
  'e.scrollTop+e.clientHeight>=e.scrollHeight-120&&currentList.length<n&&loadNextPage()',
  'e.scrollTop+e.clientHeight>=e.scrollHeight-120&&(listScanning||currentList.length<n)&&loadNextPage()',
  'P5 lazy load scanning cond');

// 6) favorites 分支复位
repBlock(
  'currentList=d.list||[],listTotal=d.total||currentList.length;',
  'currentList=d.list||[],listScanning=!1,listTotal=d.total||currentList.length;',
  'P6 favorites reset');

// 7) 缓存分支复位（3 处：c.list / l.list 两种变量）
repBlock(
  'memCache[l]=c,currentList=c.list,listTotal=c.total||c.list.length,',
  'memCache[l]=c,currentList=c.list,listScanning=!1,listTotal=c.total||c.list.length,',
  'P7a cache c');
repBlock(
  'memCache[o]=l,currentList=l.list,listTotal=l.total||l.list.length,',
  'memCache[o]=l,currentList=l.list,listScanning=!1,listTotal=l.total||l.list.length,',
  'P7b cache l');
repBlock(
  'localStore.set(o,c),currentList=c.list,listTotal=c.total||c.list.length,',
  'localStore.set(o,c),currentList=c.list,listScanning=!1,listTotal=c.total||c.list.length,',
  'P7c cache c2');

// 8) 搜索完成复位（定位：if(!e.ok) 前插 listScanning=!1，避开 unicode）
const sAnchor = 'if(!e.ok){$("content").innerHTML=';
const sIdx = s.indexOf(sAnchor);
if(sIdx<0){console.error('P8 anchor not found');process.exit(1)}
s=s.substring(0,sIdx)+'listScanning=!1;'+s.substring(sIdx);
console.log('OK P8 search reset');

fs.writeFileSync(p, s, 'utf8');
console.log('ALL DONE');
