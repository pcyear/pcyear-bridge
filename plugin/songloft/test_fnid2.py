import urllib.request, json, ssl, time
HOST='https://mimusic.035151.xyz:1024'; CTX=ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE
BASE=f'{HOST}/api/v1/jsplugin/multisource-music'
def req(m,u,d=None,h=None):
    r=urllib.request.Request(u,data=d,headers=h or {},method=m)
    try:
        with urllib.request.urlopen(r,timeout=120,context=CTX) as x: return x.status,x.read().decode(errors='replace')
    except urllib.error.HTTPError as e: return e.code,e.read().decode(errors='replace')
    except Exception as e: return -1,str(e)
tok=json.loads(req('POST',f'{HOST}/api/v1/auth/login',json.dumps({'username':'pcyear','password':'pcyear'}).encode(),{'Content-Type':'application/json'})[1])['access_token']
H={'Authorization':'Bearer '+tok,'Content-Type':'application/json'}
t0=time.time()
st,b=req('POST',f'{BASE}/sources/test',json.dumps({'id':'src_msvjjm9zfejy'}).encode(),H)
print('HTTP',st,'耗时 %.1fs'%(time.time()-t0))
print('BODY',b[:2500])
