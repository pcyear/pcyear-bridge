#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""【思路已废弃，仅供诊断】统计/清理被回环地址污染的 source_cover_url。

实测结论（2026-08-06）：宿主对 REST PUT 写入的「自引用地址」（localhost/LAN IP/公网域名）
一律归一化为相对路径 /api/v1/songs/{id}/cover → fetch 失败 404；而插件经 SDK（ensure-songs）
写入不归一化。因此正确的恢复方式是「重新 ensure / 播放」而非本脚本改 URL：
  - 当前仍启用的源（如飞牛）的歌：调 /ensure-songs（track 带 coverId）→ 插件用正确基址重写
    source_cover_url → 宿主 /songs/{id}/cover 恢复 200。
  - 失效源的歌（源已删、cover 缓存已清）：封面不可恢复，404 属实。

用法：
  python batch_fix_cover_url.py remote [--apply]   # 统计/清理（效果有限，仅供诊断）
"""
import urllib.request, urllib.parse, json, sys, ssl

# 凭据一律从环境变量读取（脚本不内置任何真实地址/账号）：
#   local  : LOCAL_HOST / LOCAL_USER / LOCAL_PASS
#   remote : REMOTE_HOST / REMOTE_USER / REMOTE_PASS
ENV_KEYS = {
    'local':  ('LOCAL_HOST', 'LOCAL_USER', 'LOCAL_PASS'),
    'remote': ('REMOTE_HOST', 'REMOTE_USER', 'REMOTE_PASS'),
}

# 命中条件：被回环/错误地址污染（localhost/127.0.0.1/0.0.0.0），或已是被本脚本上一轮改写成
# 的「相对自引用」路径 /api/v1/songs/{id}/cover（宿主取该路径会 404 且不走 cover-search 兜底）。
# 只动插件自身域的 cover-img 路径，不动其它正常外链封面（如 bili/lxmusic 自己的 https 封面）。
INTERNAL_RE = ('localhost', '127.0.0.1', '0.0.0.0', '[::1]')

TOKEN = None
def req(HOST, p, data=None, method=None, CTX=None):
    global TOKEN
    url = HOST + p; h = {}
    if TOKEN: h['Authorization'] = 'Bearer ' + TOKEN
    body = None
    if data is not None:
        body = json.dumps(data, ensure_ascii=False).encode(); h['Content-Type']='application/json'
    r = urllib.request.Request(url, data=body, headers=h, method=method or ('POST' if body else 'GET'))
    try:
        with urllib.request.urlopen(r, timeout=120, context=CTX) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]
    except Exception as e:
        return -1, repr(e)[:300]

def is_polluted(url):
    if not isinstance(url, str) or not url: return False
    if any(tok in url for tok in INTERNAL_RE): return True
    if url.startswith('/api/v1/songs/'): return True   # 相对自引用（宿主 404 且不兜底）
    return False

def main():
    args = sys.argv[1:]
    if not args: print('usage: batch_fix_cover_url.py [local|remote] [--apply] [--limit N]'); sys.exit(1)
    which = args[0]
    apply = '--apply' in args
    limit = None
    if '--limit' in args:
        i = args.index('--limit'); limit = int(args[i+1])
    ks = ENV_KEYS[which]
    vals = [os.environ.get(k) for k in ks]
    if not all(vals):
        print('!! 缺少环境变量：' + ', '.join(k for k, v in zip(ks, vals) if not v))
        print('   示例：LOCAL_HOST=http://<宿主>:<端口> LOCAL_USER=<账号> LOCAL_PASS=<密码>')
        sys.exit(1)
    HOST, USER, PASS = vals
    IS_HTTPS = (which == 'remote')
    CTX = ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE

    global TOKEN; TOKEN=None
    s, b = req(HOST, '/api/v1/auth/login', {'username':USER,'password':PASS}, CTX=CTX)
    if s != 200: print('LOGIN FAIL', s, b[:120]); sys.exit(1)
    TOKEN = json.loads(b)['access_token']

    plan = []          # 被污染、待修复
    clean = 0          # 正常
    offset = 0
    while True:
        s, b = req(HOST, '/api/v1/songs?limit=500&offset=%d' % offset, method='GET', CTX=CTX)
        if s != 200: print('list err', s, b[:200]); break
        j = json.loads(b)
        rows = j.get('list') or j.get('songs') or j.get('data') or (j if isinstance(j,list) else [])
        if isinstance(rows, dict): rows = list(rows.values())
        if not rows: break
        for sg in rows:
            url = sg.get('source_cover_url')
            if is_polluted(url):
                plan.append(sg)
            else:
                clean += 1
        if len(rows) < 500: break
        offset += 500
        if limit and len(plan) >= limit: break

    print('=== 被污染（source_cover_url 含回环地址）: %d 首；正常: %d 首 ===' % (len(plan), clean))
    for sg in plan[:30]:
        print('  id=%s title=%r url=%s' % (sg.get('id'), sg.get('title'), (sg.get('source_cover_url') or '')[:120]))

    if not apply:
        print('\n[DRY-RUN] 未做任何改动。加 --apply 才真正改写。')
        return

    ok = fail = 0
    for sg in plan:
        if limit and ok >= limit: break
        sid = sg.get('id')
        s, b = req(HOST, '/api/v1/songs/%s' % sid, method='GET', CTX=CTX)
        if s != 200:
            fail += 1; print('  ✗ GET 失败 id=%s (%d) %s' % (sid, s, b[:120])); continue
        obj = json.loads(b)
        # 清空 source_cover_url：让宿主在缺封面时直接走已注册的封面提供者（插件 /cover-search
        # 按 艺术家+专辑+标题 在已启用音源里搜），相对自引用路径反而会让宿主 404 且不兜底。
        obj['source_cover_url'] = ''
        s, b = req(HOST, '/api/v1/songs/%s' % sid, data=obj, method='PUT', CTX=CTX)
        if s in (200, 201, 204):
            ok += 1
            print('  ✓ 修复 id=%s title=%r' % (sid, sg.get('title')))
        else:
            fail += 1
            print('  ✗ PUT 失败 id=%s (%d) %s' % (sid, s, b[:120]))
    print('\n[APPLY] 成功 %d，失败 %d' % (ok, fail))

if __name__ == '__main__':
    main()
