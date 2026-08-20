// v1.4.32（实测驱动）：① 首次播放/切歌界面比音箱慢几秒——宽限期 3s→1.5s，且建锚后第一个 poll
// 若音箱 position 处于起播初期（0<pos<6）微调一次对齐（position 归零周期 ~4.5s，起播初期可信）；
// ② 暂停后界面回起点——暂停时 paintProgress 固定显示暂停位置；
// ③ 恢复播放音箱报「播放失败」——实测 stop 后立即重推失败、等待 1.5s+ 成功 → 恢复前延迟 1.5s 再推 seek。
import fs from 'node:fs';
const p = 'C:/Users/王子奇/WorkBuddy/2026-07-31-08-45-02/fnmusic-bridge/static/js/app.js';
let s = fs.readFileSync(p, 'utf8');

function repBlock(old, nw, label) {
  if (!s.includes(old)) { console.error('NOT FOUND:', label); process.exit(1); }
  s = s.replace(old, nw);
  console.log('OK', label);
}

// P1: 宽限期 3s→1.5s + 建锚后 _anchorFresh 一次微调（仅起始 0 时，position 起播初期可信）
repBlock(
  'if(this._castSwitchAt&&Date.now()-this._castSwitchAt<3e3)return;if(!this.castAnchor){this.castAnchor={pos:this._castStartPos||0,t:performance.now(),playing:n}}let d=playerState.duration||0,disp=this.castAnchor.playing?this.castAnchor.pos+(performance.now()-this.castAnchor.t)/1e3:this.castAnchor.pos;',
  'if(this._castSwitchAt&&Date.now()-this._castSwitchAt<15e2)return;if(!this.castAnchor){this.castAnchor={pos:this._castStartPos||0,t:performance.now(),playing:n},this._anchorFresh=!0}else if(this._anchorFresh){this._anchorFresh=!1;const o=Number(e.position)||0;if(!this._castStartPos&&o>0&&o<6)this.castAnchor={pos:o,t:performance.now(),playing:n}}let d=playerState.duration||0,disp=this.castAnchor.playing?this.castAnchor.pos+(performance.now()-this.castAnchor.t)/1e3:this.castAnchor.pos;',
  'P1 pollOnce grace 1.5s + anchorFresh');

// P2: toggleSpeaker——暂停记录位置夹紧 duration-3 + paintProgress 固定显示 + 取消待执行恢复；恢复延迟 1.5s 推 seek
repBlock(
  'async toggleSpeaker(){if(!this.isMiot())return;if(playerState.playing){let p=0;if(this.castAnchor)p=this.castAnchor.playing?this.castAnchor.pos+(performance.now()-this.castAnchor.t)/1e3:this.castAnchor.pos;this._castPausePos=Math.max(0,p);try{const n=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/stop")}`,"POST",{account_id:this.current.accountId,device_id:this.current.id});if(!(n&&n.success)){toast("❌ 操作失败");return}}catch{toast("❌ 操作失败");return}playerState.playing=!1,this.castAnchor&&(this.castAnchor.playing=!1),renderPlayer(),this.pollOnce();return}this.castCurrent(playerState.currentIndex,Math.max(0,Math.floor(this._castPausePos||0))).catch(()=>{})}',
  'async toggleSpeaker(){if(!this.isMiot())return;if(playerState.playing){this._resumeTimer&&(clearTimeout(this._resumeTimer),this._resumeTimer=null);let p=0;if(this.castAnchor)p=this.castAnchor.playing?this.castAnchor.pos+(performance.now()-this.castAnchor.t)/1e3:this.castAnchor.pos;const dur=playerState.duration||0;this._castPausePos=Math.max(0,Math.min(p,dur>3?dur-3:p));try{const n=await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/stop")}`,"POST",{account_id:this.current.accountId,device_id:this.current.id});if(!(n&&n.success)){toast("❌ 操作失败");return}}catch{toast("❌ 操作失败");return}playerState.playing=!1,this.castAnchor&&(this.castAnchor.playing=!1),renderPlayer(),this.paintProgress(this._castPausePos,playerState.duration||0),this.pollOnce();return}this._resumeTimer=setTimeout(()=>{this._resumeTimer=null,this.castCurrent(playerState.currentIndex,Math.max(0,Math.floor(this._castPausePos||0))).catch(()=>{})},1500)}',
  'P2 toggleSpeaker pause fixed + resume delay');

fs.writeFileSync(p, s, 'utf8');
console.log('ALL DONE');
