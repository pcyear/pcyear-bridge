# -*- coding: utf-8 -*-
import urllib.request, json, ssl
HOST='https://mimusic.035151.xyz:1024'; USER='pcyear'; PASS='pcyear'; EP='multisource-music'
CTX=ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE
r=urllib.request.Request(HOST+'/api/v1/auth/login', data=json.dumps({'username':USER,'password':PASS}).encode(), headers={'Content-Type':'application/json'}, method='POST')
TOKEN=json.loads(urllib.request.urlopen(r,timeout=30,context=CTX).read())['access_token']
def get(path):
    rq=urllib.request.Request(HOST+path, headers={'Authorization':'Bearer '+TOKEN}, method='GET')
    try: return urllib.request.urlopen(rq,timeout=30,context=CTX).read().decode('utf-8','replace')
    except urllib.error.HTTPError as e: return 'HTTP%d '%e.code+e.read().decode('utf-8','replace')
print('=== /cover-data songloft/64 ===')
print(get('/api/v1/jsplugin/%s/cover-data?sourceId=src_msm_songloft&coverId=64'%EP)[:400])
print('\n=== /cover-search songloft/64 ===')
print(get('/api/v1/jsplugin/%s/cover-search?sourceId=src_msm_songloft&coverId=64&title=%s&artist=%s&album=%s'%(EP,'达拉崩吧正版','洛天依/言和','达拉崩吧'))[:400])
