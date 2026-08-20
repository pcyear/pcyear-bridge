# -*- coding: utf-8 -*-
import urllib.request, json, ssl
HOST='https://mimusic.035151.xyz:1024'; USER='pcyear'; PASS='pcyear'; EP='multisource-music'
CTX=ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE
r=urllib.request.Request(HOST+'/api/v1/auth/login', data=json.dumps({'username':USER,'password':PASS}).encode(), headers={'Content-Type':'application/json'}, method='POST')
TOKEN=json.loads(urllib.request.urlopen(r,timeout=30,context=CTX).read())['access_token']
H64='c2cBc3JjX21zbV9zb25nbG9mdAE2NAHovr7mi4nltKnlkKfmraPniYgBAQ'
def fetch(path, headers=None):
    h={'Authorization':'Bearer '+TOKEN}
    if headers: h.update(headers)
    rq=urllib.request.Request(HOST+path, headers=h, method='GET')
    try:
        resp=urllib.request.urlopen(rq,timeout=30,context=CTX); return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()
st,hd,body=fetch('/api/v1/jsplugin/%s/rest/stream?id=%s&u=admin&p=x&v=1.13.0&c=probe'%(EP,H64), {'Range':'bytes=0-262143'})
tag=body[:207]
print('ID3 raw (latin1):')
print(tag.decode('latin1','replace'))
print('---- frame ids present ----')
# ID3v2.4 frame: 4 ascii id + 4 synchsafe size + 2 flags
i=10
while i+10<=len(tag):
    fid=tag[i:i+4]
    if fid==b'\x00\x00\x00\x00' or fid==b'\xff\xff\xff\xff':
        break
    if all(32<=c<127 for c in fid):
        sz=((tag[i+4]&0x7f)<<21)|((tag[i+5]&0x7f)<<14)|((tag[i+6]&0x7f)<<7)|(tag[i+7]&0x7f)
        print('  frame', fid.decode('latin1'), 'size=',sz, 'data=', repr(tag[i+10:i+10+min(sz,60)]))
        i=i+10+sz
    else:
        i+=1
