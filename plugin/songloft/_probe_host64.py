# -*- coding: utf-8 -*-
import urllib.request, json, ssl
HOST='https://mimusic.035151.xyz:1024'; USER='pcyear'; PASS='pcyear'
CTX=ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE
r=urllib.request.Request(HOST+'/api/v1/auth/login', data=json.dumps({'username':USER,'password':PASS}).encode(), headers={'Content-Type':'application/json'}, method='POST')
TOKEN=json.loads(urllib.request.urlopen(r,timeout=30,context=CTX).read())['access_token']
def get(path):
    rq=urllib.request.Request(HOST+path, headers={'Authorization':'Bearer '+TOKEN}, method='GET')
    return json.loads(urllib.request.urlopen(rq,timeout=30,context=CTX).read())
for sid in [64]:
    try:
        j=get('/api/v1/songs/%d'%sid)
        print('==== host song %d ===='%sid)
        for k in ['id','title','artist','album','album_artist','cover_id','cover_url','duration','year','track_no','file_path','format','size','source_data']:
            v=j.get(k) if isinstance(j,dict) else None
            if isinstance(v,(dict,list)): v=json.dumps(v,ensure_ascii=False)[:200]
            print('  %s = %r'%(k,v))
    except Exception as e:
        print('song %d FAIL'%sid, repr(e))
