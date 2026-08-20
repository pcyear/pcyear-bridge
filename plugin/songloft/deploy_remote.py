# -*- coding: utf-8 -*-
"""部署多源音乐桥到远端宿主（mimusic.035151.xyz:1024）。
用法：python deploy_remote.py
可选环境变量：HOST / USER / PASS / ZIP
"""
import urllib.request, urllib.error, json, os, ssl, sys
HOST = os.environ.get('HOST', 'https://mimusic.035151.xyz:1024')
USER = os.environ.get('USER', 'admin')
PASS = os.environ.get('PASS', 'admin')
ZIP = os.environ.get('ZIP', 'dist/multisource-music.jsplugin.zip')
CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE
TOKEN = None

def req(p, data=None, files=None, method=None, timeout=120, raw=False):
    url = HOST + p
    h = {}
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
    r = urllib.request.Request(url, data=body, headers=h, method=method or ('POST' if body is not None else 'GET'))
    try:
        with urllib.request.urlopen(r, timeout=timeout, context=CTX) as resp:
            return resp.status, (resp.read() if raw else resp.read().decode('utf-8', 'replace'))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')[:400]

print('== login ==')
s, b = req('/api/v1/auth/login', {'username': USER, 'password': PASS})
if s != 200:
    print('LOGIN FAIL', s, b[:120]); sys.exit(1)
TOKEN = json.loads(b)['access_token']

with open(ZIP, 'rb') as f:
    content = f.read()

print('== upload ==')
s, ub = req('/api/v1/jsplugins/upload', files=[('file', 'multisource-music.jsplugin.zip', 'application/zip', content)])
print(s, ub[:300])

print('== find plugin id ==')
pid = None
try:
    upj = json.loads(ub)
    for r in (upj.get('results') or []):
        pl = r.get('plugin') if isinstance(r, dict) else None
        if pl and (pl.get('entryPath') or pl.get('entry_path')) == 'multisource-music':
            pid = pl.get('id'); break
except Exception as e:
    print('upload-resp parse err', e)
if pid is None:
    try:
        s, b = req('/api/v1/jsplugins')
        j = json.loads(b)
        arr = j.get('data', j) if isinstance(j, dict) else j
        if isinstance(arr, dict):
            arr = list(arr.values())
        for pl in arr:
            if isinstance(pl, dict) and (pl.get('entryPath') or pl.get('entry_path')) == 'multisource-music':
                pid = pl.get('id'); break
    except Exception as e:
        print('list parse err', e)
print('plugin id =', pid)
if pid is None:
    print('!! 未能确定插件 id，跳过热重载')
else:
    req('/api/v1/jsplugins/%s/disable' % pid, method='POST')
    req('/api/v1/jsplugins/%s/enable' % pid, method='POST')
    print('reloaded plugin', pid)

print('== sources ==')
# 注意：插件 entryPath 已改为 multisource-music（见 plugin.json），旧 pcyear-bridge 挂载已失效会 503
import json as _json
try:
    _ep = _json.load(open('plugin.json', encoding='utf-8')).get('entryPath', 'multisource-music')
except Exception:
    _ep = 'multisource-music'
s, b = req('/api/v1/jsplugin/%s/sources' % _ep)
print(s, b[:200])
print('DONE')
