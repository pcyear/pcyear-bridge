import urllib.request, urllib.parse, json, os, sys

HOST = 'http://192.168.31.61:58091'
USER = 'pcyear'
PASS = 'pcyear'
TOKEN = None
ZIP = 'dist/multisource-music.jsplugin.zip'
BASE = '/api/v1/jsplugin/multisource-music'

def req(p, data=None, method=None, raw=False, headers=None, files=None):
    global TOKEN
    url = HOST + p
    h = dict(headers or {})
    if TOKEN:
        h['Authorization'] = 'Bearer ' + TOKEN
    body = None
    if files:
        boundary = '----bnd' + str(os.getpid())
        h['Content-Type'] = 'multipart/form-data; boundary=' + boundary
        parts = []
        for name, fn, ct, content in files:
            parts.append(('--' + boundary).encode())
            parts.append(('Content-Disposition: form-data; name="%s"; filename="%s"' % (name, fn)).encode())
            parts.append(('Content-Type: %s' % ct).encode())
            parts.append(b'')
            parts.append(content if isinstance(content, bytes) else content.encode())
        parts.append(('--' + boundary + '--').encode())
        parts.append(b'')
        body = b'\r\n'.join(parts)
    elif data is not None:
        body = json.dumps(data, ensure_ascii=False).encode()
        h['Content-Type'] = 'application/json'
    r = urllib.request.Request(url, data=body, headers=h,
                               method=method or ('POST' if body else 'GET'))
    try:
        with urllib.request.urlopen(r, timeout=90) as resp:
            return resp.status, (resp.read() if raw else resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

print('== login ==')
s, b = req('/api/v1/auth/login', {'username': USER, 'password': PASS})
print(s, b[:160])
TOKEN = json.loads(b)['access_token']

# 部署前先拿真实音源，避免硬编码 ID 失效
print('== current sources ==')
s, b = req(BASE + '/sources')
sources = []
try:
    sources = json.loads(b).get('data', [])
except Exception as e:
    print('parse err', e)
print('sources:', [(c.get('id'), c.get('type'), c.get('name')) for c in sources])

def first_of_type(t):
    for c in sources:
        if c.get('type') == t:
            return c.get('id')
    return None

print('== upload ==')
with open(ZIP, 'rb') as f:
    content = f.read()
s, upload_b = req('/api/v1/jsplugins/upload',
           files=[('file', 'multisource-music.jsplugin.zip', 'application/zip', content)])
print(s, upload_b[:300])

print('== find plugin id ==')
# 优先用上传响应里的 plugin.id（最可靠，宿主直接回传）
pid = None
try:
    upj = json.loads(upload_b)
    results = upj.get('results', []) if isinstance(upj, dict) else []
    for r in results:
        pl = r.get('plugin') if isinstance(r, dict) else None
        if pl and (pl.get('entryPath') or pl.get('entry_path')) == 'multisource-music':
            pid = pl.get('id')
            break
except Exception as e:
    print('upload-resp parse err', e)
# 兜底：扫 GET /api/v1/jsplugins（兼容 data 为列表或对象两种返回）
if pid is None:
    try:
        s, b = req('/api/v1/jsplugins')
        j = json.loads(b)
        arr = j.get('data', j) if isinstance(j, dict) else j
        if isinstance(arr, dict):
            arr = list(arr.values())
        for pl in arr:
            if isinstance(pl, dict) and (pl.get('entryPath') or pl.get('entry_path')) == 'multisource-music':
                pid = pl.get('id')
                break
    except Exception as e:
        print('list parse err', e)
print('plugin id =', pid)
if pid is None:
    # 宁可跳过，也绝不盲 reload 一个可能属于别的插件的固定 id
    print('!! 未能确定插件 id，跳过热重载（避免误伤其他插件）')
else:
    # 热重载：先禁用再启用，让宿主加载新上传的包（必须在 probe 之前）
    req('/api/v1/jsplugins/%s/disable' % pid, method='POST')
    req('/api/v1/jsplugins/%s/enable' % pid, method='POST')
    print('reloaded plugin', pid)

def probe(name, path, data=None, method='POST'):
    s, b = req(BASE + path, data=data, method=method)
    print('--- %s (%d) ---' % (name, s))
    print(b[:500])
    print()
    return b

# 取一个真实曲目（优先 fnMusic，其次任意）做 play-url / cover-data 验证
def sample_track(sid):
    s, b = req(BASE + '/tracks?sourceId=%s&limit=5' % urllib.parse.quote(sid))
    try:
        j = json.loads(b)
        for t in j.get('list', []):
            return t
    except Exception:
        pass
    return None

webdav_id = first_of_type('webdav')
fn_id = first_of_type('fnMusic')
sub_id = first_of_type('subsonic')

if fn_id:
    t = sample_track(fn_id)
    if t:
        print('== play-url (fnMusic host) ==')
        probe('fnmusic-play', '/play-url',
              {'sourceId': fn_id, 'trackId': t['id'],
               'track': {'title': t.get('title'), 'artist': t.get('artist'), 'coverId': t.get('coverId')}})
        if t.get('coverId'):
            print('== cover-data (fnMusic) ==')
            probe('fnmusic-cover',
                  '/cover-data?sourceId=%s&coverId=%s' % (urllib.parse.quote(fn_id), urllib.parse.quote(t['coverId'])),
                  method='GET')
        # 播放器桥接：把曲目解析为宿主 songId（会真实入库一首，验证宿主播放器后续可播）
        print('== ensure-songs (fnMusic -> songId) ==')
        eb = probe('fnmusic-ensure', '/ensure-songs',
                   {'sourceId': fn_id, 'trackId': t['id'],
                    'track': {'id': t['id'], 'title': t.get('title'), 'artist': t.get('artist'),
                              'album': t.get('album'), 'coverId': t.get('coverId'), 'duration': t.get('duration')}})
        try:
            ej = json.loads(eb)
            print('ensure-songs songIds =', ej.get('songIds'), '| ok =', ej.get('ok'))
        except Exception:
            pass
    else:
        print('fnMusic 没有曲目可测')

if webdav_id:
    t = sample_track(webdav_id)
    if t:
        print('== play-url (webdav direct) ==')
        probe('webdav-play', '/play-url',
              {'sourceId': webdav_id, 'trackId': t['id'],
               'track': {'title': t.get('title'), 'artist': t.get('artist')}})
        if t.get('coverId'):
            print('== cover-data (webdav dir) ==')
            probe('webdav-cover',
                  '/cover-data?sourceId=%s&coverId=%s' % (urllib.parse.quote(webdav_id), urllib.parse.quote(t['coverId'])),
                  method='GET')

if sub_id:
    t = sample_track(sub_id)
    if t:
        print('== play-url (subsonic direct) ==')
        probe('subsonic-play', '/play-url',
              {'sourceId': sub_id, 'trackId': t['id'],
               'track': {'title': t.get('title'), 'artist': t.get('artist')}})

print('DONE')
