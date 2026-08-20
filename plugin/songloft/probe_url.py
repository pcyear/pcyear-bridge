# -*- coding: utf-8 -*-
import urllib.request, urllib.error, json, ssl, sys, os
HOST = os.environ.get('HOST', 'https://mimusic.035151.xyz:1024')
USER = os.environ.get('USER', 'pcyear')
PASS = os.environ.get('PASS', 'pcyear')
EP = os.environ.get('EP', 'multisource-music')
CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE
TOKEN = None
login_body = json.dumps({'username': USER, 'password': PASS}).encode()
req_login = urllib.request.Request(HOST + '/api/v1/auth/login', data=login_body, headers={'Content-Type': 'application/json'}, method='POST')
with urllib.request.urlopen(req_login, timeout=30, context=CTX) as resp:
    TOKEN = json.loads(resp.read().decode('utf-8', 'replace'))['access_token']

sd = {
    "provider": "multisource-music",
    "sourceId": "src_msrjw9fyboc7",
    "sourceType": "geak",
    "trackId": sys.argv[1] if len(sys.argv) > 1 else "1",
}
body = json.dumps({"source_data": sd}).encode()
r = urllib.request.Request(HOST + '/api/v1/jsplugin/%s/api/music/url' % EP, data=body,
                            headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}, method='POST')
try:
    with urllib.request.urlopen(r, timeout=60, context=CTX) as resp:
        txt = resp.read().decode('utf-8', 'replace')
        print('STATUS', resp.status)
        print(txt[:600])
        # 解析出直连 url 后，直接拉流验证（带鉴权头），确认宿主能秒播
        try:
            j = json.loads(txt)
            up = j.get('url')
            hd = j.get('headers') or {}
        except Exception:
            up = None; hd = None
    if up:
        print('\n=== 拉流验证（Range 前 64KB）===')
        req2 = urllib.request.Request(up, headers=dict(hd))
        req2.add_header('Range', 'bytes=0-65535')
        try:
            with urllib.request.urlopen(req2, timeout=30, context=CTX) as r2:
                data = r2.read()
                print('stream STATUS', r2.status, 'bytes', len(data),
                      'content-type', r2.headers.get('Content-Type'),
                      'accept-ranges', r2.headers.get('Accept-Ranges'))
                print('前4字节 hex:', data[:4].hex())
        except urllib.error.HTTPError as e2:
            print('stream HTTP', e2.code, e2.read().decode('utf-8','replace')[:200])
except urllib.error.HTTPError as e:
    print('HTTP', e.code, e.read().decode('utf-8', 'replace')[:500])
