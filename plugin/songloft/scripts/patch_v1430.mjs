// v1.4.30：投屏暂停→恢复后歌词/进度/音响错位——根因：v1.4.28 的 position 合理窗口（|o-est|<4 防 0 抖动）
// 在「暂停/恢复」时刻把音箱真实的播放位置变化（如恢复后从头重播 position 归 0）误判为误报而挡住，
// 界面锚点停在旧位置与音箱彻底错位。修复：状态切换瞬间（暂停/恢复/自动停播）强制接受音箱真实 position，
// 之后恢复窗口保护。用户主动暂停/恢复在 toggleSpeaker 里直接打 _forceCalib 标记（用户已即时改 playing，
// pollOnce 的 state 切换分支检测不到）。同时缓解歌词卡顿（位置不再跳变，高亮稳定）。
import fs from 'node:fs';
const p = 'C:/Users/王子奇/WorkBuddy/2026-07-31-08-45-02/fnmusic-bridge/static/js/app.js';
let s = fs.readFileSync(p, 'utf8');

function repBlock(old, nw, label) {
  if (!s.includes(old)) { console.error('NOT FOUND:', label); process.exit(1); }
  s = s.replace(old, nw);
  console.log('OK', label);
}

// 1) toggleSpeaker：成功操作后标记强制校准（暂停/恢复瞬间音箱位置可信）
repBlock(
  'if(!(n&&n.success)){toast("❌ 操作失败");return}playerState.playing=t,renderPlayer(),this.pollOnce()',
  'if(!(n&&n.success)){toast("❌ 操作失败");return}playerState.playing=t,this._forceCalib=Date.now(),renderPlayer(),this.pollOnce()',
  'P1 toggleSpeaker forceCalib');

// 2) pollOnce：状态切换确认时标记强制校准 + 位置处理加入 forced 条件
repBlock(
  'if(this._rawCnt>=2&&playerState.playing!==n){playerState.playing=n,renderPlayer()}this.paintVolume(e.volume);if(this._castSwitchAt&&Date.now()-this._castSwitchAt<3e3)return;const o=Number(e.position)||0,d=playerState.duration||0;let est=0;if(this.castAnchor)est=this.castAnchor.playing?this.castAnchor.pos+(performance.now()-this.castAnchor.t)/1e3:this.castAnchor.pos;if(!this.castAnchor||Math.abs(o-est)<4){this.castAnchor={pos:o,t:performance.now(),playing:n}}else{this.castAnchor.playing=n}',
  'if(this._rawCnt>=2&&playerState.playing!==n){playerState.playing=n,renderPlayer(),this._forceCalib=Date.now()}this.paintVolume(e.volume);if(this._castSwitchAt&&Date.now()-this._castSwitchAt<3e3)return;const o=Number(e.position)||0,d=playerState.duration||0;let est=0;if(this.castAnchor)est=this.castAnchor.playing?this.castAnchor.pos+(performance.now()-this.castAnchor.t)/1e3:this.castAnchor.pos;const forced=this._forceCalib&&Date.now()-this._forceCalib<1500;if(forced||!this.castAnchor||Math.abs(o-est)<4){this.castAnchor={pos:o,t:performance.now(),playing:n}}else{this.castAnchor.playing=n}',
  'P2 pollOnce forced calib');

fs.writeFileSync(p, s, 'utf8');
console.log('ALL DONE');
