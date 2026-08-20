// v1.4.29：投屏切歌后进度/歌词与音箱不同步（差约2秒）——根因：castCurrent 切歌后立即从 0 本地推算进度，
// 但音箱切歌有起播延迟（1-3s），界面进度领先音箱。修复：切歌后进度归零并暂停推算（anchor=null），
// 进入 3s「切歌宽限期」（pollOnce 不校准位置），宽限期结束后用音箱真实 position 建立锚点，进度与音箱对齐。
import fs from 'node:fs';
const p = 'C:/Users/王子奇/WorkBuddy/2026-07-31-08-45-02/fnmusic-bridge/static/js/app.js';
let s = fs.readFileSync(p, 'utf8');

function repBlock(old, nw, label) {
  if (!s.includes(old)) { console.error('NOT FOUND:', label); process.exit(1); }
  s = s.replace(old, nw);
  console.log('OK', label);
}

// 1) castCurrent：切歌后 anchor=null（进度停0等校准）+ 记录切歌时刻 + 显示归零
repBlock(
  'playerState.playing=!0,renderPlayer(),syncCurTrackFromState(),hydrateNowPlaying(),this.castAnchor={pos:0,t:performance.now(),playing:!0},this.startStatusPoll(),this.pollOnce()',
  'playerState.playing=!0,renderPlayer(),syncCurTrackFromState(),hydrateNowPlaying(),this.castAnchor=null,this._castSwitchAt=Date.now(),this.paintProgress(0,playerState.duration||0),this.startStatusPoll(),this.pollOnce()',
  'P1 castCurrent anchor null + switchAt');

// 2) pollOnce：切歌宽限期（3s）内不校准位置（音箱切换中 position 不可信），宽限期后建立/校准锚点
const pollOld = 'async pollOnce(){if(!this.isMiot()){this.stopStatusPoll();return}try{const t=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/status")}&account_id=${encodeURIComponent(this.current.accountId)}&device_id=${encodeURIComponent(this.current.id)}`);if(!t.ok||!t.success||!t.data)return;const e=t.data,n=e.is_playing===true||e.state==="playing";if(n!==this._lastRaw){this._lastRaw=n,this._rawCnt=1}else if(this._rawCnt<2)this._rawCnt++;if(this._rawCnt>=2&&playerState.playing!==n){playerState.playing=n,renderPlayer()}const o=Number(e.position)||0,d=playerState.duration||0;let est=0;if(this.castAnchor)est=this.castAnchor.playing?this.castAnchor.pos+(performance.now()-this.castAnchor.t)/1e3:this.castAnchor.pos;if(!this.castAnchor||Math.abs(o-est)<4){this.castAnchor={pos:o,t:performance.now(),playing:n}}else{this.castAnchor.playing=n}let disp=this.castAnchor.playing?this.castAnchor.pos+(performance.now()-this.castAnchor.t)/1e3:this.castAnchor.pos;if(d>0&&disp>d)disp=d;this.paintProgress(disp,d),this.paintVolume(e.volume)}catch{}';
const pollNew = 'async pollOnce(){if(!this.isMiot()){this.stopStatusPoll();return}try{const t=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/status")}&account_id=${encodeURIComponent(this.current.accountId)}&device_id=${encodeURIComponent(this.current.id)}`);if(!t.ok||!t.success||!t.data)return;const e=t.data,n=e.is_playing===true||e.state==="playing";if(n!==this._lastRaw){this._lastRaw=n,this._rawCnt=1}else if(this._rawCnt<2)this._rawCnt++;if(this._rawCnt>=2&&playerState.playing!==n){playerState.playing=n,renderPlayer()}this.paintVolume(e.volume);if(this._castSwitchAt&&Date.now()-this._castSwitchAt<3e3)return;const o=Number(e.position)||0,d=playerState.duration||0;let est=0;if(this.castAnchor)est=this.castAnchor.playing?this.castAnchor.pos+(performance.now()-this.castAnchor.t)/1e3:this.castAnchor.pos;if(!this.castAnchor||Math.abs(o-est)<4){this.castAnchor={pos:o,t:performance.now(),playing:n}}else{this.castAnchor.playing=n}let disp=this.castAnchor.playing?this.castAnchor.pos+(performance.now()-this.castAnchor.t)/1e3:this.castAnchor.pos;if(d>0&&disp>d)disp=d;this.paintProgress(disp,d)}catch{}';
repBlock(pollOld, pollNew, 'P2 pollOnce switch grace');

fs.writeFileSync(p, s, 'utf8');
console.log('ALL DONE');
