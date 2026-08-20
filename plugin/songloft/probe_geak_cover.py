# -*- coding: utf-8 -*-
"""真机实测 GEAK 歌曲封面返回结构：确认 /cover-data 的 contentType 究竟是 MIME 还是 URL。"""
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

SID = 'src_msm_geak'
# 列 GEAK 歌曲前若干首，拿 coverId
s, b = req('/api/v1/jsplugin/%s/tracks?sourceId=%s&limit=8&offset=0' % (EP, SID))
print('== /tracks status=%s ==' % s)
tracks = []
try:
    j = json.loads(b)
    lst = j.get('list') or j.get('tracks') or []
    print('   total=%s returned=%d' % (j.get('total'), len(lst)))
    for t in lst[:8]:
        cid = t.get('coverId')
        tracks.append((t.get('title'), cid))
        print('   title=%s coverId=%r(%s)' % (t.get('title'), cid, type(cid).__name__ if cid else 'none'))
except Exception as e:
    print('   parse err', e, b[:200])

print('\n== /cover-data for each GEAK coverId ==')
for title, cid in tracks:
    if not cid:
        print('   [%s] no coverId -> 无封面标识' % title)
        continue
    try:
        s2, b2 = req('/api/v1/jsplugin/%s/cover-data?sourceId=%s&coverId=%s' % (EP, SID, urllib.parse.quote(str(cid))))
        j = json.loads(b2)
        ct = j.get('contentType')
        du = j.get('dataUrl')
        print('   [%s] ok=%s' % (title, j.get('ok')))
        print('      contentType = %r  (是MIME还是URL?)' % (str(ct)[:120] if ct else ct))
        print('      dataUrl     = %s' % (('dataURI len=%d' % len(du)) if du else du))
    except Exception as e:
        print('   [%s] err %s' % (title, e))
