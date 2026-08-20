import urllib.request, json, ssl, urllib.parse
HOST = "https://mimusic.035151.xyz:1024"
BASE = "/api/v1/jsplugin/multisource-music"
AB = "src_msm_audiobook"
ctx = ssl.create_default_context()
req = urllib.request.Request(HOST + "/api/v1/auth/login", data=json.dumps({"username": "pcyear", "password": "pcyear"}).encode(), headers={"Content-Type": "application/json"}, method="POST")
tok = json.load(urllib.request.urlopen(req, context=ctx))["access_token"]
H = {"Authorization": "Bearer " + tok, "Content-Type": "application/json"}

def q(method, path, body=None):
    r = urllib.request.Request(HOST + BASE + path, data=json.dumps(body).encode() if body is not None else None, headers=H, method=method)
    try:
        with urllib.request.urlopen(r, context=ctx, timeout=30) as resp:
            raw = resp.read()
            try:
                return resp.status, json.loads(raw)
            except Exception:
                return resp.status, raw[:150]
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:150]

# 1) subfolder inside 单田芳-隋唐演义
s, d = q("GET", "/browse?sourceId=" + AB + "&path=" + urllib.parse.quote("单田芳-隋唐演义") + "&limit=100&offset=0")
print("browse 单田芳:", s, json.dumps({"dirs": [x.get("path") for x in (d.get("dirs") or [])][:5], "tracks": len(d.get("tracks") or []), "total": d.get("total")}, ensure_ascii=False))
subs = d.get("dirs") or []
if subs:
    sub = subs[0].get("path")
    s, d = q("GET", "/browse?sourceId=" + AB + "&path=" + urllib.parse.quote(sub) + "&limit=100&offset=0")
    print("browse subfolder:", s, json.dumps({"dirs": len(d.get("dirs") or []), "tracks": len(d.get("tracks") or []), "total": d.get("total")}, ensure_ascii=False))
    s, d = q("POST", "/batch/tracks", {"sourceId": AB, "items": [{"kind": "folder", "id": sub, "path": sub}]})
    print("batch/tracks subfolder:", s, "count=", len(d.get("list") or []))

# 2) collections/info for folder card
s, d = q("POST", "/collections/info", {"sourceId": AB, "kind": "folder", "id": "ab:dir:单田芳-隋唐演义", "path": "单田芳-隋唐演义"})
print("collections/info:", s, json.dumps(d, ensure_ascii=False)[:250])

# 3) sources/directories
s, d = q("POST", "/sources/directories", {"sourceId": AB})
print("sources/directories:", s, json.dumps(d, ensure_ascii=False)[:200])

# 4) directory-count
s, d = q("POST", "/sources/directory-count", {"sourceId": AB, "path": "单田芳-隋唐演义"})
print("directory-count:", s, json.dumps(d, ensure_ascii=False)[:200])

# 5) search
s, d = q("GET", "/search?sourceId=" + AB + "&q=" + urllib.parse.quote("火车站") + "&limit=30")
print("search 火车站:", s, json.dumps({"tracks": len(d.get("tracks") or []), "first": (d.get("tracks") or [{}])[0].get("title")}, ensure_ascii=False))

# 6) cast/play-url
s, d = q("POST", "/cast/play-url", {"sourceId": AB, "trackId": "ab:audiobook/斑点龙的蛋糕店/0008变开心蛋糕_-2.mp3"})
print("cast/play-url:", s, json.dumps(d, ensure_ascii=False)[:200])

# 7) diag/sources
s, d = q("GET", "/diag/sources")
print("diag/sources:", s, json.dumps(d, ensure_ascii=False)[:200])

# 8) ensure-songs with existing songId roundtrip (idempotency)
s, d = q("POST", "/ensure-songs", {"tracks": [{"sourceId": AB, "trackId": "ab:audiobook/斑点龙的蛋糕店/0008变开心蛋糕_-2.mp3", "track": {"id": "ab:audiobook/斑点龙的蛋糕店/0008变开心蛋糕_-2.mp3", "title": "0008变开心蛋糕_-2", "path": "audiobook/斑点龙的蛋糕店/0008变开心蛋糕_-2.mp3"}}], "withCover": False, "withLyric": False})
print("ensure-songs idempotent:", s, json.dumps(d, ensure_ascii=False)[:200])
