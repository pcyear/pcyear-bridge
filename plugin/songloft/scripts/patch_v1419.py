# v1.4.19 队列优先级三档化 + 用户交互补标 P1
# 背景：用户反馈「最新请求没插到队列最前，点击/懒加载没第一时间响应」。
# 根因：封面/元数据补全（后台）与用户交互同档排队（都 P0），且懒加载分页/收藏/歌词等交互点漏标 P1。
# 改造：
#   1) queueRequest 三档：P1 unshift 队首（最新优先）；P0 插到最后一个 P1 之后、P2 之前（P0 内最新优先）；
#      P2（封面/补全）插到队尾（永远最后）。
#   2) 封面 _coverThrottle → P2；flushCardInfo(/collections/info 补全) → P2。
#   3) 用户交互补标 P1：懒加载分页(loadNextPage 非 drill)、单曲/批量收藏、favorite-songs 视图、歌词加载。
import io

p = 'static/js/app.js'
s = io.open(p, 'r', encoding='utf-8').read()
n0 = len(s)

def rep(old, new, tag, count=1):
    global s
    c = s.count(old)
    assert c == count, 'anchor[%s] count=%d != %d' % (tag, c, count)
    s = s.replace(old, new, count)
    print('OK:', tag)

# ---- 1. queueRequest 三档化 ----
rep(
  'function queueRequest(fn,opts){const tag=(opts&&opts.tag)||_ctxTag,prio=opts&&opts.prio?1:0;'
  'return new Promise((res,rej)=>{const task={fn,res,rej,prio,tag,seq:++_reqSeq};'
  'if(!_reqQueue.length)_reqQueue.push(task);else if(prio===1)_reqQueue.unshift(task);'
  'else{let idx=_reqQueue.length;for(let i=_reqQueue.length-1;i>=0;i--){if(_reqQueue[i].prio===1){idx=i+1;break}}'
  '_reqQueue.splice(idx,0,task)}_pumpReqs()})}',
  'function queueRequest(fn,opts){const tag=(opts&&opts.tag)||_ctxTag,prio=opts&&opts.prio||0;'
  'return new Promise((res,rej)=>{const task={fn,res,rej,prio,tag,seq:++_reqSeq};'
  'if(!_reqQueue.length)_reqQueue.push(task);else if(prio===1)_reqQueue.unshift(task);'
  'else if(prio===2){let idx=_reqQueue.length;for(let i=_reqQueue.length-1;i>=0;i--){if(_reqQueue[i].prio===2){idx=i+1;break}}'
  '_reqQueue.splice(idx,0,task)}'
  'else{let idx=0;for(let i=_reqQueue.length-1;i>=0;i--){const q=_reqQueue[i].prio;if(q===0||q===1){idx=i+1;break}}'
  '_reqQueue.splice(idx,0,task)}_pumpReqs()})}',
  'queueRequest 三档')

# ---- 2. 封面 P2 ----
rep('function _coverThrottle(fn){return queueRequest(fn)}',
    'function _coverThrottle(fn){return queueRequest(fn,{prio:2})}',
    '_coverThrottle P2')

# ---- 3. flushCardInfo（collections/info 补全）P2 ----
rep('api(`${PLUGIN_BASE}/collections/info`,"POST",{sourceId:currentSourceId,ids:t},15e3)',
    'api(`${PLUGIN_BASE}/collections/info`,"POST",{sourceId:currentSourceId,ids:t},15e3,{prio:2})',
    'flushCardInfo P2')

# ---- 4. 懒加载分页（loadNextPage 非 drill）P1 ----
rep('&limit=${listPageSize()}&offset=${currentList.length}`,n=viewToken;try{const s=await api(e);if(n!==viewToken)return;if(s.ok&&Array.isArray(s.list)){currentList=currentList.concat(s.list),listTotal=s.total||currentList.length',
    '&limit=${listPageSize()}&offset=${currentList.length}`,n=viewToken;try{const s=await api(e,"GET",void 0,2e4,{prio:1});if(n!==viewToken)return;if(s.ok&&Array.isArray(s.list)){currentList=currentList.concat(s.list),listTotal=s.total||currentList.length',
    'loadNextPage 非drill P1')

