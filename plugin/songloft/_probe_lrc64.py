# -*- coding: utf-8 -*-
import urllib.request, json, ssl
HOST='https://mimusic.035151.xyz:1024'; USER='pcyear'; PASS='pcyear'; EP='multisource-music'
CTX=ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE
r=urllib.request.Request(HOST+'/api/v1/auth/login', data=json.dumps({'username':USER,'password':PASS}).encode(), headers={'Content-Type':'application/json'}, method='POST')
TOKEN=json.loads(urllib.request.urlopen(r,timeout=30,context=CTX).read())['access_token']
H64='c2cBc3JjX21zbV9zb25nbG9mdAE2NAHovr7mi4nltKnlkKfmraPniYgBAQ'
def get(path):
    rq=urllib.request.Request(HOST+path, headers={'Authorization':'Bearer '+TOKEN}, method='GET')
    return json.loads(urllib.request.urlopen(rq,timeout=30,context=CTX).read())
# 结构化歌词全部行
js=get('/api/v1/jsplugin/%s/rest/getLyricsBySongId?id=%s&u=admin&p=x&f=json&v=1.13.0&c=Amcfy'%(EP,H64))
ll=js['subsonic-response'].get('lyricsList')
e=ll['structuredLyrics'][0] if ll and ll.get('structuredLyrics') else {}
lines=e.get('line',[])
print('structuredLyrics 行数=',len(lines))
print('displayArtist=',e.get('displayArtist'),' displayTitle=',e.get('displayTitle'))
print('--- 含 歌名/歌手/专辑/：/ti/al/ar 的行 ---')
for l in lines:
    v=l.get('value','')
    if any(k in v for k in ['歌名','歌手','专辑','：','ti:','ar:','al:','作词','作曲','演唱']):
        print('  ',repr(v))
print('--- 前3行 + 最后3行 ---')
for l in lines[:3]+lines[-3:]:
    print('  ',l.get('start'),repr(l.get('value')))
# 同时看 host 原始 lyric 文本
print('\\n==== host raw lyric ====')
try:
    j2=get('/api/v1/songs/64/lyric')
    txt=j2.get('lyric') or j2.get('text') or ''
    print('host lyric len=',len(txt))
    for line in txt.splitlines()[:15]:
        print('  ',repr(line))
except Exception as ex:
    print('host lyric FAIL', repr(ex))
