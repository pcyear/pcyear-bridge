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

def get(path):
    r = urllib.request.Request(HOST + path, headers={'Authorization': 'Bearer ' + TOKEN}, method='GET')
    with urllib.request.urlopen(r, timeout=30, context=CTX) as resp:
        return json.loads(resp.read().decode('utf-8', 'replace'))

j = get('/api/v1/jsplugin/%s/diag/playlog' % EP)
print('==== STREAM (proxy 行为) ====')
for x in (j.get('stream') or [])[-25:]:
    print(json.dumps(x, ensure_ascii=False))
print('\n==== FRONTEND (fe) ====')
for x in (j.get('fe') or [])[-25:]:
    print(json.dumps(x, ensure_ascii=False))
print('\n==== musicurl 最近6条 ====')
for x in (j.get('musicurl') or [])[-6:]:
    print(json.dumps(x, ensure_ascii=False))
