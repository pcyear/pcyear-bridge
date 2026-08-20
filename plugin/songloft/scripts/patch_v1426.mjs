// v1.4.26 投屏架构改造（完整版，锚点已修正：cut 以 ,下一方法 为 end，块内包含方法结束 }）
// 目标：1) 单曲 URL 推送（/mina/play-url，不再建歌单）；2) 进度条由 /mina/status 轮询 + castAnchor 推算平滑前进；
//       3) 音量同步 /mina/volume；4) 暂停/恢复用 /mina/pause|resume；5) 切歌重推新 URL。
import fs from 'node:fs';
const p = 'C:/Users/王子奇/WorkBuddy/2026-07-31-08-45-02/fnmusic-bridge/static/js/app.js';
let s = fs.readFileSync(p, 'utf8');

function cut(start, end, label) {
  const i = s.indexOf(start), j = s.indexOf(end, i);
  if (i < 0 || j < 0) { console.error('ANCHOR NOT FOUND:', label); process.exit(1); }
  return s.substring(i, j);
}
function repBlock(old, nw, label) {
  if (!s.includes(old)) { console.error('NOT FOUND:', label); process.exit(1); }
  if (s.split(old).length > 2) { console.error('NOT UNIQUE:', label); process.exit(1); }
  s = s.replace(old, nw);
  console.log('OK', label);
}

// ========== part1 ==========
repBlock('castPlaylistId:null,castSongIds:null,pollTimer:null,_popOpen:!1', 'pollTimer:null,_popOpen:!1,castAnchor:null', 'P1 prop');
repBlock(',async selectLocal(){',
  ',async castSetVolume(t){if(!this.isMiot())return;try{const n=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/volume")}&account_id=${encodeURIComponent(this.current.accountId)}&device_id=${encodeURIComponent(this.current.id)}`,"POST",{volume:t});if(!(n&&n.success))console.warn("[cast] set volume failed",n&&n.message)}catch(e){console.warn("[cast] set volume err",e&&e.message)}},async selectLocal(){',
  'P10 castSetVolume');

// ========== part2 ==========
// P2 castCurrent
const castCurOld = cut('async castCurrent(t){', ',async castRelative', 'P2 castCurrent');
const castCurNew = 'async castCurrent(t){if(!this.isMiot())return;try{const i=await Player.getState().catch(()=>null);if(i){const a=extractQueue(i);a.length&&(playerState.queue=a);const r=extractIndex(i,playerState.queue);r>=0&&(playerState.currentIndex=r)}}catch{}const e=(playerState.queue||[]).map(songIdOf).filter(Boolean);if(!e.length){toast("当前没有可投屏的播放列表");return}let n=typeof t=="number"?t:playerState.currentIndex;(n<0||n>=e.length)&&(n=0),playerState.currentIndex=n;const song=playerState.queue[n]||playerState.currentSong;playerState.currentSong=song,playerState.duration=song&&song.duration||0,renderPlayer();let url="";try{const r=await api(PLUGIN_BASE+"/cast/play-url","POST",{song_id:e[n]});url=r&&r.ok&&r.url||""}catch{}if(!url){toast("❌ 获取播放地址失败");return}toast("📡 正在投屏到「"+this.current.name+"」…");try{const i=await api(PLUGIN_BASE+"/miot-proxy?path="+encodeURIComponent("mina/play-url"),"POST",{account_id:this.current.accountId,device_id:this.current.id,url});if(!i.ok||!i.success){toast("❌ 投屏失败："+(i.msg||i.message||"未知错误"));return}try{Player.available()&&Player.has("pause")&&await Player.pause()}catch{}playerState.playing=!0,renderPlayer(),this.castAnchor={pos:0,t:performance.now(),playing:!0},this.startStatusPoll(),this.pollOnce()}catch{toast("❌ 投屏指令发送失败")}}';
repBlock(castCurOld, castCurNew, 'P2 castCurrent');

// P3 castToIndex
const castIdxOld = cut('async castToIndex(t){', ',async toggleSpeaker', 'P3 castToIndex');
const castIdxNew = 'async castToIndex(t){if(!this.isMiot())return;const e=(playerState.queue||[]).length;if(!e||t<0||t>=e)return;await this.castCurrent(t).catch(()=>{})}';
repBlock(castIdxOld, castIdxNew, 'P3 castToIndex');

