import urllib.request, urllib.error, json, ssl

HOST = 'https://mimusic.035151.xyz:1024'
USER, PASS = 'pcyear', 'pcyear'
EP = 'multisource-music'
SID = 'src_msrjw9fyboc7'  # GEAK

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

# login
r = urllib.request.Request(HOST + '/api/v1/auth/login',
    data=json.dumps({'username': USER, 'password': PASS}).encode(),
    headers={'Content-Type': 'application/json'}, method='POST')
tok = json.loads(urllib.request.urlopen(r, timeout=60, context=CTX).read().decode())['access_token']
H = {'Authorization': 'Bearer ' + tok}

def get_stream(track_id, with_range=True):
    url = f'{HOST}/api/v1/jsplugin/{EP}/upstream-stream?sourceId={SID}&trackId={track_id}'
    h = dict(H)
    if with_range:
        h['Range'] = 'bytes=0-'
    req = urllib.request.Request(url, headers=h)
    try:
        resp = urllib.request.urlopen(req, timeout=60, context=CTX)
        st = resp.status
        hd = {k.lower(): v for k, v in resp.getheaders()}
        body = resp.read()
        return st, hd, len(body)
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, len(e.read())

print('=== 不带 Range（模拟宿主 fallback，应触发 256KB 初始窗口）===')
st, hd, n = get_stream(1, with_range=False)
print('status =', st)
print('content-range =', hd.get('content-range'))
print('content-length =', hd.get('content-length'))
print('accept-ranges  =', hd.get('accept-ranges'))
print('content-type   =', hd.get('content-type'))
print('body bytes     =', n, '(应≈262144 即 256KB 窗口，而非整首 6.9MB)')

print()
print('=== 带 Range: bytes=0-（宿主首段请求）===')
st, hd, n = get_stream(1, with_range=True)
print('status =', st)
print('content-range =', hd.get('content-range'))
print('content-length =', hd.get('content-length'))
print('body bytes     =', n)
