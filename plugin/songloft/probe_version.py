# -*- coding: utf-8 -*-
"""拉取真机当前运行的 index.html，确认实际加载的插件版本（验证部署是否真正生效）。"""
import urllib.request, urllib.error, ssl, os, re
HOST = os.environ.get('HOST', 'https://mimusic.035151.xyz:1024')
USER = os.environ.get('USER', 'pcyear')
PASS = os.environ.get('PASS', 'pcyear')
EP = os.environ.get('EP', 'multisource-music')
CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE
TOKEN = None

def req(p, method='GET'):
    url = HOST + p
    h = {'Authorization': 'Bearer ' + TOKEN} if TOKEN else {}
    r = urllib.request.Request(url, headers=h, method=method)
    with urllib.request.urlopen(r, timeout=60, context=CTX) as resp:
        return resp.status, resp.read().decode('utf-8', 'replace')

# login
try:
    s, b = req('/api/v1/auth/login', 'POST')
    # login needs body
except Exception:
    pass
import json
r = urllib.request.Request(HOST + '/api/v1/auth/login',
    data=json.dumps({'username': USER, 'password': PASS}).encode(),
    headers={'Content-Type': 'application/json'}, method='POST')
with urllib.request.urlopen(r, timeout=60, context=CTX) as resp:
    TOKEN = json.loads(resp.read().decode())['access_token']

# 拉真机运行的前端页面
s, html = req('/api/v1/jsplugin/%s/index.html' % EP)
print('STATUS', s, 'len', len(html))
# 提取版本号
for m in re.findall(r'1\.4\.55\.\d+|1\.4\.55', html):
    print('FOUND VERSION:', m)
# 也检查是否含本次修复特征
for feat in ['bgRefreshList', 'drill.coverId', 'op:"delete"', 'np-cover-wrap']:
    print('FEATURE', feat, ':', feat in html)
