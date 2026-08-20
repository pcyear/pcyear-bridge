# -*- coding: utf-8 -*-
import urllib.request, json, ssl
HOST='https://mimusic.035151.xyz:1024'; USER='pcyear'; PASS='pcyear'
CTX=ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE
r=urllib.request.Request(HOST+'/api/v1/auth/login', data=json.dumps({'username':USER,'password':PASS}).encode(), headers={'Content-Type':'application/json'}, method='POST')
TOKEN=json.loads(urllib.request.urlopen(r,timeout=30,context=CTX).read())['access_token']
def head(path, range_hdr=None):
    h={'Authorization':'Bearer '+TOKEN}
    if range_hdr: h['Range']=range_hdr
    rq=urllib.request.Request(HOST+path, headers=h, method='GET')
    try:
        resp=urllib.request.urlopen(rq,timeout=30,context=CTX)
        body=resp.read()
        return resp.status, dict(resp.headers), body
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()
# 1) 宿主封面端点
print('==== host cover endpoint /api/v1/songs/64/cover?v=1786983312 ====')
st,hd,body=head('/api/v1/songs/64/cover?v=1786983312')
print('  status=',st,'content-type=',hd.get('Content-Type'),'len=',len(body))
print('  first bytes=',body[:16].hex() if body else 'EMPTY')

# 2) 音频文件头：找 ID3 + APIC
print('\\n==== audio head (first 256KB) ====')
st,hd,body=head('/api/v1/songs/64/stream', 'bytes=0-262143')
print('  stream status=',st,'content-type=',hd.get('Content-Type'),'len=',len(body))
if body[:3]==b'ID3':
    print('  ID3 magic FOUND. version=',body[3],body[4])
    # 解析 ID3 大小
    def idsize(b,o): return ((b[o]&0x7f)<<21)|((b[o+1]&0x7f)<<14)|((b[o+2]&0x7f)<<7)|(b[o+3]&0x7f)
    sz=idsize(body,6)
    print('  ID3 size=',sz)
    # 扫描 APIC
    apics=[]
    i=10
    end=min(10+sz,len(body))
    while i+10<end:
        f=body[i:i+4]
        if f in (b'APIC',b'TIT2',b'TPE1',b'TALB'):
            fs=idsize(body,i+4)
            apics.append((f.decode('latin1'),i,fs))
        i+=1
    print('  tag frames found:',[(x[0],x[2]) for x in apics])
else:
    print('  NO ID3 magic, first bytes=',body[:8].hex())
