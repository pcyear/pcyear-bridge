# -*- coding: utf-8 -*-
# v1.4.5 前端补丁：
# 1. 封面专用队列 -> 全局请求队列（_reqQueue，并发 3，FIFO），api() 全部请求入队
# 2. ensureDrillCover 优先用本地回填封面缓存
# 3. loadDrill 打开文件夹后 backfillDrillCover 用带封面歌曲回填文件夹封面
# 4. flushCardInfo 无 coverId 时用回填缓存补封面
import io

P = 'static/js/app.js'
js = io.open(P, 'r', encoding='utf-8').read()

def rep(old, new, tag):
    global js
    assert old in js, 'NOT FOUND: ' + tag
    js = js.replace(old, new, 1)
    print('OK:', tag)

# ---- Patch 1: 封面队列 -> 全局请求队列 ----
old1 = ('let _coverQueue=[],_coverActive=0;const _COVER_MAX=3;function _pumpCovers(){'
        'if(_coverActive>=_COVER_MAX)return;'
        'while(_coverActive<_COVER_MAX&&_coverQueue.length){const j=_coverQueue.shift();_coverActive++;'
        'j.fn().then(v=>{_coverActive--;j.res(v);_pumpCovers()},er=>{_coverActive--;j.rej(er);_pumpCovers()})}}'
        'function _coverThrottle(fn){return new Promise((res,rej)=>{_coverQueue.push({fn,res,rej});_pumpCovers()})}')
new1 = ('let _reqQueue=[],_reqActive=0;const _REQ_MAX=3;'
        'function _pumpReqs(){if(_reqActive>=_REQ_MAX)return;'
        'while(_reqActive<_REQ_MAX&&_reqQueue.length){const j=_reqQueue.shift();_reqActive++;'
        'j.fn().then(v=>{_reqActive--;j.res(v);_pumpReqs()},er=>{_reqActive--;j.rej(er);_pumpReqs()})}}'
        'function queueRequest(fn){return new Promise((res,rej)=>{_reqQueue.push({fn,res,rej});_pumpReqs()})}'
        'function _coverThrottle(fn){return queueRequest(fn)}')
rep(old1, new1, 'patch1 global queue')

# ---- Patch 2: api() 入全局队列（原实现改名 _apiDo，超时从出队开始计时）----
old2 = 'function api(t,e="GET",n,s=2e4){const o=r=>{'
new2 = ('function api(t,e="GET",n,s=2e4){return queueRequest(()=>_apiDo(t,e,n,s))}'
        'function _apiDo(t,e="GET",n,s=2e4){const o=r=>{')
rep(old2, new2, 'patch2 api queue')

# ---- Patch 3: ensureDrillCover 优先本地回填缓存 ----
old3 = ('async function ensureDrillCover(t){try{const n=await api(`${PLUGIN_BASE}/collections/info`,"POST",'
        '{sourceId:currentSourceId,ids:[t]},15e3);'
        'if(n&&n.ok&&n.list&&n.list[0]&&n.list[0].coverId)drill.coverId=n.list[0].coverId}catch{}loadDrill()}')
new3 = ('async function ensureDrillCover(t){'
        'try{const m=localStore.get("col:"+t);if(m&&m.coverId){drill.coverId=m.coverId;loadDrill();return}}catch{}'
        'try{const n=await api(`${PLUGIN_BASE}/collections/info`,"POST",'
        '{sourceId:currentSourceId,ids:[t]},15e3);'
        'if(n&&n.ok&&n.list&&n.list[0]&&n.list[0].coverId)drill.coverId=n.list[0].coverId}catch{}'
        'loadDrill()}')
rep(old3, new3, 'patch3 ensureDrillCover cache')

# ---- Patch 4: backfillDrillCover 定义（放在 ensureDrillCover 之后，loadDrill 之前）----
old4 = ('async function ensureDrillCover(t){'
        'try{const m=localStore.get("col:"+t);if(m&&m.coverId){drill.coverId=m.coverId;loadDrill();return}}catch{}'
        'try{const n=await api(`${PLUGIN_BASE}/collections/info`,"POST",'
        '{sourceId:currentSourceId,ids:[t]},15e3);'
        'if(n&&n.ok&&n.list&&n.list[0]&&n.list[0].coverId)drill.coverId=n.list[0].coverId}catch{}'
        'loadDrill()}')
new4 = old4 + (''
    'async function backfillDrillCover(){'
    'if(!drill)return;const list=currentList||[];'
    'for(const t of list){if(!t||!t.coverId)continue;'
    'let d=null;try{d=await coverDataUrl(t.coverId)}catch{}'
    'if(!d)continue;'
    'drill.coverId=t.coverId;'
    'const cov=document.querySelector(".drill-cov");cov&&(cov.src=d);'
    'try{localStore.set("col:"+drill.id,{coverId:t.coverId,ts:Date.now()})}catch{}'
    'return}}')
rep(old4, new4, 'patch4 backfillDrillCover def')

# ---- Patch 5a: loadDrill 正常分支尾部调用 backfillDrillCover ----
old5 = 'i.appendChild(d),updateBulkBar(),updateListCount(),scheduleSaveState()}const Player={inst()'
new5 = 'i.appendChild(d),updateBulkBar(),updateListCount(),scheduleSaveState(),backfillDrillCover()}const Player={inst()'
rep(old5, new5, 'patch5a loadDrill normal call')

# ---- Patch 5b: loadDrill 缓存分支调用 backfillDrillCover ----
old6 = 'setCacheState("stale","\\u5DF2\\u663E\\u793A\\u7F13\\u5B58\\uFF0C\\u70B9\\u51FB\\u5237\\u65B0\\u83B7\\u53D6\\u6700\\u65B0");return}}let l=drill.type'
new6 = 'setCacheState("stale","\\u5DF2\\u663E\\u793A\\u7F13\\u5B58\\uFF0C\\u70B9\\u51FB\\u5237\\u65B0\\u83B7\\u53D6\\u6700\\u65B0");backfillDrillCover();return}}let l=drill.type'
rep(old6, new6, 'patch5b loadDrill cache call')

# ---- Patch 6: flushCardInfo 无 coverId 时用回填缓存 ----
old7 = ('if(s.coverId){const c=r.querySelector(".cov");c&&c.src===DEFAULT_COVER&&setCover(c,s.coverId)}'
        '}}}catch{}')
new7 = ('if(s.coverId){const c=r.querySelector(".cov");c&&c.src===DEFAULT_COVER&&setCover(c,s.coverId)}'
        'else{const m=localStore.get("col:"+s.id);'
        'if(m&&m.coverId){const c=r.querySelector(".cov");c&&c.src===DEFAULT_COVER&&setCover(c,m.coverId)}}'
        '}}}catch{}')
rep(old7, new7, 'patch6 flushCardInfo fallback')

io.open(P, 'w', encoding='utf-8').write(js)
print('ALL PATCHES APPLIED, len:', len(js))
