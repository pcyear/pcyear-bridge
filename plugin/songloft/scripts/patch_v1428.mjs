// v1.4.28：① .back 返回按钮 z-index 60→50（不再盖住音源抽屉 z57）；② 投屏轮询健壮化——position 合理窗口防 0 抖动、
// state 连续 2 次确认防误报（miot 物理缓存 TTL 4s 穿透时 position 会被设备裸值重置为 0 → 进度条 0↔4-5 循环）；
// ③ 投屏切歌后刷新歌词/封面/高亮（syncCurTrackFromState+hydrateNowPlaying）。
import fs from 'node:fs';

// ---- CSS ----
const cssP = 'C:/Users/王子奇/WorkBuddy/2026-07-31-08-45-02/fnmusic-bridge/static/css/app.css';
let css = fs.readFileSync(cssP, 'utf8');
const backOld = '.back{position:fixed;top:70px;left:14px;z-index:60;';
const backNew = '.back{position:fixed;top:70px;left:14px;z-index:50;';
if (!css.includes(backOld)) { console.error('CSS .back NOT FOUND'); process.exit(1); }
css = css.replace(backOld, backNew);
fs.writeFileSync(cssP, css, 'utf8');
console.log('OK css .back z-index 60->50');

// ---- JS ----
const p = 'C:/Users/王子奇/WorkBuddy/2026-07-31-08-45-02/fnmusic-bridge/static/js/app.js';
let s = fs.readFileSync(p, 'utf8');

function repBlock(old, nw, label) {
  if (!s.includes(old)) { console.error('NOT FOUND:', label); process.exit(1); }
  s = s.replace(old, nw);
  console.log('OK', label);
}

// P1: CastManager 属性加状态防抖计数
repBlock(
  'pollTimer:null,_popOpen:!1,castAnchor:null',
  'pollTimer:null,_popOpen:!1,castAnchor:null,_lastRaw:null,_rawCnt:0',
  'P1 cast props');

// P2: pollOnce 健壮化（position 合理窗口 + state 防抖 + 显示位置推算封顶）
const pollOld = 'async pollOnce(){if(!this.isMiot()){this.stopStatusPoll();return}try{const t=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/status")}&account_id=${encodeURIComponent(this.current.accountId)}&device_id=${encodeURIComponent(this.current.id)}`);if(!t.ok||!t.success||!t.data)return;const e=t.data,n=e.is_playing===true||e.state==="playing";playerState.playing!==n&&(playerState.playing=n,renderPlayer());const o=Number(e.position)||0,d=playerState.duration||0;this.castAnchor={pos:o,t:performance.now(),playing:n},this.paintProgress(o,d),this.paintVolume(e.volume)}catch{}';
const pollNew = 'async pollOnce(){if(!this.isMiot()){this.stopStatusPoll();return}try{const t=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/status")}&account_id=${encodeURIComponent(this.current.accountId)}&device_id=${encodeURIComponent(this.current.id)}`);if(!t.ok||!t.success||!t.data)return;const e=t.data,n=e.is_playing===true||e.state==="playing";if(n!==this._lastRaw){this._lastRaw=n,this._rawCnt=1}else if(this._rawCnt<2)this._rawCnt++;if(this._rawCnt>=2&&playerState.playing!==n){playerState.playing=n,renderPlayer()}const o=Number(e.position)||0,d=playerState.duration||0;let est=0;if(this.castAnchor)est=this.castAnchor.playing?this.castAnchor.pos+(performance.now()-this.castAnchor.t)/1e3:this.castAnchor.pos;if(!this.castAnchor||Math.abs(o-est)<4){this.castAnchor={pos:o,t:performance.now(),playing:n}}else{this.castAnchor.playing=n}let disp=this.castAnchor.playing?this.castAnchor.pos+(performance.now()-this.castAnchor.t)/1e3:this.castAnchor.pos;if(d>0&&disp>d)disp=d;this.paintProgress(disp,d),this.paintVolume(e.volume)}catch{}';
repBlock(pollOld, pollNew, 'P2 pollOnce robust');

// P3: castCurrent 切歌后刷新歌词/封面/列表高亮
repBlock(
  'playerState.playing=!0,renderPlayer(),this.castAnchor={pos:0,t:performance.now(),playing:!0},this.startStatusPoll(),this.pollOnce()',
  'playerState.playing=!0,renderPlayer(),syncCurTrackFromState(),hydrateNowPlaying(),this.castAnchor={pos:0,t:performance.now(),playing:!0},this.startStatusPoll(),this.pollOnce()',
  'P3 castCurrent lyric refresh');

fs.writeFileSync(p, s, 'utf8');
console.log('ALL DONE');
