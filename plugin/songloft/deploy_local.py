import urllib.request, json, ssl, uuid
HOST='http://192.168.31.28:58091'
CTX=ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE
ZIP='dist/multisource-music.jsplugin.zip'
def req(m,u,d=None,hd=None):
    r=urllib.request.Request(u,data=d,headers=hd or {},method=m)
    try:
        with urllib.request.urlopen(r,timeout=120,context=CTX) as x:
            b=x.read(); return x.status,b.decode(errors='replace')
    except urllib.error.HTTPError as e:
        return e.code,e.read().decode(errors='replace')
    except Exception as e: return -1,str(e)
tok=json.loads(req('POST',f'{HOST}/api/v1/auth/login',json.dumps({'username':'pcyear','password':'pcyear'}).encode(),{'Content-Type':'application/json'})[1])['access_token']
boundary='----b'+uuid.uuid4().hex
body=bytearray()
body.extend(('--'+boundary+'\r\n').encode())
body.extend(('Content-Disposition: form-data; name="file"; filename="%s"\r\n'%ZIP).encode())
body.extend(b'Content-Type: application/zip\r\n\r\n')
body.extend(open(ZIP,'rb').read()); body.extend(b'\r\n')
body.extend(('--'+boundary+'--\r\n').encode())
uh={'Authorization':'Bearer '+tok,'Content-Type':'multipart/form-data; boundary='+boundary}
st,b=req('PUT',f'{HOST}/api/v1/jsplugins/1',bytes(body),uh)
print('PUT',st); print(b[:600])
