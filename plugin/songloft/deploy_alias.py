#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""部署「兼容别名」插件 multisource-music 到指定 SongLoft 宿主。

与 deploy_verify.py 同理，但上传的是别名包 dist/multisource-music.jsplugin.zip，
并按 entryPath=multisource-music 定位/重载插件。宿主会按 entryPath 自动创建或更新该插件。

用法：
  python deploy_alias.py
  HOST=https://<宿主>:<端口> USER=<账号> PASS=<密码> python deploy_alias.py
"""
import urllib.request, urllib.parse, json, os, ssl, sys

HOST = os.environ.get('HOST') or ''
USER = os.environ.get('USER') or ''
PASS = os.environ.get('PASS') or ''
if not HOST or not USER or not PASS:
    print('!! 缺少部署凭据：请设置环境变量 HOST / USER / PASS（脚本不内置默认凭据）')
    print('   例如：HOST=https://<宿主>:<端口> USER=<账号> PASS=<密码> python deploy_alias.py')
    sys.exit(1)
ENTRY = 'multisource-music'
ZIP = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist', 'multisource-music.jsplugin.zip')

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
TOKEN = None


def req(p, data=None, method=None, headers=None, files=None, timeout=90):
    global TOKEN
    url = HOST + p
    h = dict(headers or {})
    if TOKEN:
        h['Authorization'] = 'Bearer ' + TOKEN
    body = None
    if files:
        boundary = '----bnd' + str(os.getpid())
        h['Content-Type'] = 'multipart/form-data; boundary=' + boundary
        parts = []
        for name, fn, ct, content in files:
            parts.append(('--' + boundary).encode())
            parts.append(('Content-Disposition: form-data; name="%s"; filename="%s"' % (name, fn)).encode())
            parts.append(('Content-Type: %s' % ct).encode())
            parts.append(b'')
            parts.append(content if isinstance(content, bytes) else content.encode())
        parts.append(('--' + boundary + '--').encode())
        parts.append(b'')
        body = b'\r\n'.join(parts)
    elif data is not None:
        body = json.dumps(data, ensure_ascii=False).encode()
        h['Content-Type'] = 'application/json'
    r = urllib.request.Request(url, data=body, headers=h,
                               method=method or ('POST' if body else 'GET'))
    try:
        with urllib.request.urlopen(r, timeout=timeout, context=CTX) as resp:
            return resp.status, (resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:600]
    except Exception as e:
        return -1, repr(e)[:300]


if not os.path.isfile(ZIP):
    print('!! 找不到别名包：', ZIP)
    print('   请先构建别名包：ENTRY_PATH_OVERRIDE=multisource-music node scripts/build.mjs')
    sys.exit(1)

print('== login ==', HOST)
s, b = req('/api/v1/auth/login', {'username': USER, 'password': PASS})
print(s, b[:120])
if s != 200:
    print('LOGIN FAIL'); sys.exit(1)
TOKEN = json.loads(b)['access_token']

print('== upload alias ==')
with open(ZIP, 'rb') as f:
    content = f.read()
s, ub = req('/api/v1/jsplugins/upload',
            files=[('file', 'multisource-music.jsplugin.zip', 'application/zip', content)])
print('upload', s, ub[:300])

pid = None
try:
    upj = json.loads(ub)
    results = upj.get('results', []) if isinstance(upj, dict) else []
    for r in results:
        pl = r.get('plugin') if isinstance(r, dict) else None
        if pl and (pl.get('entryPath') or pl.get('entry_path')) == ENTRY:
            pid = pl.get('id')
            break
except Exception as e:
    print('parse', e)
if pid is None:
    try:
        s, b = req('/api/v1/jsplugins')
        j = json.loads(b)
        arr = j.get('data', j) if isinstance(j, dict) else j
        if isinstance(arr, dict):
            arr = list(arr.values())
        for pl in arr:
            if isinstance(pl, dict) and (pl.get('entryPath') or pl.get('entry_path')) == ENTRY:
                pid = pl.get('id')
                break
    except Exception as e:
        print('list', e)
print('alias plugin id =', pid)
if pid is None:
    print('!! 未确定别名插件 id，跳过重载')
else:
    req('/api/v1/jsplugins/%s/disable' % pid, method='POST')
    req('/api/v1/jsplugins/%s/enable' % pid, method='POST')
    print('reloaded alias plugin', pid)

# 探测别名插件是否带出旧配置（旧数据目录 jsplugins_data/multisource-music 是否还在）
print('== alias /sources ==')
s, b = req('/api/v1/jsplugin/%s/sources' % ENTRY, method='GET')
print('sources status', s)
try:
    j = json.loads(b)
    srcs = j.get('data', [])
    print('别名音源：', [(c.get('id'), c.get('type'), c.get('name')) for c in srcs])
    if not srcs:
        print('!! 别名插件暂无音源配置：旧数据目录可能已被清除，')
        print('   请在 SongLoft 插件页的「多源音乐桥(别名)」里重新添加 WebDAV/Subsonic/飞牛 音源（与原 multisource-music 相同）。')
except Exception as e:
    print('parse', e, b[:200])
print('DONE')
