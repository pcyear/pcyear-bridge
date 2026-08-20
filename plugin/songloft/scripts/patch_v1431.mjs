// v1.4.31：投屏位置体系重构——实测证明设备 position 每 ~4.5s 周期归零（miot 4s 物理缓存穿透不可靠）、
// 暂停后音箱 ~3-4s 自动恢复。因此彻底改为「本地推算为主」：
// ① 播放中进度完全本地推算（不再用设备 position 校准，消灭 0↔3s 循环跳）；
// ② 暂停 = mina/stop（彻底停止，不再自动恢复）+ 记录本地位置；
// ③ 恢复 = 重推 play-url + seek=暂停位置（服务端从指定位置起播，界面从同位置推算 → 三者同步）；
// ④ 切歌/恢复都有 3s 起播宽限期，结束后用本地起始位置（_castStartPos）建锚。
import fs from 'node:fs';
const p = 'C:/Users/王子奇/WorkBuddy/2026-07-31-08-45-02/fnmusic-bridge/static/js/app.js';
let s = fs.readFileSync(p, 'utf8');

function repBlock(old, nw, label) {
  if (!s.includes(old)) { console.error('NOT FOUND:', label); process.exit(1); }
  s = s.replace(old, nw);
  console.log('OK', label);
}

// P1: 属性加 _castStartPos/_castPausePos
repBlock(
  'pollTimer:null,_popOpen:!1,castAnchor:null,_lastRaw:null,_rawCnt:0',
  'pollTimer:null,_popOpen:!1,castAnchor:null,_lastRaw:null,_rawCnt:0,_castStartPos:0,_castPausePos:0',
  'P1 cast props');

// P2: castCurrent(t, seek)——URL 带 seek；起始位置用 seek||0
repBlock(
  'async castCurrent(t){if(!this.isMiot())return;',
  'async castCurrent(t,seek){if(!this.isMiot())return;',
  'P2a castCurrent signature');
repBlock(
  'const r=await api(PLUGIN_BASE+"/cast/play-url","POST",{song_id:e[n],host:location.origin.replace(/^https?:\\/\\//,"")});',
  'const r=await api(PLUGIN_BASE+"/cast/play-url","POST",{song_id:e[n],host:location.origin.replace(/^https?:\\/\\//,""),seek:seek||0});',
  'P2b castCurrent seek param');
repBlock(
  'playerState.playing=!0,renderPlayer(),syncCurTrackFromState(),hydrateNowPlaying(),this.castAnchor=null,this._castSwitchAt=Date.now(),this.paintProgress(0,playerState.duration||0),this.startStatusPoll(),this.pollOnce()',
  'playerState.playing=!0,renderPlayer(),syncCurTrackFromState(),hydrateNowPlaying(),this._castStartPos=Math.max(0,Math.floor(seek||0)),this.castAnchor=null,this._castSwitchAt=Date.now(),this.paintProgress(this._castStartPos,playerState.duration||0),this.startStatusPoll(),this.pollOnce()',
  'P2c castCurrent anchor start pos');

// P3: toggleSpeaker——暂停=stop+记录位置；恢复=重推 play-url+seek
repBlock(
  'async toggleSpeaker(){if(!this.isMiot())return;const t=!playerState.playing,e=t?"mina/resume":"mina/pause";try{const n=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent(e)}`,"POST",{account_id:this.current.accountId,device_id:this.current.id});if(!(n&&n.success)){toast("❌ 操作失败");return}playerState.playing=t,this._forceCalib=Date.now(),renderPlayer(),this.pollOnce()}catch{toast("❌ 操作失败")}}',
  'async toggleSpeaker(){if(!this.isMiot())return;if(playerState.playing){let p=0;if(this.castAnchor)p=this.castAnchor.playing?this.castAnchor.pos+(performance.now()-this.castAnchor.t)/1e3:this.castAnchor.pos;this._castPausePos=Math.max(0,p);try{const n=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/stop")}`,"POST",{account_id:this.current.accountId,device_id:this.current.id});if(!(n&&n.success)){toast("❌ 操作失败");return}}catch{toast("❌ 操作失败");return}playerState.playing=!1,this.castAnchor&&(this.castAnchor.playing=!1),renderPlayer(),this.pollOnce();return}this.castCurrent(playerState.currentIndex,Math.max(0,Math.floor(this._castPausePos||0))).catch(()=>{})}',
  'P3 toggleSpeaker stop/seek');

// P4: pollOnce——删设备 position 校准，宽限期结束用 _castStartPos 建锚，稳定状态同步 anchor.playing
const pollOld = 'async pollOnce(){if(!this.isMiot()){this.stopStatusPoll();return}try{const t=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/status")}&account_id=${encodeURIComponent(this.current.accountId)}&device_id=${encodeURIComponent(this.current.id)}`);if(!t.ok||!t.success||!t.data)return;const e=t.data,n=e.is_playing===true||e.state==="playing";if(n!==this._lastRaw){this._lastRaw=n,this._rawCnt=1}else if(this._rawCnt<2)this._rawCnt++;if(this._rawCnt>=2&&playerState.playing!==n){playerState.playing=n,renderPlayer(),this._forceCalib=Date.now()}this.paintVolume(e.volume);if(this._castSwitchAt&&Date.now()-this._castSwitchAt<3e3)return;const o=Number(e.position)||0,d=playerState.duration||0;let est=0;if(this.castAnchor)est=this.castAnchor.playing?this.castAnchor.pos+(performance.now()-this.castAnchor.t)/1e3:this.castAnchor.pos;const forced=this._forceCalib&&Date.now()-this._forceCalib<1500;if(forced||!this.castAnchor||Math.abs(o-est)<4){this.castAnchor={pos:o,t:performance.now(),playing:n}}else{this.castAnchor.playing=n}let disp=this.castAnchor.playing?this.castAnchor.pos+(performance.now()-this.castAnchor.t)/1e3:this.castAnchor.pos;if(d>0&&disp>d)disp=d;this.paintProgress(disp,d)}catch{}';
const pollNew = 'async pollOnce(){if(!this.isMiot()){this.stopStatusPoll();return}try{const t=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/status")}&account_id=${encodeURIComponent(this.current.accountId)}&device_id=${encodeURIComponent(this.current.id)}`);if(!t.ok||!t.success||!t.data)return;const e=t.data,n=e.is_playing===true||e.state==="playing";if(n!==this._lastRaw){this._lastRaw=n,this._rawCnt=1}else if(this._rawCnt<2)this._rawCnt++;if(this._rawCnt>=2){if(playerState.playing!==n){playerState.playing=n,renderPlayer()}this.castAnchor&&(this.castAnchor.playing=n)}this.paintVolume(e.volume);if(this._castSwitchAt&&Date.now()-this._castSwitchAt<3e3)return;if(!this.castAnchor){this.castAnchor={pos:this._castStartPos||0,t:performance.now(),playing:n}}let d=playerState.duration||0,disp=this.castAnchor.playing?this.castAnchor.pos+(performance.now()-this.castAnchor.t)/1e3:this.castAnchor.pos;if(d>0&&disp>d)disp=d;this.paintProgress(disp,d)}catch{}';
repBlock(pollOld, pollNew, 'P4 pollOnce local-only');

fs.writeFileSync(p, s, 'utf8');
console.log('ALL DONE');