# ---- 5. 单曲收藏 P1 ----
rep('const n=!favoriteIds.has(t);try{const s=await api(`${PLUGIN_BASE}/favorite`,"POST",{songId:t,fav:n});if(!s.ok)throw new',
    'const n=!favoriteIds.has(t);try{const s=await api(`${PLUGIN_BASE}/favorite`,"POST",{songId:t,fav:n},2e4,{prio:1});if(!s.ok)throw new',
    'toggleFavorite P1')

# ---- 6. 批量取消收藏 P1 ----
rep('api(`${PLUGIN_BASE}/favorite`,"POST",{songId:o,fav:!1})',
    'api(`${PLUGIN_BASE}/favorite`,"POST",{songId:o,fav:!1},2e4,{prio:1})',
    '批量取消收藏 P1')
rep('api(`${PLUGIN_BASE}/favorite-ids`);o&&Array.isArray(o.ids)',
    'api(`${PLUGIN_BASE}/favorite-ids`,"GET",void 0,6e4,{prio:1});o&&Array.isArray(o.ids)',
    '批量后 favorite-ids P1')

# ---- 7. favorite-songs 视图 P1 ----
rep('api(`${PLUGIN_BASE}/favorite-songs`,"GET",void 0,6e4)',
    'api(`${PLUGIN_BASE}/favorite-songs`,"GET",void 0,6e4,{prio:1})',
    'favorite-songs 分页 P1')
rep('api(`${PLUGIN_BASE}/favorite-songs`);if(forceRefresh=!1,e!==viewToken)return;if(!d.ok)',
    'api(`${PLUGIN_BASE}/favorite-songs`,"GET",void 0,6e4,{prio:1});if(forceRefresh=!1,e!==viewToken)return;if(!d.ok)',
    'favorite-songs 视图 P1')

# ---- 8. 歌词加载 P1（5 处）----
rep('api(`${PLUGIN_BASE}/lyric?sourceId=${i}&trackId=${encodeURIComponent(t.id)}`)',
    'api(`${PLUGIN_BASE}/lyric?sourceId=${i}&trackId=${encodeURIComponent(t.id)}`,"GET",void 0,2e4,{prio:1})',
    'lyric sourceId P1')
rep('api(`${PLUGIN_BASE}/host-lyric?songId=${encodeURIComponent(t)}`)',
    'api(`${PLUGIN_BASE}/host-lyric?songId=${encodeURIComponent(t)}`,"GET",void 0,2e4,{prio:1})',
    'host-lyric(t) P1')
rep('api(`${PLUGIN_BASE}/lyric?songId=${encodeURIComponent(t)}`)',
    'api(`${PLUGIN_BASE}/lyric?songId=${encodeURIComponent(t)}`,"GET",void 0,2e4,{prio:1})',
    'lyric songId(t) P1')
rep('api(`${PLUGIN_BASE}/host-lyric?songId=${encodeURIComponent(n)}`)',
    'api(`${PLUGIN_BASE}/host-lyric?songId=${encodeURIComponent(n)}`,"GET",void 0,2e4,{prio:1})',
    'host-lyric(n) P1')
rep('api(`${PLUGIN_BASE}/lyric?songId=${encodeURIComponent(n)}`)',
    'api(`${PLUGIN_BASE}/lyric?songId=${encodeURIComponent(n)}`,"GET",void 0,2e4,{prio:1})',
    'lyric songId(n) P1')

# ---- 9. 版本 1.4.18 -> 1.4.19 ----
s = s.replace('1.4.18', '1.4.19')
io.open(p, 'w', encoding='utf-8').write(s)

q = 'plugin.json'
t = io.open(q, 'r', encoding='utf-8').read()
t = t.replace('1.4.18', '1.4.19')
io.open(q, 'w', encoding='utf-8').write(t)

print('all patches applied, delta=%d' % (len(s) - n0))
