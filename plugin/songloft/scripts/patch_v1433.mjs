// v1.4.33（实测驱动）：
// ① 暂停后进度条退一大截——根因：暂停只改 anchor.playing=false 未更新 anchor.pos，
//    1.5s 后 pollOnce 显示用 anchor.pos（建锚旧值 0）→ 界面跳回起点。修复：暂停时同步 anchor.pos=暂停位置。
// ② 恢复播放偶发失败——实测链路稳定，加固：castCurrent 返回成败，恢复重试一次（1.2s 后）。
// ③ 歌词卡顿——投屏时 currentPosition() 改走 castAnchor 实时推算（rAF 60fps 驱动歌词高亮，不再 500ms 粒度）。
import fs from 'node:fs';
const p = 'C:/Users/王子奇/WorkBuddy/2026-07-31-08-45-02/fnmusic-bridge/static/js/app.js';
let s = fs.readFileSync(p, 'utf8');

function repBlock(old, nw, label) {
  if (!s.includes(old)) { console.error('NOT FOUND:', label); process.exit(1); }
  s = s.replace(old, nw);
  console.log('OK', label);
}

// P1: toggleSpeaker 暂停——同步 anchor.pos 到暂停位置（防 pollOnce 显示旧 pos 导致界面跳回）
repBlock(
  'playerState.playing=!1,this.castAnchor&&(this.castAnchor.playing=!1),renderPlayer(),this.paintProgress(this._castPausePos,playerState.duration||0),this.pollOnce();return}',
  'playerState.playing=!1,this.castAnchor&&(this.castAnchor.pos=this._castPausePos,this.castAnchor.playing=!1),renderPlayer(),this.paintProgress(this._castPausePos,playerState.duration||0),this.pollOnce();return}',
  'P1 pause anchor.pos sync');

// P2: castCurrent 返回成败（无队列/URL失败/推送失败→false；成功→true）
repBlock(
  'if(!e.length){toast("当前没有可投屏的播放列表");return}',
  'if(!e.length){toast("当前没有可投屏的播放列表");return!1}',
  'P2a castCurrent no queue');
repBlock(
  'if(!url){toast("❌ 获取播放地址失败");return}',
  'if(!url){toast("❌ 获取播放地址失败");return!1}',
  'P2b castCurrent url fail');
repBlock(
  'if(!i.ok||!i.success){toast("❌ 投屏失败："+(i.msg||i.message||"未知错误"));return}',
  'if(!i.ok||!i.success){toast("❌ 投屏失败："+(i.msg||i.message||"未知错误"));return!1}',
  'P2c castCurrent push fail');
repBlock(
  'this._castStartPos=Math.max(0,Math.floor(seek||0)),this.castAnchor=null,this._castSwitchAt=Date.now(),this.paintProgress(this._castStartPos,playerState.duration||0),this.startStatusPoll(),this.pollOnce()}catch{toast("❌ 投屏指令发送失败")}}',
  'this._castStartPos=Math.max(0,Math.floor(seek||0)),this.castAnchor=null,this._castSwitchAt=Date.now(),this.paintProgress(this._castStartPos,playerState.duration||0),this.startStatusPoll(),this.pollOnce(),return!0}catch{toast("❌ 投屏指令发送失败")}}',
  'P2d castCurrent success true');

// P3: 恢复重试一次（castCurrent 失败 → 1.2s 后重试）
repBlock(
  'this._resumeTimer=setTimeout(()=>{this._resumeTimer=null,this.castCurrent(playerState.currentIndex,Math.max(0,Math.floor(this._castPausePos||0))).catch(()=>{})},1500)}',
  'this._resumeTimer=setTimeout(()=>{this._resumeTimer=null;const r=()=>this.castCurrent(playerState.currentIndex,Math.max(0,Math.floor(this._castPausePos||0)));r().then(ok=>{ok||setTimeout(()=>r().catch(()=>{}),1200)}).catch(()=>{})},1500)}',
  'P3 resume retry');

fs.writeFileSync(p, s, 'utf8');
console.log('ALL DONE');
