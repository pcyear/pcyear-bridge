# -*- coding: utf-8 -*-
# v1.4.11 队列升级：优先级（用户点击 P1 > 后台 P0）、最新任务排最前、视图切换取消旧请求
import io

P = 'static/js/app.js'
js = io.open(P, 'r', encoding='utf-8').read()

def rep(old, new, tag):
    global js
    assert old in js, 'NOT FOUND: ' + tag
    js = js.replace(old, new, 1)
    print('OK:', tag)

# ---- 1. 全局队列升级：prio/tag/最新优先/取消 ----
old1 = ('let _reqQueue=[],_reqActive=0;const _REQ_MAX=3;'
        'function _pumpReqs(){if(_reqActive>=_REQ_MAX)return;'
        'while(_reqActive<_REQ_MAX&&_reqQueue.length){const j=_reqQueue.shift();_reqActive++;'
        'j.fn().then(v=>{_reqActive--;j.res(v);_pumpReqs()},er=>{_reqActive--;j.rej(er);_pumpReqs()})}}'
        'function queueRequest(fn){return new Promise((res,rej)=>{_reqQueue.push({fn,res,rej});_pumpReqs()})}'
        'function _coverThrottle(fn){return queueRequest(fn)}')
new1 = ('let _reqQueue=[],_reqActive=0,_reqSeq=0,_ctxTag="v:tracks";const _REQ_MAX=3;'
        'function _pumpReqs(){if(_reqActive>=_REQ_MAX)return;'
        'while(_reqActive<_REQ_MAX&&_reqQueue.length){const j=_reqQueue.shift();_reqActive++;'
        'j.fn().then(v=>{_reqActive--;j.res(v);_pumpReqs()},er=>{_reqActive--;j.rej(er);_pumpReqs()})}}'
        'function queueRequest(fn,opts){const tag=(opts&&opts.tag)||_ctxTag,prio=opts&&opts.prio?1:0;'
        'return new Promise((res,rej)=>{const task={fn,res,rej,prio,tag,seq:++_reqSeq};'
        'if(!_reqQueue.length)_reqQueue.push(task);'
        'else if(prio===1)_reqQueue.unshift(task);'
        'else{let idx=_reqQueue.length;for(let i=_reqQueue.length-1;i>=0;i--){if(_reqQueue[i].prio===1){idx=i+1;break}}_reqQueue.splice(idx,0,task)}'
        '_pumpReqs()})}'
        'function cancelRequests(pred){for(let i=_reqQueue.length-1;i>=0;i--){if(pred(_reqQueue[i])){const t=_reqQueue.splice(i,1)[0];try{t.rej({cancelled:!0})}catch{}}}}'
        'function switchCtx(tag){try{cancelRequests(t=>t.tag&&t.tag!==tag&&(t.tag.indexOf("v:")===0||t.tag.indexOf("d:")===0))}catch{}_ctxTag=tag}'
        'function _coverThrottle(fn){return queueRequest(fn)}')
rep(old1, new1, '1 queue prio/tag/cancel')

# ---- 2. api() 第 5 参 opts（prio/tag）----
old2 = 'function api(t,e="GET",n,s=2e4){return queueRequest(()=>_apiDo(t,e,n,s))}function _apiDo(t,e="GET",n,s=2e4){const o=r=>{'
new2 = 'function api(t,e="GET",n,s=2e4,o){return queueRequest(()=>_apiDo(t,e,n,s),o)}function _apiDo(t,e="GET",n,s=2e4){const o=r=>{'
rep(old2, new2, '2 api opts')

# ---- 3a. loadView 开头切换上下文（取消旧视图请求）----
old3 = 'async function loadView(t){const e=++viewToken;'
new3 = 'async function loadView(t){switchCtx("v:"+t);const e=++viewToken;'
rep(old3, new3, '3a loadView switchCtx')

# ---- 3b. loadView 列表请求 P1 ----
old4 = 'const a=await api(`${n}&limit=${LIST_PAGE_SIZE}&offset=0${forceRefresh?"&refresh=1":""}`);'
new4 = 'const a=await api(`${n}&limit=${LIST_PAGE_SIZE}&offset=0${forceRefresh?"&refresh=1":""}`,"GET",void 0,2e4,{prio:1});'
rep(old4, new4, '3b loadView list P1')

# ---- 4. switchView 切换上下文 ----
old5 = 'function switchView(t){view=t,drill=null,searchActive=!1,'
new5 = 'function switchView(t){switchCtx("v:"+t),view=t,drill=null,searchActive=!1,'
rep(old5, new5, '4 switchView switchCtx')

# ---- 5. loadMoreList 分页 P1 ----
old6 = 'try{const i=await api(o);if(s!==viewToken)return;'
new6 = 'try{const i=await api(o,"GET",void 0,2e4,{prio:1});if(s!==viewToken)return;'
rep(old6, new6, '5 loadMoreList P1')

# ---- 6a. loadDrill 开头切换上下文 ----
old7 = 'async function loadDrill(){if(!drill)return;const t=++viewToken;'
new7 = 'async function loadDrill(){if(!drill)return;switchCtx("d:"+drill.id);const t=++viewToken;'
rep(old7, new7, '6a loadDrill switchCtx')

# ---- 6b. loadDrill 详情请求 P1 ----
old8 = 'try{c=await api(l,"GET",void 0,6e4)}'
new8 = 'try{c=await api(l,"GET",void 0,6e4,{prio:1})}'
rep(old8, new8, '6b loadDrill P1')

# ---- 7. ensureDrillCover P1（用户等待）----
old9 = 'await api(`${PLUGIN_BASE}/collections/info`,"POST",{sourceId:currentSourceId,ids:[t]},15e3);'
new9 = 'await api(`${PLUGIN_BASE}/collections/info`,"POST",{sourceId:currentSourceId,ids:[t]},15e3,{prio:1});'
rep(old9, new9, '7 ensureDrillCover P1')

# ---- 8. 搜索：切换上下文 + P1 ----
old10 = 'searchActive=!0;const e=await api(`${PLUGIN_BASE}/search?sourceId=${currentSourceId}&q=${encodeURIComponent(t)}&limit=30`);'
new10 = ('switchCtx("v:search"),searchActive=!0;'
         'const e=await api(`${PLUGIN_BASE}/search?sourceId=${currentSourceId}&q=${encodeURIComponent(t)}&limit=30`,"GET",void 0,2e4,{prio:1});')
rep(old10, new10, '8 search switchCtx+P1')

# ---- 版本 1.4.10 -> 1.4.11 ----
js = js.replace('1.4.10', '1.4.11')
io.open(P, 'w', encoding='utf-8').write(js)
s = io.open('plugin.json', 'r', encoding='utf-8').read()
s = s.replace('1.4.10', '1.4.11')
io.open('plugin.json', 'w', encoding='utf-8').write(s)
print('written, v1.4.11')
