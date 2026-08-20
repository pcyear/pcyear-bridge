# -*- coding: utf-8 -*-
"""多源音乐桥全链路冒烟验证（铁律：修改任何功能后必须多源全量验证，只验证单一源视为未验证）。

逐源验证：连通性 / 浏览 / ensure-songs / /songs/{id}/play / /cover / /lyric。
用法:
  HOST=http://<宿主>:<端口> USER=<账号> PASS=<密码> python tool/multisource_smoke.py [--add]
  # --add 才真正添加缺失的源（否则只报告缺失）
  # 可选：WEBDAV_HOST/WEBDAV_USER/WEBDAV_PASS、FN_HOST/FN_USER/FN_PASS 覆盖示例源配置
"""
import urllib.request, json, urllib.parse, sys, time, os

HOST = os.environ.get('HOST') or ''
USER = os.environ.get('USER') or ''
PASS = os.environ.get('PASS') or ''
if not HOST or not USER or not PASS:
    print('!! 缺少 HOST/USER/PASS 环境变量（脚本不内置凭据）')
    print('   用法: HOST=http://宿主:端口 USER=账号 PASS=密码 python tool/multisource_smoke.py [--add]')
    sys.exit(1)

WANT = [
    ('webdav', 'WebDAV', os.environ.get('WEBDAV_HOST') or 'http://<webdav宿主>:<端口>',
     os.environ.get('WEBDAV_USER') or '<webdav账号>', os.environ.get('WEBDAV_PASS') or '<webdav密码>', None),
    ('fnMusic', '飞牛音乐', os.environ.get('FN_HOST') or 'http://<fnMusic宿主>:<端口>',
     os.environ.get('FN_USER') or '<fnMusic账号>', os.environ.get('FN_PASS') or '<fnMusic密码>', None),
]

def req(p, method='GET', data=None, tok=None, timeout=30):
    h={}
    if tok: h['Authorization']='Bearer '+tok
    body=None
    if data is not None:
        body=json.dumps(data,ensure_ascii=False).encode(); h['Content-Type']='application/json'
    r=urllib.request.Request(HOST+p,data=body,headers=h,method=method)
    try:
        with urllib.request.urlopen(r,timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        return -1, repr(e)[:150].encode()

ADD = '--add' in sys.argv
s,b=req('/api/v1/auth/login','POST',{'username':USER,'password':PASS})
tok=json.loads(b.decode())['access_token']
PLUGIN='/api/v1/jsplugin/multisource-music'

# ---- 1. 当前源 ----
s,b=req(PLUGIN+'/sources',tok=tok)
cur=json.loads(b.decode()).get('data',[])
print(f"[1] 当前源({len(cur)}):", [(c['id'],c['type'],c['name']) for c in cur])

# ---- 2. 补源（WANT 定义见文件头，凭据走环境变量）----
for typ,name,base,u,pwd,root in WANT:
    if any(c['type']==typ for c in cur):
        print(f"[2] {typ} 源已存在，跳过添加"); continue
    if not ADD:
        print(f"[2] {typ} 源缺失（需 --add 添加）"); continue
    s,b=req(PLUGIN+'/sources','POST',{'type':typ,'name':name,'baseUrl':base,'username':u,'password':pwd,'rootPath':root},tok=tok)
    print(f"[2] 添加 {typ} -> {s} {b[:120]!r}")
    time.sleep(0.5)

# ---- 3. 重新取源 ----
s,b=req(PLUGIN+'/sources',tok=tok)
cur=json.loads(b.decode()).get('data',[])
print(f"[3] 源清单({len(cur)}):", [(c['id'],c['type'],c['name'],c.get('enabled')) for c in cur])

# ---- 4. 逐源连通性 test ----
print("\n===== 逐源连通性 =====")
for c in cur:
    if c.get('type')=='songloft': continue  # 内置源无 test
    s,b=req(PLUGIN+'/sources/test','POST',{'id':c['id']},tok=tok,timeout=45)
    print(f"  {c['type']}({c['id']}) test -> {s} {b[:140]!r}")

# ---- 5. 逐源浏览 ----
print("\n===== 逐源浏览(前5首) =====")
for c in cur:
    if c.get('type')=='songloft': continue
    q=urllib.parse.urlencode({'sourceId':c['id'],'limit':5})
    s,b=req(PLUGIN+f"/tracks?{q}",tok=tok,timeout=60)
    if s==200:
        j=json.loads(b.decode())
        rows=j.get('data') or j.get('tracks') or j.get('list') or []
        if isinstance(rows,dict): rows=list(rows.values())
        titles=[r.get('title') for r in (rows if isinstance(rows,list) else [])][:5]
        print(f"  {c['type']} tracks -> {s} 共{len(rows) if isinstance(rows,list) else '?'}首 示例:{titles}")
    else:
        print(f"  {c['type']} tracks -> {s} {b[:100]!r}")

# ---- 6. 逐源 ensure + play + cover + lyric ----
print("\n===== 逐源 ensure/play/cover/lyric =====")
for c in cur:
    if c.get('type')=='songloft': continue
    q=urllib.parse.urlencode({'sourceId':c['id'],'limit':1})
    s,b=req(PLUGIN+f"/tracks?{q}",tok=tok,timeout=60)
    if s!=200:
        print(f"  {c['type']}: 浏览失败，跳过"); continue
    j=json.loads(b.decode())
    rows=j.get('data') or j.get('tracks') or j.get('list') or []
    if isinstance(rows,dict): rows=list(rows.values())
    if not rows:
        print(f"  {c['type']}: 无曲目，跳过"); continue
    t=rows[0]
    print(f"  --- {c['type']} 验证曲目: {t.get('title')!r} id={t.get('id')} coverId={t.get('coverId')}")
    payload={'sourceId':c['id'],'trackId':t.get('id'),
             'track':{'id':t.get('id'),'title':t.get('title'),'artist':t.get('artist'),'album':t.get('album'),
                      'coverId':t.get('coverId'),'duration':t.get('duration')},
             'withCover':True,'withLyric':False}
    s,b=req(PLUGIN+'/ensure-songs','POST',payload,tok=tok,timeout=90)
    sid=None
    if s==200:
        try: sid=json.loads(b.decode()).get('songIds',[None])[0]
        except: pass
    print(f"    ensure-songs -> {s} songId={sid}")
    if not sid: continue
    # play
    r=urllib.request.Request(HOST+f'/api/v1/songs/{sid}/play?access_token={tok}',headers={'Range':'bytes=0-1023'})
    try:
        with urllib.request.urlopen(r,timeout=30) as resp:
            data=resp.read()
            print(f"    /songs/{sid}/play -> {resp.status} {resp.headers.get('Content-Type')} len={len(data)}")
    except urllib.error.HTTPError as e:
        print(f"    /play -> {e.code} {e.read()[:80]!r}")
    # cover
    try:
        r=urllib.request.Request(HOST+f'/api/v1/songs/{sid}/cover',headers={'Authorization':'Bearer '+tok})
        with urllib.request.urlopen(r,timeout=30) as resp:
            data=resp.read()
            print(f"    /cover -> {resp.status} {resp.headers.get('Content-Type')} len={len(data)}")
    except urllib.error.HTTPError as e:
        print(f"    /cover -> {e.code} {e.read()[:60]!r}")
    # lyric
    s,b=req(PLUGIN+f'/lyric?songId={sid}',tok=tok)
    print(f"    /lyric?songId={sid} -> {s} {b[:80]!r}")
print("\nDONE")
