import urllib.request, json, ssl
HOST='https://mimusic.035151.xyz:1024'; CTX=ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE
ZIP='dist/multisource-music.jsplugin.zip'
def req(m,u,d=None,hd=None,raw=False):
    r=urllib.request.Request(u,data=d,headers=hd or {},method=m)
    try:
        with urllib.request.urlopen(r,timeout=120,context=CTX) as x:
            b=x.read(); return x.status,(b if raw else b.decode(errors='replace'))
    except urllib.error.HTTPError as e:
        return e.code,e.read().decode(errors='replace')
# login
tok=json.loads(req('POST',f'{HOST}/api/v1/auth/login',json.dumps({'username':'pcyear','password':'pcyear'}).encode(),{'Content-Type':'application/json'})[1])['access_token']
H={'Authorization':'Bearer '+tok}
# upload multipart
import email, uuid, io
boundary='----b'+uuid.uuid4().hex
body=bytearray()
def addfile(field,fn,data,ctype='application/zip'):
    body.extend(('--'+boundary+'\r\n').encode())
    body.extend(('Content-Disposition: form-data; name="%s"; filename="%s"\r\n'%(field,fn)).encode())
    body.extend(('Content-Type: %s\r\n\r\n'%ctype).encode())
    body.extend(data); body.extend(b'\r\n')
addfile('file',ZIP,open(ZIP,'rb').read())
body.extend(('--'+boundary+'--\r\n').encode())
uh={'Authorization':'Bearer '+tok,'Content-Type':'multipart/form-data; boundary='+boundary}
st,b=req('POST',f'{HOST}/api/v1/jsplugins/upload',bytes(body),uh)
print('UPLOAD',st)
print(b[:1200])
