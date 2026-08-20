// v1.4.34：列表懒加载分页时桌面提示「加载中，请稍后…」，请求执行完成（含视图切换提前返回）后隐藏。
// toast 加 duration 参数；toastLoading 计数合并（连续分页不闪烁，全部完成才隐藏）。
import fs from 'node:fs';
const p = 'C:/Users/王子奇/WorkBuddy/2026-07-31-08-45-02/fnmusic-bridge/static/js/app.js';
let s = fs.readFileSync(p, 'utf8');

function repBlock(old, nw, label) {
  if (!s.includes(old)) { console.error('NOT FOUND:', label); process.exit(1); }
  s = s.replace(old, nw);
  console.log('OK', label);
}

// 1) toast 加 duration 参数 + 新增 toastLoading（计数，6 万 ms 兜底自动隐藏）
repBlock(
  'function toast(t){const e=$("toast");e.textContent=t,e.classList.add("show"),setTimeout(()=>e.classList.remove("show"),1800)}',
  'function toast(t,d){const e=$("toast");e.textContent=t,e.classList.add("show"),setTimeout(()=>e.classList.remove("show"),d||1800)}let _lazyToastN=0;function toastLoading(t){if(t){_lazyToastN++,_lazyToastN===1&&toast("加载中，请稍后…",6e4)}else{_lazyToastN=Math.max(0,_lazyToastN-1),0===_lazyToastN&&$("toast")&&$("toast").classList.remove("show")}}',
  'P1 toast duration + toastLoading');

// 2) loadNextPage drill 分支开始
repBlock(
  'if(currentList.length>=drillTotal)return;listLoading=!0;const s=viewToken',
  'if(currentList.length>=drillTotal)return;listLoading=!0,toastLoading(!0);const s=viewToken',
  'P2 drill start');

// 3) drill 提前返回（视图切换）
repBlock(
  'if(s!==viewToken)return;if(i.ok&&Array.isArray(i.list))',
  'if(s!==viewToken){toastLoading(!1);return}if(i.ok&&Array.isArray(i.list))',
  'P3 drill early return');

// 4) drill 完成 + 非 drill 开始
repBlock(
  '}catch{}listLoading=!1;return}listLoading=!0;const e=`${PLUGIN_BASE}/',
  '}catch{}toastLoading(!1),listLoading=!1;return}listLoading=!0,toastLoading(!0);const e=`${PLUGIN_BASE}/',
  'P4 drill done + main start');

// 5) 非 drill 提前返回（视图切换）
repBlock(
  'if(n!==viewToken)return;if(s.ok&&Array.isArray(s.list))',
  'if(n!==viewToken){toastLoading(!1);return}if(s.ok&&Array.isArray(s.list))',
  'P5 main early return');

// 6) 非 drill 完成
repBlock(
  'updateBulkBar(),updateListCount()}}catch{}listLoading=!1}let _infoTimer',
  'updateBulkBar(),updateListCount()}}catch{}toastLoading(!1),listLoading=!1}let _infoTimer',
  'P6 main done');

fs.writeFileSync(p, s, 'utf8');
console.log('ALL DONE');
