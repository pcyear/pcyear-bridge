import urllib.request, json, ssl
ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
B="https://mimusic.035151.xyz:1024"; PB="/api/v1/jsplugin/multisource-music"
def login():
    r=urllib.request.Request(B+'/api/v1/auth/login', json.dumps({'username':'pcyear','password':'pcyear'}).encode(), {'Content-Type':'application/json'}, 'POST')
    return json.loads(urllib.request.urlopen(r, timeout=20, context=ctx).read())['access_token']
def req(u, tk):
    h={'Authorization':'Bearer '+tk}
    r=urllib.request.Request(B+u, headers=h)
    return json.loads(urllib.request.urlopen(r, timeout=25, context=ctx).read().decode())
tk=login()
d=req(f"{PB}/diag/playlog", tk)
fe=d.get('fe') or []
print("=== msm_fe count:", len(fe), "===")
for i,e in enumerate(fe):
    print(f"--- [{i}] where={e.get('where')} ---")
    print(json.dumps(e, ensure_ascii=False)[:1200])
