import urllib.request, json, ssl, sys, time

HOST = sys.argv[1] if len(sys.argv) > 1 else "https://mimusic.035151.xyz:1024"
USER, PASS = "pcyear", "pcyear"
CTX = ssl.create_default_context()
BASE = "/api/v1/jsplugin/multisource-music"
AB_SRC = "src_msm_audiobook"

tok = None
def req(method, path, body=None, timeout=30, base=BASE):
    global tok
    url = HOST + base + path
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, context=CTX, timeout=timeout) as resp:
            raw = resp.read()
            try: return resp.status, json.loads(raw)
            except Exception: return resp.status, raw[:200]
    except urllib.error.HTTPError as e:
        raw = e.read()
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw[:200]
    except Exception as e:
        return -1, str(e)[:200]

results = []
def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS" if ok else "FAIL"), name, ("| " + str(detail)[:220] if detail else ""))

# 0) login
s, d = req("POST", "/api/v1/auth/login", {"username": USER, "password": PASS}, base="")
if s == 200 and d.get("access_token"):
    tok = d["access_token"]; check("auth/login", True)
else:
    check("auth/login", False, d); sys.exit(1)

# 1) sources
s, d = req("GET", "/sources")
srcs = d.get("data") or d.get("sources") or []
ab = next((x for x in srcs if x.get("id") == AB_SRC), None)
check("sources", s == 200 and ab is not None, json.dumps({k: ab.get(k) for k in ("id","name","type","enabled","baseUrl","rootPath","rootPaths","username")} if ab else d, ensure_ascii=False)[:400])
print("total sources:", len(srcs), [x.get("type") for x in srcs])

# 2) sources/status
s, d = req("GET", "/sources/status")
check("sources/status", s == 200, json.dumps(d, ensure_ascii=False)[:300])

# 3) sources/test for audiobook (uses stored config)
s, d = req("POST", "/sources/test", {"id": AB_SRC})
check("sources/test(ab)", s == 200, json.dumps(d, ensure_ascii=False)[:300])

# 4) audiobook-folders (root)
s, d = req("GET", "/sources/audiobook-folders")
check("audiobook-folders", s == 200, json.dumps(d, ensure_ascii=False)[:400])
folders = d.get("folders") or []
if isinstance(folders, list) and folders and isinstance(folders[0], str):
    folders = [{"path": f, "name": f.split("/")[-1]} for f in folders]
print("root folders:", len(folders), [f.get("name") or f.get("path") for f in folders[:10]])

# 5) browse root
s, d = req("GET", "/browse?sourceId=" + AB_SRC + "&path=&limit=100&offset=0")
check("browse root", s == 200, json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in (d.items() if isinstance(d, dict) else {})}, ensure_ascii=False)[:300])

# 6) browse into first folder (relative path, as frontend uses)
first_folder = None
if folders:
    first_folder = folders[1] if len(folders) > 1 else folders[0]
    fp = first_folder.get("path") or first_folder.get("id") or first_folder.get("name") or ""
    # audiobook-folders returns prefixed paths ("audiobook/xxx"); browse expects relative ("xxx")
    if fp.startswith("audiobook/"):
        fp = fp[len("audiobook/"):]
    s, d = req("GET", "/browse?sourceId=" + AB_SRC + "&path=" + urllib.parse.quote(fp) + "&limit=100&offset=0")
    nd = d if isinstance(d, dict) else {}
    check("browse folder '" + str(fp)[:30] + "'", s == 200, json.dumps({"dirs": len(nd.get("dirs") or []), "tracks": len(nd.get("tracks") or []), "total": nd.get("total")}, ensure_ascii=False)[:200])
    # pagination: second page
    s, d = req("GET", "/browse?sourceId=" + AB_SRC + "&path=" + urllib.parse.quote(fp) + "&limit=100&offset=100")
    nd = d if isinstance(d, dict) else {}
    check("browse folder page2", s == 200, json.dumps({"dirs": len(nd.get("dirs") or []), "tracks": len(nd.get("tracks") or []), "total": nd.get("total")}, ensure_ascii=False)[:200])