// P4 toggleSpeaker
const togOld = cut('async toggleSpeaker(){', ',async stopSpeakerIfPlaying', 'P4 toggleSpeaker');
const togNew = 'async toggleSpeaker(){if(!this.isMiot())return;const t=!playerState.playing,e=t?"mina/resume":"mina/pause";try{const n=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent(e)}&account_id=${encodeURIComponent(this.current.accountId)}&device_id=${encodeURIComponent(this.current.id)}`,"POST");if(!(n&&n.success)){toast("❌ 操作失败");return}playerState.playing=t,renderPlayer(),this.pollOnce()}catch{toast("❌ 操作失败")}}';
repBlock(togOld, togNew, 'P4 toggleSpeaker');

// P5 stopSpeakerIfPlaying
const stopOld = cut('async stopSpeakerIfPlaying(t){', ',startStatusPoll', 'P5 stopSpeakerIfPlaying');
const stopNew = 'async stopSpeakerIfPlaying(t){if(!(!t||!t.id))try{const e=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/status")}&account_id=${encodeURIComponent(t.accountId)}&device_id=${encodeURIComponent(t.id)}`);e.ok&&e.success&&e.data&&e.data.state==="playing"&&await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/pause")}&account_id=${encodeURIComponent(t.accountId)}&device_id=${encodeURIComponent(t.id)}`,"POST")}catch{}}';
repBlock(stopOld, stopNew, 'P5 stopSpeakerIfPlaying');

// P6 startStatusPoll 间隔 3s → 1.5s
repBlock('startStatusPoll(){this.stopStatusPoll(),this.isMiot()&&(this.pollTimer=setInterval(()=>this.pollOnce(),3e3))}', 'startStatusPoll(){this.stopStatusPoll(),this.isMiot()&&(this.pollTimer=setInterval(()=>this.pollOnce(),15e2))}', 'P6 startStatusPoll');

// ========== part3 ==========
// P7 pollOnce + paintVolume（pollOld 以 ,paintProgress( 前为止，替换后同样以 ,paintProgress( 衔接）
const pollOld = cut('async pollOnce(){', ',paintProgress(', 'P7 pollOnce');
const pollNew = 'async pollOnce(){if(!this.isMiot()){this.stopStatusPoll();return}try{const t=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/status")}&account_id=${encodeURIComponent(this.current.accountId)}&device_id=${encodeURIComponent(this.current.id)}`);if(!t.ok||!t.success||!t.data)return;const e=t.data,n=e.is_playing===true||e.state==="playing";playerState.playing!==n&&(playerState.playing=n,renderPlayer());const o=Number(e.position)||0,d=playerState.duration||0;this.castAnchor={pos:o,t:performance.now(),playing:n},this.paintProgress(o,d),this.paintVolume(e.volume)}catch{}},paintVolume(t){if(typeof t!=="number"||t<0)return;const e=Math.min(100,Math.max(0,Math.round(t)));currentVolume=e/100,volPaint(e/100)},paintProgress(';
repBlock(pollOld, pollNew, 'P7 pollOnce+paintVolume');

// P8 setVolumeHost 同步音量
repBlock('async function setVolumeHost(t){currentVolume=Math.max(0,Math.min(1,t));try{Player.has("setVolume")&&await Player.setVolume(Math.round(currentVolume*100))}catch(e){console.log("[volume] set failed",e&&e.message)}renderExtraControls()}',
  'async function setVolumeHost(t){currentVolume=Math.max(0,Math.min(1,t));try{Player.has("setVolume")&&await Player.setVolume(Math.round(currentVolume*100))}catch(e){console.log("[volume] set failed",e&&e.message)}CastManager.isMiot()&&CastManager.castSetVolume(Math.round(currentVolume*100)),renderExtraControls()}',
  'P8 setVolumeHost');

// P9 本地 tick 投屏分支
repBlock('setInterval(()=>{if(_kbOpen||CastManager.isMiot()||!playerPosAnchor)return;const t=playerState.duration||0;let e=currentPosition();if(t>0&&e>t&&playerState.playing&&playMode==="single"){',
  'setInterval(()=>{if(_kbOpen)return;const t=playerState.duration||0;let e;if(CastManager.isMiot()){const a=CastManager.castAnchor;if(!a)return;e=a.playing?a.pos+(performance.now()-a.t)/1e3:a.pos}else{if(!playerPosAnchor)return;e=currentPosition()}if(!CastManager.isMiot()&&t>0&&e>t&&playerState.playing&&playMode==="single"){',
  'P9 tick cast branch');

fs.writeFileSync(p, s, 'utf8');
console.log('ALL DONE');
