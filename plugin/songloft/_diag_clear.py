import urllib.request, json, ssl
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
B = "https://mimusic.035151.xyz:1024"; PB = "/api/v1/jsplugin/multisource-music"

def login():
    r = urllib.request.Request(B + "/api/v1/auth/login", json.dumps({"username": "pcyear", "password": "pcyear"}).encode(), {"Content-Type": "application/json"}, "POST")
    return json.loads(urllib.request.urlopen(r, timeout=20, context=ctx).read())["access_token"]

def req(u, tk, data=None):
    h = {"Authorization": "Bearer " + tk}
    if data is not None:
        h["Content-Type"] = "application/json"
        r = urllib.request.Request(B + u, json.dumps(data).encode(), h, "POST")
    else:
        r = urllib.request.Request(B + u, headers=h)
    return urllib.request.urlopen(r, timeout=25, context=ctx).read().decode()

tk = login()
print("clear msm_fe:", req(f"{PB}/diag/clear", tk, {"key": "msm_fe"})[:80])