# 7) batch/tracks full folder list (audiobook play path)
s, d = req("POST", "/batch/tracks", {"sourceId": AB_SRC, "items": [{"kind": "folder", "id": fp, "path": fp}]})
lst = d.get("list") or []
check("batch/tracks folder", s == 200 and len(lst) > 0, "count=" + str(len(lst)) + " first=" + json.dumps(lst[0] if lst else None, ensure_ascii=False)[:200])

# 8) ensure-songs batch (first few tracks)
sample = lst[:3]
es_items = [{"sourceId": AB_SRC, "trackId": t.get("id"), "track": t} for t in sample]
s, d = req("POST", "/ensure-songs", {"tracks": es_items, "withCover": False, "withLyric": False})
res = d.get("results") or []
check("ensure-songs batch", s == 200 and all(r.get("songId") for r in res), json.dumps(res, ensure_ascii=False)[:300])

# 9) play-url
s, d = req("POST", "/play-url", {"sourceId": AB_SRC, "trackId": sample[0].get("id")})
check("play-url", s == 200, json.dumps(d, ensure_ascii=False)[:300])

# 10) lyric
if sample:
    s, d = req("GET", "/lyric?sourceId=" + AB_SRC + "&trackId=" + urllib.parse.quote(sample[0].get("id") or ""))
    check("lyric", s == 200, json.dumps(d, ensure_ascii=False)[:200])

# 11) cover-data
s, d = req("GET", "/cover-data?sourceId=" + AB_SRC + "&trackId=" + urllib.parse.quote(sample[0].get("id") or "") + "&coverId=" + urllib.parse.quote(sample[0].get("coverId") or ""))
check("cover-data", s == 200, json.dumps(d, ensure_ascii=False)[:200])

# 12) cover-img
s, d = req("GET", "/cover-img?sourceId=" + AB_SRC + "&coverId=" + urllib.parse.quote(sample[0].get("coverId") or ""))
check("cover-img", s == 200, str(d)[:120])

# 13) ui-state get
s, d = req("GET", "/ui-state")
check("ui-state get", s == 200, json.dumps(d, ensure_ascii=False)[:300])

# 14) ui-state post (roundtrip)
test_state = {"currentSourceId": AB_SRC, "view": "folders", "drill": None, "folderPath": fp, "search": "", "scrollTop": 42, "selectedKind": "track", "selected": [sample[0].get("id")] if sample else [], "playMode": "loop", "currentVolume": 0.5, "favoriteIds": []}
s, d = req("POST", "/ui-state", {"state": test_state})
check("ui-state post", s == 200, json.dumps(d, ensure_ascii=False)[:200])
s, d = req("GET", "/ui-state")
got = (d.get("state") or {}) if isinstance(d, dict) else {}
check("ui-state roundtrip", s == 200 and got.get("folderPath") == fp and got.get("scrollTop") == 42, json.dumps(got, ensure_ascii=False)[:300])

# 15) fuse GET/POST
s, d = req("GET", "/sources/fuse")
check("fuse get", s == 200, json.dumps(d, ensure_ascii=False)[:200])

# 16) local-opts
s, d = req("GET", "/sources/local-opts")
check("local-opts", s == 200, json.dumps(d, ensure_ascii=False)[:200])

# 17) search
s, d = req("GET", "/search?sourceId=" + AB_SRC + "&q=" + urllib.parse.quote((lst[0].get("title") or "")[:4]) + "&limit=10")
check("search", s == 200, json.dumps({k: len(v) if isinstance(v, list) else v for k, v in (d.items() if isinstance(d, dict) else {})}, ensure_ascii=False)[:200])

# 18) health
s, d = req("GET", "/health")
check("health", s == 200, json.dumps(d, ensure_ascii=False)[:150])

# 19) sources/export
s, d = req("GET", "/sources/export")
check("sources/export", s == 200, json.dumps(d, ensure_ascii=False)[:200])

# summary
fails = [r for r in results if not r[1]]
print("\n===== SUMMARY =====")
print("total:", len(results), "pass:", len(results) - len(fails), "fail:", len(fails))
for name, ok, detail in fails:
    print("  FAIL", name, "|", str(detail)[:250])
