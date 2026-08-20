# -*- coding: utf-8 -*-
"""验证封面兼容修复：真机页面版本 + contentType 直链可加载为真实图片。"""
import urllib.request, urllib.error, json, ssl, os, re
HOST = os.environ.get('HOST', 'https://mimusic.035151.xyz:1024')
USER = 'pcyear'; PASS = 'pcyear'; EP = 'multisource-music'
CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE
TOKEN = None

def req(p, method='GET', raw=False):
    h = {'Authorization': 'Bearer ' + TOKEN} if TOKEN else {}
    r = urllib.request.Request(HOST + p, headers=h, method=method)
    with urllib.request.urlopen(r, timeout=60, context=CTX) as resp:
        return resp.status, (resp.read() if raw else resp.read().decode('utf-8', 'replace'))

r = urllib.request.Request(HOST + '/api/v1/auth/login',
    data=json.dumps({'username': USER, 'password': PASS}).encode(),
    headers={'Content-Type': 'application/json'}, method='POST')
with urllib.request.urlopen(r, timeout=60, context=CTX) as resp:
    TOKEN = json.loads(resp.read().decode())['access_token']

s, html = req('/api/v1/jsplugin/%s/index.html' % EP)
print('真机页面版本:', re.findall(r'1\.4\.55\.\d+', html)[:1])
print('页面含 contentType 兼容逻辑:', ('contentType' in html and 'dataUrl' in html))

# 取 cover-data 的 contentType 直链，模拟前端 <img> 加载（裸 GET，query 已带 token，不加 Bearer 头）
s2, b2 = req('/api/v1/jsplugin/%s/cover-data?sourceId=src_msm_songloft&coverId=19' % EP)
j = json.loads(b2)
url = j.get('contentType')
try:
    r = urllib.request.Request(url, headers={'User-Agent': 'msm-verify'})
    with urllib.request.urlopen(r, timeout=60, context=CTX) as resp:
        body = resp.read()
    head = body[:4]
    print('contentType 直链 GET:', resp.status, 'bytes=', len(body),
          'magic=', head.hex(), '(JPEG=ffd8ffe0, PNG=89504e47)')
except Exception as e:
    print('contentType 直链 GET 异常:', type(e).__name__, str(e)[:120])
