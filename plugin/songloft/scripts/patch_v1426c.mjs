// v1.4.26 修正：mina/* 控制接口的 account_id/device_id 走 body（非 query）
import fs from 'node:fs';
const p = 'C:/Users/王子奇/WorkBuddy/2026-07-31-08-45-02/fnmusic-bridge/static/js/app.js';
let s = fs.readFileSync(p, 'utf8');

function repBlock(old, nw, label) {
  if (!s.includes(old)) { console.error('NOT FOUND:', label); process.exit(1); }
  s = s.replace(old, nw);
  console.log('OK', label);
}

// toggleSpeaker：mina/pause|resume，account_id/device_id 放 body
repBlock(
  'async toggleSpeaker(){if(!this.isMiot())return;const t=!playerState.playing,e=t?"mina/resume":"mina/pause";try{const n=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent(e)}&account_id=${encodeURIComponent(this.current.accountId)}&device_id=${encodeURIComponent(this.current.id)}`,"POST");if(!(n&&n.success)){toast("❌ 操作失败");return}playerState.playing=t,renderPlayer(),this.pollOnce()}catch{toast("❌ 操作失败")}}',
  'async toggleSpeaker(){if(!this.isMiot())return;const t=!playerState.playing,e=t?"mina/resume":"mina/pause";try{const n=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent(e)}`,"POST",{account_id:this.current.accountId,device_id:this.current.id});if(!(n&&n.success)){toast("❌ 操作失败");return}playerState.playing=t,renderPlayer(),this.pollOnce()}catch{toast("❌ 操作失败")}}',
  'toggleSpeaker body');

// stopSpeakerIfPlaying：status 用 query(GET)；pause 用 body(POST)
repBlock(
  'async stopSpeakerIfPlaying(t){if(!(!t||!t.id))try{const e=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/status")}&account_id=${encodeURIComponent(t.accountId)}&device_id=${encodeURIComponent(t.id)}`);e.ok&&e.success&&e.data&&e.data.state==="playing"&&await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/pause")}&account_id=${encodeURIComponent(t.accountId)}&device_id=${encodeURIComponent(t.id)}`,"POST")}catch{}}',
  'async stopSpeakerIfPlaying(t){if(!(!t||!t.id))try{const e=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/status")}&account_id=${encodeURIComponent(t.accountId)}&device_id=${encodeURIComponent(t.id)}`);e.ok&&e.success&&e.data&&e.data.state==="playing"&&await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/pause")}`,"POST",{account_id:t.accountId,device_id:t.id})}catch{}}',
  'stopSpeakerIfPlaying body');

// castSetVolume：body {account_id, device_id, volume}
repBlock(
  ',async castSetVolume(t){if(!this.isMiot())return;try{const n=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/volume")}&account_id=${encodeURIComponent(this.current.accountId)}&device_id=${encodeURIComponent(this.current.id)}`,"POST",{volume:t});if(!(n&&n.success))console.warn("[cast] set volume failed",n&&n.message)}catch(e){console.warn("[cast] set volume err",e&&e.message)}},async selectLocal(){',
  ',async castSetVolume(t){if(!this.isMiot())return;try{const n=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/volume")}`,"POST",{account_id:this.current.accountId,device_id:this.current.id,volume:t});if(!(n&&n.success))console.warn("[cast] set volume failed",n&&n.message)}catch(e){console.warn("[cast] set volume err",e&&e.message)}},async selectLocal(){',
  'castSetVolume body');

fs.writeFileSync(p, s, 'utf8');
console.log('DONE');
