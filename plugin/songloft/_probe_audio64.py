# -*- coding: utf-8 -*-
import urllib.request, json, ssl
HOST='https://mimusic.035151.xyz:1024'; USER='pcyear'; PASS='pcyear'; EP='multisource-music'
CTX=ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE
r=urllib.request.Request(HOST+'/api/v1/auth/login', data=json.dumps({'username':USER,'password':PASS}).encode(), headers={'Content-Type':'application/json'}, method='POST')
TOKEN=json.loads(urllib.request.urlopen(r,timeout=30,context=CTX).read())['access_token']
H64='c2cBc3JjX21zbV9zb25nbG9mdAE2NAHovr7mi4nltKnlkKfmraPniYgBAQ'
def fetch(path, headers=None):
    h={'Authorization':'Bearer '+TOKEN}; 
    if headers: h.update(headers)
    rq=urllib.request.Request(HOST+path, headers=h, method='GET')
    try:
        resp=urllib.request.urlopen(rq,timeout=30,context=CTX)
        return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()

# 通过插件 Subsonic stream 端点拿音频头部（host 歌曲由插件 serveFile 返回）
print('==== plugin stream (host song) first 256KB ====')
st,hd,body=fetch('/api/v1/jsplugin/%s/rest/stream?id=%s&u=admin&p=x&v=1.13.0&c=probe'%(EP,H64), {'Range':'bytes=0-262143'})
print('  status=',st,'content-type=',hd.get('Content-Type'),'len=',len(body))
if len(body)>=3 and body[:3]==b'ID3':
    print('  ID3 magic FOUND. ver=',body[3],body[4])
    def idsize(b,o): return ((b[o]&0x7f)<<21)|((b[o+1]&0x7f)<<14)|((b[o+2]&0x7f)<<7)|(b[o+3]&0x7f)
    sz=idsize(body,6); print('  ID3 size=',sz)
    apics=[]
    i=10; end=min(10+sz,len(body))
    while i+10<end:
        f=body[i:i+4]
        if f in (b'APIC',b'TIT2',b'TPE1',b'TALB',b'TPE2',b'TORY',b'TYER'):
            fs=idsize(body,i+4); apics.append((f.decode('latin1'),i,fs))
        i+=1
    print('  frames:',[(x[0],x[2]) for x in apics])
elif len(body)>=11 and body[:4]==b'fLaC' or (len(body)>=4 and body[:4]==b'OggS'):
    print('  FLAC/OGG container, need deeper parse')
else:
    print('  first bytes=',body[:12].hex(), ' ascii=',body[:12])
