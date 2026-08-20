# -*- coding: utf-8 -*-
"""真机实测 /cover-data 返回的 JSON 字段名，定性 v1.4.55.18 的 dataUrl||contentType 兼容是否还需要。"""
import urllib.request, urllib.error, json, ssl, os
HOST = os.environ.get('HOST', 'https://mimusic.035151.xyz:1024')
USER = os.environ.get('USER', 'pcyear'); PASS = os.environ.get('PASS', 'pcyear')
EP = 'multisource-music'
CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE
TOKEN = None

def req(p, method='GET'):
    h = {'Authorization': 'Bearer ' + TOKEN} if TOKEN else {}
    r = urllib.request.Request(HOST + p, headers=h, method=method)
    with urllib.request.urlopen(r, timeout=60, context=CTX) as resp:
        return resp.status, resp.read().decode('utf-8', 'replace')

r = urllib.request.Request(HOST + '/api/v1/auth/login',
    data=json.dumps({'username': USER, 'password': PASS}).encode(),
    headers={'Content-Type': 'application/json'}, method='POST')
with urllib.request.urlopen(r, timeout=60, context=CTX) as resp:
    TOKEN = json.loads(resp.read().decode())['access_token']

# songloft 本地库封面 coverId=19（历史真机验证过 host /songs/19/cover 返回 206）
for sid, cid in [('src_msm_songloft', '19'), ('src_msm_songloft', '7')]:
    try:
        s2, b2 = req('/api/v1/jsplugin/%s/cover-data?sourceId=%s&coverId=%s' % (EP, sid, cid))
        try:
            j = json.loads(b2)
            print('[%s/%s] status=%s keys=%s ok=%s' % (sid, cid, s2, list(j.keys()), j.get('ok')))
            print('   has dataUrl=%s  has contentType=%s' % ('dataUrl' in j, 'contentType' in j))
            for k, v in j.items():
                print('   %s = %s' % (k, (('dataURI len=%d' % len(v)) if k == 'dataUrl' else str(v)[:90])))
        except Exception as e:
            print('parse err', e, b2[:180])
    except Exception as e:
        print('req err', e)
