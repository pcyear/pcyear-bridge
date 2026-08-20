// v1.4.44：返回按钮并入返回顶部浮框（一体框、drill 才显示）+ 浮框可拖拽移动
import fs from 'node:fs';

// ===== template：lf-top 后加 lf-back =====
{
  const p = 'static/index.template.html';
  let t = fs.readFileSync(p, 'utf8');
  const o = '<path d="m8 12 4-4 4 4"/></svg></button><span class="lf-count" id="lfCount"></span>';
  const n = '<path d="m8 12 4-4 4 4"/></svg></button><button class="lf-back" id="lfBack" onclick="lfBack()" title="返回">← 返回</button><span class="lf-count" id="lfCount"></span>';
  if (!t.includes(o)) { console.error('TPL NOT FOUND'); process.exit(1); }
  t = t.replace(o, n);
  fs.writeFileSync(p, t, 'utf8');
  console.log('OK TPL lfBack');
}

// ===== CSS：.lf-back 样式 + 删 .back =====
{
  const p = 'static/css/app.css';
  let c = fs.readFileSync(p, 'utf8');
  // 1) .lf-top:active 后插 .lf-back
  const anchor = '.lf-top:active{transform:scale(.9)}';
  const add = anchor + '.lf-back{display:none;width:auto;min-width:54px;height:30px;border:none;border-radius:8px;background:transparent;color:var(--sub);cursor:pointer;align-items:center;justify-content:center;gap:3px;padding:0 8px;font-size:12px;font-weight:500;transition:background .15s,color .15s}.lf-back.show{display:flex}.lf-back:hover{background:rgba(255,255,255,.1);color:var(--text)}[data-theme=light] .lf-back:hover{background:rgba(0,0,0,.07)}';
  if (!c.includes(anchor)) { console.error('CSS ANCHOR NOT FOUND'); process.exit(1); }
  c = c.replace(anchor, add);
  // 2) 删除 .back 三条规则（.back{...} .back:hover{...} .back:active{...}）
  for (const sel of ['.back{', '.back:hover{', '.back:active{']) {
    while (c.includes(sel)) {
      const i = c.indexOf(sel);
      const end = c.indexOf('}', i);
      if (end < 0) { console.error('CSS BOUNDS', sel); process.exit(1); }
      // 往前找到规则起始（上一个 } 之后）
      const start = c.lastIndexOf('}', i) + 1;
      c = c.substring(0, start) + c.substring(end + 1);
    }
  }
  fs.writeFileSync(p, c, 'utf8');
  console.log('OK CSS lfBack + .back removed');
}

// ===== app.js =====
{
  const p = 'static/js/app.js';
  let s = fs.readFileSync(p, 'utf8');
  function rep(old_, new_, label) {
    if (!s.includes(old_)) { console.error('NOT FOUND:', label); process.exit(1); }
    if (s.split(old_).length > 2) { console.error('NOT UNIQUE:', label); process.exit(1); }
    s = s.replace(old_, new_);
    console.log('OK', label);
  }
  // a) 删 drill back 创建
  rep(
    'const o=document.createElement("div");o.className="back",o.textContent="\\u2190 \\u8FD4\\u56DE",o.onclick=()=>loadView(view),e.appendChild(o);',
    '',
    'P3a drill back removed'
  );
  // b) 新增 lfBack()
  rep(
    'function scrollListTop(){',
    'function lfBack(){drill&&loadView(view)}function scrollListTop(){',
    'P3b lfBack'
  );
  // c) syncFloatCount 切换 lfBack 显示
  rep(
    'function syncFloatCount(){const f=$("listFloat"),n=$("lfCount");if(!f||!n)return;if(!drill&&searchActive',
    'function syncFloatCount(){const f=$("listFloat"),n=$("lfCount");if(!f||!n)return;const bk=$("lfBack");bk&&bk.classList.toggle("show",!!drill);if(!drill&&searchActive',
    'P3c syncFloatCount lfBack'
  );
  // d) 声明 _lfCustom
  rep(
    'let listPage=0,listTotal=0,listLoading=!1,drillTotal=0,listScanning=!1,_scanPollTimer=null,_sbOpen=!1,_playerWasMini=null,searchResultCount=null;',
    'let listPage=0,listTotal=0,listLoading=!1,drillTotal=0,listScanning=!1,_scanPollTimer=null,_sbOpen=!1,_playerWasMini=null,searchResultCount=null,_lfCustom=!1;',
    'P3d lfCustom decl'
  );
  // e) bindListFloat：恢复位置 + place 检查 + 拖拽
  rep(
    'function bindListFloat(){const c=$("content"),f=$("listFloat");if(!c||!f||f.dataset.bound)return;f.dataset.bound="1";let timer=null;const place=()=>{const r=c.getBoundingClientRect(),sb=$("searchBar"),off=sb&&sb.classList.contains("show")?sb.offsetHeight:0;f.style.top=(r.top+6+off)+"px"};window._lfPlace=place;',
    'function bindListFloat(){const c=$("content"),f=$("listFloat");if(!c||!f||f.dataset.bound)return;f.dataset.bound="1";let timer=null;try{const p=JSON.parse(localStorage.getItem("lfFloatPos"));if(p&&typeof p.left==="number"){_lfCustom=!0,f.style.left=p.left+"px",f.style.top=p.top+"px"}}catch{}const place=()=>{if(_lfCustom)return;const r=c.getBoundingClientRect(),sb=$("searchBar"),off=sb&&sb.classList.contains("show")?sb.offsetHeight:0;f.style.top=(r.top+6+off)+"px"};window._lfPlace=place;let sx=0,sy=0,dx=0,dy=0,dragging=!1,moved=!1;const onDown=e=>{if(e.target.closest("button"))return;dragging=!0,moved=!1,sx=e.clientX,sy=e.clientY,dx=e.clientX-f.offsetLeft,dy=e.clientY-f.offsetTop,f.setPointerCapture&&f.setPointerCapture(e.pointerId),e.preventDefault()},onMove=e=>{if(!dragging)return;Math.hypot(e.clientX-sx,e.clientY-sy)>4&&(moved=!0);const nx=Math.min(Math.max(6,e.clientX-dx),window.innerWidth-f.offsetWidth-6),ny=Math.min(Math.max(6,e.clientY-dy),window.innerHeight-f.offsetHeight-6);_lfCustom=!0,f.style.left=nx+"px",f.style.top=ny+"px",e.preventDefault()},onUp=()=>{if(!dragging)return;dragging=!1;if(moved){try{localStorage.setItem("lfFloatPos",JSON.stringify({left:f.offsetLeft,top:f.offsetTop}))}catch{}}};f.addEventListener("pointerdown",onDown),window.addEventListener("pointermove",onMove),window.addEventListener("pointerup",onUp);',
    'P3e bindListFloat drag'
  );
  fs.writeFileSync(p, s, 'utf8');
  console.log('app.js done');
}
console.log('ALL DONE');
