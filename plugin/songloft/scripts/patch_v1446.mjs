// v1.4.46：① 返回顶部/返回两框内部紧凑+同宽；② 懒加载提示改顶部（与下拉刷新转圈同位置）
import fs from 'node:fs';

// ===== template：ptr 后加 topLoading =====
{
  const p = 'static/index.template.html';
  let t = fs.readFileSync(p, 'utf8');
  const o = '<div class="ptr" id="ptr"><span class="ptr-spin"></span><span class="ptr-txt" id="ptrTxt">释放刷新</span></div>';
  const n = o + '<div class="top-loading" id="topLoading"><span class="ptr-spin"></span><span>加载中，请稍后…</span></div>';
  if (!t.includes(o)) { console.error('TPL NOT FOUND'); process.exit(1); }
  t = t.replace(o, n);
  fs.writeFileSync(p, t, 'utf8');
  console.log('OK TPL topLoading');
}

// ===== CSS =====
{
  const p = 'static/css/app.css';
  let c = fs.readFileSync(p, 'utf8');
  // 1) 两框同宽（stretch）+ 间距紧凑
  const o1 = '.list-float{position:fixed;right:10px;z-index:45;display:flex;flex-direction:column;align-items:center;gap:8px;';
  const n1 = '.list-float{position:fixed;right:10px;z-index:45;display:flex;flex-direction:column;align-items:stretch;gap:6px;';
  if (!c.includes(o1)) { console.error('CSS1 NOT FOUND'); process.exit(1); }
  c = c.replace(o1, n1);
  // 2) .lf-box 内部紧凑（padding 4px 5px、gap 2px）
  const o2 = '.lf-box{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 8px;';
  const n2 = '.lf-box{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 5px;';
  if (!c.includes(o2)) { console.error('CSS2 NOT FOUND'); process.exit(1); }
  c = c.replace(o2, n2);
  // 3) .lf-back-box 去掉单独 padding（继承 .lf-box 紧凑内边距，与返回顶部框同宽同内边距）
  const o3 = '.lf-back-box{display:none;padding:5px 6px}.lf-back-box.show{display:flex;justify-content:center}';
  const n3 = '.lf-back-box{display:none}.lf-back-box.show{display:flex;justify-content:center}';
  if (!c.includes(o3)) { console.error('CSS3 NOT FOUND'); process.exit(1); }
  c = c.replace(o3, n3);
  // 4) .top-loading 顶部加载指示器（与 ptr 同位置风格）
  const o4 = '.ptr{';
  const n4 = '.top-loading{position:fixed;left:0;right:0;display:none;align-items:center;justify-content:center;gap:8px;height:48px;z-index:46;color:var(--sub);font-size:12px;pointer-events:none}.top-loading.show{display:flex}.top-loading .ptr-spin{display:block}.ptr{';
  if (!c.includes(o4)) { console.error('CSS4 NOT FOUND'); process.exit(1); }
  c = c.replace(o4, n4);
  fs.writeFileSync(p, c, 'utf8');
  console.log('OK CSS');
}

// ===== JS：toastLoading 改顶部指示器 =====
{
  const p = 'static/js/app.js';
  let s = fs.readFileSync(p, 'utf8');
  const o = 'let _lazyToastN=0;function toastLoading(t){if(t){_lazyToastN++,_lazyToastN===1&&toast("加载中，请稍后…",6e4)}else{_lazyToastN=Math.max(0,_lazyToastN-1),0===_lazyToastN&&$("toast")&&$("toast").classList.remove("show")}}';
  const n = 'let _lazyToastN=0,_lazyToastTimer=null;function toastLoading(t){if(t){_lazyToastN++,_lazyToastN===1&&showTopLoading()}else{_lazyToastN=Math.max(0,_lazyToastN-1),0===_lazyToastN&&hideTopLoading()}}function showTopLoading(){const e=$("topLoading"),c=$("content");if(!e||!c)return;const r=c.getBoundingClientRect();e.style.top=(r.top+4)+"px",e.classList.add("show"),clearTimeout(_lazyToastTimer),_lazyToastTimer=setTimeout(()=>hideTopLoading(),6e4)}function hideTopLoading(){const e=$("topLoading");e&&e.classList.remove("show")}';
  if (!s.includes(o)) { console.error('JS NOT FOUND'); process.exit(1); }
  s = s.replace(o, n);
  fs.writeFileSync(p, s, 'utf8');
  console.log('OK JS toastLoading');
}
console.log('ALL DONE');
