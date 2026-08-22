const TYPE_META = {
    fnMusic: { icon: "\u{1F3B5}", color: "#ff7a45", desc: "\u98DE\u725B NAS \u5B98\u65B9\u97F3\u4E50\u670D\u52A1" },
    subsonic: { icon: "\u{1F3A7}", color: "#7c4dff", desc: "Navidrome / Jellyfin / Airsonic" },
    geak: { icon: "\u{1F5A5}", color: "#00bfa5", desc: "GEAK / yomtime NAS" },
    webdav: { icon: "\u{1F4C1}", color: "#448aff", desc: "WebDAV / \u575A\u679C\u4E91 / NAS" },
    daoliyu: { icon: "\u{1F41F}", color: "#26a69a", desc: "Daoliyu Music \u4E2A\u4EBA\u97F3\u4E50\u670D\u52A1" }
};
const DEBUG_KEY = "mm:debug";

function isDebugOn() {
    try {
        return localStorage.getItem(DEBUG_KEY) === "1" || localStorage.getItem("mm:swipeDebug") === "1"
    } catch {
        return !1
    }
}

function setDebugOn(t) {
    try {
        localStorage.setItem(DEBUG_KEY, t ? "1" : "0"), localStorage.removeItem("mm:swipeDebug")
    } catch {}
}(function() {
    const e = {};
    ["log", "warn", "info", "debug"].forEach(n => {
        typeof console[n] == "function" && (e[n] = console[n].bind(console), console[n] = function() {
            isDebugOn() && e[n].apply(console, arguments)
        })
    }), window.__rawConsole = e
})();
const TYPE_LABELS = {
        fnMusic: "\u98DE\u725B\u97F3\u4E50",
        subsonic: "Subsonic",
        webdav: "WebDAV",
        songloft: "SongLoft \u672C\u5730\u5E93",
        geak: "GEAK NAS",
        daoliyu: "\u9053\u7406\u9C7C"
    },
    SONGLOFT_SOURCE_ID = "src_msm_songloft",
    ICONS = {
        prev: '<svg class="ico" viewBox="0 0 24 24"><polygon points="19 20 9 12 19 4 19 20" fill="none"/><line x1="5" y1="19" x2="5" y2="5"/></svg>',
        next: '<svg class="ico" viewBox="0 0 24 24"><polygon points="5 4 15 12 5 20 5 4" fill="none"/><line x1="19" y1="5" x2="19" y2="19"/></svg>',
        play: '<svg class="ico fill" viewBox="0 0 24 24"><polygon points="7 5 20 12 7 19 7 5"/></svg>',
        pause: '<svg class="ico fill" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
        back10: '<svg class="ico" viewBox="0 0 24 24"><line x1="20" y1="12" x2="7" y2="12"/><polyline points="13 6 7 12 13 18"/><text x="3.5" y="21" font-size="8" text-anchor="middle" fill="currentColor" stroke="none">10</text></svg>',
        fwd10: '<svg class="ico" viewBox="0 0 24 24"><line x1="4" y1="12" x2="17" y2="12"/><polyline points="11 6 17 12 11 18"/><text x="20.5" y="21" font-size="8" text-anchor="middle" fill="currentColor" stroke="none">10</text></svg>',
        order: '<svg class="ico" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
        loop: '<svg class="ico" viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
        random: '<svg class="ico" viewBox="0 0 24 24"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
        repeat: '<svg class="ico" viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="12" y="14" font-size="8" text-anchor="middle" fill="currentColor" stroke="none">1</text></svg>',
        singlePlay: '<svg class="ico" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="none"/><text x="12" y="16" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">1</text></svg>',
        heart: '<svg class="ico" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
        heartFill: '<svg class="ico fill" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
        vol: '<svg class="ico" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
        volMute: '<svg class="ico" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>',
        list: '<svg class="ico" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
        rate: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 1 9 9"/><path d="M12 3a9 9 0 0 0-8.5 12.7"/><circle cx="12" cy="12" r="2.2"/><line x1="12" y1="12" x2="16.5" y2="7.5"/></svg>',
        lyric: '<svg class="ico" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="3"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="13" y2="13"/><circle cx="16" cy="16.5" r="2"/><path d="M16 14.5V11l2.5-.8v3.1"/></svg>',
        refresh: '<svg class="ico" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>'
    };

function setIcon(t, e) {
    t && (t.innerHTML = ICONS[e] || "")
}

function refreshAllIcons() {
    setIcon($("prevBtn"), "prev"), setIcon($("nextBtn"), "next"), setIcon($("back10Btn"), "back10"), setIcon($("fwd10Btn"), "fwd10"), setIcon($("listBtn"), "list"), setIcon($("listBtn2"), "list");
    const t = (e, n) => {
        const s = $(e);
        s && (s.textContent = n)
    };
    t("rateHomeBtn", "\u500D"), t("lyricHomeBtn", "\u8BCD"), t("npRateBtn", "\u500D"), setIcon($("npPrevBtn"), "prev"), setIcon($("npBack10Btn"), "back10"), setIcon($("npNextBtn"), "next"), setIcon($("npFwd10Btn"), "fwd10"), setIcon($("npVolBtn"), "vol"), setIcon($("npListBtn"), "list");
    // 初始状态兜底：页面刚刷新、宿主状态尚未回弹时，播放按钮也应有正确图标（三角形），避免空白。
    const p = $("playBtn");
    p && !p.innerHTML && setIcon(p, playerState.playing ? "pause" : "play")
}
let sources = [],
    currentSourceId = null,
    view = "folders",
    drill = null,
    songMode = "folders",
    viewToken = 0,
    forceRefresh = !1,
    searchActive = !1,
    currentList = [];
const memCache = {};
let editingId = null,
    dirSelected = [],
    dirCurrent = "",
    lastDirList = [],
    dirCountCache = {},
    curTrack = null,
    selected = new Set,
    selectedKind = "track",
    focusedTrackId = null,
    pendingImport = null,
    songloftPlaylists = [],
    uiStateRestored = !1,
    saveStateTimer = null,
    restoreFolderPending = !1,
    abRestoreTrack = null,
    pendingNpRestore = null;
const PLUGIN_BASE = window.location.pathname.replace(/\/index\.html(\?.*)?$/, "").replace(/\/+$/, "") || "/api/v1/jsplugin/multisource-music",
    DEFAULT_COVER = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2048%2048'%3E%3Crect%20width='48'%20height='48'%20rx='8'%20fill='%2324242c'/%3E%3Ctext%20x='50%25'%20y='55%25'%20dominant-baseline='middle'%20text-anchor='middle'%20font-size='28'%20fill='%239a9aa5'%3E%E2%99%AA%3C/text%3E%3C/svg%3E",
    $ = t => document.getElementById(t),
    coverCache = new Map,
    localStore = {
        get(t) {
            try {
                const e = localStorage.getItem("mm:" + t);
                return e == null ? void 0 : JSON.parse(e)
            } catch {
                return
            }
        },
        set(t, e) {
            try {
                localStorage.setItem("mm:" + t, JSON.stringify(e))
            } catch {}
        },
        del(t) {
            try {
                localStorage.removeItem("mm:" + t)
            } catch {}
        },
        clearPrefix(t) {
            try {
                const e = [];
                for (let n = 0; n < localStorage.length; n++) {
                    const s = localStorage.key(n);
                    s && s.indexOf("mm:" + t) === 0 && e.push(s)
                }
                e.forEach(n => localStorage.removeItem(n))
            } catch {}
        }
    };

function setListLoading(t) {}
async function getBackendCache(t) {
    try {
        const e = await api(`${PLUGIN_BASE}/cache?key=${encodeURIComponent(t)}`);
        return e.ok && e.data ? e.data : null
    } catch {
        return null
    }
}

function putBackendCache(t, e) {
    api(`${PLUGIN_BASE}/cache`, "POST", {
        key: t,
        value: e
    }).catch(() => {})
}

function coverGet(t) {
    if (coverCache.has(t)) return coverCache.get(t);
    const e = localStore.get("cover:" + t);
    if (e !== void 0) return coverCache.set(t, e), e
}

function coverSet(t, e) {
    coverCache.set(t, e), localStore.set("cover:" + t, e)
}

function coverDel(t) {
    coverCache.delete(t), localStore.del("cover:" + t)
}

// 诊断：列出 localStorage 全部 key 及值前若干字符，用于定位客户端实际注入的 token
function dumpLocalStorage() {
    try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            let v = "";
            try { v = (localStorage.getItem(k) || "").slice(0, 24) } catch (e) { v = "<err>" }
            keys.push(k + "=" + v)
        }
        return keys.join("\n")
    } catch (e) {
        return "dump err: " + e
    }
}

function getAccessToken() {
    // 优先读取宿主注入的 songloft-auth（与宿主 common.js 保持一致）
    try {
        const raw = localStorage.getItem("songloft-auth");
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.accessToken === "string" && parsed.accessToken) {
                return parsed.accessToken
            }
        }
    } catch {}
    // 宿主兜底：客户端注入的 songloft-auth 失效/损坏时，回退用宿主永久有效的 pluginToken
    try {
        const pt = localStorage.getItem("songloft-plugin-token");
        if (pt) return pt
    } catch {}
    try {
        const t = new URLSearchParams(window.location.search).get("access_token");
        if (t) return t
    } catch {}
    try {
        const t = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("access_token");
        if (t) return t
    } catch {}
    try {
        return localStorage.getItem("access_token") || localStorage.getItem("songloft_access_token") || localStorage.getItem("token") || ""
    } catch {}
    try {
        return sessionStorage.getItem("access_token") || sessionStorage.getItem("token") || ""
    } catch {}
    // 通用兜底：扫描 localStorage 全部值，自动选用看起来是合法 JWT（eyJ 开头）的 token。
    // 容忍客户端把有效 token 放在任意 key（songloft-auth 失效/损坏时仍能自愈）。
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            let v = localStorage.getItem(k) || "";
            // 可能是 JSON 包裹：{"accessToken":"eyJ..."} 或 {"token":"eyJ..."}
            if (v.indexOf("eyJ") >= 0) {
                try {
                    const o = JSON.parse(v);
                    for (const kk of ["accessToken", "token", "access_token", "jwt", "authToken"]) {
                        if (typeof o[kk] === "string" && o[kk].indexOf("eyJ") === 0) return o[kk]
                    }
                } catch (_) {}
                const m = v.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
                if (m) return m[0]
            }
        }
    } catch {}
    return ""
}

function authHeaders() {
    const t = {
            "Content-Type": "application/json"
        },
        e = getAccessToken();
    return e && (t.Authorization = "Bearer " + e), t
}

function sdkPathOf(t) {
    let e = String(t || "");
    try {
        if (/^https?:\/\//i.test(e)) {
            const n = new URL(e);
            e = n.pathname + (n.search || "")
        }
        e = e.replace(/^\/api\/v1\/jsplugin\/[^/]+\/?/, "/"), e.startsWith("/") || (e = "/" + e)
    } catch {}
    return e
}

function illegalAccess() {
    try {
        if (document.body && document.body.dataset.locked === "1") return
    } catch {}
    try {
        document.body.dataset.locked = "1"
    } catch {}
    try {
        try {
            typeof _kbOpen < "u" && (_kbOpen = !0)
        } catch {}
        try {
            window.SongloftPlugin && window.SongloftPlugin.player && typeof window.SongloftPlugin.player.pause == "function" && window.SongloftPlugin.player.pause()
        } catch {}
    } catch {}
    try {
        document.title = "\u26A0 \u975E\u6CD5\u8BBF\u95EE"
    } catch {}
    const t = document.createElement("div");
    t.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0a0a;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center;padding:40px;', t.innerHTML = '<div style="font-size:96px;color:#ff3b30;line-height:1;margin-bottom:24px;letter-spacing:6px">\u26A0</div><div style="font-size:30px;font-weight:800;letter-spacing:10px;color:#ff3b30;margin-bottom:18px">\u975E \u6CD5 \u8BBF \u95EE</div><div style="font-size:15px;color:#a0a0a0;margin-bottom:28px;max-width:480px;line-height:1.9">\u60A8\u7684\u8BBF\u95EE\u8BF7\u6C42\u672A\u901A\u8FC7\u5BBF\u4E3B\u6388\u6743\u6821\u9A8C\uFF08HTTP 401\uFF09\u3002<br/>\u672C\u63D2\u4EF6\u62D2\u7EDD\u5411\u672A\u7ECF\u6388\u6743\u7684\u4F1A\u8BDD\u63D0\u4F9B\u4EFB\u4F55\u670D\u52A1\u3002</div><div style="display:inline-block;padding:8px 16px;border:1px solid #333;border-radius:6px;font-family:Menlo,Consolas,monospace;font-size:12px;color:#777;letter-spacing:2px">UNAUTHORIZED \xB7 HTTP 401</div>';
    try {
        document.body.innerHTML = ""
    } catch {}
    try {
        document.body.appendChild(t)
    } catch {}
}

function api(t, e = "GET", n, s = 2e4, o) {
    return queueRequest(() => _apiDo(t, e, n, s), o)
}

function _apiDo(t, e = "GET", n, s = 2e4) {
    const o = r => {
            if (r) {
                const l = r.status || r.code || 0,
                    c = String(r.message || r.error || r.msg || r.detail || "");
                (l === 401 || l === 403) && illegalAccess()
            }
            return r
        },
        i = window.SongloftPlugin;
    if (i && typeof(e === "GET" ? i.apiGet : i.apiPost) == "function") {
        let r = sdkPathOf(t),
            l;
        try {
            l = e === "GET" ? i.apiGet(r) : i.apiPost(r, n !== void 0 ? n : {})
        } catch (c) {
            return Promise.resolve(o({
                ok: !1,
                status: 0,
                message: c && c.message || "SDK \u8C03\u7528\u5931\u8D25"
            }))
        }
        return new Promise((c, d) => {
            const u = setTimeout(() => {
                clearTimeout(u), d(new Error("\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5"))
            }, s);
            Promise.resolve(l).then(f => {
                clearTimeout(u), f == null ? c(o({
                    ok: !1,
                    status: 0,
                    message: "\u8BF7\u6C42\u5931\u8D25"
                })) : c(o({
                    ok: f.ok !== void 0 ? f.ok : !0,
                    status: typeof f.status == "number" ? f.status : 200,
                    ...f
                }))
            }, f => {
                clearTimeout(u), c(o({
                    ok: !1,
                    status: 0,
                    message: f && f.message || "\u8BF7\u6C42\u5931\u8D25"
                }))
            })
        })
    }
    const a = {
        method: e,
        headers: authHeaders()
    };
    return n !== void 0 && (a.body = JSON.stringify(n)), new Promise((r, l) => {
        const c = setTimeout(() => l(new Error("\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5")), s);
        fetch(t, a).then(async d => {
            clearTimeout(c);
            const u = await d.text();
            let f = {};
            try {
                f = JSON.parse(u)
            } catch {
                f = {
                    message: u || "HTTP " + d.status
                }
            }
            r(o({
                ok: d.ok,
                status: d.status,
                ...f
            }))
        }, d => {
            clearTimeout(c), l(d)
        })
    })
}
async function probeAuth() {
    try {
        const t = await api(PLUGIN_BASE + "/ui-state");
        if (t == null || t.ok === !1 && !t.error && !t.message && !t.msg && !t.detail) try {
            const n = await fetch(PLUGIN_BASE + "/ui-state");
            if (n.status === 401 || n.status === 403) {
                illegalAccess();
                return
            }
        } catch {}
    } catch {}
}

function fmt(t) {
    if (!t) return "0:00";
    const e = Math.floor(Number(t));
    return Math.floor(e / 60) + ":" + String(e % 60).padStart(2, "0")
}

function fmtSize(b) {
    if (!b || b <= 0) return "";
    if (b >= 1073741824) return (b / 1073741824).toFixed(1) + "GB";
    if (b >= 1048576) return (b / 1048576).toFixed(1) + "MB";
    if (b >= 1024) return Math.round(b / 1024) + "KB";
    return b + "B"
}

function toast(t, d) {
    const e = $("toast");
    e.textContent = t, e.classList.add("show"), setTimeout(() => e.classList.remove("show"), d || 1800)
}
let _lazyToastN = 0,
    _lazyToastTimer = null;

function toastLoading(t) {
    if (t) {
        _lazyToastN++, _lazyToastN === 1 && showTopLoading()
    } else {
        _lazyToastN = Math.max(0, _lazyToastN - 1), 0 === _lazyToastN && hideTopLoading()
    }
}

function showTopLoading() {
    const e = $("topLoading"),
        c = $("content");
    if (!e || !c) return;
    const r = c.getBoundingClientRect();
    e.style.top = (r.top + 4) + "px", e.classList.add("show"), clearTimeout(_lazyToastTimer), _lazyToastTimer = setTimeout(() => hideTopLoading(), 6e4)
}

function hideTopLoading() {
    const e = $("topLoading");
    e && e.classList.remove("show")
}
const _coverInflight = new Map,
    _coverFailCache = new Map;

function coverDataByUrl(t, e) {
    const n = e || t;
    if (n && coverGet(n)) return Promise.resolve(coverGet(n));
    const s = _coverFailCache.get(n);
    if (s && Date.now() - s < 3e4) return Promise.resolve(null);
    if (_coverInflight.has(n)) return _coverInflight.get(n);
    const o = (async () => {
        try {
            const i = await api(t);
            return i && i.ok && i.dataUrl ? (n && coverSet(n, i.dataUrl), i.dataUrl) : (_coverFailCache.set(n, Date.now()), null)
        } catch {
            return _coverFailCache.set(n, Date.now()), null
        } finally {
            _coverInflight.delete(n)
        }
    })();
    return _coverInflight.set(n, o), o
}
async function hostCoverDataUrl(t) {
    return t ? coverDataByUrl(`${PLUGIN_BASE}/host-cover?url=${encodeURIComponent(t)}`, "host:" + t) : null
}

function srcCoverDataUrl(t) {
    if (!t || !t.sourceId || !t.coverId) return null;
    const e = `${PLUGIN_BASE}/cover-data?sourceId=${encodeURIComponent(t.sourceId)}&coverId=${encodeURIComponent(t.coverId)}`;
    return coverDataByUrl(e, "host:" + e)
}
let _reqQueue = [],
    _reqActive = 0,
    _reqSeq = 0,
    _ctxTag = "v:tracks";
const _REQ_MAX = 3;

function _pumpReqs() {
    if (_reqActive >= _REQ_MAX) return;
    while (_reqActive < _REQ_MAX && _reqQueue.length) {
        const j = _reqQueue.shift();
        _reqActive++;
        j.fn().then(v => {
            _reqActive--;
            j.res(v);
            _pumpReqs()
        }, er => {
            _reqActive--;
            j.rej(er);
            _pumpReqs()
        })
    }
}

function queueRequest(fn, opts) {
    const tag = (opts && opts.tag) || _ctxTag,
        prio = opts && opts.prio || 0;
    return new Promise((res, rej) => {
        const task = {
            fn,
            res,
            rej,
            prio,
            tag,
            key: opts && opts.key || "",
            seq: ++_reqSeq
        };
        if (!_reqQueue.length) _reqQueue.push(task);
        else {
            const k = task.key;
            if (k) {
                for (let i = _reqQueue.length - 1; i >= 0; i--) {
                    if (_reqQueue[i].key === k) {
                        _reqQueue.splice(i, 1);
                        break
                    }
                }
            }
            let idx = 0;
            for (let i = _reqQueue.length - 1; i >= 0; i--) {
                if (_reqQueue[i].prio < task.prio) {
                    idx = i + 1;
                    break
                }
            }
            _reqQueue.splice(idx, 0, task)
        }
        _pumpReqs()
    })
}

function cancelRequests(pred) {
    for (let i = _reqQueue.length - 1; i >= 0; i--) {
        if (pred(_reqQueue[i])) {
            const t = _reqQueue.splice(i, 1)[0];
            try {
                t.rej({
                    cancelled: !0
                })
            } catch {}
        }
    }
}

function switchCtx(tag) {
    try {
        cancelRequests(t => t.tag && t.tag !== tag && (t.tag.indexOf("v:") === 0 || t.tag.indexOf("d:") === 0))
    } catch {}
    _ctxTag = tag
}

function _coverThrottle(fn, tag) {
    return queueRequest(fn, {
        prio: 2,
        tag: tag || _ctxTag
    })
}
async function _coverReq(t) {
    if (coverGet(t)) return coverGet(t);
    const f = _coverFailCache.get(t);
    if (f && Date.now() - f < 6e4) return null;
    if (_coverInflight.has(t)) return _coverInflight.get(t);
    const p = _coverThrottle(async () => {
        const r = await fetch(t, {
            headers: authHeaders()
        });
        return r.json()
    }, "c:" + t).then(j => {
        if (j && j.ok) {
            // /cover-data 返回：
            //  - dataUrl 字段：始终是可加载的真实值（data: 内联图 / http(s) 直链 / cover-img 代理）；
            //  - contentType 字段：data URI 场景下是 MIME 类型(如 image/jpeg)而非 URL，
            //    URL 场景下才是直链。故优先用 dataUrl；仅当 contentType 确为 http(s) 直链时才优先它。
            const _ct = j.contentType || "";
            const _use = _ct.indexOf("http") === 0 ? _ct : (j.dataUrl || "");
            const _d = (_use || "").trim();
            if (_d.indexOf("data:") === 0 || _d.indexOf("http") === 0) return coverSet(t, _d), _d
        }
        return _coverFailCache.set(t, Date.now()), null
    }).catch(e => {
        if (e && e.cancelled) return null;
        return _coverFailCache.set(t, Date.now()), null
    });
    return _coverInflight.set(t, p), p.finally(() => {
        _coverInflight.delete(t)
    })
}
async function coverDataUrl(t) {
    if (!t) return null;
    const e = currentSourceId;
    if (e === SONGLOFT_SOURCE_ID) return _coverReq(`${PLUGIN_BASE}/cover-data?songId=${encodeURIComponent(t)}`);
    return _coverReq(`${PLUGIN_BASE}/cover-data?sourceId=${encodeURIComponent(e)}&coverId=${encodeURIComponent(t)}`)
}

function coverImgUrl(t) {
    if (!t) return null;
    const e = currentSourceId;
    if (e === SONGLOFT_SOURCE_ID) return null;
    return `${PLUGIN_BASE}/cover-img?sourceId=${encodeURIComponent(e)}&coverId=${encodeURIComponent(t)}`
}
async function coverErrFix(t) {
    try {
        if (t && t.src !== DEFAULT_COVER) {
            t.onerror = null, t.src = DEFAULT_COVER, t.dataset.dc = "1";
            const s = t.src;
            coverCache.forEach((v, k) => {
                if (v === s) coverCache.delete(k)
            });
            Object.keys(localStorage || {}).forEach(k => {
                if (k.indexOf("cover:") === 0 && localStorage.getItem(k) === s) {
                    try {
                        localStorage.removeItem(k)
                    } catch (e) {}
                }
            })
        }
    } catch {}
}
// 安全显示封面：远程直链（宿主 /songs/{id}/cover 等）先离屏预加载验证，成功才换上可见 <img>；
// 失败（404 / 非图片体）保持占位图，避免 <img> 闪一下破图再 onerror 恢复。data: 直连则直接设。
// o 为加载成功后的回调（如封面色调提取），可选。
function safeShowCover(t, e, o) {
    if (!t) return;
    t.onerror = null;
    if (!e) { t.src = DEFAULT_COVER; t.dataset.dc = "1"; o && o(); return }
    if (e.indexOf("data:") === 0) { t.src = e; t.dataset.dc = "0"; o && o(); return }
    const n = new Image();
    n.onload = function () { try { t.onerror = null; t.src = e; t.dataset.dc = "0"; o && o() } catch (s) {} };
    n.onerror = function () { try { t.onerror = null; if (t.src !== DEFAULT_COVER) t.src = DEFAULT_COVER; t.dataset.dc = "1" } catch (s) {} };
    n.src = e
}
async function setCover(t, e, n) {
    if (!t) return;
    t.onerror = () => coverErrFix(t);
    if (!e) {
        t.src = DEFAULT_COVER, t.dataset.dc = "1";
        return
    }
    const s = await coverDataUrl(e);
    safeShowCover(t, s)
}

function makeCover(t, e) {
    const n = document.createElement("img");
    return n.className = t, n.alt = "", n.dataset.dc = "1", n.onerror = () => coverErrFix(n), n.src = DEFAULT_COVER, e && lazyCover(n, e), n
}
function wrapCover(t) {
    const n = document.createElement("div");
    n.className = "cov-wrap";
    n.appendChild(t);
    const eq = document.createElement("div");
    eq.className = "eq";
    for (let i = 0; i < 5; i++) eq.appendChild(document.createElement("i"));
    n.appendChild(eq);
    return n
}

function lazyCover(t, e) {
    if (!("IntersectionObserver" in window)) {
        setCover(t, e);
        return
    }
    const n = new IntersectionObserver(s => {
        for (const o of s) {
            if (o.isIntersecting) {
                n.disconnect(), setCover(t, e);
                return
            }
            cancelRequests(q => q.tag === "c:" + e)
        }
    }, {
        root: document.getElementById("content") || null,
        rootMargin: Math.round(listPreloadPx() * 0.5) + "px 0px"
    });
    n.observe(t)
}
async function loadSources() {
    let t = null;
    let authFailed = false;
    for (let _a = 0; _a < 3; _a++) {
        try {
            t = await api(PLUGIN_BASE + "/sources")
        } catch (_e) {
            t = null
        }
        if (t && (t.status === 401 || t.status === 403 ||
            /无效|缺少认证|unauthorized|invalid/i.test(String(t.message || "")))) {
            authFailed = true;
            break
        }
        if (t && t.data && t.data.length) break;
        await new Promise(r => setTimeout(r, 400))
    }
    if (!t || !t.data) t = {
        data: []
    };
    if (authFailed) {
        t = null
    }
    if (!t || !t.data) {
        let diag = "";
        try {
            diag += "SDK=" + (window.SongloftPlugin ? "yes" : "no")
        } catch (e) {}
        let dump = "";
        try {
            const lines = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                let v = "";
                try { v = localStorage.getItem(k) || "" } catch (e) { v = "<err>" }
                // 标出值里是否含 eyJ 开头的 JWT
                const hasJwt = /eyJ[A-Za-z0-9_-]{10,}/.test(v) ? " [JWT✓]" : "";
                lines.push((k + " = " + v.slice(0, 40) + hasJwt))
            }
            dump = lines.join("\n")
        } catch (e) {
            dump = "dump err: " + e
        }
        if (t && t.message) diag += " | msg=" + t.message;
        const box = document.createElement("div");
        box.className = "empty";
        box.style.cssText = "padding:24px;line-height:1.8";
        const title = document.createElement("div");
        title.textContent = "认证失败，无法加载音源。请把下面这段发我：";
        const pre = document.createElement("pre");
        pre.style.cssText = "white-space:pre-wrap;word-break:break-all;color:#999;font-size:11px;text-align:left;background:#f6f6f6;padding:10px;border-radius:6px;max-height:50vh;overflow:auto;margin-top:8px";
        pre.textContent = dump;
        box.appendChild(title);
        box.appendChild(pre);
        const c = $("content");
        if (c) c.innerHTML = "";
        if (c) c.appendChild(box);
        return
    }
    if (sources = (t.data || []).map(e => ({
            ...e,
            type: e.type
        })), renderSources(), currentSourceId = currentSourceId || (sources.find(e => e.type === "songloft") || sources.find(e => e.type === "local") || sources.find(e => e.enabled) || {}).id || null, !currentSourceId) {
        $("content").innerHTML = '<div class="empty">\u8BF7\u5148\u5728\u5DE6\u4FA7\u6DFB\u52A0\u4E00\u4E2A\u97F3\u6E90</div>';
        return
    }
    if (loadSourceStatuses().catch(() => {}), !uiStateRestored) try {
        await restoreUiState()
    } catch (e) {
        console.log("[state] restore failed", e)
    }
    if (!currentSourceId || !sources.find(s => s.id === currentSourceId)) {
        currentSourceId = (sources.find(s => s.type === "songloft") || sources.find(s => s.type === "local") || sources.find(s => s.enabled) || {}).id || null
    }
    renderSources();
    (!uiStateRestored || !drill && currentList.length === 0 && view !== "folders") && (drill ? await loadDrill() : await loadView(view));
    checkPluginUpdate()
}

function cmpVer(a, b) {
    const p = String(a || "0").split(".").map(x => parseInt(x, 10) || 0),
        q = String(b || "0").split(".").map(x => parseInt(x, 10) || 0);
    for (let i = 0; i < Math.max(p.length, q.length); i++) {
        const x = p[i] || 0,
            y = q[i] || 0;
        if (x !== y) return x > y ? 1 : -1
    }
    return 0
}
let _updVer = null,
    _updUrl = null,
    _updBeta = !1;

function renderUpdateTip() {
    const v = $("updVer");
    if (!v) return;
    v.textContent = "v" + _updVer;
    const t = $("updBetaTip");
    t && (t.textContent = _updBeta ? "测试版通道（调试模式检测）" : "");
    const vl = $("verLine");
    if (vl) {
        vl.textContent = "v" + PLUGIN_VERSION + "（有新版本）";
        vl.classList.add("ver-upd")
    }
    const m = $("updateModal");
    m && m.classList.add("show")
}

function closeUpdateModal() {
    const m = $("updateModal");
    m && m.classList.remove("show")
}

function updSkip() {
    try {
        localStore.set("mm:update_ignore_ver", _updVer)
    } catch {};
    closeUpdateModal()
}
async function checkPluginUpdate() {
    try {
        const beta = isDebugOn();
        const r = await api(PLUGIN_BASE + "/update-check?beta=" + (beta ? 1 : 0), "GET", void 0, 8e3);
        if (!r || !r.ok || !r.hasUpdate) return;
        let ig = "";
        try {
            ig = localStore.get("mm:update_ignore_ver") || ""
        } catch {}
        if (ig && cmpVer(r.latest, ig) <= 0) return;
        _updVer = r.latest;
        _updUrl = r.downloadUrl || "";
        _updBeta = !!r.beta;
        renderUpdateTip()
    } catch {}
}

function showSrcErrorDialog(t) {
    if (t) {
        try {
            $("srcErrName").textContent = "\u97F3\u6E90\u300C" + t.name + "\u300D\u8FDE\u63A5\u5931\u8D25"
        } catch {}
        try {
            $("srcErrMsg").textContent = t._status && t._status.message || "\u672A\u77E5\u9519\u8BEF"
        } catch {}
        try {
            $("srcErrModal").classList.add("show")
        } catch {}
    }
}

function closeSrcErr() {
    try {
        $("srcErrModal").classList.remove("show")
    } catch {}
}
let _srcTestBusy = !1,
    _srcSeqTesting = !1;
async function probeUntestedSources() {
    if (!(_srcSeqTesting || !sources || !sources.length)) {
        _srcSeqTesting = !0;
        try {
            for (const t of sources)
                if (!(t._status && t._status.ok !== void 0)) {
                    if (t.id === currentSourceId) {
                        t._status = {
                            ok: !0,
                            kind: "ok",
                            message: "\u5F53\u524D\u6E90",
                            ts: Date.now()
                        };
                        continue
                    }
                    if (!t._testing) {
                        t._testing = !0, renderSources();
                        try {
                            const e = await api(PLUGIN_BASE + "/sources/test", "POST", {
                                id: t.id
                            }, 15e3);
                            t._status = {
                                ok: !!e.ok,
                                kind: e.kind || (e.ok ? "ok" : "auth"),
                                message: e.message || "",
                                ts: Date.now()
                            }
                        } catch (e) {
                            t._status = {
                                ok: !1,
                                kind: "network",
                                message: e && e.message || "\u8FDE\u63A5\u6D4B\u8BD5\u5931\u8D25",
                                ts: Date.now()
                            }
                        } finally {
                            t._testing = !1
                        }
                        renderSources()
                    }
                }
        } finally {
            _srcSeqTesting = !1
        }
    }
}
async function loadSourceStatuses() {
    const t = await api(PLUGIN_BASE + "/sources/status");
    if (!t || !t.ok || !t.statuses) return [];
    const e = [];
    return sources.forEach(n => {
        const s = t.statuses[n.id];
        if (!s) {
            n._status = null;
            return
        }
        n._status = s, s.ok || e.push(n)
    }), renderSources(), e
}
async function resetPlayerForSourceSwitch(prevSrc) {
    curTrack = null;
    pendingTarget = null;
    if (!isAudiobook()) {
        abFolderList = [];
        abFolderPath = ""
    }
    folderPath = "";
    // 按音源持久化抽屉队列：离开旧源时落盘，进入新源时清空并导入新源之前落盘的队列。
    try {
        queueRestoreGuard = !0;
        saveSourceQueue(prevSrc, playerState.queue);
        await swapQueueForSource(currentSourceId, prevSrc, !0);
        setTimeout(() => {
            queueRestoreGuard = !1
        }, 1200)
    } catch (_) {
        queueRestoreGuard = !1
    }
}

function renderSources() {
    const t = $("srcList");
    if (t.innerHTML = "", !sources.length) t.innerHTML = '<div class="empty" style="padding:20px">\u8FD8\u6CA1\u6709\u97F3\u6E90\uFF0C\u70B9\u4E0B\u65B9\u6DFB\u52A0</div>';
    else
        for (const n of sources) {
            const s = document.createElement("div");
            s.className = "src-item" + (n.id === currentSourceId ? " active" : ""), s.onclick = async () => {
                if (n.id !== currentSourceId) {
                    if (_srcTestBusy) {
                        toast("\u6B63\u5728\u6D4B\u8BD5\u8FDE\u63A5\uFF0C\u8BF7\u7A0D\u5019\u2026");
                        return
                    }
                    _srcTestBusy = !0, n._testing = !0, renderSources();
                    try {
                        const r = await api(PLUGIN_BASE + "/sources/test", "POST", {
                            id: n.id
                        }, 15e3);
                        if (n._status = {
                                ok: !!r.ok,
                                kind: r.kind || (r.ok ? "ok" : "auth"),
                                message: r.message || "",
                                ts: Date.now()
                            }, n._testing = !1, renderSources(), !r.ok) {
                            showSrcErrorDialog(n);
                            return
                        }
                        closeSidebar();
                        const _prevSrc = currentSourceId;
                        currentSourceId = n.id;
                        loadFavoriteIds(currentSourceId).catch(() => {});
                        _snapNav(_prevSrc);
                        await resetPlayerForSourceSwitch(_prevSrc);
                        _loadNav(currentSourceId);
                        if (view === "folders") folderPath = viewNav.folders.path;
                        else if (view === "albums" || view === "artists" || view === "playlists") drill = viewNav[view].drill;
                        else drill = null;
                        searchActive = !1;
                        renderSources();
                        drill ? await loadDrill() : await loadView(view);
                        scheduleSaveState()
                    } catch (r) {
                        n._testing = !1, n._status = {
                            ok: !1,
                            kind: "network",
                            message: r && r.message || "\u8FDE\u63A5\u6D4B\u8BD5\u5931\u8D25",
                            ts: Date.now()
                        }, renderSources(), showSrcErrorDialog(n)
                    } finally {
                        _srcTestBusy = !1
                    }
                }
            };
            let o = "",
                i = "";
            n._testing ? o = "testing" : n._status && (n._status.ok ? o = "on" : n._status.kind === "network" ? o = "err" : o = "warn", n._status.ok || (i = n._status.message || "\u8FDE\u63A5\u5931\u8D25")), s.innerHTML = `<span class="dot ${o}" title="${esc(i)}"></span>
        <div class="meta"><div class="nm">${esc(n.name)}</div><div class="ty">${TYPE_LABELS[n.type]||n.type}</div></div>`;
            const a = document.createElement("div");
            if (a.style.cssText = "display:flex;gap:4px;align-items:center", n.type === "songloft" || n.type === "audiobook") {
                const r = mkBtn("\u2699", () => n.type === "audiobook" ? openAudiobookSettings() : openLocalLibSettings());
                r.title = n.type === "audiobook" ? "有声书设置" : "本地库设置", a.appendChild(r)
            } else {
                const r = mkBtn("\u270E", () => openEdit(n.id)),
                    l = mkBtn("\u{1F5D1}", () => delSource(n.id));
                l.className = "btn sm danger", a.appendChild(r), a.appendChild(l)
            }
            s.appendChild(a), t.appendChild(s)
        }
    const e = document.createElement("div");
    e.className = "qrbox", e.innerHTML = '<a href="https://www.035151.xyz/?ref=4" target="_blank"><img src="static/qrcode.png" alt="\u516C\u4F17\u53F7\u4E8C\u7EF4\u7801" /></a><div>\u5FAE\u4FE1\u626B\u4E00\u626B \xB7 \u5173\u6CE8 pcyear</div><div id="verLine" style="cursor:pointer" onclick="_updVer&&renderUpdateTip()" class="ver' + (_updVer ? " ver-upd" : "") + '">v' + PLUGIN_VERSION + (_updVer ? "（有新版本）" : "") + "</div>", t.appendChild(e)
}

function mkBtn(t, e) {
    const n = document.createElement("button");
    return n.className = "btn sm", n.textContent = t, n.onclick = s => {
        s.stopPropagation(), e()
    }, n
}
async function exportConfig() {
    try {
        const t = await api(PLUGIN_BASE + "/sources/export");
        if (!t.ok) return toast(t.message || "\u5BFC\u51FA\u5931\u8D25");
        const e = new Blob([JSON.stringify(t.data, null, 2)], {
                type: "application/json"
            }),
            n = URL.createObjectURL(e),
            s = document.createElement("a");
        s.href = n, s.download = "multisource-music-config.json", document.body.appendChild(s), s.click(), s.remove(), URL.revokeObjectURL(n), toast("\u914D\u7F6E\u5DF2\u5BFC\u51FA\u4E3A JSON")
    } catch (t) {
        toast("\u5BFC\u51FA\u5931\u8D25\uFF1A" + (t && t.message || t))
    }
}

function importConfigFile() {
    $("cfgFile").click()
}
async function onCfgFile(t) {
    const e = t.target.files && t.target.files[0];
    if (t.target.value = "", !!e) try {
        const n = await new Promise((a, r) => {
                const l = new FileReader;
                l.onload = () => a(l.result), l.onerror = () => r(l.error || new Error("\u8BFB\u53D6\u6587\u4EF6\u5931\u8D25")), l.readAsText(e)
            }),
            s = JSON.parse(n),
            o = Array.isArray(s) ? s : s.data || [];
        if (!o.length) return toast("\u6587\u4EF6\u91CC\u6CA1\u6709\u97F3\u6E90\u914D\u7F6E");
        const i = await api(PLUGIN_BASE + "/sources/import", "POST", {
            configs: o,
            merge: !0
        });
        if (!i.ok) return toast(i.message || "\u5BFC\u5165\u5931\u8D25");
        toast("\u5DF2\u5BFC\u5165 " + (i.total || o.length) + " \u4E2A\u97F3\u6E90"), await loadSources(), currentSourceId && loadView(view)
    } catch (n) {
        toast("\u5BFC\u5165\u5931\u8D25\uFF1A" + (n && n.message || n))
    }
}

function toggleFolderView() {
    const n = songMode === "tracks" ? "folders" : "tracks";
    songMode = n;
    switchView(n)
}

function folderCard(d) {
    const a = document.createElement("div");
    a.className = "card folder-card";
    a.dataset.id = d.id || d.path;
    a.dataset.path = d.path || d.id;
    d.id && (a.dataset.info = "1");
    const r = document.createElement("input");
    r.type = "checkbox", r.className = "chk", r.dataset.id = d.id || d.path, r.checked = selectedKind === "folder" && selected.has(d.id || d.path), r.onclick = f => toggleSelect(f, "folder", d.id || d.path);
    if (!isAudiobook()) a.appendChild(r);
    const c = document.createElement("div");
    c.className = "cov folder-cov";
    if (d.id) {
        // 包裹 wrapCover 以生成 .cov-wrap + .eq 示波图元素（与专辑/歌手卡片一致），
        // 否则 folder-card 根本没有示波图 DOM，匹配逻辑再对也无法显示。
        a.appendChild(wrapCover(makeCover("cov", null)));
        try {
            const m = localStore.get("col:" + d.id);
            m && m.coverId && setCover(a.querySelector(".cov"), m.coverId)
        } catch {}
    } else {
        c.innerHTML = '<svg viewBox="0 0 24 24" width="42" height="42" fill="currentColor"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>', a.appendChild(c)
    }
    const l = document.createElement("div");
    l.className = "info";
    l.innerHTML = `<div class="text-body"><div class="t">${esc(d.name)}</div><div class="s"></div></div>`, a.appendChild(l), a.onclick = f => {
        if (f.target.tagName === "INPUT" || f.target.closest(".top-act")) return;
        navigateFolder(d.path)
    };
    const dd = document.createElement("div");
    dd.className = "top-act";
    const u = document.createElement("button");
    u.className = "btn", u.textContent = "\u25B6", u.title = "\u64AD\u653E\u5168\u90E8", u.onclick = f => {
        f.stopPropagation(), playDirectory("folder", d)
    }, dd.appendChild(u), a.appendChild(dd);
    return a
}
async function renderFolderView() {
    const tk = ++viewToken;
    const e = $("content");
    if (!e) return;
    folderLoading = !1, folderLocated = !1, e.innerHTML = '<div class="empty">加载中…</div>', updateListCount();
    try {
        const r = await api(PLUGIN_BASE + "/browse?sourceId=" + encodeURIComponent(currentSourceId) + "&path=" + encodeURIComponent(folderPath) + "&limit=" + listPageSize() + "&offset=0", "GET", void 0, 3e4, {
            prio: 1
        });
        if (tk !== viewToken) return;
        if (!r || !r.ok) {
            folderDirs = [], folderTracks = [], folderTotal = 0, e.innerHTML = '<div class="empty">加载失败：' + esc((r && r.message) || "未知错误") + '</div>', updateListCount();
            return
        }
        if (r.unsupported) {
            folderDirs = [], folderTracks = [], folderTotal = 0, e.innerHTML = '<div class="empty">该音源不支持文件夹浏览</div>', updateListCount();
            return
        }
        folderDirs = r.dirs || [], folderTracks = sortTracksByName(r.tracks || []), folderTotal = r.total || folderTracks.length;
        if (!folderDirs.length && !folderTracks.length) {
            e.innerHTML = '<div class="empty">此文件夹为空</div>', updateListCount();
            return
        }
        e.innerHTML = "";
        var cr = $("folderCrumbs");
        if (cr) cr.innerHTML = "";
        if (folderPath && cr) cr.appendChild(makeFolderCrumbs());
        if (folderDirs.length) {
            const g = document.createElement("div");
            g.className = "grid";
            for (const d of folderDirs) g.appendChild(folderCard(d));
            e.appendChild(g)
        }
        if (folderTracks.length) {
            const tl = document.createElement("div");
            tl.className = "track-list";
            for (const tr of folderTracks) tl.appendChild(trackRow(tr));
            e.appendChild(tl)
        }
        isDebugOn() && console.log("[folder] fp=", folderPath, "abFolder=", abLast() && abLast().folder), isAudiobook() && folderPath === (abLast() && abLast().folder) && (markFolderPlaying(), updateFolderProgress(), !folderLocated && locateFolderCurrent().then(() => folderLocated = !0));
        isAudiobook() && (function() {
            // 有声书：abFolderList 必须是「完整书单」(供抽屉懒加载 + 队列重建)。
            // 不能用分页的 folderTracks(仅第一页) 覆盖——否则重新进入/返回宿主再进时，
            // 完整书单被截断成 20 条，抽屉懒加载无更多数据（只显示当前曲前后各 10 条）。
            // 启动(boot)已从宿主恢复完整 abFolderList，此处仅做「无任何书单记录」时的临时占位，
            // 且【绝不主动落盘 20 条】，避免把宿主里已有的完整书单截断。随后 syncQueueFromHost
            // 会从 /batch/tracks(browseDeep) 拉到完整列表并统一落盘。
            // 守卫：若已存在完整书单且路径与当前浏览一致，绝对不覆盖。
            if (!abFolderList.length && folderTracks.length && !(abFolderList && abFolderList.length)) {
                abFolderList = folderTracks.slice();
                abFolderPath = folderPath;
                // 注意：此处不调用 abFolderListSave()，防止 20 条分页覆盖宿主完整书单。
            }
            syncQueueFromHost();
        })(), scheduleCardInfo("folder"), highlightPlaying(), updateListCount()
    } catch (err) {
        if (tk === viewToken) {
            folderDirs = [], folderTracks = [], folderTotal = 0, e.innerHTML = '<div class="empty">加载失败：' + esc(err && err.message || String(err)) + '</div>', updateListCount()
        }
    }
}

function makeFolderCrumbs() {
    var w = document.createElement("div");
    w.className = "folder-crumbs";
    var r = document.createElement("span");
    r.className = "crumb";
    r.textContent = "根目录";
    r.onclick = function() {
        navigateFolder("")
    };
    w.appendChild(r);
    if (folderPath) {
        var p = folderPath.split("/");
        var acc = "";
        for (var k = 0; k < p.length; k++) {
            acc = acc ? acc + "/" + p[k] : p[k];
            var s = document.createElement("span");
            s.className = "crumb-sep";
            s.textContent = "/";
            w.appendChild(s);
            var c = document.createElement("span");
            c.className = "crumb" + (k === p.length - 1 ? " current" : "");
            c.textContent = p[k];
            if (k < p.length - 1) {
                var pp = acc;
                c.onclick = function() {
                    navigateFolder(pp)
                }
            }
            w.appendChild(c)
        }
    }
    return w
}
let scrollMem = {};

function viewScrollKey() {
    const base = drill ? ("drill:" + (drill.type || "") + ":" + (drill.id || "")) : (view === "folders" ? ("folders:" + (folderPath || "")) : "view:" + view);
    return "s:" + (currentSourceId || "") + "|" + base
}

function saveCurrentScroll() {
    const c = $("content");
    if (c) scrollMem[viewScrollKey()] = c.scrollTop
}
// 滚动时实时记忆浏览位置：节流更新内存 scrollMem，停止滚动后防抖落盘（localStorage 草稿 + 后端）。
// 否则宿主刷新 webview 时浏览器不保证触发 beforeunload，浏览位置会丢失（回到的不是当前位置）。
let _scrollMarkTs = 0,
    _scrollMarkTimer = null;
function markScroll() {
    const c = $("content");
    if (!c) return;
    const now = Date.now();
    if (now - _scrollMarkTs > 200) {
        _scrollMarkTs = now;
        saveCurrentScroll()
    }
    clearTimeout(_scrollMarkTimer);
    _scrollMarkTimer = setTimeout(() => {
        saveCurrentScroll();
        scheduleSaveState()
    }, 350)
}
async function locateTrackInList(tid) {
    const c = $("content");
    if (!c) return !1;
    for (let p = 0; p < 300; p++) {
        let el = null;
        c.querySelectorAll(".track").forEach(function(e) {
            if (!el && String(e.dataset.id) === String(tid)) el = e
        });
        if (el) {
            try {
                el.scrollIntoView({
                    block: "center"
                })
            } catch (_) {}
            return !0
        }
        const more = view === "folders" ? folderTracks.length < folderTotal : (drill ? currentList.length < drillTotal : (!searchActive && currentList.length < listTotal));
        if (!more) return !1;
        if (view === "folders") await loadMoreFolder();
        else await loadNextPage()
    }
    return !1
}
async function restoreListScroll(preferPlaying) {
    const c = $("content");
    if (!c) return;
    const k = viewScrollKey();
    if (preferPlaying && curTrack) {
        const id = curTrack.id;
        const inList = view === "folders" ? folderTracks.some(function(x) {
            return String(x.id) === String(id)
        }) : currentList.some(function(x) {
            return String(x.id) === String(id)
        });
        if (inList) {
            const ok = await locateTrackInList(id);
            if (ok) {
                scrollMem[k] = c.scrollTop;
                return
            }
        }
    }
    const tgt = scrollMem[k];
    if (typeof tgt === "number") {
        const hasMore = function() {
            return view === "folders" ? folderTracks.length < folderTotal : (drill ? currentList.length < drillTotal : (!searchActive && currentList.length < listTotal))
        };
        let g = 0;
        while (g++ < 200 && hasMore() && c.scrollTop < tgt - 80) {
            if (view === "folders") await loadMoreFolder();
            else await loadNextPage();
            c.scrollTop = tgt
        }
        c.scrollTop = tgt;
        scrollMem[k] = tgt
    }
}
async function navigateFolder(np) {
    saveCurrentScroll();
    folderPath = np;
    await renderFolderView();
    await restoreListScroll(!0);
    scheduleSaveState()
}
const viewNav = {
    folders: {
        path: ""
    },
    albums: {
        drill: null
    },
    artists: {
        drill: null
    },
    playlists: {
        drill: null
    }
};
// 按「音源 × 菜单」分别记忆导航位置：srcId -> { folders:{path}, albums:{drill}, artists:{drill}, playlists:{drill} }
let navState = {};
// 退出时 saveUiState 的同步草稿键（localStorage 同步落盘，兜底异步网络保存的不可靠）
const UI_STATE_DRAFT_KEY = "songloft:uistate:draft";
function _syncNavCurrent() {
    if (view === "folders") viewNav.folders.path = folderPath;
    else if (view === "albums" || view === "artists" || view === "playlists") viewNav[view].drill = drill
}
function _snapNav(s) {
    if (!s) return;
    _syncNavCurrent();
    navState[s] = {
        folders: {
            path: viewNav.folders.path
        },
        albums: {
            drill: viewNav.albums.drill
        },
        artists: {
            drill: viewNav.artists.drill
        },
        playlists: {
            drill: viewNav.playlists.drill
        }
    }
}
// 把“当前音源”的导航位置即时写进 navState（不依赖切源，供 saveUiState 在任意时刻保存最新位置）
function _snapCurrentNav() {
    if (!currentSourceId) return;
    _syncNavCurrent();
    navState[currentSourceId] = {
        folders: {
            path: viewNav.folders.path
        },
        albums: {
            drill: viewNav.albums.drill
        },
        artists: {
            drill: viewNav.artists.drill
        },
        playlists: {
            drill: viewNav.playlists.drill
        }
    }
}
function _loadNav(s) {
    const e = s && navState[s] || {};
    viewNav.folders.path = e.folders && e.folders.path || "";
    viewNav.albums.drill = e.albums && e.albums.drill || null;
    viewNav.artists.drill = e.artists && e.artists.drill || null;
    viewNav.playlists.drill = e.playlists && e.playlists.drill || null
}
async function switchView(t) {
    saveCurrentScroll();
    var _fc = $("folderCrumbs");
    if (_fc) _fc.innerHTML = "";
    if (view === "folders") viewNav.folders.path = folderPath;
    else if (view === "albums" || view === "artists" || view === "playlists") viewNav[view].drill = drill;
    switchCtx("v:" + t), view = t, drill = t === "folders" ? null : (t === "albums" || t === "artists" || t === "playlists" ? viewNav[t].drill : null), folderPath = t === "folders" ? viewNav.folders.path : "", (t === "tracks" || t === "folders") && (songMode = t), searchActive = !1, $("searchInput").value = "", selected.clear(), focusedTrackId = null, selectedKind = t === "tracks" || t === "favorites" ? "track" : t === "albums" ? "album" : t === "artists" ? "artist" : t === "folders" ? "folder" : "playlist", document.querySelectorAll("#tabs .tab").forEach(e => e.classList.toggle("active", e.dataset.v === t || (t === "folders" && e.dataset.v === "tracks")));
    const vb = $("viewToggleBtn");
    vb && vb.classList.toggle("active", t === "folders");
    drill ? await loadDrill() : await loadView(t);
    await restoreListScroll(!0);
    eqNeedLocate = !0, ensurePlayingRowVisible()
}

function setCacheState(t, e) {}

function refreshList() {
    forceRefresh = !0;
    if (searchActive && $("searchInput").value.trim()) return doSearch();
    if (view === "folders") return renderFolderView();
    return drill ? loadDrill() : loadView(view)
}
let listPage = 0,
    listTotal = 0,
    listLoading = !1,
    drillTotal = 0,
    listScanning = !1,
    folderPath = "",
    folderDirs = [],
    folderTracks = [],
    folderTotal = 0,
    folderLoading = !1,
    folderLocated = !1,
    favShown = 0,
    _favFull = [],
    _scanPollTimer = null,
    _sbOpen = !1,
    _playerWasMini = null,
    searchResultCount = null,
    _lfCustom = !1,
    _lfShifted = !1,
    _lfOrigTop = null;

function listPageSize() {
    const e = document.getElementById("content");
    if (!e || !e.clientHeight) return 50;
    const t = drill || view === "tracks" ? 56 : 200;
    return Math.min(100, Math.max(20, Math.ceil(e.clientHeight / t * 1.5)))
}

function listPreloadPx() {
    const e = document.getElementById("content");
    return Math.max(200, e && e.clientHeight || 0)
}
async function bgRefreshList(s, n, o, e) {
  // 命中缓存后后台静默刷新非 favorites 列表：先秒显缓存占位，再穿透后端缓存拿最新写回+重渲染
  if (window.__bgFly && window.__bgFly.has(o)) return;
  (window.__bgFly = window.__bgFly || new Set()).add(o);
  try {
    const a = await api(`${n}&limit=${listPageSize()}&offset=0&refresh=1`, "GET", void 0, 2e4, { prio: 1 });
    if (e !== viewToken) return;
    if (!a || !a.ok || !a.list) return;
    const r = { list: a.list || [], total: a.total || a.list.length };
    memCache[o] = r, localStore.set(o, r), putBackendCache(o, r);
    currentList = r.list, listTotal = r.total, renderList(s), updateBulkBar(), scheduleSaveState();
    setCacheState("fresh", "已是最新");
  } catch (_) {} finally {
    window.__bgFly && window.__bgFly.delete(o);
  }
}

async function loadView(t) {
    switchCtx("v:" + t);
    const e = ++viewToken;
    if (drill = null, t !== "folders" && (folderPath = ""), listLoading = !1, selectedKind = t === "tracks" || t === "favorites" ? "track" : t === "albums" ? "album" : t === "artists" ? "artist" : t === "folders" ? "folder" : "playlist", clearSelection(), t === "favorites") {
        const l = "list:favorites:" + currentSourceId,
            c = memCache[l] || localStore.get(l);
        if (c && c.list && c.list.length) {
            memCache[l] = c, _favFull = c.list, favShown = Math.min(c.list.length, listPageSize()), currentList = _favFull.slice(0, favShown), listScanning = !1, listTotal = c.total || c.list.length, renderList("tracks"), updateBulkBar(), scheduleSaveState();
            const f = forceRefresh || !c.fetchedAt || Date.now() - c.fetchedAt > 8e3;
            forceRefresh = !1, f ? refreshFavoritesSilently(l, e) : setCacheState("fresh", "\u5DF2\u662F\u6700\u65B0");
            return
        }
        $("content").innerHTML = '<div class="empty">\u52A0\u8F7D\u4E2D\u2026</div>';
        const d = await api(`${PLUGIN_BASE}/favorite-songs?sourceId=${encodeURIComponent(currentSourceId)}`, "GET", void 0, 6e4, {
            prio: 1
        });
        if (forceRefresh = !1, e !== viewToken) return;
        if (!d.ok) {
            $("content").innerHTML = `<div class="empty">${esc(d.message||"\u52A0\u8F7D\u6536\u85CF\u5931\u8D25")}</div>`, updateBulkBar(), scheduleSaveState(), updateListCount();
            return
        }
        currentList = d.list || [], listScanning = !1, listTotal = d.total || currentList.length;
        _favFull = currentList, favShown = Math.min(currentList.length, listPageSize()), currentList = _favFull.slice(0, favShown);
        const u = {
            list: _favFull,
            total: listTotal,
            fetchedAt: Date.now()
        };
        memCache[l] = u, localStore.set(l, u), renderList("tracks"), updateBulkBar(), scheduleSaveState(), setCacheState("fresh", "\u5DF2\u662F\u6700\u65B0");
        return
    }
    if (t === "folders") {
        if (restoreFolderPending) {
            restoreFolderPending = !1;
            folderSourceId = currentSourceId
        } else if (currentSourceId !== folderSourceId) {
            if (isAudiobook()) {
                folderPath = (abLast() && abLast().folder) || ""
            } else {
                let _fp = "";
                if (queueSourceId === currentSourceId) {
                    const _cs = playerState.currentSong;
                    let _csp = null;
                    if (_cs && _cs.path) {
                        _csp = _cs.path
                    } else if (_cs && playerState.queue) {
                        const _m = playerState.queue.find(function(x) {
                            return String(x.id) === String(_cs.id)
                        });
                        if (_m && _m.path) _csp = _m.path
                    }
                    if (_csp) {
                        const _i = String(_csp).lastIndexOf("/");
                        _fp = _i >= 0 ? _csp.slice(0, _i) : ""
                    }
                }
                folderPath = _fp
            }
            folderSourceId = currentSourceId
        }
        await renderFolderView();
        return
    }
    if (!currentSourceId) {
        $("content").innerHTML = '<div class="empty">\u8BF7\u5148\u5728\u5DE6\u4FA7\u6DFB\u52A0\u4E00\u4E2A\u97F3\u6E90</div>';
        return
    }
    let n, s;
    t === "tracks" ? (n = `${PLUGIN_BASE}/tracks?sourceId=${currentSourceId}`, s = "tracks") : t === "albums" ? (n = `${PLUGIN_BASE}/albums?sourceId=${currentSourceId}`, s = "albums") : t === "artists" ? (n = `${PLUGIN_BASE}/artists?sourceId=${currentSourceId}`, s = "artists") : (n = `${PLUGIN_BASE}/playlists?sourceId=${currentSourceId}`, s = "playlists");
    const o = "list:" + currentSourceId + ":" + t;
    if (!forceRefresh) {
        const l = memCache[o] || localStore.get(o);
        if (l && l.list && l.list.length) {
            memCache[o] = l, currentList = l.list, listScanning = !1, listTotal = l.total || l.list.length, renderList(s), updateBulkBar(), scheduleSaveState(), setCacheState("stale", "\u5DF2\u663E\u793A\u7F13\u5B58\uFF0C\u70B9\u51FB\u5237\u65B0\u83B7\u53D6\u6700\u65B0");
            bgRefreshList(s, n, o, e);
            return
        }
        const c = await getBackendCache(o);
        if (c && c.list && c.list.length) {
            memCache[o] = c, localStore.set(o, c), currentList = c.list, listScanning = !1, listTotal = c.total || c.list.length, renderList(s), updateBulkBar(), scheduleSaveState(), setCacheState("stale", "\u5DF2\u663E\u793A\u7F13\u5B58\uFF0C\u70B9\u51FB\u5237\u65B0\u83B7\u53D6\u6700\u65B0");
            bgRefreshList(s, n, o, e);
            return
        }
    }
    const i = currentList.length > 0;
    i || ($("content").innerHTML = '<div class="empty">\u52A0\u8F7D\u4E2D\u2026</div>');
    const a = await api(`${n}&limit=${listPageSize()}&offset=0${forceRefresh?"&refresh=1":""}`, "GET", void 0, 2e4, {
        prio: 1
    });
    if (forceRefresh = !1, e !== viewToken) return;
    if (setCacheState(a.cached ? "stale" : "fresh", a.cached ? "\u5DF2\u663E\u793A\u7F13\u5B58\uFF0C\u70B9\u51FB\u5237\u65B0\u83B7\u53D6\u6700\u65B0" : "\u5DF2\u662F\u6700\u65B0"), !a.ok) {
        if (i) {
            setCacheState("error", "\u5237\u65B0\u5931\u8D25\uFF0C\u4ECD\u663E\u793A\u65E7\u5185\u5BB9"), updateBulkBar(), scheduleSaveState();
            return
        }
        $("content").innerHTML = `<div class="empty">${esc(a.message||"\u52A0\u8F7D\u5931\u8D25")}</div>`;
        const l = sources.find(c => c.id === currentSourceId);
        l && toast(`\u26A0 \u97F3\u6E90\u300C${l.name}\u300D\u52A0\u8F7D\u5931\u8D25\uFF1A${a.message||"\u8BF7\u68C0\u67E5\u7F51\u7EDC\u6216\u767B\u5F55\u4FE1\u606F"}`, 3500), updateBulkBar(), scheduleSaveState(), updateListCount();
        return
    }
    currentList = a.list || [], listScanning = !!a.partial, listScanning && pollScanDone(), listScanning || (listTotal = a.total || currentList.length);
    const r = {
        list: currentList,
        total: listTotal
    };
    memCache[o] = r, localStore.set(o, r), putBackendCache(o, r), renderList(s), updateBulkBar(), scheduleSaveState()
}
async function refreshFavoritesSilently(t, e) {
    setCacheState("stale", "\u5237\u65B0\u4E2D\u2026");
    try {
        const n = await api(`${PLUGIN_BASE}/favorite-songs?sourceId=${encodeURIComponent(currentSourceId)}`, "GET", void 0, 6e4, {
            prio: 1
        });
        if (e !== viewToken) return;
        if (!n.ok) {
            setCacheState("error", "\u5237\u65B0\u5931\u8D25\uFF1A" + (n.message || "\u672A\u77E5\u9519\u8BEF"));
            return
        }
        const s = n.list || [],
            o = {
                list: s,
                total: n.total || s.length,
                fetchedAt: Date.now()
            };
        memCache[t] = o, localStore.set(t, o), currentList = s, listTotal = o.total, renderList("tracks"), updateBulkBar(), scheduleSaveState(), setCacheState("fresh", "\u5DF2\u662F\u6700\u65B0")
    } catch (n) {
        setCacheState("error", "\u5237\u65B0\u5931\u8D25\uFF1A" + (n && n.message || n))
    }
}

function bindListLazyLoad() {
    const t = $("content");
    !t || t.dataset.lazyBound || (t.dataset.lazyBound = "1", t.addEventListener("scroll", () => {
        markScroll();
        if (listLoading || !view || searchActive) return;
        const e = t;
        if (e.scrollTop + e.clientHeight < e.scrollHeight - Math.max(300, listPageSize() * 56)) return;
        if (view === "folders") {
            if (folderTracks.length < folderTotal) loadMoreFolder();
            return
        }
        const n = drill ? drillTotal : listTotal;
        (listScanning || currentList.length < n) && loadNextPage()
    }, {
        passive: !0
    }))
}

function pollScanDone() {
    clearTimeout(_scanPollTimer), _scanPollTimer = setTimeout(async () => {
        if (!listScanning || !currentSourceId) return;
        try {
            const r = await api(`${PLUGIN_BASE}/tracks?sourceId=${currentSourceId}&limit=1&offset=0`, "GET", void 0, 15e3);
            if (r.ok && r.list) r.partial ? pollScanDone() : (listScanning = !1, updateListCount())
        } catch {
            pollScanDone()
        }
    }, 8e3)
}

function bindListFloat() {
    const c = $("content"),
        f = $("listFloat");
    if (!c || !f || f.dataset.bound) return;
    f.dataset.bound = "1";
    let timer = null;
    const place = () => {
        if (_lfCustom) return;
        const sb = $("searchBar"),
            off = sb && sb.classList.contains("show") ? sb.offsetHeight : 0;
        f.style.top = (64 + off) + "px"
    };;
    window._lfPlace = place, window._lfPoke = poke;
    f.style.touchAction = "none";
    let sx = 0,
        sy = 0,
        dx = 0,
        dy = 0,
        dragging = !1,
        moved = !1;
    const onDown = e => {
            dragging = !0, moved = !1, _lfDragAcc = 0, sx = e.clientX, sy = e.clientY, dx = e.clientX - f.offsetLeft, dy = e.clientY - f.offsetTop, poke()
        },
        onMove = e => {
            if (!dragging) return;
            if (!moved) {
                _lfDragAcc = (_lfDragAcc || 0) + Math.hypot(e.clientX - sx, e.clientY - sy);
                if (_lfDragAcc < 8) return
            }
            moved = !0, _lfDragAcc = 0, f.style.right = "auto", _lfCustom = !0, _lfShifted = !1, _lfOrigTop = null, e.preventDefault(), poke();
            const nx = Math.min(Math.max(6, e.clientX - dx), window.innerWidth - f.offsetWidth - 6),
                ny = Math.min(Math.max(6, e.clientY - dy), window.innerHeight - f.offsetHeight - 6);
            f.style.left = nx + "px", f.style.top = ny + "px"
        },
        onUp = () => {
            if (!dragging) return;
            dragging = !1, poke();
            if (moved) {
                setTimeout(() => {
                    moved = !1
                }, 100)
            } else {
                _lfDragAcc = 0
            }
        };
    const suppressClick = e => {
        if (moved) {
            e.stopPropagation(), e.preventDefault();
            moved = !1
        }
    };
    f.addEventListener("pointerdown", onDown), window.addEventListener("pointermove", onMove), window.addEventListener("pointerup", onUp), f.addEventListener("click", suppressClick, !0), f.addEventListener("mouseenter", () => clearTimeout(timer)), f.addEventListener("mouseleave", () => poke());
    const hide = () => f.classList.remove("show");

    function poke(d) {
        f.classList.add("show"), syncFloatCount(), clearTimeout(timer), timer = setTimeout(hide, d || 2e3)
    }
    c.addEventListener("scroll", () => poke(), {
        passive: !0
    }), document.addEventListener("wheel", () => poke(), {
        passive: !0
    }), document.addEventListener("pointermove", e => {
        e.buttons & 1 && poke()
    }, {
        passive: !0
    }), document.addEventListener("touchstart", () => poke(), {
        passive: !0
    }), document.addEventListener("touchmove", () => poke(), {
        passive: !0
    }), document.addEventListener("touchend", () => poke(), {
        passive: !0
    }), window.addEventListener("resize", place), place()
}

function syncFloatCount() {
    const f = $("listFloat"),
        n = $("lfCount");
    if (!f || !n) return;
    const bk = $("lfBackBox");
    bk && bk.classList.toggle("show", !!drill || !!folderPath);
    const c = $("content");
    let pos = 0;
    if (c) {
        const cr = c.getBoundingClientRect();
        const it = c.querySelectorAll(".track,.card");
        const len = it.length;
        if (len) {
            let first = -1,
                vis = 0;
            for (let i = 0; i < len; i++) {
                const r = it[i].getBoundingClientRect();
                if (r.bottom <= cr.top + 1) continue;
                if (first < 0) first = i;
                if (r.top >= cr.bottom - 1) break;
                vis++
            }
            pos = first < 0 ? len : first + vis
        }
    }
    const loaded = view === "folders" ? folderDirs.length + folderTracks.length : currentList.length;
    let total = !drill && searchActive && searchResultCount != null ? searchResultCount : (view === "folders" ? folderDirs.length + folderTotal : (drill ? drillTotal : listTotal));
    total = total || loaded || 0;
    n.textContent = (pos || loaded || 0) + "/" + total
}

function setSearchBarOpen(t) {
    _sbOpen = t;
    const b = $("searchBar"),
        c = $("content");
    if (!b) return;
    const pb = $("playerBar");
    if (t) {
        b.classList.add("show");
        if (pb) {
            if (pb.classList.contains("mini")) _playerWasMini = !0;
            else _playerWasMini = !1, pb.classList.add("mini"), document.body.classList.add("mini-on")
        }
        const i = $("searchInput");
        i && setTimeout(() => i.focus(), 50);
        if (_lfCustom && c) {
            const f = $("listFloat");
            if (f) {
                const sbBottom = c.getBoundingClientRect().top + b.offsetHeight;
                if (f.offsetTop < sbBottom) {
                    _lfOrigTop = f.offsetTop, f.style.top = (sbBottom + 6) + "px", _lfShifted = !0
                }
            }
        }
    } else {
        b.classList.remove("show"), c && (c.style.paddingTop = "");
        if (pb && _playerWasMini === !1) {
            pb.classList.remove("mini"), document.body.classList.remove("mini-on"), placeBulkBar()
        }
        _playerWasMini = null;
        if (_lfShifted && _lfOrigTop != null) {
            const f = $("listFloat");
            f && (f.style.top = _lfOrigTop + "px"), _lfShifted = !1, _lfOrigTop = null
        }
    }
    window._lfPlace && window._lfPlace()
}

function toggleSearchBar() {
    const b = $("searchBar");
    if (!b) return;
    b.classList.contains("show") ? closeSearchBar() : setSearchBarOpen(!0)
}

function closeSearchBar() {
    setSearchBarOpen(!1);
    if (searchActive) {
        searchActive = !1, searchResultCount = null, $("searchInput").value = "", drill ? loadDrill() : loadView(view)
    }
}

function lfBack() {
    if (view === "folders") {
        if (!folderPath) return;
        const i = folderPath.lastIndexOf("/");
        folderPath = i >= 0 ? folderPath.slice(0, i) : "";
        navigateFolder(i >= 0 ? folderPath.slice(0, i) : "")
    }
    if (drill && searchActive) {
        closeSearchBar();
        return
    }
    drill && loadView(view)
}

function scrollListTop() {
    const c = $("content");
    if (!c) return;
    try {
        c.scrollTo({
            top: 0,
            behavior: "smooth"
        })
    } catch (e) {}
    c.scrollTop = 0
}

function bindPullToRefresh() {
    const c = $("content"),
        p = $("ptr");
    if (!c || !p || c.dataset.ptrBound) return;
    c.dataset.ptrBound = "1";
    let sy = null,
        pd = 0,
        ref = !1;
    const MAX = 80,
        TRIG = 60;
    const place = () => {
        const r = c.getBoundingClientRect();
        p.style.top = r.top + "px"
    };
    const reset = () => {
        pd = 0, c.style.paddingTop = "", p.classList.remove("show", "loading")
    };
    const go = () => {
        ref = !0, p.classList.add("show", "loading"), c.style.paddingTop = (16 + 56) + "px";
        try {
            Promise.resolve(refreshList()).finally(() => {
                ref = !1, reset()
            })
        } catch {
            ref = !1, reset()
        }
    };
    const start = y => {
        if (ref || listLoading || !view || c.scrollTop > 0) return;
        sy = y, pd = 0
    };
    const move = y => {
        if (sy == null) return;
        const d = y - sy;
        if (d <= 0) {
            pd > 0 && (pd = 0, reset());
            return
        }
        pd = Math.min(d, MAX), c.style.paddingTop = (16 + pd) + "px", p.classList.add("show")
    };
    const end = () => {
        if (sy == null) return;
        sy = null, pd >= TRIG ? go() : reset()
    };
    place(), window.addEventListener("resize", place), c.addEventListener("touchstart", e => start(e.touches[0].clientY), {
        passive: !0
    }), c.addEventListener("touchmove", e => {
        if (sy == null) return;
        const d = e.touches[0].clientY - sy;
        if (d > 0 && c.scrollTop <= 0) {
            e.preventDefault(), move(e.touches[0].clientY)
        }
    }, {
        passive: !1
    }), c.addEventListener("touchend", end, {
        passive: !0
    }), c.addEventListener("mousedown", e => {
        e.button === 0 && start(e.clientY)
    }), c.addEventListener("mousemove", e => {
        if (sy != null) {
            e.preventDefault(), move(e.clientY)
        }
    }), c.addEventListener("mouseup", end), c.addEventListener("mouseleave", () => {
        if (sy != null) {
            sy = null, pd >= TRIG ? go() : reset()
        }
    })
}
async function loadMoreFolder() {
    if (folderLoading || !folderPath || view !== "folders") return;
    if (folderTracks.length >= folderTotal) return;
    folderLoading = !0, toastLoading(!0);
    const tk = viewToken;
    try {
        const r = await api(PLUGIN_BASE + "/browse?sourceId=" + encodeURIComponent(currentSourceId) + "&path=" + encodeURIComponent(folderPath) + "&limit=" + listPageSize() + "&offset=" + folderTracks.length, "GET", void 0, 3e4, {
            prio: 1,
            key: "fld:" + folderPath + ":" + folderTracks.length
        });
        if (tk !== viewToken) return;
        if (r && r.ok && (r.tracks || []).length) {
            folderTracks = folderTracks.concat(r.tracks), folderTotal = r.total || folderTracks.length;
            const tl = document.querySelector(".track-list");
            if (tl) {
                for (const tr of r.tracks) tl.appendChild(trackRow(tr));
                scheduleCardInfo("folder"), updateListCount()
            }
        }
    } catch {} finally {
        folderLoading = !1, toastLoading(!1)
    }
}

function favLoadMore() {
    if (view !== "favorites") return;
    const n = favShown + listPageSize();
    if (n >= _favFull.length) return;
    favShown = n, currentList = _favFull.slice(0, favShown), renderList("tracks"), updateBulkBar(), updateListCount()
}
async function loadNextPage() {
    if (view === "folders") return loadMoreFolder();
    if (view === "favorites") return favLoadMore();
    if (listLoading || !view || searchActive) return;
    if (drill) {
        if (currentList.length >= drillTotal) return;
        listLoading = !0, toastLoading(!0);
        const s = viewToken,
            o = drill.type === "album" ? `${PLUGIN_BASE}/album/tracks?sourceId=${currentSourceId}&albumId=${encodeURIComponent(drill.id)}&limit=${listPageSize()}&offset=${currentList.length}` : drill.type === "playlist" ? `${PLUGIN_BASE}/playlist/tracks?sourceId=${currentSourceId}&playlistId=${encodeURIComponent(drill.id)}&limit=${listPageSize()}&offset=${currentList.length}` : `${PLUGIN_BASE}/artist/tracks?sourceId=${currentSourceId}&artistId=${encodeURIComponent(drill.id)}&limit=${listPageSize()}&offset=${currentList.length}`;
        try {
            const i = await api(o, "GET", void 0, 2e4, {
                prio: 1,
                key: "pg:" + o
            });
            if (s !== viewToken) {
                toastLoading(!1);
                return
            }
            if (i.ok && Array.isArray(i.list)) {
                currentList = currentList.concat(i.list), drillTotal = i.total || currentList.length;
                const a = $("drillListBox");
                let r = a && a.querySelector(".track-list");
                r || (r = document.createElement("div"), r.className = "track-list", a && a.appendChild(r));
                for (const l of i.list) r.appendChild(trackRow(l));
                updateBulkBar(), updateListCount()
            }
        } catch {}
        toastLoading(!1), listLoading = !1;
        return
    }
    listLoading = !0, toastLoading(!0);
    const e = `${PLUGIN_BASE}/${view==="tracks"?"tracks":view==="albums"?"albums":view==="artists"?"artists":"playlists"}?sourceId=${currentSourceId}&limit=${listPageSize()}&offset=${currentList.length}`,
        n = viewToken;
    try {
        const s = await api(e, "GET", void 0, 2e4, {
            prio: 1,
            key: /pg:/ + e
        });
        if (n !== viewToken) {
            toastLoading(!1);
            return
        }
        if (s.ok && Array.isArray(s.list)) {
            currentList = currentList.concat(s.list), listScanning = !!s.partial, listScanning && pollScanDone(), listScanning || (listTotal = s.total || currentList.length);
            const o = $("content"),
                i = view;
            if (i === "tracks") {
                const a = o.querySelector(".track-list") || o;
                for (const r of s.list) a.appendChild(trackRow(r))
            } else {
                let a = o.querySelector(".grid");
                a || (a = document.createElement("div"), a.className = "grid", o.appendChild(a));
                for (const r of s.list) {
                    const m = i === "albums" ? r.artist == null && r.trackCount == null && r.albumCount == null : i === "artists" ? r.albumCount == null && r.trackCount == null : r.trackCount == null;
                    const l = i === "albums" ? makeCard(r, "album", r.artist, m ? "" : (r.trackCount || 0) + " \u9996", () => openAlbum(r), () => playDirectory("album", r), m) : i === "artists" ? makeCard(r, "artist", "", m ? "" : artistCountLabel(r), () => openArtist(r), () => playDirectory("artist", r), m) : makeCard(r, "playlist", "", m ? "" : r.trackCount + " \u9996", () => openPlaylist(r), () => playDirectory("playlist", r), m);
                    a.appendChild(l)
                }
                scheduleCardInfo(i)
            }
            updateBulkBar(), updateListCount()
        }
    } catch {}
    toastLoading(!1), listLoading = !1
}
let _infoTimer = null,
    _infoIds = [];

function scheduleCardInfo(t) {
    const e = $("content");
    const n = e.querySelectorAll(".card[data-info]");
    if (!n.length) return;
    if (!("IntersectionObserver" in window)) {
        for (const s of n) {
            const a = s.dataset.id;
            a && _infoIds.indexOf(a) < 0 && _infoIds.push(a)
        }
        _infoTimer && clearTimeout(_infoTimer);
        _infoTimer = setTimeout(flushCardInfo, 50);
        return
    }
    const s = new IntersectionObserver(o => {
        for (const r of o)
            if (r.isIntersecting) {
                s.unobserve(r.target);
                const a = r.target.dataset.id;
                if (a && _infoIds.indexOf(a) < 0) _infoIds.push(a);
                _infoTimer && clearTimeout(_infoTimer);
                _infoTimer = setTimeout(flushCardInfo, 50)
            }
    }, {
        root: e,
        rootMargin: Math.round(listPreloadPx() * 0.5) + "px 0px"
    });
    for (const o of n) s.observe(o)
}
async function flushCardInfo() {
    _infoTimer = null;
    const t = _infoIds;
    _infoIds = [];
    if (!t.length) return;
    try {
        const e = await api(`${PLUGIN_BASE}/collections/info`, "POST", {
            sourceId: currentSourceId,
            ids: t
        }, 15e3, {
            prio: 2
        });
        if (!e || !e.ok || !Array.isArray(e.list)) return;
        const n = $("content");
        for (const s of e.list) {
            if (!s || s.id == null) continue;
            const o = n.querySelectorAll(".card");
            for (const r of o) {
                if (r.dataset.id !== s.id) continue;
                r.dataset.info = "done";
                const a = r.querySelector(".s");
                if (a) {
                    const c = [];
                    s.artist && c.push(s.artist);
                    s.trackCount != null && c.push(s.trackCount + " \u9996");
                    a.textContent = c.join(" \xB7 ")
                }
                const m = localStore.get("col:" + s.id);
                const cid = (m && m.coverId) || s.coverId;
                if (cid) {
                    const c = r.querySelector(".cov");
                    c && c.dataset.dc === "1" && setCover(c, cid)
                }
            }
        }
    } catch {}
}

function renderList(t) {
    const e = $("content");
    if (e.innerHTML = "", !currentList.length) {
        e.innerHTML = '<div class="empty">\u6682\u65E0\u5185\u5BB9</div>', updateListCount();
        return
    }
    if (t === "tracks") {
        const n = document.createElement("div");
        n.className = "track-list";
        for (const s of currentList) n.appendChild(trackRow(s));
        e.appendChild(n)
    } else if (t === "albums") {
        const n = document.createElement("div");
        n.className = "grid";
        for (const s of currentList) {
            const m = s.artist == null && s.trackCount == null && s.albumCount == null;
            const o = makeCard(s, "album", s.artist, m ? "" : (s.trackCount || 0) + " \u9996", () => openAlbum(s), () => playDirectory("album", s), m);
            n.appendChild(o)
        }
        e.appendChild(n)
    } else if (t === "artists") {
        const n = document.createElement("div");
        n.className = "grid";
        for (const s of currentList) {
            const m = s.albumCount == null && s.trackCount == null;
            const o = makeCard(s, "artist", "", m ? "" : artistCountLabel(s), () => openArtist(s), () => playDirectory("artist", s), m);
            n.appendChild(o)
        }
        e.appendChild(n)
    } else if (t === "playlists") {
        const n = document.createElement("div");
        n.className = "grid";
        if (currentSourceType() === "subsonic") {
            const nc = document.createElement("div");
            nc.className = "card new-pl";
            nc.innerHTML = '<div class="cov ph">+</div><div class="info"><div class="text-body"><div class="t">\u65b0\u5efa\u6b4c\u5355</div></div></div>';
            nc.onclick = () => openPlaylistEditModal("create");
            n.appendChild(nc)
        }
        for (const s of currentList) {
            const m = s.trackCount == null;
            const o = makeCard(s, "playlist", "", m ? "" : s.trackCount + " \u9996", () => openPlaylist(s), () => playDirectory("playlist", s), m);
            if (currentSourceType() === "subsonic") {
                let ta = o.querySelector(".top-act");
                if (!ta) {
                    ta = document.createElement("div");
                    ta.className = "top-act";
                    o.appendChild(ta)
                }
                const eb = document.createElement("button");
                eb.className = "btn sm";
                eb.textContent = "\u270e";
                eb.title = "\u91cd\u547d\u540d";
                eb.onclick = e => {
                    e.stopPropagation();
                    openPlaylistEditModal("rename", s)
                };
                const db = document.createElement("button");
                db.className = "btn sm danger";
                db.textContent = "\u2715";
                db.title = "\u5220\u9664";
                db.onclick = e => {
                    e.stopPropagation();
                    openPlaylistEditModal("delete", s)
                };
                ta.appendChild(eb);
                ta.appendChild(db)
            }
            n.appendChild(o)
        }
        e.appendChild(n)
    }
    highlightPlaying(), scheduleCardInfo(t), updateListCount()
}

function updateListCount() {
    syncFloatCount();
    window._lfPoke && window._lfPoke()
}

function artistCountLabel(t) {
    return t.trackCount != null ? t.trackCount + " \u9996" : ""
}

function makeCard(t, e, n, s, o, i, m) {
    const a = document.createElement("div");
    a.className = "card";
    a.dataset.id = t.id, a.dataset.kind = e, a.dataset.name = t.name || "", m && (a.dataset.info = "1");
    const r = document.createElement("input");
    r.type = "checkbox", r.className = "chk", r.dataset.id = t.id, r.checked = selectedKind === e && selected.has(t.id), r.onclick = f => toggleSelect(f, e, t.id), a.appendChild(r), a.appendChild(wrapCover(makeCover("cov", t.coverId)));
    try {
        const m = localStore.get("col:" + t.id);
        m && m.coverId && setCover(a.querySelector(".cov"), m.coverId)
    } catch {}
    const l = document.createElement("div");
    l.className = "info";
    const c = [n, s].filter(Boolean).join(" \xB7 ");
    l.innerHTML = `<div class="text-body"><div class="t">${esc(t.name)}</div><div class="s">${esc(c)}</div></div>`, a.appendChild(l), a.onclick = f => {
        f.target.tagName === "INPUT" || f.target.closest(".top-act") || o()
    };
    const d = document.createElement("div");
    d.className = "top-act";
    const u = document.createElement("button");
    return u.className = "btn", u.textContent = "\u25B6", u.title = "\u64AD\u653E\u5168\u90E8", u.onclick = f => {
        f.stopPropagation(), i()
    }, d.appendChild(u), a.appendChild(d), a
}

function trackRow(t, fallbackCoverId) {
    const e = document.createElement("div");
    const on = isCurTrack(t);
    e.className = "track" + (on ? " playing" : "") + (selectedKind === (view === "folders" ? "folder" : "track") && selected.has(t.id) ? " selected" : ""), e.dataset.id = String(t.id), e.dataset.sourceId = t.sourceId != null ? t.sourceId : currentSourceId;
    const n = selectedKind === (view === "folders" ? "folder" : "track") && selected.has(t.id) ? "checked" : "";
    let s;
    if (t._host) {
        s = document.createElement("img"), s.className = "cov", s.alt = "", s.onerror = () => coverErrFix(s), s.src = DEFAULT_COVER;
        const c = t.srcCover;
        c && c.sourceId && c.coverId && srcCoverDataUrl(c).then(d => {
            d && s && s.isConnected && safeShowCover(s, d)
        }).catch(() => {})
    } else s = makeCover("cov", t.coverId);
    const o = document.createElement("input");
    o.type = "checkbox", o.className = "chk", o.dataset.id = t.id, o.checked = !!n, o.onclick = c => toggleSelect(c, view === "folders" ? "folder" : "track", t.id);
    if (!isAudiobook()) e.appendChild(o);
    e.appendChild(wrapCover(s));
    if (isAudiobook()) {
        const ring = document.createElement("div");
        ring.className = "disc-ring";
        const _pr = abProgressGet(t.id);
        const _d = _pr && _pr.dur ? _pr.dur : 0;
        const _p = _pr ? _pr.pos : 0;
        const _pct = _d > 0 ? Math.min(100, Math.max(0, _p / _d * 100)) : 0;
        ring.innerHTML = '<svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="16"></circle><circle class="fg" cx="18" cy="18" r="16"></circle></svg>';
        ring.querySelector(".fg").style.strokeDashoffset = String(100.5 * (1 - _pct / 100));
        e.appendChild(ring)
    }
    const i = document.createElement("div");
    i.className = "ti", i.innerHTML = `<div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist||"")}${t.album?" \xB7 "+esc(t.album):""}</div>`, e.appendChild(i);
    const a = document.createElement("div");
    a.className = "dur", a.textContent = t.duration > 0 ? fmt(t.duration) : (t.size ? fmtSize(t.size) : "0:00"), e.appendChild(a), e.onclick = c => {
        if (c.target.tagName === "INPUT" || c.target.closest(".act")) return;
        if (isAudiobook()) {
            const d = t.id,
                u = Date.now();
            if (sc_lastId === d && u - sc_lastTime < SC_DBL) {
                sc_lastId = null, playFolderFrom(t);
                return
            }
            sc_lastId = d, sc_lastTime = u, selected.clear(), selected.add(d), renderSelection(), updateBulkBar(), scheduleSaveState();
            return
        }
        const d = t.id,
            u = Date.now();
        if (sc_lastId === d && u - sc_lastTime < SC_DBL) {
            sc_lastId = null, t._host ? playHostSong(t) : playTrack(t);
            return
        }
        sc_lastId = d, sc_lastTime = u, selectTrackRow(e, d)
    };
    const r = document.createElement("div");
    r.className = "act";
    const l = mkBtn("\uFF0B", () => addTracksToQueue([t]));
    if (!isAudiobook()) {
        l.title = "\u52A0\u5165\u64AD\u653E\u5217\u8868", r.appendChild(l);
        if (drill && drill.type === "playlist" && currentSourceType() === "subsonic") {
            const rb = mkBtn("\u2715", () => removeTrackFromPlaylist(t.id));
            rb.className = "btn sm danger";
            r.appendChild(rb)
        }
        e.appendChild(r)
    }
    return e
}
async function playHostSong(t) {
    const e = Number(t.id);
    if (!e) return toast("\u65E0\u6548\u7684\u6B4C\u66F2");
    const n = ++playSeq;
    if (clearNowPlayingUI(), curTrack = t, queueClearGuard = !1, setIcon($("playBtn"), "pause"), setIcon($("npPlayBtn"), "pause"), $("pTitle").textContent = t.title || "", $("pArtist").textContent = [t.artist, t.album].filter(Boolean).join(" \xB7 "), checkPlayerMarquee(), playerState.currentSong = {
            id: e,
            title: t.title || "",
            artist: t.artist || "",
            album: t.album || ""
        }, playerState.playing = !0, playerPosAnchor = {
            pos: 0,
            t: performance.now(),
            playing: !0
        }, renderPlayer(), highlightPlaying(), hydrateNowPlaying(), !Player.available()) {
        toast("\u5F53\u524D\u5BBF\u4E3B\u7248\u672C\u4E0D\u652F\u6301\u63A7\u5236\u64AD\u653E\u5668\uFF0C\u8BF7\u5347\u7EA7 SongLoft"), playerState.playing = !1, renderPlayer();
        return
    }
    try {
        pendingTarget = {
            songId: String(e),
            token: n,
            t: Date.now()
        }, currentLyric = null, currentLyricKey = null, lastLyricIndex = -1, renderLyricIfOpen();
        const s = playerState.queue || [];
        if (s.some(i => String(songIdOf(i)) === String(e))) await Player.play(e);
        else if (s.length) {
            if (await Player.addToQueue([e]), n !== playSeq) return;
            await Player.play(e)
        } else {
            if (await Player.setQueue([e], 0), n !== playSeq) return;
            await Player.play(e)
        }
        startActivePoll()
    } catch (s) {
        playerState.playing = !1, renderPlayer(), toast("\u64AD\u653E\u5931\u8D25\uFF1A" + (s && s.message || s))
    }
}
let sc_lastId = null,
    sc_lastTime = 0;
const SC_DBL = 350;

function selectTrackRow(t, e) {
    setSelectionKind(view === "folders" ? "folder" : "track"), selected.has(e) ? selected.delete(e) : selected.add(e);
    const n = selected.has(e),
        s = t.querySelector(".chk");
    s && (s.checked = n), t.classList.toggle("selected", n), updateBulkBar(), scheduleSaveState()
}

function openAlbum(t) {
    drill = {
        type: "album",
        id: t.id,
        name: t.name,
        coverId: t.coverId
    }, scheduleSaveState(), drill.coverId ? loadDrill() : ensureDrillCover(t.id)
}

function openArtist(t) {
    drill = {
        type: "artist",
        id: t.id,
        name: t.name,
        coverId: t.coverId
    }, scheduleSaveState(), drill.coverId ? loadDrill() : ensureDrillCover(t.id)
}
async function ensureDrillCover(t) {
    try {
        const m = localStore.get("col:" + t);
        if (m && m.coverId) {
            drill.coverId = m.coverId;
            loadDrill();
            return
        }
    } catch {}
    try {
        const n = await api(`${PLUGIN_BASE}/collections/info`, "POST", {
            sourceId: currentSourceId,
            ids: [t]
        }, 15e3, {
            prio: 1
        });
        if (n && n.ok && n.list && n.list[0] && n.list[0].coverId) drill.coverId = n.list[0].coverId
    } catch {}
    loadDrill()
}
async function backfillDrillCover() {
    if (!drill) return;
    // 优先信任后端已选好的可解析封面（drill.coverId），存在则不再用列表首曲覆盖，避免顶部封面被首曲 404 吃掉
    if (drill.coverId) return;
    const list = currentList || [];
    for (const t of list) {
        if (!t || !t.coverId) continue;
        let d = null;
        try {
            d = await coverDataUrl(t.coverId)
        } catch {}
        if (!d) continue;
        drill.coverId = t.coverId;
        const cov = document.querySelector(".drill-cov");
        cov && safeShowCover(cov, d);
        try {
            localStore.set("col:" + drill.id, {
                coverId: t.coverId,
                ts: Date.now()
            })
        } catch {}
        return
    }
}
async function loadDrill() {
    if (!drill) return;
    searchActive = !1, searchResultCount = null;
    switchCtx("d:" + drill.id);
    const t = ++viewToken;
    selected.clear(), selectedKind = "track", focusedTrackId = null, drillTotal = 0;
    const e = $("content");
    if (e.innerHTML = "", drill.coverId) {
        const u = document.createElement("div");
        u.style.cssText = "display:flex;justify-content:center;padding:6px 0 10px", u.appendChild(makeCover("drill-cov", drill.coverId)), e.appendChild(u)
    }
    const n = drill.type === "album" ? "\u{1F4C0} " : drill.type === "playlist" ? "\u{1F4CB} " : "\u{1F3A4} ",
        s = document.createElement("h2");
    s.style.cssText = "font-size:18px;margin:4px 0 10px;text-align:center", s.textContent = n + drill.name, e.appendChild(s);
    const i = document.createElement("div");
    i.id = "drillListBox", i.innerHTML = '<div class="empty">\u52A0\u8F7D\u4E2D\u2026</div>', e.appendChild(i);
    const a = "drill:" + currentSourceId + ":" + drill.type + ":" + encodeURIComponent(drill.id),
        r = forceRefresh;
    if (forceRefresh = !1, !r) {
        const u = await getBackendCache(a);
        if (u && u.list && u.list.length) {
            currentList = u.list, drillTotal = u.total || u.list.length, i.innerHTML = "";
            const f = document.createElement("div");
            f.className = "track-list";
            for (const p of currentList) f.appendChild(trackRow(p));
            i.appendChild(f), updateBulkBar(), updateListCount(), setCacheState("stale", "\u5DF2\u663E\u793A\u7F13\u5B58\uFF0C\u70B9\u51FB\u5237\u65B0\u83B7\u53D6\u6700\u65B0");
            backfillDrillCover();
            highlightPlaying();
            return
        }
    }
    let l = drill.type === "album" ? `${PLUGIN_BASE}/album/tracks?sourceId=${currentSourceId}&albumId=${encodeURIComponent(drill.id)}&limit=${listPageSize()}&offset=0` : drill.type === "playlist" ? `${PLUGIN_BASE}/playlist/tracks?sourceId=${currentSourceId}&playlistId=${encodeURIComponent(drill.id)}&limit=${listPageSize()}&offset=0` : `${PLUGIN_BASE}/artist/tracks?sourceId=${currentSourceId}&artistId=${encodeURIComponent(drill.id)}&limit=${listPageSize()}&offset=0`;
    r && (l += "&refresh=1");
    let c;
    try {
        c = await api(l, "GET", void 0, 6e4, {
            prio: 1
        })
    } catch (u) {
        const f = u && u.message ? u.message : "\u7F51\u7EDC\u9519\u8BEF";
        i.innerHTML = '<div class="empty">\u52A0\u8F7D\u5931\u8D25\uFF1A' + esc(f) + "\uFF0C\u8BF7\u70B9\u51FB\u5237\u65B0\u91CD\u8BD5</div>", setCacheState("error", "\u52A0\u8F7D\u5931\u8D25\uFF1A" + f), updateBulkBar(), scheduleSaveState();
        return
    }
    if (t !== viewToken) return;
    if (setCacheState(c.cached ? "stale" : "fresh", c.cached ? "\u5DF2\u663E\u793A\u7F13\u5B58\uFF0C\u70B9\u51FB\u5237\u65B0\u83B7\u53D6\u6700\u65B0" : "\u5DF2\u662F\u6700\u65B0"), !c.ok) {
        i.innerHTML = '<div class="empty">' + esc(c.message || "\u52A0\u8F7D\u5931\u8D25") + "</div>", setCacheState("error", "\u52A0\u8F7D\u5931\u8D25\uFF1A" + (c.message || "\u672A\u77E5\u9519\u8BEF")), updateBulkBar(), scheduleSaveState();
        return
    }
    currentList = c.list || [], drillTotal = c.total || currentList.length, putBackendCache(a, {
        list: currentList,
        total: drillTotal
    }), i.innerHTML = "";
    const d = document.createElement("div");
    d.className = "track-list";
    for (const u of currentList) d.appendChild(trackRow(u));
    i.appendChild(d), updateBulkBar(), updateListCount(), scheduleSaveState(), backfillDrillCover(), highlightPlaying()
}
const Player = {
        inst() {
            return window.SongloftPlugin && window.SongloftPlugin.player
        },
        available() {
            const t = window.SongloftPlugin && window.SongloftPlugin.host;
            return t && typeof t.isAvailable == "function" ? !!t.isAvailable() : !!this.inst()
        },
        _methods: {},
        probe() {
            const t = this.inst();
            if (!t) return;
            const e = ["setQueue", "addToQueue", "removeFromQueue", "play", "togglePlay", "pause", "next", "prev", "previous", "seek", "setVolume", "setPlayMode", "setRepeat", "setShuffle", "favorite", "like", "toggleFavorite", "addFavorite", "removeFavorite", "getState", "onStateChange"],
                n = {};
            for (const s of e) typeof t[s] == "function" && (n[s] = !0);
            this._methods = n, console.log("[player] probe methods", Object.keys(n))
        },
        has(t) {
            return !!this._methods[t]
        },
        invoke(t, e) {
            const n = this.inst();
            if (!n || typeof n[t] != "function") return Promise.reject(new Error("\u64AD\u653E\u5668\u4E0D\u53EF\u7528\uFF1A" + t));
            try {
                return Promise.resolve(n[t].apply(n, e || []))
            } catch (s) {
                return Promise.reject(s)
            }
        },
        async call(t, e, n = 2) {
            let s;
            for (let o = 0; o <= n; o++) try {
                return await this.invoke(t, e)
            } catch (i) {
                s = i;
                const a = String(i && i.message || i);
                if (!/timeout|超时/i.test(a) || o === n) throw i;
                await new Promise(r => setTimeout(r, 300 * (o + 1)))
            }
            throw s
        },
        setQueue(t, e) {
            return this.call("setQueue", [t, {
                startIndex: e || 0
            }])
        },
        addToQueue(t) {
            return this.call("addToQueue", [t])
        },
        removeFromQueue(t) {
            return this.call("removeFromQueue", [t])
        },
        play(t) {
            return this.call("play", [t])
        },
        togglePlay() {
            return this.call("togglePlay", [])
        },
        pause() {
            return this.invoke("pause", [])
        },
        next() {
            return this.call("next", [])
        },
        previous() {
            return this.call(this.has("prev") ? "prev" : "previous", [])
        },
        seek(t) {
            return this.call("seek", [t])
        },
        setVolume(t) {
            return this.invoke("setVolume", [t])
        },
        setPlayMode(t) {
            return this.call("setPlayMode", [t])
        },
        setRepeat(t) {
            return this.call("setRepeat", [t])
        },
        setShuffle(t) {
            return this.call("setShuffle", [t])
        },
        favorite(t, e) {
            return this.call("favorite", [t, !!e])
        },
        toggleFavorite(t) {
            return this.call("toggleFavorite", [t])
        },
        getState() {
            return this.call("getState", [])
        },
        sdkBound: !1,
        onState(t) {
            const e = this.inst();
            if (!e || typeof e.onStateChange != "function") {
                console.warn("[player] onStateChange not available");
                return
            }
            this.sdkBound || (this.sdkBound = !0, console.log("[player] subscribing onStateChange"), e.onStateChange(n => t(n, "event")))
        }
    },
    CastManager = {
        devices: [],
        hasMiot: !1,
        current: {
            type: "local",
            id: "local",
            accountId: "",
            name: "\u672C\u673A"
        },
        lastMiot: null,
        pollTimer: null,
        _popOpen: !1,
        castAnchor: null,
        _lastRaw: null,
        _rawCnt: 0,
        _castStartPos: 0,
        _castPausePos: 0,
        isMiot() {
            return !!(this.current && this.current.type === "miot")
        },
        isOffline(t) {
            return !t || t.presence !== "online"
        },
        init() {
            try {
                const t = localStorage.getItem("mm:cast_device");
                if (t) {
                    const e = JSON.parse(t);
                    e && e.type === "miot" ? (this.current = e, this.lastMiot = {
                        id: e.id,
                        accountId: e.accountId,
                        name: e.name
                    }) : this.current = {
                        type: "local",
                        id: "local",
                        accountId: "",
                        name: "\u672C\u673A"
                    }
                }
            } catch {}
            this.renderButton(), this.isMiot() && this.startStatusPoll(), this.loadDevices().then(() => this.renderButton()).catch(() => {}), document.addEventListener("click", t => {
                this._popOpen && !t.target.closest("#npDevicePop") && !t.target.closest("#npDeviceBtn") && this.closePop()
            }, !0)
        },
        async refresh() {
            await this.loadDevices().catch(() => {}), this.renderButton(), this._popOpen && this.renderPop()
        },
        async loadDevices() {
            this.devices = [];
            try {
                const t = await api(PLUGIN_BASE + "/miot-proxy?path=" + encodeURIComponent("mina/devices"));
                if (!t.ok || !t.success || !Array.isArray(t.data)) {
                    this.hasMiot = !1;
                    return
                }
                this.hasMiot = !0, t.data.forEach(e => {
                    (e.devices || []).forEach(n => this.devices.push({
                        ...n,
                        account_id: e.account_id
                    }))
                })
            } catch {
                this.hasMiot = !1
            }
        },
        renderButton() {
            const t = $("npDeviceName"),
                e = document.querySelector("#npDeviceBtn .np-device-ico");
            t && (t.textContent = this.current.name || "\u672C\u673A"), e && (e.textContent = this.isMiot() ? "\u{1F50A}" : "\u{1F4F1}")
        },
        togglePop(t) {
            t.stopPropagation(), this._popOpen ? this.closePop() : this.openPop()
        },
        openPop() {
            this.renderPop();
            const t = $("npDevicePop");
            t && (t.classList.add("show"), this._popOpen = !0)
        },
        closePop() {
            const t = $("npDevicePop");
            t && t.classList.remove("show"), this._popOpen = !1
        },
        renderPop() {
            const t = $("npDevicePop");
            if (!t) return;
            const e = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            let n = "";
            n += `
      <div class="np-device-item ${this.isMiot()?"":"active"}" data-type="local" data-id="local">
        <span class="np-di-ico">${e?"\u{1F4F1}":"\u{1F5A5}\uFE0F"}</span>
        <span class="np-di-name">\u672C\u673A</span>
        <span class="np-di-state">${this.isMiot()?"\u672C\u5730\u64AD\u653E":"\u2713 \u5F53\u524D"}</span>
      </div>`, !this.hasMiot || this.devices.length === 0 ? n += `<div class="np-device-tip">${this.hasMiot?"\u672A\u53D1\u73B0\u5C0F\u7231\u97F3\u7BB1":"\u672A\u542F\u7528\u201C\u667A\u80FD\u97F3\u7BB1\u201D\u63D2\u4EF6"}</div>` : this.devices.forEach(s => {
                const o = this.isOffline(s),
                    i = this.isMiot() && this.current.id === s.deviceID,
                    a = o ? "" : '<span class="np-di-dot"></span>';
                n += `
          <div class="np-device-item ${i?"active":""} ${o?"offline":""}" data-type="miot" data-id="${s.deviceID}" data-account="${s.account_id}" data-name="${ceHtml(s.name)}">
            <span class="np-di-ico">\u{1F50A}</span>
            <span class="np-di-name">${ceHtml(s.name)}${a}</span>
            <span class="np-di-state">${o?"\u79BB\u7EBF":i?"\u2713 \u6295\u5C4F\u4E2D":"\u5728\u7EBF"}</span>
          </div>`
            }), t.innerHTML = n, t.querySelectorAll(".np-device-item").forEach(s => {
                s.addEventListener("click", () => {
                    s.dataset.type === "local" ? this.selectLocal() : this.selectMiot({
                        id: s.dataset.id,
                        accountId: s.dataset.account,
                        name: s.dataset.name
                    }), this.closePop()
                })
            })
        },
        async castSetVolume(t) {
            if (!this.isMiot()) return;
            try {
                const n = await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/volume")}`, "POST", {
                    account_id: this.current.accountId,
                    device_id: this.current.id,
                    volume: t
                });
                if (!(n && n.success)) console.warn("[cast] set volume failed", n && n.message)
            } catch (e) {
                console.warn("[cast] set volume err", e && e.message)
            }
        },
        async selectLocal() {
            const t = this.isMiot(),
                e = this.lastMiot;
            playerPosAnchor = null, this.current = {
                type: "local",
                id: "local",
                accountId: "",
                name: "\u672C\u673A"
            };
            try {
                localStorage.setItem("mm:cast_device", JSON.stringify(this.current))
            } catch {}
            this.renderButton(), this.stopStatusPoll(), t && e && (await this.stopSpeakerIfPlaying(e).catch(() => {}), playerState.playing = !1, renderPlayer(), toast("\u5DF2\u5207\u56DE\u672C\u673A\u64AD\u653E"))
        },
        async selectMiot(t) {
            const e = this.isMiot(),
                n = this.lastMiot;
            if (e && n && n.id !== t.id) await this.stopSpeakerIfPlaying(n).catch(() => {});
            else if (!e) try {
                Player.available() && Player.has("pause") && await Player.pause()
            } catch {}
            playerPosAnchor = null, this.current = {
                type: "miot",
                id: t.id,
                accountId: t.accountId,
                name: t.name
            }, this.lastMiot = {
                id: t.id,
                accountId: t.accountId,
                name: t.name
            };
            try {
                localStorage.setItem("mm:cast_device", JSON.stringify(this.current))
            } catch {}
            this.renderButton(), (playerState.queue || []).some(o => songIdOf(o)) ? await this.castCurrent().catch(o => console.warn("[cast] \u6295\u5C4F\u5931\u8D25", o)) : toast("\u5DF2\u9009\u300C" + t.name + "\u300D\uFF0C\u64AD\u653E\u65F6\u81EA\u52A8\u6295\u5C4F")
        },
        async ensureCastPlaylist(t) {
            const e = "PcyearBridge\u6295\u5C4F";
            try {
                const n = await api("/api/v1/playlists"),
                    o = (n.ok && Array.isArray(n.playlists) ? n.playlists : n.data && Array.isArray(n.data.playlists) ? n.data.playlists : []).find(r => r.name === e);
                if (o && o.id) try {
                    await api("/api/v1/playlists/" + o.id, "DELETE")
                } catch {}
                const i = await api("/api/v1/playlists", "POST", {
                        name: e,
                        type: "normal"
                    }),
                    a = i.id || i.data && i.data.id;
                if (!a) throw new Error("\u6B4C\u5355\u521B\u5EFA\u672A\u8FD4\u56DE id");
                return t && t.length && await api("/api/v1/playlists/" + a + "/songs", "POST", {
                    song_ids: t
                }), a
            } catch (n) {
                return console.warn("[cast] ensureCastPlaylist \u5931\u8D25", n), null
            }
        },
        async waitSongUrlsReady(t) {
            const e = Date.now() + 8e3;
            for (; Date.now() < e;) {
                try {
                    const n = await api("/api/v1/playlists/" + t + "/songs"),
                        s = n.ok && Array.isArray(n.songs) ? n.songs : n.data && Array.isArray(n.data.songs) ? n.data.songs : [];
                    if (s.length > 0 && s.every(o => o && String(o.url || "").indexOf("/play") >= 0)) return
                } catch {}
                await new Promise(n => setTimeout(n, 600))
            }
            console.warn("[cast] \u7B49\u5F85\u6B4C\u66F2 URL \u5C31\u7EEA\u8D85\u65F6\uFF0C\u76F4\u63A5\u5C1D\u8BD5\u6295\u5C4F")
        },
        async castCurrent(t, seek) {
            if (!this.isMiot()) return;
            try {
                const i = await Player.getState().catch(() => null);
                if (i) {
                    const a = extractQueue(i);
                    a.length && (playerState.queue = a);
                    const r = extractIndex(i, playerState.queue);
                    r >= 0 && (playerState.currentIndex = r)
                }
            } catch {}
            const e = (playerState.queue || []).map(songIdOf).filter(Boolean);
            if (!e.length) {
                toast("当前没有可投屏的播放列表");
                return !1
            }
            let n = typeof t == "number" ? t : playerState.currentIndex;
            (n < 0 || n >= e.length) && (n = 0), playerState.currentIndex = n;
            const song = playerState.queue[n] || playerState.currentSong;
            playerState.currentSong = song, playerState.duration = song && song.duration || 0, renderPlayer();
            let url = "";
            try {
                const r = await api(PLUGIN_BASE + "/cast/play-url", "POST", {
                    song_id: e[n],
                    host: location.origin.replace(/^https?:\/\//, ""),
                    seek: seek || 0
                });
                url = r && r.ok && r.url || ""
            } catch {}
            if (!url) {
                toast("❌ 获取播放地址失败");
                return !1
            }
            toast("📡 正在投屏到「" + this.current.name + "」…");
            try {
                const i = await api(PLUGIN_BASE + "/miot-proxy?path=" + encodeURIComponent("mina/play-url"), "POST", {
                    account_id: this.current.accountId,
                    device_id: this.current.id,
                    url
                });
                if (!i.ok || !i.success) {
                    toast("❌ 投屏失败：" + (i.msg || i.message || "未知错误"));
                    return !1
                }
                try {
                    Player.available() && Player.has("pause") && await Player.pause()
                } catch {}
                playerState.playing = !0, renderPlayer(), syncCurTrackFromState(), hydrateNowPlaying(), this._castStartPos = Math.max(0, Math.floor(seek || 0)), this.castAnchor = null, this._castSwitchAt = Date.now(), this.paintProgress(this._castStartPos, playerState.duration || 0), this.startStatusPoll(), this.pollOnce();
                return !0
            } catch {
                toast("❌ 投屏指令发送失败")
            }
        },
        async castRelative(t) {
            if (!this.isMiot()) return;
            const e = (playerState.queue || []).length;
            if (!e) return;
            let n = playerState.currentIndex + t;
            n < 0 && (n = e - 1), n >= e && (n = 0), await this.castToIndex(n)
        },
        async castToIndex(t) {
            if (!this.isMiot()) return;
            const e = (playerState.queue || []).length;
            if (!e || t < 0 || t >= e) return;
            await this.castCurrent(t).catch(() => {})
        },
        async toggleSpeaker() {
            if (!this.isMiot()) return;
            if (playerState.playing) {
                this._resumeTimer && (clearTimeout(this._resumeTimer), this._resumeTimer = null);
                let p = 0;
                if (this.castAnchor) p = this.castAnchor.playing ? this.castAnchor.pos + (performance.now() - this.castAnchor.t) / 1e3 : this.castAnchor.pos;
                const dur = playerState.duration || 0;
                this._castPausePos = Math.max(0, Math.min(p, dur > 3 ? dur - 3 : p));
                try {
                    const n = await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/stop")}`, "POST", {
                        account_id: this.current.accountId,
                        device_id: this.current.id
                    });
                    if (!(n && n.success)) {
                        toast("❌ 操作失败");
                        return
                    }
                } catch {
                    toast("❌ 操作失败");
                    return
                }
                playerState.playing = !1, this.castAnchor && (this.castAnchor.pos = this._castPausePos, this.castAnchor.playing = !1), renderPlayer(), this.paintProgress(this._castPausePos, playerState.duration || 0), this.pollOnce();
                return
            }
            this._resumeTimer = setTimeout(() => {
                this._resumeTimer = null;
                const r = () => this.castCurrent(playerState.currentIndex, Math.max(0, Math.floor(this._castPausePos || 0)));
                r().then(ok => {
                    ok || setTimeout(() => r().catch(() => {}), 1200)
                }).catch(() => {})
            }, 1500)
        },
        async stopSpeakerIfPlaying(t) {
            if (!(!t || !t.id)) try {
                const e = await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/status")}&account_id=${encodeURIComponent(t.accountId)}&device_id=${encodeURIComponent(t.id)}`);
                e.ok && e.success && e.data && e.data.state === "playing" && await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/stop")}`, "POST", {
                    account_id: t.accountId,
                    device_id: t.id
                })
            } catch {}
        },
        startStatusPoll() {
            this.stopStatusPoll(), this.isMiot() && (this.pollTimer = setInterval(() => this.pollOnce(), 15e2))
        },
        stopStatusPoll() {
            this.pollTimer && (clearInterval(this.pollTimer), this.pollTimer = null)
        },
        async pollOnce() {
            if (!this.isMiot()) {
                this.stopStatusPoll();
                return
            }
            try {
                const t = await api(`${PLUGIN_BASE}/miot-proxy?path=${encodeURIComponent("mina/status")}&account_id=${encodeURIComponent(this.current.accountId)}&device_id=${encodeURIComponent(this.current.id)}`);
                if (!t.ok || !t.success || !t.data) return;
                const e = t.data,
                    n = e.is_playing === true || e.state === "playing";
                if (n !== this._lastRaw) {
                    this._lastRaw = n, this._rawCnt = 1
                } else if (this._rawCnt < 2) this._rawCnt++;
                if (this._rawCnt >= 2) {
                    if (playerState.playing !== n) {
                        playerState.playing = n, renderPlayer()
                    }
                    this.castAnchor && (this.castAnchor.playing = n)
                }
                this.paintVolume(e.volume);
                if (this._castSwitchAt && Date.now() - this._castSwitchAt < 15e2) return;
                if (!this.castAnchor) {
                    this.castAnchor = {
                        pos: this._castStartPos || 0,
                        t: performance.now(),
                        playing: n
                    }, this._anchorFresh = !0
                } else if (this._anchorFresh) {
                    this._anchorFresh = !1;
                    const o = Number(e.position) || 0;
                    if (!this._castStartPos && o > 0 && o < 6) this.castAnchor = {
                        pos: o,
                        t: performance.now(),
                        playing: n
                    }
                }
                let d = playerState.duration || 0,
                    disp = this.castAnchor.playing ? this.castAnchor.pos + (performance.now() - this.castAnchor.t) / 1e3 : this.castAnchor.pos;
                if (d > 0 && disp > d) disp = d;
                this.paintProgress(disp, d)
            } catch {}
        },
        paintVolume(t) {
            if (typeof t !== "number" || t < 0) return;
            const e = Math.min(100, Math.max(0, Math.round(t)));
            currentVolume = e / 100, volPaint(e / 100)
        },
        paintProgress(t, e) {
            const n = (o, i) => {
                const a = $(o);
                a && (a.textContent = fmt(i))
            };
            n("npCur", t), n("npDur", e), n("cur", t), n("dur", e);
            const s = o => {
                const i = $(o);
                if (i && e > 0) {
                    const a = Math.round(t / e * 1e3);
                    i.value = a, i.style && i.style.setProperty("--progress", a / 10 + "%")
                }
            };
            s("npSeek"), s("seek")
        }
    };

function ceHtml(t) {
    return String(t ?? "").replace(/[&<>"']/g, e => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[e])
}
let playerState = {
        playing: !1,
        currentSong: null,
        duration: 0,
        position: 0,
        queue: [],
        currentIndex: -1
    },
    playerPosAnchor = null,
    pauseIntent = !1,
    loopRecoverAt = 0,
    playerCoverUrl = null,
    currentLyric = null;
const PLUGIN_VERSION = '__VERSION__';
let currentLyricKey = null,
    lastLyricIndex = -1,
    playMode = "order",
    currentVolume = 1,
    favoriteIds = new Set,
    remoteFavSet = new Set;

function songIdOf(t) {
    if (!t) return "";
    const e = t.song || t.track || t;
    return e.id ?? e.song_id ?? e.songId ?? e.track_id ?? e.trackId ?? ""
}

function extractQueue(t) {
    const e = t.queue ?? t.play_queue ?? t.playQueue ?? t.queue_songs ?? t.queueSongs ?? t.songs ?? t.playlist;
    return (Array.isArray(e) ? e : Array.isArray(e?.songs) ? e.songs : Array.isArray(e?.items) ? e.items : Array.isArray(e?.queue) ? e.queue : []).map(s => s.song || s.track || s).filter(s => s && (s.id || s.title))
}

function extractIndex(t, e) {
    let n = Number.isInteger(t.current_index) ? t.current_index : Number.isInteger(t.currentIndex) ? t.currentIndex : -1;
    const s = songIdOf(t.current_song ?? t.currentSong),
        o = s !== "" ? String(s) : "",
        i = o ? e.findIndex(a => String(songIdOf(a)) === o) : -1;
    return i >= 0 && (n < 0 || n >= e.length || String(songIdOf(e[n])) !== o) ? i : n >= 0 && n < e.length ? n : i
}

function parsePlaying(t, e) {
    const n = t.is_playing ?? t.isPlaying ?? t.playing ?? t.player_state ?? t.playerState ?? t.status;
    if (typeof n == "boolean") return n;
    if (typeof n == "number") return n !== 0;
    if (typeof n == "string") {
        const s = n.toLowerCase();
        if (["paused", "pause", "stopped", "stop", "idle", "false", "0"].includes(s)) return !1;
        if (["playing", "play", "true", "1"].includes(s)) return !0
    }
    return e
}

function parsePosition(t) {
    const e = t.position ?? t.progress ?? t.current_time ?? t.currentTime ?? t.current_position ?? t.currentPosition ?? t.played_seconds ?? t.playback_position ?? t.playbackPosition ?? t.playback_time ?? t.playbackTime ?? t.audio_position ?? t.audioPosition ?? t.elapsed ?? t.offset ?? t.pos,
        n = typeof e == "number" ? e : typeof e == "string" && e.trim() ? Number(e) : NaN;
    return !Number.isFinite(n) || n < 0 ? null : n
}

function parsePlayMode(t) {
    if (!t || typeof t != "object") return null;
    const e = t.play_mode ?? t.playMode ?? t.mode ?? t.repeat_mode ?? t.repeatMode ?? t.playback_mode ?? t.playbackMode;
    if (e == null) return null;
    const n = String(e).toLowerCase().replace(/[-_]/g, ""),
        s = Number(e);
    return n === "order" || n === "sequence" || n === "sequential" || n === "list" || s === 0 ? "order" : n === "loop" || n === "listloop" || n === "listrepeat" || n === "all" || n === "repeatall" || s === 1 ? "loop" : n === "single" || n === "repeat" || n === "one" || n === "repeatone" || n === "singlerepeat" || s === 2 ? "single" : n === "random" || n === "shuffle" || s === 3 ? "random" : n === "singleplay" || n === "playone" || n === "playonce" || n === "once" || n === "onlyone" || s === 4 ? "singlePlay" : (console.log("[playMode] unknown host mode:", e), null)
}

function parseState(t) {
    if (!t || typeof t != "object") return null;
    const e = extractQueue(t),
        n = extractIndex(t, e),
        s = n >= 0 && n < e.length ? e[n] : t.currentSong || null,
        o = Number(t.duration ?? t.playerDuration ?? t.totalDuration ?? (s && s.duration) ?? 0) || 0,
        i = parsePosition(t) ?? 0;
    return {
        queue: e,
        currentIndex: n,
        currentSong: s,
        duration: o,
        position: i
    }
}

function songSourceData(t) {
    if (!t) return null;
    const e = t.source_data || t.sourceData;
    if (!e) return null;
    if (typeof e == "string") try {
        return JSON.parse(e)
    } catch {
        return null
    }
    return e
}

// 当前播放歌曲的权威标识：优先 playerState.currentSong 的 source_data.trackId
// （宿主 applyState 切歌后始终是最新，避免依赖易过期的 curTrack 导致示波器停在上首）；
// curTrack 仅作退化兜底（playXxx 精确设置、或列表尚未从宿主回填时）。
// host songId → 源 trackId 持久映射：ensureSongIds 是所有多源播放的唯一解析入口，
// 因此这里建立的映射能精确把宿主回显的 current_song（只有 host id、无 source_data）映射回列表项（源 trackId），
// 不受 applyState 覆盖 currentSong 影响，切歌（上一首/下一首/播放列表点选）后示波器始终精确跟随。
const hostSongMap = new Map();
// hostSongMap 持久化：该映射是切歌后示波图精确跟随、重启后定位文件夹的唯一可靠来源
// （host id → 源 trackId/path）。它是内存 Map，重启即清空，导致「关掉宿主重开播放列表无法定位」。
// 因此每次写入都同步落盘到 localStorage（去抖），重启后 startup 时回填，使 applyState 首帧即可补回 path。
const HOSTSONGMAP_KEY = "songloft-hostSongMap";
let _hsmSaveTimer = null;
function persistHostSongMap() {
    try {
        // 超出上限时裁剪：保留最近写入的（Map 迭代顺序 ≈ 写入顺序）
        const _MAX = 600;
        if (hostSongMap.size > _MAX) {
            const _keep = new Map();
            const _arr = [...hostSongMap.entries()].slice(-_MAX);
            for (const [k, v] of _arr) _keep.set(k, v);
            hostSongMap.clear();
            for (const [k, v] of _keep) hostSongMap.set(k, v);
        }
        const _obj = {};
        for (const [k, v] of hostSongMap) _obj[k] = v;
        if (_hsmSaveTimer) clearTimeout(_hsmSaveTimer);
        _hsmSaveTimer = setTimeout(() => {
            try {
                // 直连宿主永久存储（mm_hostsongmap），不写浏览器 localStorage
                api(PLUGIN_BASE + "/rest/hostMap", "POST", _obj).catch(() => {})
            } catch (_) {}
        }, 200)
    } catch (_) {}
}
async function restoreHostSongMap() {
    try {
        const r = await api(PLUGIN_BASE + "/rest/hostMap", "GET");
        const _obj = r && r.ok && r.data ? r.data : null;
        if (_obj && typeof _obj === "object") {
            for (const k in _obj) {
                const v = _obj[k];
                if (v && (v.trackId != null || v.path != null)) hostSongMap.set(k, v)
            }
        }
    } catch (_) {}
}
// 包装 hostSongMap.set，自动触发持久化（不改读取语义）
const _hsmOrigSet = hostSongMap.set.bind(hostSongMap);
hostSongMap.set = function (k, v) {
    _hsmOrigSet(k, v);
    persistHostSongMap();
    return hostSongMap
};
// 当前播放队列项：以 playerState.queue + currentIndex 为权威来源。
// 队列项由播放列表构建，同时携带 host id（.id）与源 trackId（.trackId），
// 可把宿主回显的 current_song 精确映射回列表项（源 trackId），
// 避免 applyState 用宿主回显（缺 source_data）覆盖 currentSong 后 curTrack 失准、示波器停在上首。
// 仅当队列项 host id 与当前播放曲一致时才信任，防止陈旧队列误匹配。
function curQueueItem() {
    const q = playerState.queue;
    if (!Array.isArray(q) || playerState.currentIndex < 0 || playerState.currentIndex >= q.length) return null;
    const it = q[playerState.currentIndex];
    if (!it) return null;
    const cs = playerState.currentSong,
        csId = cs ? songIdOf(cs) : null;
    if (csId != null && it.id != null && String(csId) !== String(songIdOf(it))) return null;
    return it
}
// 由宿主回显的 current_song（仅 host id）反查源 trackId：本地播放切歌后 currentSong 无 source_data，
// 但 ensureSongIds 已建立 host id → 源 trackId 映射，可精确匹配列表行。
function curRefFromHost() {
    const cs = playerState.currentSong;
    if (!cs) return null;
    const hid = songIdOf(cs);
    if (hid == null || hid === "") return null;
    const m = hostSongMap.get(String(hid));
    if (m) return { id: String(m.trackId), sourceId: m.sourceId != null ? m.sourceId : currentSourceId };
    return null
}
function curPlayingRef() {
    const h = curRefFromHost();
    if (h) return h;
    const qi = curQueueItem();
    if (qi && qi.trackId != null)
        return { id: String(qi.trackId), sourceId: qi.sourceId != null ? qi.sourceId : currentSourceId };
    const cs = playerState.currentSong;
    if (cs) {
        // 优先 source_data；msmMergeMeta 后顶层 trackId 也携带源 trackId（source_data 可能被宿主回显剥离），两者皆可用。
        const sd = songSourceData(cs);
        const tid = (sd && sd.provider === "multisource-music" && sd.trackId != null) ? String(sd.trackId)
            : (cs.trackId != null ? String(cs.trackId) : null);
        if (tid != null)
            return { id: tid, sourceId: (sd && sd.sourceId != null) ? sd.sourceId : (cs.sourceId != null ? cs.sourceId : currentSourceId) }
    }
    if (curTrack && curTrack.id != null)
        return { id: String(curTrack.id), sourceId: curTrack.sourceId != null ? curTrack.sourceId : currentSourceId };
    return null
}
// 列表项 t 是否为当前播放：id + sourceId 统一比对（任一方缺省则 sourceId 视为匹配）。
function isCurTrack(t) {
    const ref = curPlayingRef();
    if (!ref || !t) return !1;
    // 优先用源 trackId 比对（抽屉队列项 id 是 host sid、trackId 是源；文件夹项 id 是源）。
    // ref.id 始终为源 trackId，故统一以 trackId 为主键；id 仅作兜底。
    const tTrack = t.trackId != null ? String(t.trackId) : null;
    const tId = t.id != null ? String(t.id) : null;
    const match = (tTrack && tTrack === ref.id) || (tId && tId === ref.id);
    if (!match) return !1;
    const sid = t.sourceId != null ? t.sourceId : currentSourceId;
    return ref.sourceId == null || sid == null || sid === ref.sourceId
}

function syncCurTrackFromState() {
    const t = playerState.currentSong;
    if (!t) return;
    const e = songSourceData(t);
    if (e && e.provider === "multisource-music" && e.trackId != null) {
        // 切歌时总是用当前播放曲更新 curTrack（精确 id，绝不保留上一首）：
        // 优先取列表里的完整对象；列表不含该曲（别的视图/队列）则用 source_data 构造最小对象。
        // String 比较避免 id 数字/字符串类型不一致导致匹配失败、示波器停在上首。
        const tid = String(e.trackId);
        const hit = currentList.find(n => String(n.id) === tid) || (isAudiobook() ? folderTracks.find(n => String(n.id) === tid) : null);
        // 重建 curTrack 必须保留 path：否则切歌后 curTrack.path 丢失，highlightPlaying 取不到当前歌曲路径，
        // 文件夹示波图前缀匹配失败（表现=「底栏歌名对、但文件夹/歌曲示波图不亮」）。
        const _p = hit && hit.path != null ? hit.path : (hostSongMap.get(tid) && hostSongMap.get(tid).path != null ? hostSongMap.get(tid).path : null);
        curTrack = hit ? { ...hit } : { id: e.trackId, sourceId: e.sourceId != null ? e.sourceId : currentSourceId, title: t.title, artist: t.artist, album: t.album, path: _p };
        return
    }
    // 非 multisource-music provider（宿主原生音源）退化路径：仅当 curTrack 缺失时按 title 兜底。
    // 本地播放：宿主回显 current_song 无 source_data（我们从未把 source_data 发给宿主），
    // 但 ensureSongIds 已建立 host songId → 源 trackId 映射。命中则精确更新 curTrack（含 album/artist），
    // 让 album/artist 卡片（highlightPlaying 用 curTrack.album/artist 文本匹配）的示波器随切歌切换。
    const hid = songIdOf(t);
    // 1) hostSongMap：本插件显式播放/入库时建立的 host id → 源 trackId 映射
    if (hid != null && hid !== "") {
        const m = hostSongMap.get(String(hid));
        if (m) {
            const tid = String(m.trackId);
            const hit = currentList.find(n => String(n.id) === tid) || (isAudiobook() ? folderTracks.find(n => String(n.id) === tid) : null);
            const _p = hit && hit.path != null ? hit.path : (m.path != null ? m.path : null);
            curTrack = hit ? { ...hit } : { id: m.trackId, sourceId: m.sourceId != null ? m.sourceId : currentSourceId, title: t.title || (hit && hit.title) || "", artist: t.artist || (hit && hit.artist) || "", album: t.album || (hit && hit.album) || "", path: _p };
            return
        }
    }
    // 2) 队列项携带源 trackId（宿主回显队列经 msmMergeMeta 提取）：不依赖 hostSongMap，
    //    覆盖「从未显式 ensure、但已在队列中」的切歌场景（如宿主自动下一首 / 传输键切歌）。
    const qi = curQueueItem();
    if (qi && qi.trackId != null) {
        const tid = String(qi.trackId);
        const hit = currentList.find(n => String(n.id) === tid) || (isAudiobook() ? folderTracks.find(n => String(n.id) === tid) : null);
        const _p = hit && hit.path != null ? hit.path : (qi.path != null ? qi.path : null);
        curTrack = hit ? { ...hit } : { id: qi.trackId, sourceId: qi.sourceId != null ? qi.sourceId : currentSourceId, title: t.title || (hit && hit.title) || "", artist: t.artist || (hit && hit.artist) || "", album: t.album || (hit && hit.album) || "", path: _p };
        return
    }
    // 3) title+artist 兜底：宿主回显既无 source_data、又不在 hostSongMap/队列时，
    //    即使 curTrack 已存在也要校正（旧逻辑被 !curTrack 门控，导致示波器停在上首）。
    //    仅在列表中能唯一匹配、且与当前 curTrack 不同时才更新，避免误匹配。
    if (t.title && currentList.length) {
        const n = currentList.find(s => s.title === t.title && (!t.artist || s.artist === t.artist));
        if (n && (!curTrack || String(curTrack.id) !== String(n.id))) curTrack = n
    }
}

function curTrackKey() {
    const h = curRefFromHost();
    if (h) return {
        sourceId: h.sourceId,
        trackId: h.id
    };
    const qi = curQueueItem();
    if (qi && qi.trackId != null) return {
        sourceId: qi.sourceId != null ? qi.sourceId : currentSourceId,
        trackId: qi.trackId
    };
    const t = playerState.currentSong,
        e = songSourceData(t);
    if (e && e.provider === "multisource-music") return {
        sourceId: e.sourceId,
        trackId: e.trackId
    };
    if (t && currentSourceId) {
        const sid = t.trackId ?? t.id ?? songIdOf(t);
        if (sid != null && sid !== "") {
            // 优先在 currentList 按 id 命中，保证与列表项 id 体系一致
            if (currentList.length) {
                const m = currentList.find(s => String(s.id) === String(sid));
                if (m) return {
                    sourceId: currentSourceId,
                    trackId: String(m.id)
                }
            }
            // 当前列表不含此歌（已切到别的列表/文件夹）：用当前歌自身 id 兜底，
            // 切回包含它的列表时仍可正确定位，实现跨列表/文件夹同步
            return {
                sourceId: currentSourceId,
                trackId: String(sid)
            }
        }
    }
    return null
}
async function coverForSong(t) {
    if (!t || $("modal") && $("modal").classList.contains("show")) return DEFAULT_COVER;
    const e = songSourceData(t);
    if (e && e.provider === "multisource-music" && e.coverId && e.sourceId) try {
        const s = `${PLUGIN_BASE}/cover-data?sourceId=${encodeURIComponent(e.sourceId)}&coverId=${encodeURIComponent(e.coverId)}`;
        if (coverGet(s)) return coverGet(s);
        const i = await (await fetch(s, {
            headers: authHeaders()
        })).json();
        if (i.ok && i.dataUrl) {
            const _d = i.dataUrl;
            if (typeof _d === "string" && (_d.indexOf("data:") === 0 || _d.indexOf("http") === 0)) return coverSet(s, _d), _d
        }
    } catch {}
    const n = t.id ?? t.song_id ?? t.songId;
    if (n) try {
        const s = `${PLUGIN_BASE}/cover-data?songId=${encodeURIComponent(n)}`;
        if (coverGet(s)) return coverGet(s);
        const i = await (await fetch(s, {
            headers: authHeaders()
        })).json();
        if (i.ok && i.dataUrl) {
            const _d = i.dataUrl;
            if (typeof _d === "string" && (_d.indexOf("data:") === 0 || _d.indexOf("http") === 0)) return coverSet(s, _d), _d
        }
    } catch {}
    return DEFAULT_COVER
}

function checkPlayerMarquee() {
    ["pTitle", "pArtist"].forEach(t => {
        const e = $(t);
        if (!e) return;
        const n = e.scrollWidth > e.clientWidth + 2;
        e.classList.toggle("scrolling", n)
    })
}

function toggleMiniPlayer() {
    const t = $("playerBar");
    if (!t) return;
    t.classList.toggle("mini"), document.body.classList.toggle("mini-on", t.classList.contains("mini")), t.classList.contains("mini") || placeBulkBar(), screenLyricOn && positionScreenLyric();
    const e = $("miniDiscImg"),
        n = $("pCov");
    e && n && n.src && (e.src = n.src)
}
function setNpCoverGlow(t) {
    const w = document.querySelector(".np-cover-wrap");
    if (!w || !t || !t.naturalWidth) return;
    try {
        const n = 24;
        const cv = document.createElement("canvas");
        cv.width = cv.height = n;
        const cx = cv.getContext("2d");
        cx.drawImage(t, 0, 0, n, n);
        const dt = cx.getImageData(0, 0, n, n).data;
        let r = 0, g = 0, b = 0, c = 0;
        for (let i = 0; i < dt.length; i += 4) {
            const a = dt[i + 3];
            if (a < 16) continue;
            r += dt[i]; g += dt[i + 1]; b += dt[i + 2]; c++
        }
        if (!c) return;
        r = Math.round(r / c); g = Math.round(g / c); b = Math.round(b / c);
        const mn = Math.min(r, g, b), mx = Math.max(r, g, b, 1);
        // 避免提取出近似白/灰白：浅色封面会让发光在浅色主题下显示为"白色圆角背景"。
        // 仅当整体过亮且饱和度低（接近白色/浅灰白）时才回退到主题强调色（246,44,85）。
        // 深色/黑色封面应跟随其本身颜色（发光自然变暗，几乎不可见），不要强加红色。
        const sat = (mx - mn) / mx;
        const lum = (r + g + b) / (3 * 255);
        if (lum > 0.82 && sat < 0.18) {
            w.style.setProperty("--np-glow-rgb", "246,44,85");
            return
        }
        const k = Math.min(1, 210 / mx);
        r = Math.round(r * k); g = Math.round(g * k); b = Math.round(b * k);
        w.style.setProperty("--np-glow-rgb", r + "," + g + "," + b)
    } catch (e) {}
}
async function renderPlayer() {
    const t = playGen,
        e = playerState.currentSong || curTrack || null;
    // 示波图(eq)动画只在真正播放时显示：停止/暂停即隐藏（保留行高亮），修复「停止后示波图仍显示」。
    document.body.classList.toggle("np-is-playing", !!playerState.playing);
    $("pTitle").textContent = e ? e.title || "\u672A\u77E5\u6807\u9898" : "\u672A\u5728\u64AD\u653E", $("pArtist").textContent = e ? [e.artist, e.album].filter(Boolean).join(" \xB7 ") : "\u9009\u62E9\u4E00\u9996\u6B4C\u66F2\u5F00\u59CB", checkPlayerMarquee();
    const n = playerState.playing ? "pause" : "play";
    setIcon($("playBtn"), n);
    const s = $("npPlayBtn");
    s && setIcon(s, n);
    let o = DEFAULT_COVER;
    if (playerState.currentSong && (o = await coverForSong(playerState.currentSong)), o === DEFAULT_COVER && curTrack && curTrack.coverId) {
        const c = await coverDataUrl(curTrack.coverId);
        c && (o = c)
    }
    if (t !== playGen) return;
    if (o !== playerCoverUrl) {
        $("pCov").onerror = () => coverErrFix($("pCov")), $("pCov").src = o, playerCoverUrl = o;
        const c = $("miniDiscImg");
        c && (c.src = o)
    }
    const i = $("miniDisc");
    i && i.classList.toggle("spin", !!playerState.playing);
    const nf = document.querySelector(".np-panel");
    nf && nf.classList.toggle("playing", !!playerState.playing);
    const a = $("miniRing");
    if (a) {
        const c = playerState.duration || e && Number(e.duration) || 0,
            d = c > 0 ? Math.min(100, Math.max(0, (playerState.position || 0) / c * 100)) : 0;
        a.style.setProperty("--disc-progress", d)
    }
    const r = playerState.duration || e && Number(e.duration) || 0;
    $("dur").textContent = fmt(r);
    let l = playerState.position || 0;
    if (r > 0 && l > r) l = r;
    if ($("cur").textContent = fmt(l), r > 0) {
        $("seek").value = Math.min(1e3, Math.floor(l / r * 1e3));
        const c = Math.min(100, Math.max(0, l / r * 100));
        $("seek").style.setProperty("--progress", c + "%")
    }
    $("npMask").classList.contains("show") && ($("npTitle").textContent = e ? e.title || "\u672A\u77E5\u6807\u9898" : "\u672A\u5728\u64AD\u653E", $("npArtist").textContent = e ? [e.artist, e.album].filter(Boolean).join(" \xB7 ") : "", (async () => {
        let c = DEFAULT_COVER;
        if (playerState.currentSong && (c = await coverForSong(playerState.currentSong)), c === DEFAULT_COVER && curTrack && curTrack.coverId) {
            const d = await coverDataUrl(curTrack.coverId);
            d && (c = d)
        }
        if (t === playGen) {
            const npImg = $("npCover");
            safeShowCover(npImg, c, function () { setNpCoverGlow(npImg) });
            npImg.complete && npImg.naturalWidth && setNpCoverGlow(npImg)
        }
    })()), updateLyricHighlight(), highlightPlaying()
}

let locatedPlayingKey = null;

function locatePlaying() {
    const e = document.querySelector(".track.playing") || document.querySelector(".card.playing-collection .cov-wrap.playing") || document.querySelector(".cov-wrap.playing");
    if (e) try {
        e.scrollIntoView({
            block: "center"
        })
    } catch (_) {}
}

// 仅在「正在播放」时定位当前播放歌曲；未播放则保留原定位（不强行滚动）。
// 以 音源|曲目 为键去重：同一首只滚动一次；切歌后键变化会重新定位；
// 若当前列表尚未渲染出该曲目（如刚进入插件、宿主还未回填 currentSong），
// 则不记录，留待后续 highlightPlaying（轮询/渲染）再次出现时再尝试。
function curPlayingKey() {
    const t = curTrackKey();
    return (playerState.playing && t) ? (t.sourceId + "|" + t.trackId) : null;
}

function maybeLocatePlaying() {
    const key = curPlayingKey();
    if (!key) {
        locatedPlayingKey = null;
        return
    }
    if (key === locatedPlayingKey) return;
    const el = document.querySelector(".track.playing") || document.querySelector(".pl-item.active") || document.querySelector(".card.playing-collection .cov-wrap.playing") || document.querySelector(".cov-wrap.playing");
    if (el) {
        locatedPlayingKey = key;
        try {
            el.scrollIntoView({
                block: "center"
            })
        } catch (_) {}
    }
}

// 切歌/进视图后，若当前播放曲的行尚未渲染进 DOM（列表为增量加载/无限滚动，
// 播放曲可能在未加载区间），则按数据集索引精确加载后续分页直到该行出现，
// 再滚动到它，使示波图(eq)可见并跟随。行一旦渲染即由 trackRow(isCurTrack) 自带 .playing。
// 若播放曲本就不在当前视图数据集，则不动（避免无意义加载整个列表）。
let lastSongChangeAt = 0;
let eqNeedLocate = !1;
async function ensurePlayingRowVisible() {
    eqNeedLocate = !1;
    // 已可见：仅定位即可
    if (document.querySelector(".track.playing")) {
        locatePlaying();
        return
    }
    const key = curPlayingKey();
    if (!key) return;
    const _p = key.indexOf("|");
    const sid = key.slice(0, _p),
        tid = key.slice(_p + 1);
    const list = view === "folders" ? folderTracks : currentList;
    if (!list || !list.length) return;
    const idx = list.findIndex(x => String(x.id) === String(tid) && (x.sourceId == null || String(x.sourceId) === String(sid)));
    if (idx < 0) return;
    let guard = 0;
    while (!document.querySelector(".track.playing") && guard < 100) {
        const rendered = view === "folders" ? folderTracks.length : currentList.length;
        if (idx < rendered) {
            // 已在 DOM：兜底再高亮一次（防止渲染早于 curTrack 就绪）
            highlightPlaying(!1);
            break
        }
        const hasMore = view === "folders" ? folderTracks.length < folderTotal : (drill ? currentList.length < drillTotal : (!searchActive && currentList.length < listTotal));
        if (!hasMore) break;
        await loadNextPage();
        await new Promise(r => requestAnimationFrame(r));
        guard++
    }
    const el = document.querySelector(".track.playing");
    if (el) try {
        el.scrollIntoView({
            block: "center"
        })
    } catch (_) {}
}

// 当前播放歌曲的「行标识」：优先以队列项（源 trackId）为权威，
// 再退化到 curTrack / curTrackKey，确保切歌后定位到正确行。
function playingRowId() {
    const h = curRefFromHost();
    if (h) return { id: h.id, sourceId: h.sourceId };
    const qi = curQueueItem();
    if (qi && qi.trackId != null) return {
        id: String(qi.trackId),
        sourceId: qi.sourceId != null ? qi.sourceId : currentSourceId
    };
    if (curTrack && curTrack.id != null) return {
        id: String(curTrack.id),
        sourceId: curTrack.sourceId != null ? curTrack.sourceId : currentSourceId
    };
    return curTrackKey()
}

function highlightPlaying(locate = !0) {
    if (isAudiobook()) {
        markFolderPlaying();
    } else {
        document.querySelectorAll(".track").forEach(e => {
            const on = isCurTrack({ id: e.dataset.id, sourceId: e.dataset.sourceId });
            e.classList.toggle("playing", on);
            const w = e.querySelector(".cov-wrap");
            w && w.classList.toggle("playing", on)
        });
    }
    if (isAudiobook()) {
        // 有声书：当前播放的「那一集」也要用示波图标出（track row 的 .playing 已由 isCurTrack 判定）。
        document.querySelectorAll(".track").forEach(e => {
            const on = isCurTrack({ id: e.dataset.id, sourceId: e.dataset.sourceId });
            e.classList.toggle("playing", on);
            const w = e.querySelector(".cov-wrap");
            w && w.classList.toggle("playing", on)
        });
    }
    // 抽屉播放列表即队列本身，currentIndex 是权威位置；直接按序号匹配，
    // 绝不依赖易过期的 curTrack / trackId，避免「切了好几首仍停在第一首」。
    const curIdx = playerState.currentIndex;
    document.querySelectorAll(".pl-item").forEach(p => {
        const on = Number(p.dataset.i) === curIdx;
        p.classList.toggle("active", on)
    });
    const folderCards = [];
    document.querySelectorAll(".card").forEach(c => {
        const k = c.dataset.kind,
            name = c.dataset.name;
        let on = !1;
        if (k === "album" || k === "artist") {
            if (curTrack) {
                if (k === "album" && curTrack.album && name === curTrack.album) on = !0;
                else if (k === "artist" && curTrack.artist && name === curTrack.artist) on = !0
            }
        } else if (k === "playlist") {
            // 歌单 / 歌单文件夹（playlist folder）卡片：当前正在播放的歌单即点亮其封面示波图。
            // 进网格时 drill 会被 loadView 置空，故以 activePlaylistId（播放歌单时记录，跨视图保留）为准，
            // 同时兼容 drill 仍指向该歌单的场景。覆盖「普通歌单」与「歌单视图里的文件夹」两类卡片。
            if ((drill && drill.type === "playlist" && String(drill.id) === String(c.dataset.id)) || (activePlaylistId != null && String(activePlaylistId) === String(c.dataset.id))) on = !0
        } else if (c.classList.contains("folder-card")) {
            // 文件夹卡片收集后统一处理（仅点亮最深一张，避免双示波图）
            folderCards.push(c);
            return
        }
        c.classList.toggle("playing-collection", on);
        const w = c.querySelector(".cov-wrap");
        w && w.classList.toggle("playing", on)
    });
    // 文件夹卡片：仅点亮「当前歌曲所在（含祖先）文件夹」中路径最长（最深）的一张，
    // 避免同时点亮多个祖先文件夹造成的「双示波图」；定位(locate)也只会滚到这唯一一张。
    {
        let _cp = (playerState.currentSong && playerState.currentSong.path) || (curTrack && curTrack.path) || "";
        if (!_cp) {
            const _ref = curPlayingRef();
            if (_ref) {
                const _hm = hostSongMap.get(String(_ref.id));
                if (_hm && _hm.path) _cp = _hm.path
            }
        }
        // 有声书歌曲 path 带 "audiobook/" 前缀（如 "audiobook/单田芳/第01回.mp3"），
        // 而文件夹卡片 dataset.path 不带前缀（"单田芳"）。剥离前缀使前缀匹配能直接命中，
        // 无需依赖 activeFolderId/abLast 兜底。
        if (_cp && _cp.indexOf("audiobook/") === 0) _cp = _cp.slice("audiobook/".length);
        let _deepest = null,
            _deepestLen = -1;
        for (const c of folderCards) {
            const fp = c.dataset.path || c.dataset.id || "";
            let on = !1;
            if (fp) {
                if (_cp && (_cp === fp || _cp.indexOf(fp + "/") === 0 || _cp.indexOf(fp + "\\") === 0)) on = !0;
                // cp 缺失时退回 activeFolderId（切歌时已同步为当前歌曲所在文件夹）
                else if (!_cp && activeFolderId != null && String(activeFolderId) === String(fp)) on = !0
            }
            if (on && fp.length > _deepestLen) _deepestLen = fp.length, _deepest = c
        }
        // 前缀匹配未点亮任何卡片时，兜底点亮逻辑（避免「闪一下就熄灭」）：
        // 1) activeFolderId 精确命中某张卡片 → 点亮（播放某集/切歌时已同步为当前书文件夹）
        // 2) 有声书再退一步：用 abLast().folder（最后播放的「那本书」路径）兜底，
        //    覆盖 path 带源前缀不匹配、后端 browseDeep 未重启、activeFolderId 未更新的场景。
        // 注意：无论 _cp 是否存在都尝试兜底——前缀常因 audiobook/ 等源前缀不一致而失效。
        if (!_deepest) {
            const _fids = [];
            if (activeFolderId != null) _fids.push(String(activeFolderId));
            if (isAudiobook()) {
                // 优先用 abPlayFolder（播放时记录的真实书路径，已去前缀），其次 abLast().folder
                const _alf = abPlayFolder || (abLast() && abLast().folder);
                if (_alf != null && _alf !== "") _fids.push(String(_alf))
            }
            if (_fids.length) {
                let _bl = -1;
                for (const c of folderCards) {
                    const fp = c.dataset.path || c.dataset.id || "";
                    if (fp && _fids.indexOf(String(fp)) >= 0 && fp.length > _bl) _bl = fp.length, _deepest = c
                }
            }
        }
        for (const c of folderCards) {
            const on = c === _deepest;
            c.classList.toggle("playing-collection", on);
            const w = c.querySelector(".cov-wrap");
            w && w.classList.toggle("playing", on)
        }
    }
    locate && maybeLocatePlaying();
    eqNeedLocate && ensurePlayingRowVisible();
    feEqDiag({
        where: "highlightPlaying"
    });
    // === 临时诊断浮层（排查文件夹示波图，后续移除）===
    try {
        let dbg = document.getElementById("eqDiagBox");
        if (!dbg) {
            dbg = document.createElement("div");
            dbg.id = "eqDiagBox";
            dbg.style.cssText = "position:fixed;left:6px;bottom:6px;z-index:99999;max-width:46vw;background:rgba(0,0,0,.82);color:#0f0;font:11px/1.4 monospace;padding:6px 8px;border-radius:6px;white-space:pre-wrap;pointer-events:none";
            document.body.appendChild(dbg)
        }
        const fcs = folderCards.map(c => c.dataset.path || c.dataset.id);
        dbg.textContent = "[EQ诊断] np-playing=" + document.body.classList.contains("np-is-playing") +
            "\nactiveFolderId=" + activeFolderId +
            "\nabLast.folder=" + (abLast() && abLast().folder) +
            "\n_cp=" + ((playerState.currentSong && playerState.currentSong.path) || (curTrack && curTrack.path) || "") +
            "\nfolderCards(" + fcs.length + ")=" + fcs.slice(0, 6).join(" | ") +
            "\ndeepest=" + (_deepest && (_deepest.dataset.path || _deepest.dataset.id));
        // 仅在播放时显示，避免打扰浏览
        dbg.style.display = document.body.classList.contains("np-is-playing") ? "block" : "none"
    } catch (e) {}
}

// 底层兜底：监听任意新插入的 .track / .card，自动按当前播放状态打标记。
// 这样无论哪个视图渲染、未来新增什么视图，示波器都自动同步，
// 不再需要（也不依赖）每个渲染函数手动调用 highlightPlaying。
(function setupPlayingHighlightObserver() {
    const start = () => {
        const body = document.body;
        if (!body) return;
        let scheduled = !1;
        const obs = new MutationObserver(muts => {
            let hit = !1;
            for (const m of muts) {
                for (const nn of m.addedNodes) {
                    if (nn.nodeType === 1) {
                        if (nn.classList && (nn.classList.contains("track") || nn.classList.contains("card") || nn.classList.contains("pl-item"))) { hit = !0; break }
                        if (nn.querySelector && nn.querySelector(".track,.card,.pl-item")) { hit = !0; break }
                    }
                }
                if (hit) break
            }
            if (!hit || scheduled) return;
            scheduled = !0;
            requestAnimationFrame(() => {
                scheduled = !1;
                // 重进插件等场景下 curTrack 可能尚未恢复（恢复依赖 currentList 已加载，
                // 而宿主状态推送常早于列表拉取），这里兜底尝试恢复，确保列表渲染后示波器能标上。
                if (!curTrack && playerState.currentSong && currentList.length) syncCurTrackFromState();
                highlightPlaying(!1)
            })
        });
        obs.observe(body, { childList: !0, subtree: !0 });
        // 歌词偏移控件：折叠小图标 + 点击展开竖向滑块（上=延迟/正，下=提前/负，0 在中间）
        const offToggle = $("lrcOffToggle");
        offToggle && offToggle.addEventListener("click", e => {
            e.stopPropagation();
            const box = $("lrcOffset");
            box && box.classList.toggle("expanded");
            updateLrcOffsetUI()
        });
        // 点击界面其他位置自动收起展开中的滑块。
        // 用捕获阶段（capture）注册，避免被详情页上层（如 npMask）在冒泡阶段 stopPropagation 拦截；
        // 控件内部（图标/滑块/圆点）都包含在 box 内，不会被误关。
        const closeOffsetOnOutside = e => {
            const box = $("lrcOffset");
            if (box && box.classList.contains("expanded") && !box.contains(e.target)) box.classList.remove("expanded")
        };
        document.addEventListener("click", closeOffsetOnOutside, !0);
        document.addEventListener("touchstart", closeOffsetOnOutside, { capture: !0, passive: !0 });
        const offTrack = $("lrcOffTrack"),
            offThumb = $("lrcOffThumb");
        if (offTrack) {
            let dragging = !1;
            const ratioFromEvent = e => {
                const r = offTrack.getBoundingClientRect();
                return (e.clientY - r.top) / r.height
            };
            const thumbCenterRatio = () => {
                if (!offThumb) return lrcOffsetToRatio();
                const r = offTrack.getBoundingClientRect(),
                    tr = offThumb.getBoundingClientRect();
                return (tr.top + tr.height / 2 - r.top) / r.height
            };
            const onDrag = e => setLrcOffsetFromRatio(ratioFromEvent(e));
            const nudge = dir => {
                // dir>0 向上(延迟/+) dir<0 向下(提前/-)，每次微调 0.2s
                const v = Math.round((getLyricOffset() + dir * 0.2) * 10) / 10;
                saveLyricOffset(v);
                updateLrcOffsetUI();
                if ($("npMask") && $("npMask").classList.contains("show")) updateLyricHighlight()
            };
            offTrack.addEventListener("pointerdown", e => {
                e.stopPropagation();
                const cr = offThumb ? offThumb.getBoundingClientRect() : null;
                const onThumb = cr && e.clientY >= cr.top - 8 && e.clientY <= cr.bottom + 8;
                if (onThumb) {
                    dragging = !0;
                    offTrack.setPointerCapture && offTrack.setPointerCapture(e.pointerId);
                    onDrag(e)
                } else {
                    // 点击空白：命中中线(0刻度)直接复位为 0
                    const p = ratioFromEvent(e);
                    if (Math.abs(p - 0.5) < 0.04) {
                        saveLyricOffset(0);
                        updateLrcOffsetUI();
                        if ($("npMask") && $("npMask").classList.contains("show")) updateLyricHighlight()
                    } else {
                        // 否则相对滑块位置微调 ±0.2s，不跳转定位
                        nudge(p < thumbCenterRatio() ? 1 : -1)
                    }
                }
            });
            offTrack.addEventListener("pointermove", e => {
                if (!dragging) return;
                e.stopPropagation();
                onDrag(e)
            });
            const endDrag = () => { dragging = !1 };
            offTrack.addEventListener("pointerup", endDrag);
            offTrack.addEventListener("pointercancel", endDrag);
            offTrack.addEventListener("click", e => e.stopPropagation());
            // 滑块内的手势不应触发歌词面板滚动/拖拽
            ["touchstart", "touchmove", "mousedown", "dblclick"].forEach(ev => offTrack.addEventListener(ev, e => e.stopPropagation()))
        }
        updateLrcOffsetUI()
    };
    "loading" === document.readyState ? document.addEventListener("DOMContentLoaded", start) : start()
})();

function _diagApply(t) {
    // 真机埋点：把 applyState 收到的宿主原始回显 + 关键内部状态，回传到宿主 /rest/kv（songloft_eqprobe），
    // 用于真机实证定位切歌/重启 bug（不依赖浮层、不依赖本地日志）。保留最近 40 条。
    try {
        const n = (typeof t === "object" && t) ? t : {};
        // 精简回显：只保留定位所需字段，避免超大对象
        const slim = (x) => {
            if (!x || typeof x !== "object") return x;
            if (Array.isArray(x)) return x.slice(0, 6).map(slim);
            const o = {};
            for (const k of ["id", "song_id", "trackId", "title", "artist", "album", "path", "source_data", "sourceData", "current_song", "current_index", "currentIndex", "queue", "playing", "is_playing", "position", "duration"]) {
                if (k in x) o[k] = slim(x[k])
            }
            return o
        };
        const cs = n.currentSong || n.current_song || {};
        const entry = {
            ts: Date.now(),
            raw: slim(n),
            a: songIdOf(cs) || "",
            ph: playingHostId != null ? String(playingHostId) : "",
            pre: preHostId != null ? String(preHostId) : "",
            pend: pendingTarget ? pendingTarget.songId : "",
            curTitle: (playerState.currentSong && playerState.currentSong.title) || "",
            curPath: (playerState.currentSong && playerState.currentSong.path) || ""
        };
        let arr = [];
        try { arr = JSON.parse(localStorage.getItem("songloft-eqdiag") || "[]") } catch {}
        arr.push(entry);
        if (arr.length > 40) arr = arr.slice(-40);
        localStorage.setItem("songloft-eqdiag", JSON.stringify(arr));
        // 回传服务端（忽略失败，不影响主流程）
        try {
            const payload = {};
            payload["songloft_eqprobe"] = JSON.stringify(arr);
            api(PLUGIN_BASE + "/rest/kv", "POST", payload).catch(() => {})
        } catch (_) {}
    } catch {}
}
function applyState(t, e = "event") {
    _diagApply(t);
    if (!t || typeof t != "object") return;
    const n = parseState(t);
    if (!n) return;
    // 清空队列期间：忽略宿主回弹（setQueue([]) 后宿主可能自动恢复上次队列并广播 onStateChange），
    // 强制维持前端清空态，直到用户主动播放（loadAndPlay 等会复位 queueClearGuard）。
    // 置于最顶，覆盖所有分支（含 CastManager.isMiot）。
    if (queueClearGuard) {
        playerState = {
            ...playerState,
            queue: [],
            currentIndex: -1,
            currentSong: null,
            playing: !1,
            position: 0
        }, playerPosAnchor = null, renderPlayer(), renderPlaylist(), renderExtraControls();
        return
    }
    // 「用户已清空队列」持久标记：返回宿主再进入插件时前端内存重置、queueClearGuard 归零，
    // 但宿主可能把队列自动推回。此时强制保持前端清空态，直到用户主动点歌播放（loadAndPlay 清除标记）。
    if (localStorage.getItem("mm:queueCleared") === "1") {
        // 清空后设备可能自动续播/跳播到某一首（setQueue([]) 被忽略、逐项删除触发跳播、队列空后被音箱自动续播等）。
        // 持续按下暂停，直到用户主动点歌播放（loadAndPlay 清除该标记）。只针对设备侧，不影响前端已清空的空态。
        if (n && n.playing) {
            try {
                if (Player.available() && Player.has("pause")) Player.pause().catch(() => {})
            } catch (_) {}
        }
        playerState = {
            ...playerState,
            queue: [],
            currentIndex: -1,
            currentSong: null,
            playing: !1,
            position: 0
        }, playerPosAnchor = null, renderPlayer(), renderPlaylist(), renderExtraControls();
        return
    }
    // 切换音源导入过程中：暂不接受宿主回弹，避免旧源队列/自动续播覆盖刚导入的新源队列。
    if (queueRestoreGuard) return;
    // 有声书：宿主队列以「滑动窗口」维护（abSetHostWindow 仅放 21 首），前端队列必须以完整文件夹为准。
    // 当宿主在播却前端队列为空（如切换音源被清空后宿主自动续播、或单集播放未写入队列），
    // 从 abFolderList 重建，避免「抽屉为空却在播」。
    if (isAudiobook() && n.queue && n.queue.length && (!playerState.queue || !playerState.queue.length)) {
        (async () => {
            try {
                if (!abFolderList.length) {
                    const _fp = folderPath || (abLast() && abLast().folder) || "";
                    if (_fp) {
                        const _re = await api(PLUGIN_BASE + "/batch/tracks", "POST", {
                            sourceId: currentSourceId,
                            items: [{
                                kind: "folder",
                                id: _fp,
                                path: _fp
                            }]
                        });
                        if (_re && _re.ok && Array.isArray(_re.list) && _re.list.length) {
                            abFolderList = sortTracksByName(_re.list);
                            abFolderPath = _fp;
                            abFolderListSave()
                        }
                    }
                }
                if (abFolderList.length) {
                    const _sm = abSongMap();
                    let book = abFolderList.map(x => {
                        const _srcId = String(x.trackId != null ? x.trackId : x.id);
                        const c = _sm[_srcId];
                        return c && c.sid ? {
                            id: Number(c.sid),
                            trackId: _srcId,
                            title: x.title,
                            artist: x.artist,
                            coverId: x.coverId,
                            album: x.album
                        } : null
                    }).filter(Boolean);
                    if (!book.length) book = abFolderList.map(x => ({
                        id: null,
                        trackId: x.id,
                        title: x.title,
                        artist: x.artist,
                        coverId: x.coverId,
                        album: x.album
                    }));
                    const csid = n.currentSong ? String(songIdOf(n.currentSong)) : null;
                    let newIdx = 0;
                    if (csid != null) {
                        const fi = book.findIndex(x => String(songIdOf(x)) === csid);
                        if (fi >= 0) newIdx = fi
                    }
                    playerState = {
                        ...playerState,
                        queue: book.map(msmMergeMeta),
                        currentIndex: newIdx
                    };
                    renderPlaylist()
                }
            } catch (_) {}
        })()
    }
    if (CastManager.isMiot() && !isAudiobook()) {
        n.queue && n.queue.length && (playerState = {
            ...playerState,
            queue: n.queue.map(msmMergeMeta),
            currentIndex: n.currentIndex
        }, renderPlaylist());
        const u = n.currentSong;
        u && u.id && String(songIdOf(u)) !== String(songIdOf(playerState.currentSong)) && (playerState = {
            ...playerState,
            currentSong: msmMergeMeta(u),
            duration: n.duration
        }, renderPlayer(), clearNowPlayingUI(), hydrateNowPlaying(), $("npMask").classList.contains("show") && renderNowPlaying());
        return
    }
    if (n.queue && n.queue.length && !pendingTarget) {
        const _bi = playerState.currentIndex;
        {
            const _hs = playingHostId != null ? playingHostId : (n.currentSong ? songIdOf(n.currentSong) : null);
            if (_hs != null) {
                const _fi = (playerState.queue || []).findIndex(x => String(songIdOf(x)) === String(_hs));
                if (_fi >= 0) playerState.currentIndex = _fi
            }
        }
        if (_bi !== playerState.currentIndex) {
            const _ci = playerState.currentIndex;
            // 仅在「自然顺序播下一集」(_bi+1 === _ci，上一首结束自动跳下一首) 时，
            // 才把前端抽屉列表随播扩展 1 集并同步宿主窗口随播滑动；
            // 重开/刷新/随机跳转(_ci 为任意值)不扩展，保证抽屉回到默认 20 条懒加载。
            if (_bi >= 0 && _ci === _bi + 1 && isAudiobook() && _ci >= 10) {
                if (_ci + 1 > plRendered) plRendered = Math.min((playerState.queue || []).length, _ci + 1);
                syncHostWindow(_ci)
            }
            renderPlaylist()
        }
    }
    let s = parsePlaying(t, playerState.playing);
    pendingTarget && (s = !0);
    const o = n.position;
    abPersistProgress(s, o);
    o != null ? playerPosAnchor = {
        pos: o,
        t: performance.now(),
        playing: s
    } : playerPosAnchor && (playerPosAnchor.playing = s);
    const i = playingHostId != null ? playingHostId : songIdOf(playerState.currentSong),
        a = songIdOf(n.currentSong),
        r = !!a && String(a) !== "" && String(a) !== String(i) && String(a) !== String(preHostId || "");
    if (r && (eqNeedLocate = !0, pauseIntent = !1), r) {
        // 换曲时稳健记录当前集合（覆盖队列抽屉切歌 / 宿主自动续播等绕过 loadAndPlay 的路径）：
        // - 停在歌单 drill 内 → 点亮该歌单卡片（含歌单文件夹）
        // - 文件夹视图 → 记录当前目录（兜底用，主匹配已由歌曲 path 前缀推导）
        // - 专辑/歌手等非歌单视图 → 清空歌单高亮
        if (drill && drill.type === "playlist") activePlaylistId = drill.id;
        else if (view === "folders") {
            // 不覆盖 activeFolderId：播放子文件夹时 playDirectory 已写入正确值（该子文件夹路径）；
            // 歌曲路径前缀匹配由 highlightPlaying 负责点亮其所在及祖先文件夹，父目录 folderPath 既非卡片也不该点亮。
            activePlaylistId = null
        } else if (view === "albums" || view === "artists") activePlaylistId = null
    }
    if (pauseIntent && s && !r) {
        try {
            Player.has("pause") && Player.pause()
        } catch (u) {
            console.warn("[player] guard pause failed", u)
        }
        s = !1, playerPosAnchor && (playerPosAnchor.playing = !1)
    }
    const _pt = pendingTarget;
    if (_pt && Date.now() - _pt.t > 25e2) pendingTarget = null; // 超时清除：pendingTarget 仅用于「切歌瞬间强制 playing」，不用于冻结显示
    // 用插件记录的正在播 host id(playingHostId) 定位 currentSong，而非依赖滞后的宿主回显 currentSong。
    // 仅当回显指向「既非当前目标、也非上一首」时，才接受它为新目标（自然下一首 / 宿主自动切歌）。
    if (playingHostId != null && a !== "" && String(a) !== String(playingHostId) && String(a) !== String(preHostId || "")) {
        playingHostId = String(a)
    }
    (playerState.playing !== s || Math.floor(playerState.position) !== Math.floor(o) || r) && console.log("[player] applyState", e, {
        playing: s,
        idx: n.currentIndex,
        song: n.currentSong && n.currentSong.title
    });
    let c = t.volume ?? t.playerVolume ?? t.player_volume ?? t.vol;
    if (c && typeof c == "object" && (c = c.value ?? c.volume ?? c.level ?? c.current ?? c.amount), console.log("[vol] reason=" + e, "rawVol=", c, "parsed=", typeof c == "number" && isFinite(c) ? c > 1 ? c / 100 : c : null, "cur=", currentVolume), typeof c == "number" && isFinite(c)) {
        const u = c > 1 ? c / 100 : c;
        Math.abs(u - currentVolume) > .02 && (currentVolume = Math.max(0, Math.min(1, u)), volPaint(currentVolume), renderExtraControls())
    }
    const d = parsePlayMode(t);
    d && d !== playMode && (playMode = d, scheduleSaveState()), queueClearGuard ? (playerState = {
        ...playerState,
        position: o,
        playing: !1
    }, renderPlayer(), renderExtraControls()) : (function() {
        const _q = (playerState.queue || []);
        // 反填 hostSongMap：队列项若携带源 trackId（msmMergeMeta 提取），建立 host id → 源 trackId
        // 映射，使 curRefFromHost（curPlayingRef 第一优先分支）在宿主自动切歌时也能精确解析，
        // 不依赖「该曲是否曾被本插件显式 ensure」。
        for (const it of _q) {
            const sid = songIdOf(it);
            if (sid != null && it.trackId != null) hostSongMap.set(String(sid), {
                trackId: String(it.trackId),
                sourceId: it.sourceId != null ? it.sourceId : currentSourceId
            })
        }
        // ⚠️ 根因修复（"声音是新歌、界面回退上一首"第二轮）：
        // 之前 _wantId 优先用 playingHostId（上一次「插件发起」切歌时记录的 host id）。
        // 但当切歌由【宿主自发】触发（自动下一首 / 系统通知 / 传输键）时，并没有新的 pendingTarget，
        // 此时 playingHostId 仍是陈旧的「上一首」id，_fi 在队列里命中上一首 → _newCs 锁死上一首 → 回退。
        // 正确优先级：
        //   1) 用户刚点歌（pendingTarget 在窗口期且宿主回显与之一致）→ 强制用源对象 pendingTarget.track（含 path，权威）
        //   2) 否则 → 用宿主【当帧推送】的 n.currentSong 作为在播歌（这是真实在播的那首，比陈旧的 playingHostId 可靠）
        //   3) 兜底 → playingHostId（仅当 n.currentSong 缺失时）
        const _aId = a != null ? String(a) : "";
        const _ptOk = pendingTarget && Date.now() - pendingTarget.t < 25e2 &&
            (_aId !== "" && (String(_aId) === String(pendingTarget.songId) || _aId === String(pendingTarget.trackId)));
        let _newCs;
        if (_ptOk) {
            // 用户刚点歌且宿主确认就是这首歌：用源对象（含 path，权威），绝不依赖滞后回显
            _newCs = pendingTarget.track || n.currentSong
        } else {
            // 宿主当帧回显的在播歌，优先用它定位（真实在播的那首，不依赖陈旧的 playingHostId）
            const _hostId = n.currentSong ? songIdOf(n.currentSong) : null;
            const _wantId = _hostId != null && String(_hostId) !== "" ? _hostId : (playingHostId != null ? playingHostId : null);
            // 切歌定位：优先在前端队列里按真实在播的 host id 找（队列项带 path，最理想）。
            // 关键修复：当在播的歌不在前端队列里时（如通过宿主/传输键切到文件夹·收藏夹·随机续播的歌，
            // 前端队列是另一批），绝对不能用宿主的 n.currentIndex 去索引前端队列——
            // 两套队列不对应，会捞到位置错位的旧歌，导致「声音是新歌、界面回退到上一首」。
            // 此时直接用宿主当前曲 n.currentSong（真实在播的那首，id/标题正确）作为界面 currentSong，
            // 再靠下方 path 补缺逻辑（curTrack / hostSongMap）填回 path。_newIdx 仅用于队列内定位，找不到置 -1。
            const _fi = _wantId != null && String(_wantId) !== "" ? _q.findIndex(x => String(songIdOf(x)) === String(_wantId)) : -1;
            _newCs = _fi >= 0 ? _q[_fi] : (n.currentSong || null)
        }
        const _newIdx = (function() {
            const _id = _newCs ? songIdOf(_newCs) : null;
            return _id != null && String(_id) !== "" ? _q.findIndex(x => String(songIdOf(x)) === String(_id)) : -1
        })();
        const _cs = msmMergeMeta(_newCs);
        // 统一 currentSong.id 为正在播的 host id（与 playingHostId 同坐标系），确保后续 songIdOf / 列表高亮 / hostSongMap 一致
        const _wantId = (function() {
            if (_ptOk && pendingTarget) return pendingTarget.trackId != null ? String(pendingTarget.trackId) : (pendingTarget.songId != null ? String(pendingTarget.songId) : null);
            const _id = _newCs ? songIdOf(_newCs) : null;
            return _id != null && String(_id) !== "" ? String(_id) : (playingHostId != null ? playingHostId : null)
        })();
        if (_wantId != null && String(_wantId) !== "") { _cs.id = String(_wantId); _cs.song_id = String(_wantId); }
        // 优先补齐当前歌曲路径：队列项 > curTrack > hostSongMap，写回 _cs.path，
        // 使 currentSong.path 恒有值（文件夹示波图跟随 + 自动定位的唯一可靠来源）。
        let _finalPath = _cs.path != null ? _cs.path : null;
        if (_finalPath == null && _q[_newIdx] && _q[_newIdx].path != null) _finalPath = _q[_newIdx].path;
        if (_finalPath == null && curTrack && curTrack.path != null) _finalPath = curTrack.path;
        if (_finalPath == null) {
            const _ref = curPlayingRef();
            if (_ref) {
                const _hm = hostSongMap.get(String(_ref.id));
                if (_hm && _hm.path) _finalPath = _hm.path
            }
        }
        if (_finalPath != null && _cs.path == null) _cs.path = _finalPath;
        // 当前播放曲 host id → 源 trackId 直接登记：宿主回显同时带 id(host) 与 trackId(源)，
        // 覆盖「宿主/箭头音乐传输键切歌未经过本插件 ensureSongIds」的情况，
        // 确保切菜单/切歌后示波器始终能从 hostSongMap 解析到正确 trackId（不再依赖可能过期的 curTrack）。
        {
            const _sid = songIdOf(_cs);
            const _sd = songSourceData(_cs);
            const _tid = (_sd && _sd.provider === "multisource-music" && _sd.trackId != null) ? String(_sd.trackId) : (_cs.trackId != null ? String(_cs.trackId) : null);
            if (_sid != null && _tid != null) {
                const _ex = hostSongMap.get(String(_sid)) || {};
                const _p = (_finalPath != null ? _finalPath : (_ex.path != null ? _ex.path : null));
                hostSongMap.set(String(_sid), {
                    trackId: _tid,
                    sourceId: (_sd && _sd.sourceId != null) ? _sd.sourceId : (_cs.sourceId != null ? _cs.sourceId : currentSourceId),
                    path: _p != null ? String(_p) : null
                })
            }
        }
        // 切歌（r）时把 activeFolderId 同步成当前播放曲所在文件夹（歌曲路径的父目录），
        // 使文件夹示波图随切歌跟随：旧文件夹卡片的 activeFolderId 兜底不再命中→熄灭，
        // 新文件夹靠 path 前缀匹配（及该兜底）点亮。覆盖「抽屉切歌 / 宿主自动续播」绕过 playDirectory 的路径。
        if (r) {
            // 有声书：文件夹卡片 dataset.path 无源前缀（如 "单田芳-隋唐演义"），
            // 而 currentSong.path 常带 "audiobook/" 前缀，直接从其推导父目录会带前缀、与卡片不匹配→示波图灭。
            // 故有声书一律用 abLast().folder（已去前缀、与卡片同坐标系）同步 activeFolderId，
            // 它跨切歌、跨重进都稳定存在，文件夹示波图即可随播放跟随而不丢失。
            let _nf = null;
            if (isAudiobook()) {
                // 优先用 abPlayFolder（播放时记录的真实书路径，已去前缀、与卡片同坐标系）；
                // 其次退化 abLast().folder（持久化的最后那本书）。二者都避免 folderPath/歌曲路径前缀错配。
                const _alf = abPlayFolder || (abLast() && abLast().folder);
                if (_alf != null && _alf !== "") _nf = String(_alf)
            } else if (_finalPath != null) {
                const _np = String(_cs.path);
                const _sep = _np.lastIndexOf("/") >= 0 ? "/" : (_np.lastIndexOf("\\") >= 0 ? "\\" : "");
                _nf = _sep ? _np.substring(0, _np.lastIndexOf(_sep)) : _np
            }
            if (_nf != null) activeFolderId = _nf
        }
        playerState = {
            ...playerState,
            currentIndex: _newIdx,
            currentSong: _cs,
            duration: n.duration,
            position: o,
            playing: s
        };
        playerState.currentSong && syncCurTrackFromState();
        renderPlayer();
        renderExtraControls();
        return r ? (clearNowPlayingUI(), hydrateNowPlaying(), $("npMask").classList.contains("show") && renderNowPlaying(), maybeRestoreNp()) : !firstApplyDone && playerState.currentSong && (hydrateNowPlaying(), maybeRestoreNp())
    }()), isAudiobook() && markFolderPlaying(), updateFolderProgress(), highlightPlaying(), firstApplyDone = !0;
    feEqDiag({
        where: "applyState",
        changed: r,
        playing: s
    }, !0)
}
let _kbOpen = !1,
    _kbStableH = window.innerHeight;
window.addEventListener("resize", () => {
    const t = window.innerHeight;
    t > _kbStableH && (_kbStableH = t), _kbOpen = t < _kbStableH - 80
});

function currentPosition() {
    if (CastManager.isMiot()) {
        const a = CastManager.castAnchor;
        if (a) return a.playing ? a.pos + (performance.now() - a.t) / 1e3 : a.pos
    }
    if (!playerPosAnchor) return playerState.position || 0;
    const t = playerPosAnchor.playing ? (performance.now() - playerPosAnchor.t) / 1e3 : 0;
    return Math.max(0, playerPosAnchor.pos + t)
}
setInterval(() => {
    if (_kbOpen) return;
    const t = playerState.duration || 0;
    let e;
    if (CastManager.isMiot()) {
        const a = CastManager.castAnchor;
        if (!a) return;
        e = a.playing ? a.pos + (performance.now() - a.t) / 1e3 : a.pos
    } else {
        if (!playerPosAnchor) return;
        e = currentPosition()
    }
    if (!CastManager.isMiot() && t > 0 && e > t && playerState.playing) {
        // 播放位置越过总时长：进度条/歌词应回到新一圈起点。
        // 单曲循环、列表循环仅一首都会回到同曲开头，但宿主未必回传 position=0，
        // 锚点会一直累加越过时长，导致进度条被钳满、歌词停在末行（需暂停再播放才复位）。
        const r = ((e - t) % t + t) % t;
        playerPosAnchor = {
            pos: 0,
            t: performance.now() - r * 1e3,
            playing: !0
        }, e = currentPosition();
        // 仅“单曲循环”或“列表循环且队列仅一首”才主动 seek(0) 兜底；
        // 多曲列表循环由宿主自动切下一首（applyState 会校正），主动 seek 会误把当前曲重头播。
        const sameSongRepeat = playMode === "single" || (playMode === "loop" && playerState.queue && playerState.queue.length <= 1);
        if (sameSongRepeat) {
            const a = Date.now();
            a - loopRecoverAt > 1500 && (loopRecoverAt = a, recoverSingleLoop())
        }
    }
    const eDisp = t > 0 && e > t ? t : e;
    if (playerState.position = e, $("cur").textContent = fmt(eDisp), t > 0) {
        $("seek").value = Math.min(1e3, Math.floor(e / t * 1e3));
        const a = Math.min(100, Math.max(0, e / t * 100));
        $("seek").style.setProperty("--progress", a + "%")
    }
    const n = $("npCur"),
        s = $("npDur"),
        o = $("npSeek");
    n && (n.textContent = fmt(eDisp)), s && (s.textContent = fmt(t)), o && t > 0 && (o.value = Math.min(1e3, Math.floor(e / t * 1e3)));
    const i = $("miniRing");
    if (i) {
        const a = t > 0 ? Math.min(100, Math.max(0, e / t * 100)) : 0;
        i.style.setProperty("--disc-progress", a)
    }
    updateLyricHighlight()
}, 500);
async function recoverSingleLoop() {
    try {
        const t = songIdOf(playerState.currentSong);
        if (t == null) return;
        Player.has("seek") && await Player.seek(0), Player.has("play") && !playerState.playing && await Player.play(t)
    } catch (t) {
        console.log("[loop] recover failed", t && t.message)
    }
}

function initPlayerBridge() {
    if (!Player.available()) {
        console.log("[player] not available yet, retry in 500ms"), setTimeout(initPlayerBridge, 500);
        return
    }
    Player.probe(), Player.onState(t => {
        applyState(t, "event"), t && t.is_playing && playRate !== 1 && applyPlayRate(playRate)
    }), Player.getState().then(t => {
        console.log("[state] FULL", JSON.stringify(t)), applyState(t, "init");
        if (!(playerState.queue && playerState.queue.length)) {
            try {
                syncQueueFromHost().catch(() => {})
            } catch (_) {}
        }
    }).catch(t => console.log("[player] initial getState failed", t));
    try {
        const t = Player.inst();
        t && typeof t.getVolume == "function" && t.getVolume().then(e => {
            if (typeof e == "number" && isFinite(e)) {
                const n = e > 1 ? e / 100 : e;
                currentVolume = Math.max(0, Math.min(1, n)), volPaint(currentVolume), renderExtraControls()
            }
        }).catch(() => {})
    } catch {}
    loadFavoriteIds().catch(() => {})
}

function startActivePoll() {
    Player.available() && Player.getState().then(t => applyState(t, "manual")).catch(() => {})
}
async function feDiag(o) {
    try {
        await api(PLUGIN_BASE + "/diag/frontend", "POST", o)
    } catch (_) {}
}
// 示波图跟随诊断：切歌时把 applyState/highlightPlaying 的关键状态上报到后端 /diag/frontend，
// 供远程读取（/diag/playlog 的 fe 字段）定位「示波图不跟随」根因，避免盲猜。
let _eqDiagLast = 0;

function feEqDiag(extra, force) {
    try {
        const now = performance.now();
        if (!force && now - _eqDiagLast < 400) return;
        _eqDiagLast = now;
        const ref = curPlayingRef();
        const tracks = document.querySelectorAll(".track");
        let pc = 0;
        const pids = [];
        tracks.forEach(e => {
            if (e.classList.contains("playing")) {
                pc++;
                if (pids.length < 5) pids.push(e.dataset.id)
            }
        });
        const sample = [];
        let k = 0;
        tracks.forEach(e => {
            if (k < 6) {
                sample.push(e.dataset.id);
                k++
            }
        });
        const cards = document.querySelectorAll(".card");
        const cardKinds = {};
        let cardPlaying = 0;
        let folderCardPlaying = 0;
        cards.forEach(c => {
            const kk = c.dataset.kind || (c.classList.contains("folder-card") ? "folder" : "none");
            cardKinds[kk] = (cardKinds[kk] || 0) + 1;
            if (c.classList.contains("playing") || c.classList.contains("playing-collection")) {
                cardPlaying++;
                c.classList.contains("folder-card") && folderCardPlaying++
            }
        });
        const cs = playerState.currentSong;
        const _ref2 = curPlayingRef();
        const _hmPath = _ref2 ? (hostSongMap.get(String(_ref2.id)) || {}).path || null : null;
        api(PLUGIN_BASE + "/diag/frontend", "POST", {
            kind: "eq",
            ...extra,
            refId: ref && ref.id,
            refSrc: ref && ref.sourceId,
            curIdx: playerState.currentIndex,
            csId: cs ? String(songIdOf(cs)) : null,
            csTrackId: cs && cs.trackId != null ? String(cs.trackId) : null,
            csPath: cs && cs.path != null ? String(cs.path) : null,
            csSrcDataPath: (function() {
                try {
                    const d = cs && (cs.source_data || cs.sourceData);
                    if (!d) return null;
                    const o = typeof d === "string" ? JSON.parse(d) : d;
                    return o && o.path != null ? String(o.path) : null
                } catch (_) {
                    return null
                }
            })(),
            curTrackPath: curTrack && curTrack.path != null ? String(curTrack.path) : null,
            hmPath: _hmPath != null ? String(_hmPath) : null,
            csHasSrcData: !!(cs && cs.source_data),
            curTrackId: curTrack && curTrack.id != null ? String(curTrack.id) : null,
            curAlbum: curTrack && curTrack.album,
            curArtist: curTrack && curTrack.artist,
            hostMapSize: hostSongMap.size,
            trackCount: tracks.length,
            playingCount: pc,
            playingIds: pids,
            sampleRowIds: sample,
            cardKinds: cardKinds,
            cardPlaying: cardPlaying,
            folderCardPlaying: folderCardPlaying,
            activePlaylistId: activePlaylistId != null ? String(activePlaylistId) : null,
            activeFolderId: activeFolderId != null ? String(activeFolderId) : null,
            drillType: drill && drill.type,
            drillId: drill && drill.id,
            npIsPlaying: document.body.classList.contains("np-is-playing"),
            psPlaying: !!playerState.playing,
            view,
            folderPath: (typeof folderPath !== "undefined") ? folderPath : null,
            qPath: (playerState.queue && playerState.queue[playerState.currentIndex] && playerState.queue[playerState.currentIndex].path != null) ? String(playerState.queue[playerState.currentIndex].path) : null,
            folderCards: (function() {
                const out = [];
                document.querySelectorAll(".card.folder-card").forEach(c => {
                    out.push({
                        p: c.dataset.path || c.dataset.id,
                        lit: c.classList.contains("playing-collection")
                    })
                });
                return out
            })(),
            qLen: (playerState.queue ? playerState.queue.length : 0),
            guard: queueClearGuard === !0,
            cleared: (function() {
                try {
                    return localStorage.getItem("mm:queueCleared") === "1"
                } catch (_) {
                    return !1
                }
            })()
        }).catch(() => {})
    } catch (_) {}
}
async function ensureSongIds(t, e) {
    const _cs = currentSourceId;
    const norm = t.map(x => (x && x.sourceId && x.trackId) ? x : ({
        sourceId: _cs,
        trackId: x && x.id,
        track: x
    }));
    const n = {
        tracks: norm
    };
    e && typeof e.withCover == "boolean" && (n.withCover = e.withCover), e && typeof e.withLyric == "boolean" && (n.withLyric = e.withLyric);
    const s = await api(PLUGIN_BASE + "/ensure-songs", "POST", n);
    if (!s.ok) throw new Error(s.message || "\u89E3\u6790\u6B4C\u66F2\u5931\u8D25");
    // host songId -> 源 trackId/path 映射：供切歌后示波器精确跟随（见 curRefFromHost）。
    // 入参 norm[idx].track 是完整曲目对象（含 path），顺序与 results 一致，据此把 path 一并登记。
    (s.results || []).forEach((r, idx) => {
        if (r && r.trackId != null && r.songId != null) {
            const src = norm[idx] && norm[idx].track;
            const p = src && src.path != null ? String(src.path) : null;
            const ex = hostSongMap.get(String(r.songId)) || {};
            hostSongMap.set(String(r.songId), {
                trackId: String(r.trackId),
                sourceId: _cs,
                path: p != null ? p : (ex.path != null ? ex.path : null)
            })
        }
    });
    return s.results || []
}

function sourceDataFor(t) {
    return {
        provider: "multisource-music",
        sourceId: currentSourceId,
        trackId: t.id,
        coverId: t.coverId,
        title: t.title,
        artist: t.artist,
        album: t.album,
        path: t.path
    }
}
let playSeq = 0,
    firstApplyDone = !1,
    playGen = 0,
    pendingTarget = null,
    playingHostId = null,   // 插件视角「当前正在播的 host 歌曲 id」：applyState 用它定位 currentSong，不依赖滞后的宿主回显 currentSong
    preHostId = null;       // 切歌前的 playingHostId，用于区分「宿主滞后回显上一首」与「真的切到另一首」
async function loadAndPlay(t) {
    // 用户主动点歌播放：解除「已清空队列」持久标记（否则 applyState 会持续强制保持空态）。
    try {
        localStorage.removeItem("mm:queueCleared")
    } catch (_) {}
    queueClearGuard = !1;
    const e = ++playSeq;
    // 记录当前正在播放的「集合」，供网格/文件夹卡片示波图点亮：
    // - 钻取进歌单后播放（无论「播放全部」还是「钻取后播里面某首」）：点亮该歌单卡片
    // - 文件夹视图内播放：点亮当前文件夹（返回上级时其所在子文件夹卡片随之点亮）
    if (drill && drill.type === "playlist") {
        activePlaylistId = drill.id;
        activeFolderId = null
    } else if (view === "folders") {
        // 点亮「当前播放歌曲所在文件夹」而非浏览位置 folderPath：
        // 从歌曲真实路径取父目录，避免「播放 A 却点亮当前浏览的 B 文件夹」的示波图错位。
        if (t && t.path) {
            const _sep = t.path.lastIndexOf("/") >= 0 ? "/" : (t.path.lastIndexOf("\\") >= 0 ? "\\" : "");
            activeFolderId = _sep ? t.path.substring(0, t.path.lastIndexOf(_sep)) : t.path
        } else {
            activeFolderId = folderPath
        }
        // 有声书：从歌曲路径父目录剥离 "audiobook/" 前缀得到真实书路径，记入 abPlayFolder，
        // 使切歌 applyState / 兜底 highlightPlaying 都能稳定点亮（与卡片同坐标系）。
        if (isAudiobook() && t && t.path) {
            let _bp = t.path.replace(/^audiobook\//, "");
            const _sep = _bp.lastIndexOf("/");
            abPlayFolder = _sep >= 0 ? _bp.substring(0, _sep) : _bp
        }
        activePlaylistId = null
    } else {
        if (view !== "playlists") activePlaylistId = null;
        if (view !== "folders") activeFolderId = null;
        // 有声书：即使在非 folders 视图（如正在播放页/抽屉）点歌，也要记录书路径，
        // 使切歌 applyState、兜底 highlightPlaying 都能点亮该书卡片。
        if (isAudiobook() && t && t.path) {
            let _bp = t.path.replace(/^audiobook\//, "");
            const _sep = _bp.lastIndexOf("/");
            abPlayFolder = _sep >= 0 ? _bp.substring(0, _sep) : _bp
        }
    }
    if (clearNowPlayingUI(), curTrack = t, queueClearGuard = !1, setIcon($("playBtn"), "pause"), setIcon($("npPlayBtn"), "pause"), t && ($("pTitle").textContent = t.title, $("pArtist").textContent = [t.artist, t.album].filter(Boolean).join(" \xB7 "), checkPlayerMarquee(), setCover($("pCov"), t.coverId), playerState.currentSong = {
            title: t.title,
            artist: t.artist,
            album: t.album,
            coverId: t.coverId,
            path: t.path,
            source_data: JSON.stringify(sourceDataFor(t))
        }, playerState.playing = !0, playerPosAnchor = {
            pos: 0,
            t: performance.now(),
            playing: !0
        }, renderPlayer(), highlightPlaying()), hydrateNowPlaying(), !Player.available()) {
        toast("\u5F53\u524D\u5BBF\u4E3B\u7248\u672C\u4E0D\u652F\u6301\u63A7\u5236\u64AD\u653E\u5668\uFF0C\u8BF7\u5347\u7EA7 SongLoft"), playerState.playing = !1, renderPlayer();
        return
    }
    try {
        // 记录切歌前的目标，供 applyState 区分「宿主滞后回显上一首」与「真切到另一首」
        preHostId = playingHostId;
        pendingTarget = { songId: String(t.id), sourceId: currentSourceId, trackId: t.id, token: e, t: Date.now(), track: t };
        const n = await ensureSongIds([{
            sourceId: currentSourceId,
            trackId: t.id,
            track: t
        }]);
        if (e !== playSeq) {
            console.log("[player] \u8FC7\u671F\u64AD\u653E\u6307\u4EE4\uFF08loadAndPlay \u5165\u5E93\u540E\uFF09\uFF0C\u4E22\u5F03", e, "!=", playSeq);
            return
        }
        const s = n[0] && n[0].songId;
        if (!s) throw new Error("\u672A\u83B7\u53D6\u5230\u6B4C\u66F2 id");
        if (console.log("[player] play", s), pendingTarget = {
                songId: String(s),
                sourceId: currentSourceId,
                trackId: t.id,
                token: e,
                t: Date.now(),
                track: t
            }, currentLyric = null, currentLyricKey = null, lastLyricIndex = -1, renderLyricIfOpen(), CastManager.isMiot()) try {
            const a = playerState.queue || [];
            if (a.some(l => String(songIdOf(l)) === String(s))) {
                const l = a.findIndex(c => String(songIdOf(c)) === String(s));
                await CastManager.castToIndex(l >= 0 ? l : 0)
            } else if (a.length) {
                const l = (playerState.queue || []).length;
                if (await Player.addToQueue([s]), e !== playSeq) return;
                await CastManager.castToIndex(l)
            } else {
                if (await Player.setQueue([s], 0), e !== playSeq) return;
                await CastManager.castToIndex(0)
            }
            startActivePoll();
            return
        } catch (a) {
            console.warn("[cast] loadAndPlay \u6295\u5C4F\u5931\u8D25\uFF0C\u56DE\u9000\u672C\u673A\u64AD\u653E", a)
        }
        playingHostId = String(s); // 记录当前正在播的 host 歌曲 id（队列定位真相来源，避免滞后回显回退）
        const o = playerState.queue || [];

        if (o.some(a => String(songIdOf(a)) === String(s))) await Player.play(s);
        else if (o.length) {
            if (await Player.addToQueue([s]), e !== playSeq) {
                console.log("[player] \u8FC7\u671F\u64AD\u653E\u6307\u4EE4\uFF08loadAndPlay addToQueue \u540E\uFF09\uFF0C\u4E22\u5F03");
                return
            }
            await Player.play(s)
        } else {
            if (await Player.setQueue([s], 0), e !== playSeq) {
                console.log("[player] \u8FC7\u671F\u64AD\u653E\u6307\u4EE4\uFF08loadAndPlay setQueue \u540E\uFF09\uFF0C\u4E22\u5F03");
                return
            }
            await Player.play(s)
        }
        startActivePoll()
    } catch (n) {
        playerState.playing = !1, renderPlayer(), toast("\u64AD\u653E\u5931\u8D25\uFF1A" + (n && n.message || n))
    }
}

function playTrack(t) {
    loadAndPlay(t)
}
async function addSelectedToQueue() {
    if (!selected.size) return toast("\u8BF7\u5148\u52FE\u9009\u8981\u6DFB\u52A0\u7684\u5185\u5BB9");
    if (selectedKind === "track") {
        const t = (view === "folders" ? folderTracks : currentList).filter(e => selected.has(e.id));
        if (!t.length) return toast("\u5F53\u524D\u5217\u8868\u4E2D\u6CA1\u6709\u9009\u4E2D\u7684\u6B4C\u66F2");
        if (view === "favorites") return await addHostTracksToQueue(t);
        await addTracksToQueue(t)
    } else if (selectedKind === "folder") {
        const dirs = folderDirs.filter(e => selected.has(e.id || e.path)).map(e => ({
            kind: "folder",
            id: e.id || e.path,
            path: e.path
        }));
        const trks = folderTracks.filter(e => selected.has(e.id));
        if (!dirs.length && !trks.length) return toast("\u5F53\u524D\u5217\u8868\u4E2D\u6CA1\u6709\u9009\u4E2D\u7684\u5185\u5BB9");
        if (dirs.length) await addDirectoriesToQueue(dirs);
        if (trks.length) await addTracksToQueue(trks);
        return
    } else {
        const t = currentList.filter(e => selected.has(e.id)).map(e => ({
            kind: selectedKind,
            id: e.id
        }));
        if (!t.length) return toast("\u5F53\u524D\u5217\u8868\u4E2D\u6CA1\u6709\u9009\u4E2D\u7684\u9879\u76EE");
        await addDirectoriesToQueue(t)
    }
}
let _sleepTimer = null,
    _sleepTracks = 0,
    _sleepLastIdx = -1,
    _sleepWatcher = null,
    _sleepUntil = 0,
    _sleepCountdownTimer = null;

function openSleepTimer() {
    $("sleepMask").classList.add("show");
    var t = document.getElementById("sleepModeTime"),
        c = document.getElementById("sleepModeCount");
    setSleepMode((t && t.checked) ? "time" : (c && c.checked) ? "count" : "time");
    if (_sleepUntil > 0) {
        var r = Math.max(0, Math.ceil((_sleepUntil - Date.now()) / 1000));
        var mm = Math.floor(r / 60),
            ss = r % 60;
        setSleepStatus("剩余 " + mm + ":" + (ss < 10 ? "0" + ss : ss) + " 后停止")
    } else if (_sleepTracks > 0) {
        setSleepStatus("剩余 " + _sleepTracks + " 集后停止")
    }
    updateSleepButtons()
}

function closeSleepModal() {
    $("sleepMask").classList.remove("show")
}

function setSleepMode(m) {
    var t = document.getElementById("sleepModeTime"),
        c = document.getElementById("sleepModeCount");
    if (t) t.checked = (m === "time");
    if (c) c.checked = (m === "count");
    var bs = document.querySelectorAll(".sleep-block");
    for (var i = 0; i < bs.length; i++) {
        bs[i].classList.toggle("active", bs[i].getAttribute("data-mode") === m)
    }
}

function sleepStep(m, d) {
    if (m === "time") {
        var e = document.getElementById("sleepTimeVal");
        var v = parseInt(e.textContent || "5", 10) + d * 5;
        if (v < 5) v = 5;
        if (v > 180) v = 180;
        e.textContent = String(v);
        setSleepMode("time")
    } else {
        var e2 = document.getElementById("sleepCountVal");
        var v2 = parseInt(e2.textContent || "2", 10) + d;
        if (v2 < 1) v2 = 1;
        if (v2 > 50) v2 = 50;
        e2.textContent = String(v2);
        setSleepMode("count")
    }
}

function setSleepStatus(t) {
    var e = document.getElementById("sleepStatus");
    if (e) e.textContent = t;
    document.querySelectorAll(".sleep-btn").forEach(function(b) {
        b.classList.toggle("active", t && t !== "未设置");
        b.title = t && t !== "未设置" ? t : "定时停止"
    })
}

function doSleepStop() {
    try {
        if (_sleepTimer) {
            clearTimeout(_sleepTimer);
            _sleepTimer = null
        }
        if (_sleepCountdownTimer) {
            clearInterval(_sleepCountdownTimer);
            _sleepCountdownTimer = null
        }
        if (_sleepWatcher) {
            clearInterval(_sleepWatcher);
            _sleepWatcher = null
        }
        _sleepTracks = 0;
        _sleepUntil = 0;
        setSleepStatus("未设置");
        if (Player && Player.pause) Player.pause();
        updateSleepButtons();
        toast("已定时停止播放")
    } catch (_) {}
}

function applySleepTimer() {
    try {
        if (_sleepTimer) {
            clearTimeout(_sleepTimer);
            _sleepTimer = null
        }
        if (_sleepCountdownTimer) {
            clearInterval(_sleepCountdownTimer);
            _sleepCountdownTimer = null
        }
        if (_sleepWatcher) {
            clearInterval(_sleepWatcher);
            _sleepWatcher = null
        }
        _sleepTracks = 0;
        _sleepUntil = 0;
        var t = document.getElementById("sleepModeTime"),
            c = document.getElementById("sleepModeCount");
        if (t && t.checked) {
            var v = parseInt(document.getElementById("sleepTimeVal").textContent || "5", 10);
            _sleepUntil = Date.now() + v * 60000;
            _sleepTimer = setTimeout(function() {
                doSleepStop()
            }, v * 60000);
            setSleepStatus("已设定：" + v + " 分钟后停止");
            toast("已设定：" + v + " 分钟后停止");
            _sleepCountdownTimer = setInterval(function() {
                var r = Math.max(0, Math.ceil((_sleepUntil - Date.now()) / 1000));
                if (r <= 0) {
                    clearInterval(_sleepCountdownTimer);
                    _sleepCountdownTimer = null;
                    return
                }
                var mm = Math.floor(r / 60),
                    ss = r % 60;
                setSleepStatus("剩余 " + mm + ":" + (ss < 10 ? "0" + ss : ss) + " 后停止")
            }, 1000)
        } else if (c && c.checked) {
            var v2 = parseInt(document.getElementById("sleepCountVal").textContent || "2", 10);
            _sleepTracks = v2;
            _sleepLastIdx = playerState.currentIndex;
            _sleepWatcher = setInterval(function() {
                if (playerState.currentIndex !== _sleepLastIdx) {
                    _sleepLastIdx = playerState.currentIndex;
                    _sleepTracks--;
                    if (_sleepTracks <= 0) {
                        setSleepStatus("未设置");
                        doSleepStop();
                        return
                    }
                    setSleepStatus("剩余 " + _sleepTracks + " 集后停止")
                }
            }, 1500);
            setSleepStatus("已设定：" + v2 + " 集后停止");
            toast("已设定：" + v2 + " 集后停止")
        }
    } catch (_) {}
}

function cancelSleepTimer() {
    try {
        if (_sleepTimer) {
            clearTimeout(_sleepTimer);
            _sleepTimer = null
        }
        if (_sleepCountdownTimer) {
            clearInterval(_sleepCountdownTimer);
            _sleepCountdownTimer = null
        }
        if (_sleepWatcher) {
            clearInterval(_sleepWatcher);
            _sleepWatcher = null
        }
        _sleepTracks = 0;
        _sleepUntil = 0;
        setSleepStatus("未设置");
        toast("已取消定时");
        closeSleepModal()
    } catch (_) {}
}

function updateSleepButtons() {
    var a = (_sleepUntil > 0 || _sleepTracks > 0);
    var en = document.getElementById("sleepEnableBtn");
    var di = document.getElementById("sleepDisableBtn");
    if (en) en.disabled = !1;
    if (di) di.disabled = !a
}

function onSleepEnable() {
    try {
        applySleepTimer()
    } catch (_) {}
    closeSleepModal();
    updateSleepButtons()
}

function onSleepDisable() {
    try {
        cancelSleepTimer()
    } catch (_) {}
    updateSleepButtons()
}

function msmPluginTrackFor(t) {
    if (!t) return null;
    let tid = t.trackId != null ? String(t.trackId) : null;
    const sid = songIdOf(t);
    if (!tid && sid != "") {
        const _sm = abSongMap();
        for (const k in _sm)
            if (_sm[k] && _sm[k].sid && String(_sm[k].sid) === String(sid)) {
                tid = k;
                break
            }
    }
    if (tid == null) return null;
    // abFolderList 项可能 id=hostSid, trackId=sourceId；查找时同时匹配两者。
    const tr = (abFolderList && abFolderList.find(x => String(x.id) === String(tid) || String(x.trackId) === String(tid))) || (folderTracks && folderTracks.find(x => String(x.id) === String(tid) || String(x.trackId) === String(tid))) || (currentList && currentList.find(x => String(x.id) === String(tid) || String(x.trackId) === String(tid))) || null;
    if (tr) return {
        title: tr.title,
        artist: tr.artist,
        coverId: tr.coverId,
        album: tr.album,
        trackId: tr.trackId != null ? tr.trackId : tr.id,
        path: tr.path
    };
    const _tc = abTitleCache();
    if (_tc[tid]) return {
        title: _tc[tid].title,
        artist: _tc[tid].artist,
        coverId: _tc[tid].coverId,
        album: _tc[tid].album,
        trackId: tid,
        path: _tc[tid].path
    };
    return null
}

function msmMergeMeta(t) {
    if (!t) return t;
    const p = msmPluginTrackFor(t);
    if (!p) {
        // 普通音乐模式下 msmPluginTrackFor 常找不到 tr（abFolderList/folderTracks/currentList 均不含），
        // 此时若 hostSongMap 已登记该曲 path（ensureSongIds 时存入），仍把 path 合并进来，
        // 供文件夹卡片示波图按路径前缀匹配点亮。
        const sid = songIdOf(t);
        const hm = sid != null ? hostSongMap.get(String(sid)) : null;
        if (hm && hm.path != null) return {
            ...t,
            path: hm.path
        };
        return t
    }
    return {
        ...t,
        title: p.title != null ? p.title : t.title,
        artist: p.artist != null ? p.artist : t.artist,
        coverId: p.coverId != null ? p.coverId : t.coverId,
        album: p.album != null ? p.album : t.album,
        trackId: p.trackId != null ? p.trackId : t.trackId,
        path: p.path != null ? p.path : t.path
    }
}
async function syncQueueFromHost() {
    try {
        // 清空队列期间 / 已清空持久标记生效时 / 切换音源导入中，禁止用宿主队列回填（否则会冲掉前端的清空态，导致「清空不了」）。
        // 这是 openPlaylistDrawer、addTracksToQueue 等多处直接调用本函数、绕过 applyState 清空保护的漏洞点。
        if (queueClearGuard || queueRestoreGuard || localStorage.getItem("mm:queueCleared") === "1") return;
        const st = await Player.getState();
        if (!st) return;
        let hq = extractQueue(st);
        if (!hq.length) return;
        const hIdx = extractIndex(st, hq);
        const _sm = abSongMap();
        const inv = {};
        for (const k in _sm)
            if (_sm[k] && _sm[k].sid) inv[String(_sm[k].sid)] = k;
        const _tc = abTitleCache();
        hq = hq.map(it => {
            const sid = String(songIdOf(it));
            if ((!it.title) && inv[sid] && _tc[inv[sid]]) {
                const c = _tc[inv[sid]];
                return {
                    ...it,
                    title: c.title || it.title,
                    artist: c.artist || it.artist,
                    coverId: c.coverId || it.coverId,
                    album: c.album || it.album
                }
            }
            return it
        });
        const cs = st.current_song || st.currentSong;
        const csid = cs ? String(songIdOf(cs)) : null;
        if (isAudiobook()) {
            if (!abFolderList.length) abFolderListLoad();
            if (!abFolderList.length) {
                try {
                    const _rfp = folderPath || (abLast() && abLast().folder) || "";
                    if (_rfp) {
                        const _re = await api(PLUGIN_BASE + "/batch/tracks", "POST", {
                            sourceId: currentSourceId,
                            items: [{
                                kind: "folder",
                                id: _rfp,
                                path: _rfp
                            }]
                        });
                        if (_re && _re.ok && Array.isArray(_re.list) && _re.list.length) {
                            abFolderList = sortTracksByName(_re.list);
                            abFolderPath = _rfp;
                            abFolderListSave()
                        }
                    }
                } catch (_) {}
            }
            let book = null;
            if (abFolderList.length) {
                // 注意：reload 插件/清 localStorage 后 abSongMap 可能为空，此时不应丢弃曲子
                // （否则整本书队列变空、抽屉懒加载无内容可滚）。无 host sid 时仍保留完整曲目，
                // id 暂留空，由 abNav 滑动窗口懒解析 sid（与 playTracks 窗口外 id 留空的设计一致）。
                // abFolderList 项来自 _sorted：id=hostSid, trackId=sourceId；abSongMap 键为 sourceId，
                // 因此必须用 trackId 查映射，不能用 id（hostSid）查，否则重建后全部 id=null。
                book = abFolderList.map(x => {
                    const _srcId = String(x.trackId != null ? x.trackId : x.id);
                    const c = _sm[_srcId];
                    return {
                        id: c && c.sid ? Number(c.sid) : null,
                        trackId: _srcId,
                        title: x.title,
                        artist: x.artist,
                        coverId: x.coverId,
                        album: x.album
                    }
                });
            }
            if ((!book || !book.length) && folderTracks.length) {
                book = folderTracks.map(x => {
                    const _srcId = String(x.trackId != null ? x.trackId : x.id);
                    const c = _sm[_srcId];
                    const _s = c && c.sid ? Number(c.sid) : (x.songId != null ? Number(x.songId) : (songIdOf(x) ? Number(songIdOf(x)) : null));
                    return _s ? {
                        id: _s,
                        trackId: _srcId,
                        title: x.title,
                        artist: x.artist,
                        coverId: x.coverId,
                        album: x.album
                    } : null
                }).filter(Boolean);
            }
            if (!book || !book.length) book = playerState.queue || [];
            book = sortTracksByName(book);
            let newIdx = playerState.currentIndex;
            if (csid != null) {
                const fi = book.findIndex(x => String(songIdOf(x)) === csid);
                if (fi >= 0) newIdx = fi;
            } else if (hIdx >= 0 && book.length === hq.length) newIdx = hIdx;
            if (newIdx < 0 || newIdx >= book.length) newIdx = 0;
            playerState = {
                ...playerState,
                queue: book.map(msmMergeMeta),
                currentIndex: newIdx
            };
            renderPlaylist();
            if (csid && inv[csid]) {
                const tid = inv[csid];
                const ft = folderTracks.find(x => String(x.id) === String(tid));
                if (ft) {
                    curTrack = ft;
                    markFolderPlaying()
                }
            }
            return
        }
        const _localQ = (playerState.queue || []).map(msmMergeMeta);
        const baseQ = (hq.length && hq.length >= _localQ.length ? hq : (_localQ.length ? _localQ : hq)).map(it => msmMergeMeta(it));
        let newIdx = playerState.currentIndex;
        if (csid != null) {
            const fi = baseQ.findIndex(x => String(songIdOf(x)) === csid);
            if (fi >= 0) newIdx = fi;
        } else if (hIdx >= 0 && baseQ.length === hq.length) newIdx = hIdx;
        if (newIdx < 0 || newIdx >= baseQ.length) newIdx = 0;
        playerState = {
            ...playerState,
            queue: baseQ,
            currentIndex: newIdx
        };
        renderPlaylist();
        if (csid && inv[csid]) {
            const tid = inv[csid];
            const ft = folderTracks.find(x => String(x.id) === String(tid));
            if (ft) {
                curTrack = ft;
                markFolderPlaying()
            }
        }
    } catch (_) {}
}

function showLoading(m) {
    try {
        if (!_loadingEl) {
            _loadingEl = document.createElement("div");
            _loadingEl.id = "msmLoading";
            _loadingEl.style.cssText = "position:fixed;left:0;top:0;right:0;bottom:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);color:#fff;font-size:16px;letter-spacing:2px;";
            document.body.appendChild(_loadingEl)
        }
        _loadingEl.textContent = m || "加载中…";
        _loadingEl.style.display = "flex"
    } catch (_) {}
}

function hideLoading() {
    try {
        if (_loadingEl) _loadingEl.style.display = "none"
    } catch (_) {}
}
let _loadingEl = null;

function abTitleCache() {
    return _abStore.titleCache || {}
}

function abTitleCachePut(t) {
    if (!t || !t.id) return;
    try {
        if (!_abStore.titleCache) _abStore.titleCache = {};
        const g = k => t[k] || (t.track && t.track[k]);
        const tc = _abStore.titleCache;
        tc[String(t.id)] = {
            title: g("title"),
            artist: g("artist"),
            coverId: g("coverId"),
            album: g("album"),
            t: Date.now()
        };
        const ks = Object.keys(tc);
        if (ks.length > 5e3) {
            ks.sort((a, b) => (tc[a].t || 0) - (tc[b].t || 0));
            for (let i = 0; i < 1e3; i++) delete tc[ks[i]]
        }
        abStorePersist()
    } catch (_) {}
}
async function addHostTracksToQueue(t) {
    const e = t.map(n => Number(n.id)).filter(Boolean);
    if (!e.length) return toast("\u6CA1\u6709\u53EF\u6DFB\u52A0\u7684\u6B4C\u66F2");
    if (!Player.available()) {
        toast("\u5F53\u524D\u5BBF\u4E3B\u7248\u672C\u4E0D\u652F\u6301\u63A7\u5236\u64AD\u653E\u5668\uFF0C\u8BF7\u5347\u7EA7 SongLoft");
        return
    }
    try {
        const n = playerState.playing;
        // 用户主动加入队列：解除「已清空队列」持久标记，否则下方 syncQueueFromHost 会被 guard 拦掉、新歌不显示。
        try { localStorage.removeItem("mm:queueCleared") } catch (_) {}
        queueClearGuard = !1;
        await Player.addToQueue(e), await syncQueueFromHost(), n ? toast(`\u5DF2\u52A0\u5165\u64AD\u653E\u5217\u8868\uFF08+${e.length} \u9996\uFF09`) : (await Player.play(e[0]).catch(() => {}), startActivePoll())
    } catch (n) {
        toast("\u6DFB\u52A0\u5931\u8D25\uFF1A" + (n && n.message || n))
    }
}
async function addDirectoriesToQueue(t) {
    if (!Player.available()) {
        toast("\u5F53\u524D\u5BBF\u4E3B\u7248\u672C\u4E0D\u652F\u6301\u63A7\u5236\u64AD\u653E\u5668\uFF0C\u8BF7\u5347\u7EA7 SongLoft");
        return
    }
    try {
        const e = await api(`${PLUGIN_BASE}/batch/tracks`, "POST", {
            sourceId: currentSourceId,
            items: t
        });
        if (!e.ok) throw new Error(e.message || "\u8BFB\u53D6\u76EE\u5F55\u5931\u8D25");
        const n = sortTracksByName(e.list || []);
        if (!n.length) return toast("\u8FD9\u4E2A\u5206\u7C7B\u4E0B\u6CA1\u6709\u6B4C\u66F2");
        await addTracksToQueue(n)
    } catch (e) {
        toast("\u6DFB\u52A0\u5931\u8D25\uFF1A" + (e && e.message || e))
    }
}
async function addTracksToQueue(t) {
    if (!t.length) return toast("\u6CA1\u6709\u53EF\u6DFB\u52A0\u7684\u6B4C\u66F2");
    if (!Player.available()) {
        toast("\u5F53\u524D\u5BBF\u4E3B\u7248\u672C\u4E0D\u652F\u6301\u63A7\u5236\u64AD\u653E\u5668\uFF0C\u8BF7\u5347\u7EA7 SongLoft");
        return
    }
    try {
        const e = t.map(i => ({
                sourceId: currentSourceId,
                trackId: i.id,
                track: i
            })),
            s = (await ensureSongIds(e, {
                withCover: !1,
                withLyric: !1
            })).map(i => i.songId).filter(Boolean);
        if (!s.length) throw new Error("\u672A\u83B7\u53D6\u5230\u6B4C\u66F2 id");
        const o = playerState.playing;
        // 用户主动加入队列：解除「已清空队列」持久标记，否则下方 syncQueueFromHost 会被 guard 拦掉、新歌不显示。
        try { localStorage.removeItem("mm:queueCleared") } catch (_) {}
        queueClearGuard = !1;
        // 先乐观地把新歌追加进前端队列并立即渲染，避免依赖宿主 addToQueue 的异步回显（有延迟时新歌不显示）。
        const _added = t.map((tr, i) => {
            const _id = Number(s[i]);
            return _id ? {
                id: _id,
                trackId: tr.id,
                title: tr.title,
                artist: tr.artist,
                album: tr.album,
                coverId: tr.coverId,
                sourceId: currentSourceId
            } : null
        }).filter(Boolean);
        if (_added.length) {
            playerState = {
                ...playerState,
                queue: (playerState.queue || []).concat(_added)
            }, renderPlaylist()
        }
        if (await Player.addToQueue(s), await syncQueueFromHost(), toast(`\u5DF2\u52A0\u5165\u64AD\u653E\u5217\u8868\uFF1A${s.length} \u9996`), clearSelection(), currentSourceId !== SONGLOFT_SOURCE_ID && ensureSongIds(e, {
                withCover: !0,
                withLyric: !0
            }).catch(() => {}), Player.getState().then(i => {
                i && applyState(i, "add")
            }).catch(() => {}), !o) {
            const i = ++playSeq;
            clearNowPlayingUI(), curTrack = t[0], playerState.currentSong = {
                title: t[0].title,
                artist: t[0].artist,
                album: t[0].album,
                source_data: JSON.stringify(sourceDataFor(t[0]))
            }, playerState.playing = !0, playerPosAnchor = {
                pos: 0,
                t: performance.now(),
                playing: !0
            }, renderPlayer(), highlightPlaying(), hydrateNowPlaying(), pendingTarget = {
                songId: String(s[0]),
                token: i,
                t: Date.now()
            }, currentLyric = null, currentLyricKey = null, lastLyricIndex = -1, renderLyricIfOpen(), await Player.play(s[0]), startActivePoll()
        }
    } catch (e) {
        toast("\u6DFB\u52A0\u5931\u8D25\uFF1A" + (e && e.message || e))
    }
}
let activePlaylistId = null,
    activeFolderId = null;
// 当前正在播放的有声书「那本书」路径（已去 audiobook/ 前缀，与文件夹卡片 dataset.path 同坐标系）。
// playDirectory 播放整本书、playTrack 播单集时写入；供 saveAbPosition / applyState / highlightPlaying
// 作为权威信号，不再依赖 folderPath（它反映浏览位置、在根目录播书时为空，会导致示波图丢失）。
let abPlayFolder = "";
async function playDirectory(t, e) {
    // 记录当前正在播放的「集合」，供网格/文件夹卡片示波图点亮：
    // - 歌单（含歌单里的文件夹 playlist folder）：activePlaylistId
    // - 文件夹：activeFolderId（用 path 匹配文件夹卡片）
    // 播放专辑/歌手等非歌单、非文件夹内容则清空对应项。
    activePlaylistId = t === "playlist" ? e.id : null;
    if (t === "folder") {
        // e.path 即去前缀的书路径（如 "单田芳-隋唐演义"），与卡片同坐标系；e.id 是 ab:dir: 形式不可用。
        abPlayFolder = e.path || "";
        activeFolderId = abPlayFolder || null;
    } else {
        abPlayFolder = "";
        activeFolderId = null;
    }
    await playDirectories([{
        kind: t,
        id: e.id,
        path: e.path
    }])
}
async function playDirectories(t) {
    if (setIcon($("playBtn"), "pause"), setIcon($("npPlayBtn"), "pause"), !Player.available()) {
        toast("\u5F53\u524D\u5BBF\u4E3B\u7248\u672C\u4E0D\u652F\u6301\u63A7\u5236\u64AD\u653E\u5668\uFF0C\u8BF7\u5347\u7EA7 SongLoft"), playerState.playing = !1, renderPlayer();
        return
    }
    try {
        const e = await api(`${PLUGIN_BASE}/batch/tracks`, "POST", {
            sourceId: currentSourceId,
            items: t
        });
        if (!e.ok) throw new Error(e.message || "\u8BFB\u53D6\u76EE\u5F55\u5931\u8D25");
        const n = sortTracksByName(e.list || []);
        if (!n.length) return playerState.playing = !1, renderPlayer(), toast("\u8FD9\u4E2A\u5206\u7C7B\u4E0B\u6CA1\u6709\u6B4C\u66F2");
        await playTracks(n)
    } catch (e) {
        playerState.playing = !1, renderPlayer(), toast("\u64AD\u653E\u5931\u8D25\uFF1A" + (e && e.message || e))
    }
}
async function playTracks(t, startIdx = 0) {
    if (!t.length) return toast("没有可播放的歌曲");
    if (queueSourceId && queueSourceId !== currentSourceId) {
        if (playerState.queue && playerState.queue.length) {
            await clearQueue()
        } else {
            playerState = {
                ...playerState,
                queue: [],
                currentIndex: -1,
                currentSong: null,
                playing: !1,
                position: 0
            };
            playerPosAnchor = null;
            renderPlaylist();
            renderPlayer()
        }
        curTrack = null;
        pendingTarget = null;
        if (!isAudiobook()) {
            abFolderList = [];
            abFolderPath = ""
        }
        folderPath = ""
    }
    queueSourceId = currentSourceId;
    const e = ++playSeq;
    if (playerState.queue && playerState.queue.length) {
        const _cid = String(t[startIdx].id);
        const _hit = (playerState.queue || []).find(x => String(x.trackId) === _cid || String(x.id) === _cid);
        if (_hit && _hit.id != null) {
            try {
                const _st = await Player.getState().catch(() => null);
                const _hsids = _st && _st.queue ? _st.queue.map(songIdOf).filter(Boolean).map(String) : [];
                if (!_hsids.length || _hsids.indexOf(String(_hit.id)) >= 0) {
                    const _sid = Number(_hit.id);
                    curTrack = t[startIdx];
                    playerState = {
                        ...playerState,
                        currentIndex: playerState.queue.indexOf(_hit),
            currentSong: {
                title: t[startIdx].title,
                artist: t[startIdx].artist,
                album: t[startIdx].album,
                source_data: JSON.stringify(sourceDataFor(t[startIdx]))
            },
                        playing: true,
                        playerPosAnchor: {
                            pos: 0,
                            t: performance.now(),
                            playing: true
                        }
                    };
                    renderPlayer();
                    highlightPlaying();
                    hydrateNowPlaying();
                    pendingTarget = {
                        songId: String(_sid),
                        token: e,
                        t: Date.now()
                    };
                    if (isAudiobook()) saveAbPosition();
                    await Player.play(_sid).catch(() => {});
                    startActivePoll();
                    feDiag({
                        stage: "playFastPath",
                        sid: _sid
                    });
                    return
                }
            } catch (_) {}
        }
    }
    if (clearNowPlayingUI(), curTrack = t[startIdx], queueClearGuard = !1, setIcon($("playBtn"), "pause"), setIcon($("npPlayBtn"), "pause"), t.length === 1) {
        if (t[startIdx] && ($("pTitle").textContent = t[startIdx].title, $("pArtist").textContent = [t[startIdx].artist, t[startIdx].album].filter(Boolean).join(" \xB7 "), checkPlayerMarquee(), setCover($("pCov"), t[startIdx].coverId), playerState.currentSong = {
                title: t[startIdx].title,
                artist: t[startIdx].artist,
                album: t[startIdx].album,
                source_data: JSON.stringify(sourceDataFor(t[startIdx]))
            }, playerState.playing = !0, playerPosAnchor = {
                pos: 0,
                t: performance.now(),
                playing: !0
            }, renderPlayer(), highlightPlaying()), hydrateNowPlaying(), !Player.available()) {
            toast("\u5F53\u524D\u5BBF\u4E3B\u7248\u672C\u4E0D\u652F\u6301\u63A7\u5236\u64AD\u653E\u5668\uFF0C\u8BF7\u5347\u7EA7 SongLoft"), playerState.playing = !1, renderPlayer();
            return
        }
        try {
            const n = await ensureSongIds([{
                sourceId: currentSourceId,
                trackId: t[startIdx].id,
                track: t[startIdx]
            }]);
            if (e !== playSeq) {
                console.log("[player] \u8FC7\u671F\u64AD\u653E\u6307\u4EE4\uFF08playTracks \u5355\u66F2\u5165\u5E93\u540E\uFF09\uFF0C\u4E22\u5F03");
                return
            }
            const s = n[0] && n[0].songId;
            if (!s) throw new Error("\u672A\u83B7\u53D6\u5230\u6B4C\u66F2 id");
            console.log("[player] play", s), pendingTarget = {
                songId: String(s),
                token: e,
                t: Date.now()
            }, currentLyric = null, currentLyricKey = null, lastLyricIndex = -1, renderLyricIfOpen();
            const o = playerState.queue || [];
            if (o.some(a => String(songIdOf(a)) === String(s))) await Player.play(s);
            else if (o.length) {
                if (await Player.addToQueue([s]), e !== playSeq) {
                    console.log("[player] \u8FC7\u671F\u64AD\u653E\u6307\u4EE4\uFF08playTracks \u5355\u66F2 addToQueue \u540E\uFF09\uFF0C\u4E22\u5F03");
                    return
                }
                await Player.play(s)
            } else {
                if (await Player.setQueue([s], 0), e !== playSeq) {
                    console.log("[player] \u8FC7\u671F\u64AD\u653E\u6307\u4EE4\uFF08playTracks \u5355\u66F2 setQueue \u540E\uFF09\uFF0C\u4E22\u5F03");
                    return
                }
                await Player.play(s)
            }
            startActivePoll();
            await syncQueueFromHost().catch(() => {})
        } catch (n) {
            playerState.playing = !1, renderPlayer(), toast("\u64AD\u653E\u5931\u8D25\uFF1A" + (n && n.message || n))
        }
        return
    }
    if ($("pTitle").textContent = t[startIdx].title, $("pArtist").textContent = [t[startIdx].artist, t[startIdx].album].filter(Boolean).join(" \xB7 "), checkPlayerMarquee(), setCover($("pCov"), t[startIdx].coverId), playerState.currentSong = {
            title: t[startIdx].title,
            artist: t[startIdx].artist,
            album: t[startIdx].album,
            source_data: JSON.stringify(sourceDataFor(t[startIdx]))
        }, playerState.playing = !0, playerPosAnchor = {
            pos: 0,
            t: performance.now(),
            playing: !0
        }, renderPlayer(), highlightPlaying(), hydrateNowPlaying(), !Player.available()) {
        toast("\u5F53\u524D\u5BBF\u4E3B\u7248\u672C\u4E0D\u652F\u6301\u63A7\u5236\u64AD\u653E\u5668\uFF0C\u8BF7\u5347\u7EA7 SongLoft"), playerState.playing = !1, renderPlayer();
        return
    }
    try {
        const N = t.length;
        showLoading("加载中…");
        let _map = abSongMap();
        let _items = [],
            _failed = 0;
        // 有声书模式下：宿主仅维护 21 首滑动窗口，窗口外的集无需立即解析 host songId。
        // 只对「当前播放窗口」内的集做 ensureSongIds，其余集延迟到 abNav 滑动窗口时懒解析，
        // 避免新书几百集一次性解析导致「加载中」过长。
        const _winLo = isAudiobook() ? Math.max(0, startIdx - 5) : 0;
        const _winHi = isAudiobook() ? Math.min(N - 1, startIdx + 15) : N - 1;
        for (let b = 0; b < N; b += 20) {
            if (e !== playSeq) {
                hideLoading();
                return;
            }
            const _batch = t.slice(b, b + 20);
            const _batchEnd = Math.min(N, b + 20);
            // 本 batch 与播放窗口是否有交集
            const _batchInWin = isAudiobook() && b <= _winHi && _batchEnd > _winLo;
            let _res = [];
            if (_batchInWin) {
                const _need = _batch.map((x, i) => {
                    const _idx = b + i;
                    if (_idx < _winLo || _idx > _winHi) return null;
                    return {
                        sourceId: currentSourceId,
                        trackId: x.id,
                        track: x
                    }
                }).filter(Boolean);
                if (_need.length) {
                    try {
                        _res = await ensureSongIds(_need);
                    } catch (_) {}
                }
            }
            // 按下标对应（_res 与 _need 同序，_need 为 batch 中窗口内项的子集），
            // 窗口内项按顺序从 _res 取回，避免重复 trackId 反查命中同一 songId。
            let _ri = 0;
            for (let _bi = 0; _bi < _batch.length; _bi++) {
                const o = _batch[_bi];
                const _idx = b + _bi;
                const _inside = _idx >= _winLo && _idx <= _winHi;
                const r = _inside ? _res[_ri++] : null;
                if (_inside && r && r.trackId != null && r.songId != null) {
                    _map[String(r.trackId)] = {
                        sid: String(r.songId),
                        t: Date.now()
                    };
                    _items.push({
                        ...(o.track || o),
                        trackId: r.trackId,
                        id: Number(r.songId)
                    });
                    abTitleCachePut(o);
                } else {
                    const _cached = _map[String(o.id)] && _map[String(o.id)].sid;
                    _items.push({
                        ...(o.track || o),
                        trackId: o.id,
                        id: _cached ? Number(_cached) : null
                    });
                    if (_inside) _failed++
                }
            }
            await new Promise(r => setTimeout(r, 40));
            const _done = b + _batch.length;
            showLoading("加载中 " + Math.min(100, Math.round(_done / N * 100)) + "%");
        }
        abSongMapSave(_map);
        if (!_items.length) {
            hideLoading();
            playerState.playing = false;
            renderPlayer();
            toast("没有可播放的歌曲");
            return;
        }
        const _sorted = isAudiobook() ? sortTracksByName([..._items]) : _items.slice();
        const _selId = String(t[startIdx].id);
        let _sel = 0;
        for (let _i = 0; _i < _sorted.length; _i++) {
            if (String(_sorted[_i].trackId) === _selId) {
                _sel = _i;
                break;
            }
        }
        if (_sel < 0) _sel = Math.max(0, Math.min(_sorted.length - 1, startIdx));
        playerState = {
            ...playerState,
            queue: _sorted,
            currentIndex: _sel
        };
        renderPlaylist();
        pendingTarget = {
            songId: String(_sorted[_sel].id),
            token: e,
            t: Date.now()
        };
        currentLyric = null;
        currentLyricKey = null;
        lastLyricIndex = -1;
        renderLyricIfOpen();
        await abSetHostWindow(_sorted, _sel, true);
        if (e !== playSeq) {
            hideLoading();
            return;
        }
        if (isAudiobook()) {
            // 把整本书（完整队列）同步进 abFolderList，保证持久化与 syncQueueFromHost 重建
            // 用的是「整本书」而非浏览时的局部列表；否则退出重进后抽屉只剩窗口内集数。
            abFolderList = _sorted;
            abFolderPath = abPlayFolder || folderPath || "";
            abFolderListSave()
        }
        if (isAudiobook()) saveAbPosition();
        highlightPlaying();
        startActivePoll();
        await feDiag({
            stage: "playAfterFirstBatch",
            total: _sorted.length,
            winLen: Math.min(21, _sorted.length)
        });
        hideLoading();
    } catch (n) {
        playerState.playing = !1, renderPlayer(), toast("\u64AD\u653E\u5931\u8D25\uFF1A" + (n && n.message || n))
    }
}
async function playNext() {
    if (isAudiobook()) {
        await abNav(1);
        return
    }
    if (CastManager.isMiot()) {
        await CastManager.castRelative(1);
        return
    }
    try {
        console.log("[player] next"), await Player.next(), startActivePoll()
    } catch (t) {
        toast("\u4E0B\u4E00\u9996\u5931\u8D25\uFF1A" + (t && t.message || t))
    }
}
async function playPrev() {
    if (isAudiobook()) {
        await abNav(-1);
        return
    }
    if (CastManager.isMiot()) {
        await CastManager.castRelative(-1);
        return
    }
    try {
        console.log("[player] previous"), await Player.previous(), startActivePoll()
    } catch (t) {
        toast("\u4E0A\u4E00\u9996\u5931\u8D25\uFF1A" + (t && t.message || t))
    }
}
let toggling = !1;
async function togglePlay() {
    if (CastManager.isMiot()) {
        await CastManager.toggleSpeaker();
        return
    }
    if (toggling) {
        console.log("[player] togglePlay debounced");
        return
    }
    toggling = !0;
    const t = $("playBtn");
    t && (t.disabled = !0);
    const e = !playerState.playing;
    try {
        console.log("[player] togglePlay -> " + (e ? "play" : "pause")), playerState.playing = e, playerPosAnchor && (playerPosAnchor = {
            pos: currentPosition(),
            t: performance.now(),
            playing: e
        });
        const n = e ? "pause" : "play";
        setIcon($("playBtn"), n);
        const s = $("npPlayBtn");
        s && setIcon(s, n);
        const o = $("miniDisc");
        if (o && o.classList.toggle("spin", !!e), e) pauseIntent = !1, await Player.togglePlay();
        else {
            pauseIntent = !0;
            try {
                await Player.togglePlay()
            } catch (i) {
                console.warn("[player] togglePlay failed", i)
            }
        }
        startActivePoll()
    } catch (n) {
        toast("\u64AD\u653E/\u6682\u505C\u5931\u8D25\uFF1A" + (n && n.message || n))
    } finally {
        toggling = !1, t && (t.disabled = !1)
    }
}

function onSeek() {
    if (CastManager.isMiot()) {
        toast("\u6295\u5C4F\u6A21\u5F0F\u4E0B\u4E0D\u652F\u6301\u62D6\u52A8\u8FDB\u5EA6");
        return
    }
    const t = playerState.duration || playerState.currentSong && Number(playerState.currentSong.duration) || 0;
    if (t <= 0) return;
    const e = Number($("seek").value),
        n = e / 1e3 * t;
    $("seek").style.setProperty("--progress", e / 10 + "%"), playerState.position = n, playerPosAnchor = {
        pos: n,
        t: performance.now(),
        playing: playerState.playing
    }, $("cur").textContent = fmt(n), Player.seek(n).then(() => startActivePoll()).catch(() => {})
}

function onNpSeek() {
    if (CastManager.isMiot()) {
        toast("\u6295\u5C4F\u6A21\u5F0F\u4E0B\u4E0D\u652F\u6301\u62D6\u52A8\u8FDB\u5EA6");
        return
    }
    const t = playerState.duration || playerState.currentSong && Number(playerState.currentSong.duration) || 0,
        e = Number($("npSeek").value);
    if (t <= 0) return;
    const n = e / 1e3 * t;
    playerState.position = n, playerPosAnchor = {
        pos: n,
        t: performance.now(),
        playing: playerState.playing
    };
    const s = $("npCur");
    s && (s.textContent = fmt(n)), Player.seek(n).then(() => startActivePoll()).catch(() => {})
}

function seek(t) {
    const e = playerState.position || 0;
    Player.seek(Math.max(0, e + t)).then(() => startActivePoll()).catch(() => {})
}

function getCurrentSongId() {
    const t = songIdOf(playerState.currentSong);
    return t !== "" && t > 0 ? Number(t) : null
}
async function loadFavoriteIds(sidArg) {
    try {
        const sid = sidArg || currentSourceId || "";
        const u = `${PLUGIN_BASE}/favorite-ids` + (sid ? `?sourceId=${encodeURIComponent(sid)}` : "");
        const r = await api(u);
        r.ok && Array.isArray(r.ids) && (favoriteIds = new Set(r.ids.map(Number)), remoteFavSet = new Set((r.remote || []).map(x => x.sourceId + ":" + x.trackId)))
    } catch (e) {
        console.log("[fav] load failed", e)
    }
    renderExtraControls()
}

function isFavOf(t) {
    if (!t) return !1;
    const e = songIdOf(t);
    if (e && favoriteIds.has(Number(e))) return !0;
    const s = t.sourceId || currentSourceId;
    if (s && t.id != null) return remoteFavSet.has(s + ":" + t.id);
    return !1
}

function currentSourceType() {
    const s = sources.find(x => x.id === currentSourceId);
    return s && s.type || ""
}

function plEditModalEl() {
    const m = document.getElementById("plEditModal");
    if (m) return m;
    const n = document.createElement("div");
    n.className = "modal-mask";
    n.id = "plEditModal";
    n.innerHTML = '<div class="modal" style="width:340px"><div class="modal-head"><h3 id="plEditTitle"></h3><button class="modal-x" id="plEditX">\u2715</button></div><div class="modal-body"><div class="field"><label>\u6b4c\u5355\u540d\u79f0</label><input id="plEditInput" placeholder="\u672a\u547d\u540d\u6b4c\u5355" /></div></div><div class="modal-foot"><div class="row"><button class="btn" id="plEditCancel">\u53d6\u6d88</button><button class="btn primary" id="plEditOk">\u786e\u5b9a</button></div></div></div>';
    document.body.appendChild(n);
    document.getElementById("plEditX").onclick = () => n.classList.remove("show");
    document.getElementById("plEditCancel").onclick = () => n.classList.remove("show");
    n.onclick = e => {
        if (e.target === n) n.classList.remove("show")
    };
    return n
}

function openPlaylistEditModal(mode, pl) {
    const m = plEditModalEl();
    document.getElementById("plEditTitle").textContent = mode === "create" ? "\u65b0\u5efa\u6b4c\u5355" : mode === "delete" ? "\u5220\u9664\u6b4c\u5355" : "\u91cd\u547d\u540d\u6b4c\u5355";
    const inp = document.getElementById("plEditInput");
    inp.style.display = mode === "delete" ? "none" : "block";
    if (mode !== "create" && pl) inp.value = pl.name || "";
    m.classList.add("show");
    setTimeout(() => inp.focus(), 30);
    document.getElementById("plEditOk").onclick = () => plEditConfirm(mode, pl)
}
async function plEditConfirm(mode, pl) {
    const m = plEditModalEl();
    const name = document.getElementById("plEditInput").value.trim();
    try {
        if (mode === "create") {
            const r = await api(PLUGIN_BASE + "/upstream-playlist", "POST", {
                op: "create",
                sourceId: currentSourceId,
                name: name || "\u672a\u547d\u540d\u6b4c\u5355"
            }, 2e4, {
                prio: 1
            });
            if (!r.ok) throw new Error(r.message || "\u5931\u8d25")
        } else if (mode === "rename") {
            const r = await api(PLUGIN_BASE + "/upstream-playlist", "POST", {
                op: "update",
                sourceId: currentSourceId,
                playlistId: pl.id,
                name: name
            }, 2e4, {
                prio: 1
            });
            if (!r.ok) throw new Error(r.message || "\u5931\u8d25")
        } else if (mode === "delete") {
            if (typeof confirm === "function" && !confirm("\u786e\u5b9a\u5220\u9664\u8be5\u6b4c\u5355\uff1f\u6b64\u64cd\u4f5c\u4e0d\u53ef\u6062\u590d")) return;
            const r = await api(PLUGIN_BASE + "/upstream-playlist", "POST", {
                op: "delete",
                sourceId: currentSourceId,
                playlistId: pl.id
            }, 2e4, {
                prio: 1
            });
            if (!r.ok) throw new Error(r.message || "\u5931\u8d25")
        }
        m.classList.remove("show");
        toast("\u64cd\u4f5c\u6210\u529f");
        refreshPlaylists()
    } catch (e) {
        toast("\u64cd\u4f5c\u5931\u8d25\uff1a" + (e && e.message || e))
    }
}

function refreshPlaylists() {
    try {
        localStore.del("list:" + currentSourceId + ":playlists")
    } catch {}
    try {
        delete memCache["list:" + currentSourceId + ":playlists"]
    } catch {}
    forceRefresh = !0;
    loadView("playlists")
}
async function removeTrackFromPlaylist(trackId) {
    forceRefresh = !0;
    try {
        const r = await api(PLUGIN_BASE + "/upstream-playlist", "POST", {
            op: "update",
            sourceId: currentSourceId,
            playlistId: drill.id,
            trackIdsToRemove: [String(trackId)]
        }, 2e4, {
            prio: 1
        });
        if (!r.ok) throw new Error(r.message || "\u5931\u8d25");
        toast("\u5df2\u79fb\u9664");
        loadDrill()
    } catch (e) {
        toast("\u79fb\u9664\u5931\u8d25\uff1a" + (e && e.message || e))
    }
}

function isCurrentFavorite() {
    const t = getCurrentSongId();
    if (t && favoriteIds.has(t)) return !0;
    const k = curTrackKey();
    if (k && k.sourceId && k.trackId && remoteFavSet.has(k.sourceId + ":" + k.trackId)) return !0;
    return !1
}
function onNpPanelDblclick(t) {
    // 双击播放详情页面板空白处收藏/取消收藏；排除按钮、输入框、进度条、歌词等可交互子区域，避免误触。
    const e = t.target;
    if (e && (e.closest("button, input, textarea, a, .np-progress, .np-controls, .np-lyric, #npLyric, .np-device-pop, .np-list-pop"))) return;
    t.stopPropagation();
    toggleFavoriteCurrent()
}
async function toggleFavoriteCurrent() {
    const t = getCurrentSongId();
    if (!t) return toast("\u5F53\u524D\u6CA1\u6709\u53EF\u6536\u85CF\u7684\u6B4C\u66F2");
    const n = !isCurrentFavorite();
    const k = curTrackKey();
    const body = {
        songId: t,
        fav: n
    };
    if (k && k.sourceId && k.trackId) {
        body.sourceId = k.sourceId;
        body.trackId = k.trackId
    } else if (currentSourceId) {
        body.sourceId = currentSourceId
    }
    try {
        const s = await api(`${PLUGIN_BASE}/favorite`, "POST", body, 2e4, {
            prio: 1
        });
        if (!s.ok) throw new Error(s.message || "HTTP " + s.status);
        await loadFavoriteIds(k && k.sourceId ? k.sourceId : currentSourceId);
        try {
            const o = localStore.get("list:favorites:" + currentSourceId) || memCache["list:favorites:" + currentSourceId];
            if (o && o.list) {
                const i = Object.assign({}, o, {
                    fetchedAt: 0
                });
                memCache["list:favorites:" + currentSourceId] = i, localStore.set("list:favorites:" + currentSourceId, i)
            }
        } catch {}
        view === "favorites" && loadView("favorites"), scheduleSaveState(), renderExtraControls(), toast(n ? "\u5DF2\u6536\u85CF" : "\u5DF2\u53D6\u6D88\u6536\u85CF")
    } catch (s) {
        toast("\u6536\u85CF\u5931\u8D25\uFF1A" + (s && s.message || s))
    }
}
async function unfavoriteSelected() {
    const t = [...selected];
    if (!t.length) return toast("\u8BF7\u5148\u9009\u62E9\u8981\u79FB\u51FA\u6536\u85CF\u7684\u6B4C\u66F2");
    const e = $("unfavSelBtn");
    e && (e.disabled = !0);
    const sid = currentSourceId;
    try {
        let n = 0,
            s = 0;
        for (const o of t) {
            const songId = Number(o);
            const body = {
                fav: !1
            };
            if (Number.isFinite(songId) && songId > 0) body.songId = songId;
            if (sid) body.sourceId = sid;
            body.trackId = String(o);
            try {
                const i = await api(`${PLUGIN_BASE}/favorite`, "POST", body, 2e4, {
                    prio: 1
                });
                i && i.ok ? n++ : s++
            } catch {
                s++
            }
        }
        await loadFavoriteIds(sid);
        clearSelection();
        try {
            const o = localStore.get("list:favorites:" + currentSourceId) || memCache["list:favorites:" + currentSourceId];
            if (o && o.list) {
                const i = Object.assign({}, o, {
                    fetchedAt: 0
                });
                memCache["list:favorites:" + currentSourceId] = i, localStore.set("list:favorites:" + currentSourceId, i)
            }
        } catch {}
        view === "favorites" && loadView("favorites"), scheduleSaveState(), toast(s ? `\u5DF2\u79FB\u51FA ${n} \u9996\uFF0C${s} \u9996\u5931\u8D25` : `\u5DF2\u79FB\u51FA\u6536\u85CF ${n} \u9996`)
    } catch (n) {
        toast("\u79FB\u51FA\u6536\u85CF\u5931\u8D25\uFF1A" + (n && n.message || n))
    } finally {
        e && (e.disabled = !1)
    }
}
const PLAY_MODE_LABELS = {
        order: "\u987A\u5E8F\u64AD\u653E",
        loop: "\u5217\u8868\u5FAA\u73AF",
        single: "\u5355\u66F2\u5FAA\u73AF",
        random: "\u968F\u673A\u64AD\u653E",
        singlePlay: "\u5355\u66F2\u64AD\u653E"
    },
    PLAY_MODE_ICONS = {
        order: "order",
        loop: "loop",
        single: "repeat",
        random: "random",
        singlePlay: "singlePlay"
    },
    PLAY_MODES = Object.keys(PLAY_MODE_LABELS);

function renderModeMenu() {
    const t = $("modeMenu");
    t && (t.innerHTML = PLAY_MODES.map(e => `<div class="mi${e===playMode?" active":""}" onclick="selectPlayMode('${e}')">
       <span class="ico-wrap"></span>${PLAY_MODE_LABELS[e]}<span class="chk">\u2713</span>
     </div>`).join(""), t.querySelectorAll(".mi").forEach((e, n) => {
        const s = e.querySelector(".ico-wrap");
        s && (s.innerHTML = ICONS[PLAY_MODE_ICONS[PLAY_MODES[n]]] || "")
    }))
}

function toggleModeMenu(t) {
    const e = $("modeMenu");
    if (!e) return;
    if (e.classList.contains("show")) {
        e.classList.remove("show");
        return
    }
    renderModeMenu();
    const n = t.getBoundingClientRect(),
        s = e.offsetHeight || 130,
        o = e.offsetWidth || 150,
        i = $("volPop"),
        a = i && i.offsetHeight || 205;
    let r = n.top - a - 10;
    r = Math.max(8, r);
    let l = n.right - o;
    l = Math.max(8, Math.min(l, window.innerWidth - o - 8)), e.style.left = l + "px", e.style.top = r + "px", e.classList.add("show")
}
const PLAY_RATES = [.5, .75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
let playRate = 1;
try {
    const t = parseFloat(localStorage.getItem("mm:play_rate") || "");
    PLAY_RATES.indexOf(t) >= 0 && (playRate = t)
} catch {}

function savePlayRate() {
    try {
        localStorage.setItem("mm:play_rate", String(playRate))
    } catch {}
}
const RATE_METHODS = ["setPlaybackRate", "playbackRate", "setRate", "setSpeed", "speed", "setPlaybackSpeed"];

function findRateMethod() {
    const t = window.SongloftPlugin && window.SongloftPlugin.player;
    if (!t) return null;
    for (const e of RATE_METHODS)
        if (typeof t[e] == "function") return e;
    return null
}

function applyPlayRate(t) {
    const e = window.SongloftPlugin && window.SongloftPlugin.player,
        n = findRateMethod();
    if (!e || !n) return !1;
    try {
        return e[n](t), !0
    } catch {
        return !1
    }
}

function renderRateMenu() {
    const t = $("rateMenu");
    if (t) {
        t.innerHTML = "";
        for (const e of PLAY_RATES) {
            const n = document.createElement("div");
            n.className = "mi" + (e === playRate ? " active" : "");
            const s = e === 1 ? "\u6B63\u5E38 (" + e + "x)" : e + "x";
            n.innerHTML = `<span>${s}</span><span class="chk">\u2713</span>`, n.onclick = () => selectRate(e), t.appendChild(n)
        }
    }
}

function toggleRateMenu(t) {
    const e = $("rateMenu");
    if (!e) return;
    if (e.classList.contains("show")) {
        e.classList.remove("show");
        return
    }
    renderRateMenu();
    const n = t.getBoundingClientRect();
    e.classList.add("show");
    const s = e.offsetHeight || PLAY_RATES.length * 36 + 12;
    let o = n.top - s - 4;
    o < 8 && (o = n.bottom + 10);
    let i = n.right - (e.offsetWidth || 150);
    i = Math.max(8, Math.min(i, window.innerWidth - (e.offsetWidth || 150) - 8)), e.style.left = i + "px", e.style.top = o + "px"
}

function selectRate(t) {
    $("rateMenu").classList.remove("show"), playRate = t, savePlayRate(), applyPlayRate(t) || toast("\u5BBF\u4E3B\u64AD\u653E\u5668\u4E0D\u652F\u6301\u500D\u901F\u529F\u80FD"), renderExtraControls()
}
async function selectPlayMode(t) {
    PLAY_MODE_LABELS[t] && (playMode = t, $("modeMenu").classList.remove("show"), scheduleSaveState(), await applyPlayMode(), renderExtraControls())
}

function hostPlayMode(t) {
    return t === "repeat" ? "single" : t
}
async function applyPlayMode() {
    try {
        const t = hostPlayMode(playMode);
        Player.has("setPlayMode") ? await Player.setPlayMode(t) : Player.has("setShuffle") ? (await Player.setShuffle(t === "random"), Player.has("setRepeat") && await Player.setRepeat(t === "loop" || t === "single")) : Player.has("setRepeat") && await Player.setRepeat(t === "loop" || t === "single")
    } catch (t) {
        console.log("[playMode] apply failed", t && t.message)
    }
}
async function setVolumeHost(t) {
    currentVolume = Math.max(0, Math.min(1, t));
    try {
        Player.has("setVolume") && await Player.setVolume(Math.round(currentVolume * 100))
    } catch (e) {
        console.log("[volume] set failed", e && e.message)
    }
    CastManager.isMiot() && CastManager.castSetVolume(Math.round(currentVolume * 100)), renderExtraControls()
}

function toggleVolPop(t) {
    const e = $("volPop");
    if (e.classList.contains("show")) {
        e.classList.remove("show");
        return
    }
    volPaint(currentVolume), e.classList.add("show"), bindVolTrack();
    const n = t.getBoundingClientRect(),
        s = e.offsetHeight || 180;
    e.style.left = Math.max(8, Math.min(n.left, window.innerWidth - 80)) + "px", e.style.top = Math.max(8, n.top - s - 10) + "px"
}
let volDrag = null,
    volPending = null,
    volTimer = null;

function volOf(t) {
    const n = $("volTrack").getBoundingClientRect();
    return Math.max(0, Math.min(1, (n.bottom - t) / (n.height || 1)))
}

function volPaint(t) {
    const e = Math.round(t * 100);
    $("volFill").style.height = e + "%", $("volThumb").style.bottom = e + "%", $("volPct").textContent = e + "%"
}

function volSchedule(t) {
    volPending = t, !volTimer && (volTimer = setTimeout(() => {
        if (volTimer = null, volPending != null) {
            const e = volPending;
            volPending = null, setVolumeHost(e)
        }
    }, 50))
}

function volFlush() {
    if (volTimer && (clearTimeout(volTimer), volTimer = null), volPending != null) {
        const t = volPending;
        volPending = null, setVolumeHost(t)
    }
}

function volDown(t) {
    const e = volOf(t);
    volDrag = !0, volPaint(e), setVolumeHost(e)
}

function volMove(t) {
    if (!volDrag) return;
    const e = volOf(t);
    volPaint(e), volSchedule(e)
}

function volUp() {
    volDrag = null, volFlush()
}

function bindVolTrack() {
    const t = $("volTrack");
    !t || t.dataset.bound || (t.dataset.bound = "1", t.addEventListener("touchstart", e => {
        e.preventDefault(), volDown(e.touches[0].clientY)
    }, {
        passive: !1
    }), t.addEventListener("touchmove", e => {
        e.preventDefault(), volMove(e.touches[0].clientY)
    }, {
        passive: !1
    }), t.addEventListener("touchend", () => volUp()), t.addEventListener("touchcancel", () => volUp()), t.addEventListener("mousedown", e => {
        e.preventDefault(), volDown(e.clientY);
        const n = o => volMove(o.clientY),
            s = () => {
                volUp(), window.removeEventListener("mousemove", n), window.removeEventListener("mouseup", s)
            };
        window.addEventListener("mousemove", n), window.addEventListener("mouseup", s)
    }))
}

function closeFloatingOnOutside(t) {
    const e = $("volPop");
    e.classList.contains("show") && !e.contains(t.target) && !t.target.closest(".vol-btn") && e.classList.remove("show");
    const n = $("modeMenu");
    n.classList.contains("show") && !n.contains(t.target) && !t.target.closest(".mode-btn") && n.classList.remove("show");
    const s = $("rateMenu");
    s.classList.contains("show") && !s.contains(t.target) && !t.target.closest("#rateHomeBtn") && !t.target.closest("#npRateBtn") && s.classList.remove("show")
}
document.addEventListener("click", closeFloatingOnOutside, !0), document.addEventListener("touchstart", closeFloatingOnOutside, {
    capture: !0,
    passive: !0
});

function renderExtraControls() {
    document.querySelectorAll(".mode-btn").forEach(o => {
        setIcon(o, PLAY_MODE_ICONS[playMode] || "order"), o.title = PLAY_MODE_LABELS[playMode] || "\u987A\u5E8F\u64AD\u653E"
    });
    const t = isCurrentFavorite();
    document.querySelectorAll(".fav-btn").forEach(o => {
        setIcon(o, t ? "heartFill" : "heart"), o.title = t ? "\u5DF2\u6536\u85CF" : "\u6536\u85CF", o.classList.toggle("active", t)
    }), document.querySelectorAll(".vol-btn").forEach(o => {
        setIcon(o, currentVolume <= 0 ? "volMute" : "vol"), o.title = "\u97F3\u91CF " + Math.round(currentVolume * 100) + "%"
    });
    const e = "\u64AD\u653E\u901F\u5EA6\uFF1A" + (playRate === 1 ? "\u6B63\u5E38" : playRate + "x"),
        n = $("rateHomeBtn");
    n && (n.title = e);
    const s = $("npRateBtn");
    s && (s.title = e)
}

function splitWordsToChars(t) {
    for (const e of t) {
        if (!e.words || !e.words.length) continue;
        const n = [];
        for (const s of e.words) {
            const o = Array.from(s.text || "");
            if (o.length <= 1) {
                n.push(s);
                continue
            }
            const i = (s.duration || .5) / o.length;
            for (let a = 0; a < o.length; a++) n.push({
                time: s.time + a * i,
                duration: i,
                text: o[a]
            })
        }
        e.words = n, e.text = n.map(s => s.text).join("")
    }
    return t
}

function parseLRC(t) {
    if (!t) return [];
    const e = /\[\[\d{1,3}:\d{2}(?:\.\d{1,3})?\]\]/.test(t),
        n = /<\d{1,3}:\d{2}(?:\.\d{1,3})?>/.test(t),
        s = /^\[\d+,\d+\]/.test(t.trim()) && /\(\d+,\d+\)/.test(t);
    return console.log("[lyric] parse format", e ? "double" : n ? "enhanced" : s ? "yrc" : "standard"), e ? splitWordsToChars(parseDoubleBracketLRC(t)) : n ? splitWordsToChars(parseEnhancedLRC(t)) : s ? splitWordsToChars(parseYRCLyric(t)) : parseStandardLRC(t)
}

function parseDoubleBracketLRC(t) {
    const e = [],
        n = /^\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\](.*)/,
        s = /\[\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]\]/g,
        o = [];
    let i;
    for (;
        (i = s.exec(t)) !== null;) o.push(i);
    let a = 0;
    return t.split(`
`).forEach(r => {
        const l = r.match(n);
        let c, d;
        if (l) c = timeFromLRC(l[1], l[2], l[3]), d = l[4];
        else {
            const g = r.trim();
            if (!g) return;
            c = a + 5, d = g
        }
        a = c, d = d.replace(/\(\d+,\s*\d+\)/g, "").replace(/\d+,\s*\d+/g, "").replace(/[()]/g, "").trim();
        const u = [],
            f = [];
        let p;
        const v = /\[\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]\]/g;
        for (;
            (p = v.exec(d)) !== null;) f.push({
            idx: p.index,
            time: timeFromLRC(p[1], p[2], p[3])
        });
        if (!f.length || f.length < 2) {
            const g = d.replace(/\[\[\d{1,3}:\d{2}(?:\.\d{1,3})?\]\]/g, "").trim();
            g && e.push({
                time: c,
                text: g
            });
            return
        }
        const S = f.length && f[0].time < c,
            w = d.slice(0, f[0].idx).trim();
        w && u.push({
            time: c,
            text: w,
            duration: 0
        });
        for (let g = 0; g < f.length; g++) {
            const b = f[g].idx,
                x = g + 1 < f.length ? f[g + 1].idx : d.length;
            let k = d.slice(b, x).replace(/\[\[\d{1,3}:\d{2}(?:\.\d{1,3})?\]\]/g, "").trim();
            k && u.push({
                time: (S ? c : 0) + f[g].time,
                text: k,
                duration: 0
            })
        }
        for (let g = 0; g < u.length; g++) {
            const b = g + 1 < u.length ? u[g + 1].time : null;
            u[g].duration = b != null ? Math.max(.05, b - u[g].time) : .5
        }
        const M = u.map(g => g.text).join("");
        M && e.push({
            time: c,
            text: M,
            words: u.length ? u : void 0
        })
    }), e.sort((r, l) => r.time - l.time)
}

function timeFromLRC(t, e, n) {
    const s = parseInt((n || "0").padEnd(3, "0").slice(0, 3), 10);
    return parseInt(t, 10) * 60 + parseInt(e, 10) + s / 1e3
}

function parseStandardLRC(t) {
    const e = [],
        n = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    // LRC 元标签（ID 标签）按规范转成可读文字，作为置顶头部行；非显示型标签（[re:]/[ve:]/[length:]/[offset:] 等）丢弃。
    const ID_LABEL = {
        ti: '歌名',
        ar: '歌手',
        al: '专辑',
        au: '作词',
        by: '制作',
        author: '作者',
        music: '所属'
    };
    let s = 0;
    const headers = [];
    t.split(`
`).forEach(o => {
        const i = [];
        let a;
        for (;
            (a = n.exec(o)) !== null;) i.push(a);
        if (!i.length) {
            const l = o.replace(n, "").trim();
            if (!l) return;
            // 整行是单个元标签：[ti:达拉崩吧] → 转「歌名：达拉崩吧」置顶
            const m = /^\[([a-z]+):(.*)\]$/i.exec(l);
            if (m) {
                const key = m[1].toLowerCase(),
                    val = m[2].trim();
                const label = ID_LABEL[key];
                if (label && val) {
                    headers.push(label + "：" + val);
                    return
                }
                return  // 非显示型标签（[offset:]/[length:]/[re:]/[ve:] 等）丢弃，不当歌词
            }
            // 兼容 normalizeLrc 已转成的中文标签行（旧缓存/Subsonic 路径写入的歌词）：
            // 歌名：/歌手：/专辑：/作词：/制作： 等直接作为头部置顶，不再当成普通歌词插入中间。
            const cm = /^(歌名|歌曲|标题|歌手|演唱|专辑|作词|作曲|原著|制作|作者|所属)\s*[:：]\s*(.+)$/.exec(l);
            if (cm) {
                headers.push(cm[1] + "：" + cm[2].trim());
                return
            }
            s += 5, e.push({
                time: s,
                text: l
            });
            return
        }
        const r = o.replace(n, "").trim();
        i.forEach(l => {
            s = timeFromLRC(l[1], l[2], l[3]), e.push({
                time: s,
                text: r
            })
        })
    });
    const headLines = headers.map(h => ({
        time: 0,
        text: h,
        header: true
    }));
    return [...headLines, ...e].sort((o, i) => o.time - i.time)
}

function parseEnhancedLRC(t) {
    const e = [],
        n = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\](.*)/,
        s = /<(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?>([^<]*)/g;
    t.split(`
`).forEach(o => {
        const i = o.match(n);
        if (!i) return;
        const a = timeFromLRC(i[1], i[2], i[3]),
            r = i[4],
            l = [];
        let c;
        for (;
            (c = s.exec(r)) !== null;) l.push({
            time: timeFromLRC(c[1], c[2], c[3]),
            text: c[4],
            duration: 0
        });
        if (l.length) {
            for (let u = 0; u < l.length - 1; u++) l[u].duration = l[u + 1].time - l[u].time;
            l[l.length - 1].duration = .5
        }
        const d = r.replace(/<\d{1,3}:\d{2}(?:\.\d{1,3})?>/g, "").replace(/\[.*\]/g, "").trim();
        e.push({
            time: a,
            text: d || l.map(u => u.text).join(""),
            words: l.length ? l : void 0
        })
    });
    for (let o = 0; o < e.length - 1; o++) {
        const i = e[o].words;
        if (i && i.length) {
            const a = i[i.length - 1],
                r = e[o + 1].time;
            r > a.time && (a.duration = r - a.time)
        }
    }
    return e.sort((o, i) => o.time - i.time)
}

function parseYRCLyric(t) {
    const e = [],
        n = /^\[(\d+),(\d+)\](.*)/,
        s = /\((\d+),(\d+)\)([^\(]*)/g;
    return t.split(`
`).forEach(o => {
        const i = o.match(n);
        if (!i) return;
        const a = parseInt(i[1], 10) / 1e3,
            r = i[3],
            l = [];
        let c;
        for (;
            (c = s.exec(r)) !== null;) {
            const u = parseInt(c[1], 10) / 1e3,
                f = parseInt(c[2], 10) / 1e3;
            l.push({
                time: u,
                duration: f,
                text: c[3]
            })
        }
        const d = l.map(u => u.text).join("");
        e.push({
            time: a,
            text: d,
            words: l.length ? l : void 0
        })
    }), e.sort((o, i) => o.time - i.time)
}

function withTimeout(t, e) {
    return new Promise(n => {
        let s = !1;
        const o = setTimeout(() => {
            s || (s = !0, n(!1))
        }, e);
        Promise.resolve(t).then(i => {
            s || (s = !0, clearTimeout(o), n(i))
        }, () => {
            s || (s = !0, clearTimeout(o), n(!1))
        })
    })
}

function clearNowPlayingUI() {
    playGen++, lyricFlight.clear(), slLineIdx = -2, slActiveEl = null, slLyricRef = null;
    const t = $("npTitle");
    t && (t.textContent = "");
    const e = $("npArtist");
    e && (e.textContent = "");
    const n = $("npAlbum");
    n && (n.textContent = "");
    const s = $("npCover");
    s && (s.src = DEFAULT_COVER), currentLyric = null, currentLyricKey = null, lastLyricIndex = -1, lyricLoading = !0, renderLyricIfOpen()
}

function renderLyricIfOpen() {
    $("npMask") && $("npMask").classList.contains("show") && renderLyric()
}
const lyricFlight = new Set;
let lyricLoadSeq = 0;
async function loadLyricForCurrentSong(t, force) {
    const e = playerState.currentSong,
        n = songIdOf(e);
    e && syncCurTrackFromState();
    const s = (n || "x") + "|" + (curTrack && curTrack.id || "x") + "|" + (currentSourceId || "x");
    let addedFlight = !1;
    if (lyricFlight.has(s)) {
        if (!force) {
            console.log("[lyric] same-song in-flight, skip", s);
            return
        }
        console.log("[lyric] force despite in-flight", s)
    } else {
        lyricFlight.add(s);
        addedFlight = !0
    }
    const o = ++lyricLoadSeq;
    try {
        const i = $("npMask") && $("npMask").classList.contains("show");
        const a = songSourceData(e);
        const sd = a || (curTrack && currentSourceId ? { sourceId: currentSourceId, trackId: curTrack.id } : null);
        const params = new URLSearchParams();
        if (n) params.set("songId", n);
        if (sd && sd.sourceId) params.set("sourceId", sd.sourceId);
        if (sd && sd.trackId) params.set("trackId", sd.trackId);
        const key = n ? "host:" + n : (sd ? sd.sourceId + ":" + sd.trackId : null);
        if (!key) {
            console.warn("[lyric] cannot resolve source/track, skip");
            return
        }
        const cacheKey = "lyric:" + key;
        const cached = localStore.get(cacheKey);
        if (cached !== void 0 && !t) {
            currentLyric = cached == null ? null : parseLRC(cached);
            currentLyricKey = key;
            i && renderLyricIfOpen();
            return cached != null
        }
        const c = await api(PLUGIN_BASE + "/lyric?" + params.toString(), "GET", void 0, 2e4, { prio: 1 });
        if (o != null && o !== lyricLoadSeq) return;
        if (c.ok && c.lyric) {
            currentLyric = parseLRC(c.lyric);
            currentLyricKey = key;
            localStore.set(cacheKey, c.lyric);
            console.log("[lyric] loaded", currentLyric.length, "lines source=" + (c.lyricSource || "?"));
            i && renderLyricIfOpen();
            return !0
        }
        currentLyric = null;
        currentLyricKey = key;
        localStore.set(cacheKey, null);
        console.warn("[lyric] no lyric", key);
        i && renderLyricIfOpen();
        return !1
    } finally {
        if (addedFlight) lyricFlight.delete(s)
    }
    // 歌词身份键 currentLyricKey 现已确定；用它作为偏移键重新加载记忆，
    // 保证刷新/切歌后保存时用的键与加载时一致（hydrate 时的首轮加载此刻 currentLyricKey 尚为 null，需此处补一次）。
    if (currentLyricKey) loadLyricOffset().catch(() => {})
}

async function openNowPlaying() {
    if (!(playerState.currentSong || curTrack || null)) return;
    CastManager && CastManager.refresh().catch(() => {}), $("npMask").classList.add("show");
    const e = document.querySelector(".np-panel");
    e && (e.style.transition = "none", e.style.transform = "translateY(0)"), npApplySW(), await hydrateNowPlaying(), scheduleSaveState();
    // 双击播放后立即打开详情页时，歌曲身份/歌词映射（host id → 源 trackId）可能尚未就绪，
    // 首轮拉歌词会失败并缓存成 null（显示“暂无歌词”）。这里做几次延迟重试，
    // 待映射就绪自动补齐，免去手动点刷新按钮。
    retryLyricOnOpen()
}
function retryLyricOnOpen() {
    let t = 0;
    const tick = () => {
        if (!($("npMask") && $("npMask").classList.contains("show"))) return;
        if (currentLyric && currentLyric.length) return; // 已加载成功，停止
        if (t++ >= 8) return;
        // force=true 绕过 lyricFlight 的 in-flight 去重，确保真正重新发起拉取（而非被跳过）
        loadLyricForCurrentSong(!0, !0).then(ok => { ok || setTimeout(tick, 800) })
    };
    // 首轮 hydrate 的歌词请求通常在 1s 内结束，稍长初始延迟避免与首轮请求撞车被 skip
    setTimeout(tick, 1200)
}

function closeNowPlaying() {
    $("npMask").classList.remove("show"), lastLyricIndex = -1, npActiveLineIdx = -1, npActiveLineEl = null, scheduleSaveState()
}
// 切到指定播放详情页（0=封面，1=歌词），仅在移动端 swiper 生效
function npGoPage(p) {
    npPage = p ? 1 : 0;
    const sw = $("npSwiper");
    if (sw) {
        const slides = sw.querySelector(".np-slides");
        if (slides) {
            const w = sw.clientWidth || 1;
            slides.style.transition = "none", slides.style.transform = "translateX(" + (-npPage * w) + "px)"
        }
    }
    updateNpPager(), scheduleSaveState()
}
// 退出插件前若播放详情页是打开的，回到插件后恢复其打开状态与所在页
function maybeRestoreNp() {
    if (!pendingNpRestore || !pendingNpRestore.open) return;
    if (!(playerState.currentSong || curTrack || null)) return; // 当前曲目尚未从 host 恢复，等 applyState 再试
    try {
        openNowPlaying();
        if (pendingNpRestore.page) npGoPage(pendingNpRestore.page)
    } catch (e) {
        console.log("[np] restore failed", e)
    }
    pendingNpRestore = null
}
const NP_MQ = window.matchMedia("(max-width: 768px)");
let npSWActive = !1,
    npPage = 0;
const LYRIC_MANUAL_MS = 4e3;
let lyricManualUntil = 0,
    prevManualPaused = !1;

function npApplySW() {
    const t = document.querySelector(".np-body .np-left"),
        e = document.querySelector(".np-body .np-right"),
        n = t && t.querySelector(".np-info"),
        s = $("npCover"),
        o = $("npLyric"),
        w = $("npLyricWrap") || o;
    if (!(!t || !e || !n || !s || !o)) {
        if (NP_MQ.matches && !npSWActive) {
            npSWActive = !0;
            const i = document.createElement("div");
            i.className = "np-swiper", i.id = "npSwiper";
            const a = document.createElement("div");
            a.className = "np-slides";
            const r = document.createElement("div");
            r.className = "np-slide";
            const l = document.createElement("div");
            l.className = "np-slide", a.appendChild(r), a.appendChild(l), i.appendChild(a), t.insertBefore(i, n), r.appendChild(s.parentNode || s), l.appendChild(w), e.classList.add("np-hide"), npPage = 0, bindNpSwipe(i), updateNpPager()
        } else if (!NP_MQ.matches && npSWActive) {
            npSWActive = !1, t.insertBefore(s.parentNode || s, t.firstChild), e.appendChild(w), e.classList.remove("np-hide");
            const i = $("npSwiper");
            i && i.remove()
        }
    }
}
NP_MQ.addEventListener ? NP_MQ.addEventListener("change", npApplySW) : NP_MQ.addListener && NP_MQ.addListener(npApplySW);

function bindNpSwipe(t) {
    if (!t || t.dataset.swipeBound) return;
    t.dataset.swipeBound = "1";
    const e = t.querySelector(".np-slides"),
        n = t.querySelector(".np-lyric");
    if (!e) return;
    let s = 0,
        o = 0,
        i = !1,
        a = null,
        r = 0,
        l = 1,
        c = 0;
    const d = 8;

    function u(p, v) {
        e.style.transition = v ? "transform .28s cubic-bezier(.22,.61,.36,1)" : "none", e.style.transform = "translateX(" + p + "px)"
    }
    t.addEventListener("pointerdown", p => {
        if (!(p.pointerType === "mouse" && p.button !== 0)) {
            i = !0, a = null, s = p.clientX, o = p.clientY, l = t.clientWidth || 1, r = -npPage * l, c = n ? n.scrollTop : 0, e.style.transition = "none";
            try {
                t.setPointerCapture(p.pointerId)
            } catch {}
        }
    }), t.addEventListener("pointermove", p => {
        if (!i) return;
        const v = p.clientX - s,
            S = p.clientY - o;
        if (a === null) {
            if (Math.abs(v) < d && Math.abs(S) < d) return;
            a = Math.abs(v) >= Math.abs(S) ? "x" : "y"
        }
        if (a === "x") {
            p.preventDefault();
            let w = r + v;
            w > 0 ? w = 0 : w < -l && (w = -l), u(w, !1)
        } else a === "y" && n && npPage === 1 && (p.preventDefault(), n.scrollTop = c - S, lyricManualUntil = Date.now() + LYRIC_MANUAL_MS)
    });

    function f(p) {
        if (!i) return;
        i = !1;
        try {
            t.releasePointerCapture(p.pointerId)
        } catch {}
        const v = p.clientX - s;
        a === "x" && (v < -l * .22 && npPage < 1 ? npPage = 1 : v > l * .22 && npPage > 0 && (npPage = 0), u(-npPage * l, !0), updateNpPager()), a = null
    }
    t.addEventListener("pointerup", f), t.addEventListener("pointercancel", f), n && n.addEventListener("wheel", p => {
        npPage === 1 && (n.scrollHeight <= n.clientHeight || (p.preventDefault(), n.scrollTop += p.deltaY, lyricManualUntil = Date.now() + LYRIC_MANUAL_MS))
    }, {
        passive: !1
    })
}

function updateNpPager() {
    const t = $("npPager");
    t && Array.prototype.forEach.call(t.children, (e, n) => e.classList.toggle("active", n === npPage))
}
let npSwipeBusy = !1;

function bindNpSongSwipe() {
    const t = document.querySelector(".np-panel");
    if (!t || t.dataset.songSwipeBound) return;
    t.dataset.songSwipeBound = "1";
    const e = document.getElementById("npSwipeDebug");
    let n = null;
    const s = h => {
            !e || !isDebugOn() || (e.innerHTML = h, e.classList.add("show"))
        },
        o = (h = 1500) => {
            e && (n && clearTimeout(n), n = setTimeout(() => {
                e.classList.remove("show")
            }, h))
        },
        i = h => {
            if (!h) return !1;
            const y = h.tagName;
            return !!(y === "INPUT" || y === "BUTTON" || y === "TEXTAREA" || y === "SELECT" || y === "A" || y === "LABEL" || h.closest && h.closest("input, button, textarea, select, a, label, .vol-pop, .mode-menu, .np-controls, .np-progress"))
        };
    let a = !1,
        r = null,
        l = !1,
        c = 0,
        d = 0,
        u = 0,
        f = 0,
        p = !0,
        v = !0,
        S = !1,
        w = !1,
        M = 0,
        g = 0,
        b = 0,
        x = 0,
        k = 0;
    const P = 8,
        _ = 70;
    t.addEventListener("pointerdown", h => {
        if (npSwipeBusy || h.pointerType === "mouse" && h.button !== 0) return;
        const y = h.target;
        if (i(y)) return;
        const m = y.closest && y.closest(".np-lyric"),
            L = y.closest && y.closest(".np-swiper");
        S = !!m, w = !!L, m ? (p = m.scrollTop <= 0, v = m.scrollTop + m.clientHeight >= m.scrollHeight - 1) : (p = !0, v = !0), a = !0, l = !0, r = null, u = 0, c = h.clientX, d = h.clientY, f = Date.now(), M = d, g = f, b = 0, x = 0, k = 0, t.style.transition = "none"
    }, {
        passive: !0
    }), t.addEventListener("pointermove", h => {
        if (!a || !l) return;
        const y = h.clientX - c,
            m = h.clientY - d;
        if (r === null) {
            if (Math.abs(y) < P && Math.abs(m) < P) return;
            r = Math.abs(y) >= Math.abs(m) ? "x" : "y"
        }
        if (r === "x") {
            l = !1;
            return
        }
        if (w && npPage === 1) {
            l = !1;
            return
        }
        if (S) {
            const T = m < 0;
            if (T && !v) {
                l = !1;
                return
            }
            if (!T && !p) {
                l = !1;
                return
            }
        }
        const L = Date.now();
        if (L - g > 0) {
            const T = Math.abs(h.clientY - M) / (L - g);
            x = T, T > b && (b = T)
        }
        M = h.clientY, g = L, Math.abs(m) > k && (k = Math.abs(m)), h.cancelable && h.preventDefault();
        let I = m * .85;
        const C = window.innerHeight * .5;
        I > C && (I = C), I < -C && (I = -C), t.style.transform = "translateY(" + I + "px)", u = m, s("|dy|=" + Math.abs(m).toFixed(0) + " \xB7 max=" + k.toFixed(0) + " \xB7 v=" + x.toFixed(2) + " \xB7 TH=50,v\u22651")
    }, {
        passive: !1
    });

    function E(h) {
        if (a) {
            if (a = !1, r === "y" && l) {
                const y = h.clientY - d,
                    m = Math.abs(y),
                    L = m >= 130,
                    I = m >= 50 && x >= 1,
                    C = (L || I) && m > 12;
                s("|dy|=" + m.toFixed(0) + " \xB7 max=" + k.toFixed(0) + " \xB7 v=" + x.toFixed(2) + " \xB7 " + (C ? "\u2713 \u5207\u6B4C" : "\u2717 \u56DE\u5F39") + " (TH=130 | dy\u226550&&v\u22651)"), o(300), C ? commitNpSwitch(y < 0 ? "next" : "prev") : snapNpPanel()
            } else snapNpPanel();
            l = !1, r = null
        }
    }
    t.addEventListener("pointerup", E), t.addEventListener("pointercancel", E)
}

function snapNpPanel() {
    const t = document.querySelector(".np-panel");
    t && (t.style.transition = "transform .2s ease", t.style.transform = "translateY(0)")
}

function commitNpSwitch(t) {
    const e = document.querySelector(".np-panel");
    if (!e || npSwipeBusy) return;
    npSwipeBusy = !0;
    const n = t === "next" ? -1 : 1;
    e.style.transition = "transform .3s cubic-bezier(.22,.61,.36,1)", e.style.transform = "translateY(" + n * 100 + "%)";
    let s = !1;
    const o = () => {
        s || (s = !0, t === "next" ? playNext() : playPrev(), e.style.transition = "none", e.style.transform = "translateY(" + -n * 100 + "%)", e.offsetHeight, requestAnimationFrame(() => {
            e.style.transition = "transform .3s cubic-bezier(.22,.61,.36,1)", e.style.transform = "translateY(0)"
        }), setTimeout(() => {
            npSwipeBusy = !1
        }, 640))
    };
    e.addEventListener("transitionend", o, {
        once: !0
    }), setTimeout(o, 360)
}
async function renderNowPlaying() {
    const t = playGen,
        e = playerState.currentSong || curTrack || null;
    if (!e) return;
    $("npTitle").textContent = e.title || "\u672A\u77E5\u6807\u9898", $("npArtist").textContent = e.artist || "", $("npAlbum").textContent = e.album || "", renderLyric();
    let n = DEFAULT_COVER;
    try {
        if (playerState.currentSong && (n = await coverForSong(playerState.currentSong)), n === DEFAULT_COVER && curTrack && curTrack.coverId) {
            const s = await coverDataUrl(curTrack.coverId);
            s && (n = s)
        }
    } catch (s) {
        console.log("[np] cover err", s && s.message)
    }
    t === playGen && (function () {
        const np = $("npCover");
        safeShowCover(np, n, function () { applyCoverTheme(np) })
    })()
}

function applyCoverTheme(t) {
    const e = document.querySelector(".np-panel");
    if (!t || !e) return;
    // 不放封面色调渐变背景：播放详情页保持纯净背景，避免封面四周出现彩色“背景颜色”（尤其手机端全屏时明显）。
    const n = () => {
        e.style.background = "transparent"
    };
    if (t.complete && t.naturalWidth > 0) {
        const s = document.createElement("canvas");
        s.width = 40, s.height = 40;
        const o = s.getContext("2d");
        try {
            o.drawImage(t, 0, 0, 40, 40);
            const i = o.getImageData(0, 0, 40, 40).data;
            let a = 0,
                r = 0,
                l = 0,
                c = 0;
            for (let d = 0; d < i.length; d += 4) {
                const u = i[d],
                    f = i[d + 1],
                    p = i[d + 2];
                u + f + p < 90 || u > 235 && f > 235 && p > 235 || (a += u, r += f, l += p, c++)
            }
            c > 0 && n(`${Math.round(a/c)},${Math.round(r/c)},${Math.round(l/c)}`)
        } catch {}
    } else t.onload = () => applyCoverTheme(t)
}
let lyricLoading = !1;
async function refreshNowPlayingInfo() {
    const t = playerState.currentSong;
    if (!t) return toast("\u5F53\u524D\u6CA1\u6709\u64AD\u653E\u7684\u6B4C\u66F2");
    toast("\u5237\u65B0\u5355\u66F2\u4FE1\u606F\u2026");
    try {
        const e = npCacheKey(t);
        localStore.del("np:meta:" + e), localStore.del("lyric:" + e);
        const n = songIdOf(t);
        n && localStore.del("lyric:host:" + n);
        const s = songSourceData(t);
        s && s.coverId && s.sourceId && coverDel(`${PLUGIN_BASE}/cover-data?sourceId=${encodeURIComponent(s.sourceId)}&coverId=${encodeURIComponent(s.coverId)}`);
        const o = t.cover_url || t.coverUrl;
        o && coverDel("host:" + o)
    } catch {}
    try {
        await hydrateNowPlaying()
    } catch {}
    toast("\u5DF2\u5237\u65B0")
}

function npCacheKey(t) {
    const e = songSourceData(t);
    if (e && e.provider === "multisource-music" && e.sourceId && e.trackId) return `${e.sourceId}:${e.trackId}`;
    const n = songIdOf(t);
    if (n) return "host:" + n;
    if (t && t.title && currentList.length) {
        const s = currentList.find(o => o.title === t.title && (!t.artist || o.artist === t.artist));
        if (s && currentSourceId) return `${currentSourceId}:${s.id}`
    }
    return "x"
}

function setNpText(t, e, n) {
    const s = $("npTitle");
    s && (s.textContent = t || "\u672A\u77E5\u6807\u9898");
    const o = $("npArtist");
    o && (o.textContent = e || "");
    const i = $("npAlbum");
    i && (i.textContent = n || "")
}
async function hydrateNowPlaying() {
    const t = playerState.currentSong;
    if (!t) return;
    loadLyricOffset(), updateLrcOffsetUI();
    const e = npCacheKey(t),
        n = playGen,
        s = $("npMask") && $("npMask").classList.contains("show"),
        o = localStore.get("np:meta:" + e);
    o ? setNpText(o.title, o.artist, o.album) : t.title ? setNpText(t.title, t.artist, t.album) : s && setNpText("\u52A0\u8F7D\u4E2D\u2026", "", "");
    const i = (function() {
        const l = songIdOf(t);
        return l ? "lyric:host:" + l : null
    })();
    let a = "lyric:" + e,
        r = localStore.get(a);
    r === void 0 && i && (r = localStore.get(i), a = i), r !== void 0 ? (currentLyric = r == null ? null : parseLRC(r), currentLyricKey = a.replace(/^lyric:/, ""), lyricLoading = !1, s && renderLyric()) : (currentLyric = null, currentLyricKey = null, lyricLoading = !0, s && renderLyric()), refreshNowPlaying(e, t, n)
}
async function refreshNowPlaying(t, e, n) {
    const s = $("npMask") && $("npMask").classList.contains("show");
    if (n !== playGen) return;
    const o = {
        title: e.title || "",
        artist: e.artist || "",
        album: e.album || ""
    };
    if (o.title && localStore.set("np:meta:" + t, o), n === playGen && (await loadLyricForCurrentSong(!0), n === playGen && (lyricLoading = !1, s && renderLyric(), s))) try {
        const i = await coverForSong(e);
        if (n !== playGen) return;
        i && i !== DEFAULT_COVER && safeShowCover($("npCover"), i, function () { applyCoverTheme($("npCover")) })
    } catch (i) {
        console.log("[np] cover refresh err", i && i.message)
    }
}

function renderLyric() {
    const t = $("npLyric");
    if (lastLyricIndex = -1, lyricManualUntil = 0, npActiveLineIdx = -1, npActiveLineEl = null, !currentLyric || !currentLyric.length) {
        t.innerHTML = lyricLoading ? '<div class="empty">\u52A0\u8F7D\u4E2D\u2026</div>' : '<div class="empty">\u6682\u65E0\u6B4C\u8BCD</div>';
        return
    }
    t.innerHTML = currentLyric.map((e, n) => {
        if (e.words && e.words.length) {
            const s = e.words.map((o, i) => `<span class="ch wd" data-wi="${i}" style="--h:${Math.round(10+(e.words.length<=1?0:i/(e.words.length-1))*320)}">${esc(o.text)}</span>`).join("");
            return `<div class="line" data-i="${n}">${s}</div>`
        }
        return `<div class="line" data-i="${n}">${esc(e.text)||"\xB7"}</div>`
    }).join(""), updateLyricHighlight()
}
let npActiveLineEl = null,
    npActiveLineIdx = -1,
    lyricFillRAF = 0;

function setActiveLine(t) {
    if (npActiveLineEl && currentLyric && currentLyric[npActiveLineIdx]) {
        const o = currentLyric[npActiveLineIdx];
        try {
            o.words && o.words.length ? npActiveLineEl.innerHTML = o.words.map((i, a) => `<span class="ch wd" data-wi="${a}" style="--h:${Math.round(10+(o.words.length<=1?0:a/(o.words.length-1))*320)}">${esc(i.text)}</span>`).join("") : npActiveLineEl.innerHTML = esc(o.text || "")
        } catch {}
    }
    npActiveLineIdx = t;
    const n = $("npLyric").querySelector('.line[data-i="' + t + '"]');
    if (!n) {
        npActiveLineEl = null;
        return
    }
    const s = currentLyric[t] || {};
    if (!s.words || !s.words.length) {
        const o = s.text || "";
        n.innerHTML = o.split("").map((i, a) => {
            const r = Math.round(10 + (o.length <= 1 ? 0 : a / (o.length - 1)) * 320),
                l = i === " " ? "\xA0" : esc(i);
            return '<span class="ch" style="--h:' + r + '">' + l + "</span>"
        }).join("")
    }
    npActiveLineEl = n
}

function lyricFillTick() {
    const t = $("npMask");
    if (t && t.classList.contains("show") && updateLyricHighlight(), t && t.classList.contains("show") && npActiveLineEl && currentLyric && currentLyric[npActiveLineIdx]) {
            const e = currentLyric[npActiveLineIdx],
            n = lyricPos(),
            s = npActiveLineEl.children;
        if (e.words && e.words.length && s.length === e.words.length)
            for (let o = 0; o < s.length; o++) {
                const i = e.words[o],
                    a = n >= i.time;
                s[o].classList.contains("lit") !== a && s[o].classList.toggle("lit", a)
            } else {
                const o = currentLyric[npActiveLineIdx + 1],
                    i = e.time,
                    r = (o ? o.time : (playerState.duration || 0) > i ? playerState.duration : i + 6) - i;
                let l = r > 0 ? (n - i) / r : 1;
                l < 0 ? l = 0 : l > 1 && (l = 1);
                const c = l >= 1 ? s.length : Math.floor(l * s.length);
                for (let d = 0; d < s.length; d++) {
                    const u = d < c;
                    s[d].classList.contains("lit") !== u && s[d].classList.toggle("lit", u)
                }
            }
    }
    lyricFillRAF = requestAnimationFrame(lyricFillTick)
}

function updateLyricHighlight() {
    if (!currentLyric || !$("npMask").classList.contains("show")) return;
    const t = lyricPos();
    let e = currentLyric.findIndex((s, o) => {
        if (s.header) return !1;
        const i = currentLyric[o + 1];
        return t >= s.time && (!i || t < i.time)
    });
    e < 0 && (e = 0);
    const n = Date.now() < lyricManualUntil;
    if (e !== lastLyricIndex) {
        lastLyricIndex = e;
        const s = $("npLyric");
        s.querySelectorAll(".line").forEach((i, a) => i.classList.toggle("active", a === e)), setActiveLine(e), n || centerActiveLine(s, e)
    } else prevManualPaused && !n && centerActiveLine($("npLyric"), e);
    prevManualPaused = n
}

function centerActiveLine(t, e) {
    if (!t) return;
    const n = t.querySelector('.line[data-i="' + e + '"]');
    if (!n) return;
    const s = t.getBoundingClientRect(),
        o = n.getBoundingClientRect(),
        i = t.scrollTop + o.top - s.top - s.height / 2 + o.height / 2;
    t.scrollTo({
        top: i,
        behavior: "smooth"
    })
}
let screenLyricOn = !1;
try {
    screenLyricOn = localStorage.getItem("mm:screenLyric") === "1"
} catch {}
const SL_KEY = "mm:screenLyric";
let slLineIdx = -2,
    slActiveEl = null,
    slLyricRef = null,
    slRAF = 0;

// 歌词偏移（提前/延迟），单位秒。负数=歌词提前，正数=歌词延迟。按歌曲持久化。
let currentLyricOffset = 0;
function lrcOffsetKey() {
    // 以歌词缓存键 currentLyricKey 为权威身份：它与歌词加载一一对应，
    // 在“正在播放详情页(歌词已显示)”里调偏移时必然已确定；刷新后歌词重新加载
    // 时仍会得到同一键，从而保存/加载命中同一键。宿主歌常无顶层 id，npCacheKey
    // 退化成 "x"，所以优先用 currentLyricKey，其次再用 currentSong/curTrack 兜底。
    if (currentLyricKey && currentLyricKey !== "x") return "mm:lrcOffset:" + currentLyricKey;
    const t = playerState.currentSong;
    let e = t ? npCacheKey(t) : null;
    if (!e || e === "x") {
        const cid = curTrack && curTrack.id,
            sid = currentSourceId;
        if (cid != null && sid) e = sid + ":" + cid;
        else if (t && t.id != null) e = "host:" + t.id
    }
    return e && e !== "x" ? "mm:lrcOffset:" + e : null
}
function lrcOffsetRestKey() {
    const k = lrcOffsetKey();
    return k ? k.replace(/^mm:lrcOffset:/, "") : null
}
async function loadLyricOffset() {
    // 计算所有候选键：保存时可能用其中任意一个（npCacheKey / currentLyricKey / curTrack+源 / host:id）。
    // 加载时逐个询问 localStorage 与服务端，取第一个有值者，彻底消除两次会话间键不匹配。
    const cands = [];
    const t = playerState.currentSong;
    if (t) {
        const e = npCacheKey(t);
        if (e && e !== "x") cands.push(e);
        if (t.id != null) cands.push("host:" + t.id)
    }
    if (currentLyricKey) cands.push(currentLyricKey);
    const cid = curTrack && curTrack.id,
        sid = currentSourceId;
    if (cid != null && sid) cands.push(sid + ":" + cid);
    const uniq = [...new Set(cands)];
    let v = 0;
    for (const e of uniq) {
        try {
            const lv = localStorage.getItem("mm:lrcOffset:" + e);
            if (lv != null) { v = parseFloat(lv) || 0; break }
        } catch {}
    }
    if (uniq.length) {
        try {
            const res = await Promise.all(uniq.map(k => api(PLUGIN_BASE + "/rest/lrcOffset?key=" + encodeURIComponent(k)).then(r => (r && r.ok && r.v != null) ? r.v : null).catch(() => null)));
            for (const rv of res) {
                if (rv != null) { v = rv; break }
            }
        } catch {}
    }
    if (v && uniq[0]) try { localStorage.setItem("mm:lrcOffset:" + uniq[0], String(v)) } catch {}
    currentLyricOffset = v || 0;
    updateLrcOffsetUI()
}
function saveLyricOffset(v) {
    currentLyricOffset = v;
    const k = lrcOffsetKey();
    if (k) {
        try {
            if (v === 0) localStorage.removeItem(k);
            else localStorage.setItem(k, String(v))
        } catch {}
    }
    // 直连后端落盘（主持久化，绕过 localStorage 镜像链路）
    const rk = lrcOffsetRestKey();
    if (rk) {
        try {
            api(PLUGIN_BASE + "/rest/lrcOffset", "POST", { key: rk, v }).catch(() => {})
        } catch {}
    }
    // 仍写一份到镜像（冗余兜底）
    try { kvUploadNow() } catch {}
}
function getLyricOffset() {
    return currentLyricOffset || 0
}
// 带偏移的歌词播放位置：提前/延迟通过平移比较时间实现。
function lyricPos() {
    return currentPosition() - getLyricOffset()
}
const LRC_OFF_MAX = 30; // 滑块行程 ±30s，0 在中间（上=延迟/正，下=提前/负）
function lrcOffsetToRatio() {
    const v = getLyricOffset();
    let p = (1 - v / LRC_OFF_MAX) / 2; // +MAX→0(顶=延迟) -MAX→1(底=提前)
    return Math.max(0, Math.min(1, p))
}
function setLrcOffsetFromRatio(p) {
    p = Math.max(0, Math.min(1, p));
    let v = (1 - 2 * p) * LRC_OFF_MAX; // 顶(0)=延迟(正) 底(1)=提前(负)
    v = Math.round(v * 10) / 10;
    saveLyricOffset(v);
    updateLrcOffsetUI();
    if ($("npMask") && $("npMask").classList.contains("show")) updateLyricHighlight()
}
function updateLrcOffsetUI() {
    const valEl = $("lrcOffVal");
    if (valEl) {
        const v = getLyricOffset();
        valEl.textContent = (v > 0 ? "+" : (v < 0 ? "-" : "")) + Math.abs(v).toFixed(1) + "s"
    }
    const track = $("lrcOffTrack"),
        thumb = $("lrcOffThumb"),
        fill = $("lrcOffFill");
    if (track && thumb) {
        const h = track.offsetHeight || 160;
        const y = lrcOffsetToRatio() * h;
        thumb.style.top = y + "px";
        if (fill) {
            const cy = h / 2;
            fill.style.top = Math.min(cy, y) + "px";
            fill.style.height = Math.abs(cy - y) + "px"
        }
    }
}

function positionScreenLyric() {
    const t = document.getElementById("screenLyric");
    if (!t) return;
    if (document.body.classList.contains("mini-on")) {
        t.classList.remove("show");
        return
    }
    t.classList.toggle("show", !!screenLyricOn);
    const e = document.querySelector(".player-times");
    if (!e) return;
    const n = e.getBoundingClientRect(),
        s = n.top + n.height / 2,
        o = window.innerHeight - s - (t.offsetHeight || 22) / 2;
    t.style.bottom = o + "px"
}

function slRenderLine(t) {
    const e = $("slLine");
    if (!e) return;
    const n = currentLyric && currentLyric[t];
    if (!n || !(n.text || n.words && n.words.length)) {
        e.innerHTML = '<span class="sl-empty">\u6682\u65E0\u6B4C\u8BCD</span>', slActiveEl = null;
        return
    }
    if (n.words && n.words.length) e.innerHTML = n.words.map((s, o) => `<span class="ch" data-wi="${o}" style="--h:${Math.round(10+(n.words.length<=1?0:o/(n.words.length-1))*320)}">${esc(s.text)}</span>`).join("");
    else {
        const s = n.text || "";
        e.innerHTML = s.split("").map((o, i) => {
            const a = Math.round(10 + (s.length <= 1 ? 0 : i / (s.length - 1)) * 320),
                r = o === " " ? " " : esc(o);
            return `<span class="ch" style="--h:${a}">${r}</span>`
        }).join("")
    }
    slActiveEl = e
}

function slTick() {
    try {
        if (!screenLyricOn) return;
        currentLyric !== slLyricRef && (slLyricRef = currentLyric, slLineIdx = -2, slActiveEl = null);
        let t = -1;
        if (currentLyric && currentLyric.length) {
            const e = lyricPos();
            t = currentLyric.findIndex((n, s) => {
                const o = currentLyric[s + 1];
                return e >= n.time && (!o || e < o.time)
            }), t < 0 && (t = 0)
        }
        if (t !== slLineIdx && (slLineIdx = t, slRenderLine(t)), slActiveEl && currentLyric && currentLyric[slLineIdx]) {
            const e = currentLyric[slLineIdx],
                n = lyricPos(),
                s = slActiveEl.children,
                o = e.words;
            if (o && o.length && s.length === o.length)
                for (let i = 0; i < s.length; i++) {
                    const a = n >= o[i].time;
                    s[i].classList.contains("lit") !== a && s[i].classList.toggle("lit", a)
                } else {
                    const i = currentLyric[slLineIdx + 1],
                        a = e.time,
                        l = (i ? i.time : (playerState.duration || 0) > a ? playerState.duration : a + 6) - a;
                    let c = l > 0 ? (n - a) / l : 1;
                    c < 0 ? c = 0 : c > 1 && (c = 1);
                    const d = c >= 1 ? s.length : Math.floor(c * s.length);
                    for (let u = 0; u < s.length; u++) {
                        const f = u < d;
                        s[u].classList.contains("lit") !== f && s[u].classList.toggle("lit", f)
                    }
                }
        }
    } catch (t) {
        console.log("[sl] tick err", t && t.message)
    } finally {
        slRAF = requestAnimationFrame(slTick)
    }
}

function setScreenLyric(t) {
    screenLyricOn = !!t;
    try {
        localStorage.setItem(SL_KEY, screenLyricOn ? "1" : "0")
    } catch {}
    const e = $("lyricHomeBtn");
    e && e.classList.toggle("active", screenLyricOn);
    const n = $("screenLyric");
    if (n)
        if (n.classList.toggle("show", screenLyricOn), screenLyricOn) positionScreenLyric(), slLineIdx = -2, slActiveEl = null, slTick();
        else {
            cancelAnimationFrame(slRAF);
            const s = $("slLine");
            s && (s.innerHTML = "")
        }
}

function toggleScreenLyric() {
    setScreenLyric(!screenLyricOn)
}

function restoreScreenLyric() {
    const t = screenLyricOn,
        e = $("lyricHomeBtn");
    e && e.classList.toggle("active", t);
    const n = $("screenLyric");
    n && (n.classList.toggle("show", t), t && (positionScreenLyric(), slLineIdx = -2, slActiveEl = null, slTick()))
}
let _resizeRaf = 0;

function _onResizeRaf(t) {
    let e = !1,
        n = null;
    return function(...s) {
        n = s, !e && (e = !0, _resizeRaf = requestAnimationFrame(() => {
            e = !1;
            try {
                t.apply(this, n)
            } catch (o) {
                console.error("resize handler err:", o)
            }
        }))
    }
}
window.addEventListener("resize", _onResizeRaf(() => {
    screenLyricOn && positionScreenLyric()
}));
async function openPlaylistDrawer() {
    $("playlistModal").classList.add("show"), $("playlistDrawer").classList.add("show"), bindPlListLazyLoad();
    if (Player.available()) {
        try {
            await syncQueueFromHost()
        } catch (_) {}
    }
    renderPlaylist();
    const t = playerState.currentIndex,
        e = (playerState.queue || []).length;
    t >= 0 && t < e && t >= plRendered && (plRendered = Math.min(e, t + 1), renderPlaylist());
    const n = $("plList") && $("plList").querySelector(".pl-item.active");
    n && n.scrollIntoView({
        block: "nearest"
    }), Player.available() && Player.getState().then(s => applyState(s, "manual")).catch(() => {}).finally(renderPlaylist)
}

function closePlaylistDrawer() {
    $("playlistModal").classList.remove("show"), $("playlistDrawer").classList.remove("show")
}
let queueClearGuard = !1,
    queueRestoreGuard = !1,
    plRendered = 0, // 前端已渲染的条数（懒加载控制）
    folderSourceId = null,
    queueSourceId = null,
    plPlayCheckSeq = 0;
const PL_PAGE = 10, // 用户手动滚动懒加载时每次追加的条数
    PL_DEFAULT = 20, // 抽屉默认显示的条数（总数仍显示全部）
    deadPlIdx = new Set;

function markPlDead(t) {
    t < 0 || deadPlIdx.has(t) || (deadPlIdx.add(t), renderPlaylist(), toast("\u8BE5\u6B4C\u66F2\u65E0\u6CD5\u64AD\u653E\uFF0C\u5DF2\u6807\u6CE8\u5931\u6548"))
}

function plItemHtml(t, e) {
    const n = t.title || "\u672A\u77E5\u6807\u9898",
        s = t.artist || "",
        on = isCurTrack(t),
        i = on ? " active" : "",
        r = deadPlIdx.has(e) ? ' <span class="pl-dead">\u5931\u6548</span>' : "";
    return `<div class="pl-item${i}" data-i="${e}" data-id="${t.id}" data-source-id="${t.sourceId != null ? t.sourceId : currentSourceId}" onclick="playQueueIndex(${e})">
    <div class="idx"><span class="pl-num">${e+1}</span><span class="pl-eq"><i></i><i></i><i></i><i></i><i></i></span></div>
    <div class="ti"><div class="t">${esc(n)}${r}</div>${s?`<div class="a">${esc(s)}</div>`:""}</div>
    <button class="del" onclick="event.stopPropagation(); removeFromQueue(${e})" title="\u5220\u9664">\u2715</button>
  </div>`
}

function renderPlaylist(t) {
    const e = playerState.queue || [],
        n = $("plList");
    // 总数始终显示全部（总数 = 队列实际长度，与前端懒加载渲染多少条无关）
    $("plCount").textContent = e.length ? "(" + e.length + ")" : "";
    if (!e.length) {
        plRendered = 0;
        n.innerHTML = '<div class="empty">\u64AD\u653E\u5217\u8868\u4E3A\u7A7A</div>';
        return
    }
    // 懒加载：plRendered 控制前端实际渲染条数（默认 20，滚动/播放推进时扩展）。
    // 仅在「未初始化」时设默认 20；若已懒加载但队列变短则裁剪到实际长度（而非降回 20），
    // 避免队列窗口较小时把已懒加载的条数强制清零，导致「抽屉只显示 20 条、懒加载失效」。
    // 刷新按钮（refreshPlaylist）会显式 plRendered = 0 归零回到默认 20。
    if (!plRendered) plRendered = Math.min(e.length, PL_DEFAULT);
    else if (plRendered > e.length) plRendered = e.length;
    const _shown = e.slice(0, plRendered);
    n.innerHTML = _shown.map(plItemHtml).join("");
    // 渲染后若未填满容器，自动续渲（兜底懒加载，覆盖 scroll 不触发场景）。
    _plFillMore()
}

function refreshPlaylist() {
    const b = $("plRefresh");
    if (b) b.classList.add("spin");
    const done = () => {
        b && b.classList.remove("spin")
    };
    // 回到默认懒加载条数（20），然后从宿主重新拉取当前队列，避免用前端旧缓存。
    plRendered = 0;
    if (Player.available()) {
        syncQueueFromHost().catch(() => {}).finally(() => {
            renderPlaylist();
            done()
        })
    } else {
        renderPlaylist();
        done()
    }
};
window.refreshPlaylist = refreshPlaylist;

function sortTracksByName(l) {
    if (!Array.isArray(l)) return l;
    const key = t => String((t && (t.title || t.path || t.id)) || "");
    const _cmp = (a, b) => {
        const sa = key(a),
            sb = key(b);
        if (sa === sb) return 0;
        const ta = sa.split(/(\d+)/).filter(Boolean),
            tb = sb.split(/(\d+)/).filter(Boolean);
        const n = Math.min(ta.length, tb.length);
        for (let i = 0; i < n; i++) {
            const x = ta[i],
                y = tb[i],
                xn = /^\d+$/.test(x),
                yn = /^\d+$/.test(y);
            if (xn && yn) {
                const d = (+x) - (+y);
                if (d) return d
            } else if (xn) return -1;
            else if (yn) return 1;
            else {
                const d = x.localeCompare(y);
                if (d) return d
            }
        }
        return ta.length - tb.length || sa.localeCompare(sb)
    };
    l.sort(_cmp);
    return l
}

function isAudiobook() {
    const s = sources.find(x => x.id === currentSourceId);
    return !!(s && s.type === "audiobook")
}

function abLast() {
    return _abStore.last || null
}

function saveAbPosition() {
    if (!isAudiobook()) return;
    const c = curTrack && curTrack.id;
    if (!c) return;
    try {
        const o = _abStore.last || {};
        o.track = c;
        // 优先用 abPlayFolder（播放时记录的真实书路径，已去前缀），它不依赖浏览位置 folderPath。
        // folderPath 在「从根目录播书」时为空，若只用它会导致 abLast.folder 存空串、切歌/重进后示波图丢失。
        const _folder = abPlayFolder || folderPath;
        if (_folder) o.folder = _folder;
        isDebugOn() && console.log("[ab] save track=", c, "folder=", _folder, "abPlayFolder=", abPlayFolder);
        _abStore.last = o;
        abStorePersist()
    } catch (e) {}
}

function abProgMap() {
    return _abStore.progress || {}
}

function abProgressGet(id) {
    if (!id) return null;
    const v = abProgMap()[String(id)];
    return v && typeof v.pos === "number" ? v : null
}

function abProgressSet(id, pos, dur) {
    if (!id) return;
    try {
        if (!_abStore.progress) _abStore.progress = {};
        const m = _abStore.progress;
        m[String(id)] = {
            pos: Math.max(0, Math.round(pos || 0)),
            dur: Math.round(dur || 0),
            t: Date.now()
        };
        abStorePersist()
    } catch (e) {}
}

function abProgressClear(id) {
    if (!id) return;
    try {
        if (!_abStore.progress) return;
        const m = _abStore.progress;
        delete m[String(id)];
        abStorePersist()
    } catch (e) {}
}

// ===== 有声书状态统一永久存储（宿主 mm_ab_store，不依赖浏览器 localStorage）=====
// 全部有声书数据（abFolderList / abSongMap / abTitleCache / abLast / abProgress / 队列草稿）
// 改为直连宿主 sl().storage（与音源列表同机制，插件级永久）。部署 disable→enable 清浏览器缓存后
// 仍能从服务端恢复，抽屉懒加载/示波图/进度不再因 localStorage 清空而丢失。
// 内存 _abStore 为权威缓存：启动时 GET 一次装满；写操作只改内存并去抖 POST 落盘，绝不每帧请求。
let _abStore = {
    folderList: null, // {path, list}
    songMap: {},
    titleCache: {},
    last: null, // {track, folder}
    progress: {},
    queue: {} // msm_queue_<sourceId> 草稿
};
let _abStoreReady = !1,
    _abStoreTimer = null;
async function abStoreLoad() {
    if (_abStoreReady) return _abStore;
    try {
        const r = await api(PLUGIN_BASE + "/rest/abStore", "GET");
        if (r && r.ok && r.data && typeof r.data === "object") {
            const d = r.data;
            if (d.folderList && typeof d.folderList === "object") _abStore.folderList = d.folderList;
            if (d.songMap && typeof d.songMap === "object") _abStore.songMap = d.songMap;
            if (d.titleCache && typeof d.titleCache === "object") _abStore.titleCache = d.titleCache;
            if (d.last && typeof d.last === "object") _abStore.last = d.last;
            if (d.progress && typeof d.progress === "object") _abStore.progress = d.progress;
            if (d.queue && typeof d.queue === "object") _abStore.queue = d.queue
        }
    } catch (_) {}
    _abStoreReady = !0;
    return _abStore
}

// 宿主永久存储地址（与 kvMirror 的 flushBeacon 同理），用于 sendBeacon 同步落盘。
let _abStoreUrl = "";
try { _abStoreUrl = new URL(PLUGIN_BASE + "/rest/abStore", location.href).toString() } catch (_) {}
function abStorePersist() {
    if (_abStoreTimer) clearTimeout(_abStoreTimer);
    _abStoreTimer = setTimeout(() => {
        try {
            // 必须先完成宿主加载，否则可能把「尚未装载的空 _abStore」发到宿主，
            // 覆盖掉宿主中已有的有效书单/映射，导致重进后 abFolderList 全空、抽屉失效。
            if (!_abStoreReady) return;
            const obj = {
                folderList: _abStore.folderList,
                songMap: _abStore.songMap,
                titleCache: _abStore.titleCache,
                last: _abStore.last,
                progress: _abStore.progress,
                queue: _abStore.queue
            };
            api(PLUGIN_BASE + "/rest/abStore", "POST", obj).catch(() => {});
            // sendBeacon 同步兜底：不依赖页面存活，任何写入点都立即落盘，
            // 避免「退出/刷新插件时去抖异步 POST 还没发出就被取消」导致 abFolderList 等丢失、
            // 重进后抽屉只剩宿主 20 条窗口。beacon 在页面存活时亦可用，故不挂 unload。
            if (_abStoreUrl && navigator.sendBeacon) {
                try {
                    navigator.sendBeacon(_abStoreUrl, new Blob([JSON.stringify(obj)], { type: "application/json" }))
                } catch (_) {}
            }
        } catch (_) {}
    }, 300)
}

function abSongMap() {
    return _abStore.songMap || {}
}

function abFolderListSave() {
    try {
        _abStore.folderList = {
            path: abFolderPath,
            list: abFolderList
        };
        abStorePersist()
    } catch (_) {}
}

function abFolderListLoad() {
    const j = _abStore.folderList;
    if (j && Array.isArray(j.list) && j.list.length) {
        abFolderList = j.list;
        if (j.path) abFolderPath = j.path;
        return !0
    }
    return !1
}

function abSongMapSave(m) {
    try {
        const ks = Object.keys(m);
        if (ks.length > 5000) {
            const s = ks.map(k => [k, m[k].t || 0]);
            s.sort((a, b) => a[1] - b[1]);
            for (let i = 0; i < 1000; i++) delete m[s[i][0]]
        }
        _abStore.songMap = m;
        abStorePersist()
    } catch (e) {}
}

function abSongMapPut(trackId, songId) {
    if (!trackId || !songId) return;
    try {
        if (!_abStore.songMap) _abStore.songMap = {};
        _abStore.songMap[String(trackId)] = {
            sid: String(songId),
            t: Date.now()
        };
        abStorePersist()
    } catch (e) {}
}
let abFolderList = [],
    abFolderPath = "";
let abHostW0 = -1,
    abHostW1 = -1,
    abHostCenter = -1;
async function abResumeSeek(_sid, _tid) {
    if (!isAudiobook() || !_sid) return;
    const pr = abProgressGet(String(_tid));
    const target = (pr && pr.dur > 0 && pr.pos < pr.dur * 0.98) ? Math.max(0, Math.min(pr.pos, pr.dur - 2)) : 0;
    if (target <= 0) return;
    for (let k = 0; k < 16; k++) {
        try {
            const st = await Player.getState().catch(() => null);
            if (st && String(songIdOf(st.currentSong || {})) === String(_sid)) {
                await Player.seek(target).catch(() => {});
                return
            }
        } catch (_) {}
        await new Promise(r => setTimeout(r, 120))
    }
}
async function abSetHostWindow(_slim, _center, _play) {
    const N = _slim.length;
    if (!N) return;
    // 宿主队列窗口固定 20 条：以 _center 为中心，前 10 后 9（共 20）。
    // 这是宿主端维护的「滑动窗口」，抽屉前端的懒加载条数与此独立。
    const _w0 = Math.max(0, _center - 10);
    const _w1 = Math.min(N - 1, _center + 9);
    const _slice = _slim.slice(_w0, _w1 + 1);
    // 有声书滑动窗口推给宿主前，先把窗口内尚未解析 host songId（id 为空/0）的集批量 ensure 出来，
    // 避免宿主收到 id=0 的歌曲而报「歌曲不存在」。
    // 直接修改 _slice 元素（与 playerState.queue 共享引用），一次解析、后续复用。
    const _needIdx = [];
    const _need = _slice.filter((it, _i) => {
        if (!Number(it.id)) {
            _needIdx.push(_i);
            return true
        }
        return false
    }).map(it => ({
        sourceId: currentSourceId,
        trackId: it.trackId != null ? it.trackId : it.id,
        // 关键：把 track 的 id 补成源 trackId，避免后端用 track.id（窗口外项为 null）构建 dedupKey
        // 时全部 dedupe 到同一 key，导致所有集复用同一 songId（表现为「相同 id、有进度无声音」）。
        track: Object.assign({}, it, {
            id: it.trackId != null ? it.trackId : it.id
        })
    }));
    if (_need.length) {
        try {
            // 关键：_need 与 ensureSongIds 返回的 _res 顺序严格一致（后端按入参顺序返回），
            // 因此用「按下标对应」回填，不再用 trackId 反查——避免窗口内存在重复 trackId
            // （有声书目录重复音频）时多个元素反查命中同一 songId，导致宿主收到相同 id。
            const _res = await ensureSongIds(_need);
            const _usedSid = {};
            for (let _k = 0; _k < _need.length && _k < _res.length; _k++) {
                const r = _res[_k];
                if (!r || r.songId == null) continue;
                const _sid = Number(r.songId);
                // 防御：若同一窗口内已出现过该 sid（数据层重复 trackId），不再覆盖为重复 sid，
                // 保留上一个已解析元素的 sid，避免宿主队列出现重复 id（表现为「相同 id、无声音」）。
                if (_usedSid[_sid]) {
                    console.warn("[ab] setHostWindow 检测到重复 sid", _sid, "跳过下标", _needIdx[_k]);
                    continue
                }
                _usedSid[_sid] = 1;
                const _el = _slice[_needIdx[_k]];
                if (_el && !Number(_el.id)) _el.id = _sid
            }
        } catch (_e) {
            console.warn("[ab] setHostWindow ensure 部分失败", _e && _e.message)
        }
    }
    const _objs = _slice.map(it => ({
        id: Number(it.id),
        title: it.title || "",
        artist: it.artist || "",
        coverId: it.coverId,
        album: it.album || ""
    }));
    const _sids = _slice.map(it => Number(it.id));
    const _pos = _center - _w0;
    abHostW0 = _w0;
    abHostW1 = _w1;
    abHostCenter = _center;
    let _ok = !1;
    try {
        await Player.setQueue(_objs, _pos);
        _ok = !0
    } catch (_) {}
    if (!_ok) await Player.setQueue(_sids, _pos).catch(() => {});
    if (_play) {
        const _sid = _sids[_pos];
        // 不覆盖调用方（playTracks / abNav）已设的 pendingTarget（其 token 与发起播放的 playSeq 一致），
        // 否则 token 错配会导致 applyState 不把本曲标记为正在播 → 界面无声音/进度不动。
        // 仅当调用方尚未设置 pendingTarget 时（兜底）才在此设置。
        if (!pendingTarget || Date.now() - pendingTarget.t > 25e2) {
            pendingTarget = {
                songId: String(_sid),
                token: playSeq,
                t: Date.now()
            }
        }
        await Player.play(_sid).catch(() => {});
        // 等待宿主真正切到目标曲并开始出流，避免「setQueue 后立刻 play、流 URL 未就绪」导致首次无声
        // （需暂停再播放才有声的经典症状）。最多等 1.5s，宿主就绪即止。
        for (let _w = 0; _w < 10; _w++) {
            try {
                const _st = await Player.getState().catch(() => null);
                if (_st) {
                    const _cs = _st.currentSong || _st.current_song;
                    const _live = _cs && songIdOf(_cs);
                    if (_live != null && String(_live) === String(_sid)) break
                }
            } catch (_) {}
            await new Promise(r => setTimeout(r, 150))
        }
        const _tid = _slim[_center] && _slim[_center].trackId;
        await abResumeSeek(_sid, _tid)
    }
    // 诊断：检测窗口内 trackId / sid 是否有重复（定位「传成相同 id」），并把每个元素的 trackId->sid 映射上报。
    try {
        const _tids = _slice.map(it => String(it.trackId != null ? it.trackId : it.id));
        const _tidSet = {};
        let _tidDup = 0;
        for (const t of _tids) {
            _tidSet[t] = (_tidSet[t] || 0) + 1;
            if (_tidSet[t] > 1) _tidDup++
        }
        const _sidSet = {};
        let _sidDup = 0;
        for (const s of _sids) {
            if (!s) continue;
            _sidSet[s] = (_sidSet[s] || 0) + 1;
            if (_sidSet[s] > 1) _sidDup++
        }
        await feDiag({
            stage: "abSetHostWindow",
            w0: _w0,
            w1: _w1,
            center: _center,
            len: _sids.length,
            play: _play,
            tidDup: _tidDup,
            sidDup: _sidDup,
            sids: _sids,
            tids: _tids.map(t => (t || "").slice(-24)),
            map: _slice.map(it => [String(it.trackId != null ? it.trackId : it.id).slice(-24), Number(it.id)])
        })
    } catch (_e) {
        console.warn("[ab] setHostWindow 诊断失败", _e && _e.message)
    }
}
// 仅把宿主队列同步为以 center 为中心的 20 条窗口（不触发播放）。
// 用于：①播放推进时窗口随播滑动 ②用户点击某首时推该首前10后10。
// 用户手动在抽屉里滚动懒加载（只扩前端 plRendered）时**不**调用本函数。
async function syncHostWindow(center) {
    if (!isAudiobook()) return;
    const q = playerState.queue || [];
    if (!q.length) return;
    const c = Math.max(0, Math.min(q.length - 1, center | 0));
    if (c === abHostCenter) return; // 与上次推送中心相同则跳过，避免重复 setQueue
    abHostCenter = c;
    abSetHostWindow(q, c, false).catch(e => console.warn("[ab] syncHostWindow 失败", e && e.message))
}
async function abNav(dir) {
    if (!isAudiobook()) return;
    try {
        // 优先用当前播放队列作为完整列表（playTracks/abNav/playAbRel 都会把整本书写入 playerState.queue，
        // 含 trackId 字段），避免因 abFolderList 被清空（切换/重进）而回退到错误 folder → 「这个分类下没有歌曲」。
        let all = (playerState.queue && playerState.queue.length) ? playerState.queue.slice() : abFolderList;
        if (!all.length) {
            const fp = folderPath || abFolderPath || (abLast() && abLast().folder) || "";
            const e = await api(PLUGIN_BASE + "/batch/tracks", "POST", {
                sourceId: currentSourceId,
                items: [{
                    kind: "folder",
                    id: fp,
                    path: fp
                }]
            });
            if (!e || !e.ok) throw new Error(e && e.message || "读取文件夹失败");
            all = sortTracksByName(e.list || []);
            abFolderList = all, abFolderPath = fp, abFolderListSave()
        }
        if (!all.length) return toast("这个分类下没有歌曲");
        // 从 all 中解析当前集 id（兼容 queue 项 {id,trackId} 与 abFolderList 项 {id}）
        let curId = curTrack && curTrack.id;
        if (!curId) {
            const _cs = playerState.currentSong;
            curId = _cs ? (_cs.trackId != null ? String(_cs.trackId) : String(songIdOf(_cs))) : null
        }
        // 统一主键为「源 trackId」：all 项可能来自 queue（{id:hostSid, trackId:源id}）或 abFolderList（{id:源id}）。
        const normAll = all.map(x => {
            const _srcId = (x.trackId != null) ? String(x.trackId) : String(x.id);
            const _sid = (x.trackId != null && x.id != null) ? Number(x.id) : null; // queue 项自带 host sid
            return {
                srcId: _srcId,
                sid: _sid,
                title: x.title,
                artist: x.artist,
                coverId: x.coverId,
                album: x.album
            }
        });
        let idx = curId ? normAll.findIndex(x => x.srcId === String(curId)) : -1;
        if (idx < 0) idx = playerState.currentIndex >= 0 ? playerState.currentIndex : 0;
        const ni = idx + dir;
        if (ni < 0 || ni >= normAll.length) return toast(dir > 0 ? "已经是最后一集" : "已经是第一集");
        const m = abSongMap();
        const _w0b0 = Math.max(0, ni - 5),
            _w1b0 = Math.min(normAll.length - 1, ni + 15);
        const need = [];
        for (let k = _w0b0; k <= _w1b0; k++) {
            const x = normAll[k];
            const c = m[x.srcId];
            if (!(c && c.sid)) need.push({
                sourceId: currentSourceId,
                trackId: x.srcId,
                track: x
            })
        }
        if (need.length) {
            try {
                const r = await ensureSongIds(need);
                for (const it of r)
                    if (it && it.trackId && it.songId) {
                        m[String(it.trackId)] = {
                            sid: String(it.songId),
                            t: Date.now()
                        }
                    } abSongMapSave(m)
            } catch (_e) {
                console.warn("[ab] ensure 部分失败", _e && _e.message)
            }
        }
        const _ts = (m[normAll[ni].srcId] && m[normAll[ni].srcId].sid) || normAll[ni].sid || null;
        if (!_ts) return toast("无法播放该集");
        const e = ++playSeq;
        clearNowPlayingUI();
        curTrack = normAll[ni];
        const _ui = normAll.map(x => {
            const c = m[x.srcId];
            return {
                id: (c && c.sid) ? Number(c.sid) : (x.sid || x.srcId),
                trackId: x.srcId,
                title: x.title,
                artist: x.artist,
                coverId: x.coverId,
                album: x.album
            }
        });
        playerState = {
            ...playerState,
            queue: _ui,
            currentIndex: ni
        };
        renderPlaylist();
        pendingTarget = {
            songId: String(_ts),
            token: e,
            t: Date.now()
        };
        currentLyric = null;
        currentLyricKey = null;
        lastLyricIndex = -1;
        renderLyricIfOpen();
        const _inWin = abHostW0 >= 0 && ni >= abHostW0 && ni <= abHostW1;
        if (_inWin) {
            const _p = Number(_ts);
            await Player.play(_p).catch(() => {});
            await abResumeSeek(_p, normAll[ni].srcId);
        } else {
            await abSetHostWindow(_ui, ni, true)
        }
        if (e !== playSeq) return;
        if (isAudiobook()) saveAbPosition();
        startActivePoll();
        locateFolderCurrent();
        await feDiag({
            stage: "abNav",
            ni: ni,
            queueLen: _ui.length,
            winLen: Math.min(21, normAll.length),
            within: _inWin
        })
    } catch (err) {
        toast("切换失败：" + (err && err.message || err))
    }
}
async function playAbRel(dir) {
    if (!isAudiobook()) return;
    try {
        let all = abFolderPath === folderPath ? abFolderList : [];
        if (!all.length) {
            const fp = folderPath || (abLast() && abLast().folder) || "";
            const e = await api(PLUGIN_BASE + "/batch/tracks", "POST", {
                sourceId: currentSourceId,
                items: [{
                    kind: "folder",
                    id: fp,
                    path: fp
                }]
            });
            if (!e || !e.ok) throw new Error(e && e.message || "读取文件夹失败");
            all = sortTracksByName(e.list || []);
            abFolderList = all, abFolderPath = fp, abFolderListSave()
        }
        if (!all.length) return toast("这个分类下没有歌曲");
        const curId = curTrack && curTrack.id;
        // all 项可能来自 abFolderList（id=hostSid, trackId=sourceId）或 folderTracks（id=sourceId），
        // 定位当前集时同时匹配 id 与 trackId。
        const idx = all.findIndex(x => String(x.id) === String(curId) || String(x.trackId) === String(curId));
        const base = idx >= 0 ? idx : 0;
        const ni = base + dir;
        if (ni < 0 || ni >= all.length) return toast(dir > 0 ? "已经是最后一集" : "已经是第一集");
        const m = abSongMap(),
            need = [],
            sids = [];
        for (const x of all) {
            const _srcId = String(x.trackId != null ? x.trackId : x.id);
            const c = m[_srcId];
            if (c && c.sid) sids.push(String(c.sid));
            else need.push({
                sourceId: currentSourceId,
                trackId: _srcId,
                track: x
            })
        }
        if (need.length) {
            try {
                const r = await ensureSongIds(need);
                for (const it of r)
                    if (it && it.trackId && it.songId) {
                        m[String(it.trackId)] = {
                            sid: String(it.songId),
                            t: Date.now()
                        };
                        sids.push(String(it.songId))
                    }
            } catch (_e) {
                console.warn("[ab] ensure 部分失败", _e && _e.message)
            }
            abSongMapSave(m)
        }
        const _srcTg = String(all[ni].trackId != null ? all[ni].trackId : all[ni].id),
            _ts = (m[_srcTg] && m[_srcTg].sid) || null;
        if (!_ts) return toast("无法播放该集");
        const e = ++playSeq;
        if (clearNowPlayingUI(), curTrack = all[ni], queueClearGuard = !1, playerState = {
                ...playerState,
                queue: all.map(x => {
                    const _srcId = String(x.trackId != null ? x.trackId : x.id);
                    const c2 = m[_srcId];
                    return c2 && c2.sid ? {
                        ...x,
                        trackId: _srcId,
                        id: c2.sid
                    } : null
                }).filter(Boolean),
                currentIndex: ni
            }, renderPlaylist(), pendingTarget = {
                songId: String(_ts),
                token: e,
                t: Date.now()
            }, currentLyric = null, currentLyricKey = null, lastLyricIndex = -1, renderLyricIfOpen(), sids.length) {
            let _sq = !1;
            try {
                if (e === playSeq) {
                    await Player.setQueue(sids, ni);
                    _sq = !0
                }
            } catch (_e) {
                console.warn("[ab] setQueue 失败降级 direct", _e && _e.message)
            }
            if (e !== playSeq) return
        }
        if (e === playSeq) await Player.play(_ts).catch(() => {});
        if (e !== playSeq) return;
        if (isAudiobook()) saveAbPosition(), startActivePoll();
        await abResumeSeek(_ts, tg);
        locateFolderCurrent()
    } catch (err) {
        toast("切换失败：" + (err && err.message || err))
    }
}

function abPersistProgress(s, o) {
    if (!isAudiobook()) return;
    const c = curTrack && curTrack.id;
    const d = playerState.duration || 0;
    const p = (o != null ? o : playerState.position) || 0;
    if (!c || d <= 0) return;
    const wasPlaying = playerState.playing;
    if (!s && wasPlaying) {
        if (p >= d * 0.98) abProgressClear(c);
        else if (p > 0) abProgressSet(c, p, d)
    } else if (s && p > 0 && p < d * 0.98) {
        const now = Date.now();
        if (now - (window.__abSaveT || 0) > 5000) {
            window.__abSaveT = now;
            abProgressSet(c, p, d)
        }
    }
}
async function abSeekToResume(trackId, expectIdx, sid) {
    const pr = abProgressGet(trackId);
    const targetPos = (pr && pr.dur > 0 && pr.pos < pr.dur * 0.98) ? Math.max(0, Math.min(pr.pos, pr.dur - 2)) : 0;
    let _nudged = !1,
        _plays = 0;
    for (let k = 0; k < 24; k++) {
        try {
            const st = await Player.getState().catch(() => null);
            if (st) {
                const ci = st.current_index;
                const ok = (typeof ci === "number" && ci === expectIdx) || (sid && String(songIdOf(st.currentSong || {})) === String(sid));
                if (ok) {
                    if ((st.duration || 0) > 0 && targetPos > 0) await Player.seek(targetPos).catch(() => {});
                    feDiag({
                        stage: "abSeek",
                        ok: !0,
                        idx: expectIdx,
                        targetPos
                    });
                    return
                }
                if (sid && !_nudged && k >= 3) {
                    await Player.play(sid).catch(() => {});
                    _nudged = !0;
                    _plays++
                }
            }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 150))
    }
    feDiag({
        stage: "abSeek",
        ok: !1,
        idx: expectIdx,
        targetPos,
        plays: _plays
    })
}

function updateFolderProgress() {
    const el = document.querySelector(".track.playing .disc-ring .fg");
    if (!el) return;
    const d = playerState.duration || 0,
        p = playerState.position || 0;
    const pct = d > 0 ? Math.min(100, Math.max(0, p / d * 100)) : 0;
    const len = 100.5;
    el.style.strokeDashoffset = String(len * (1 - pct / 100))
}

function folderTrackById(id) {
    return (folderTracks || []).find(x => String(x.id) === String(id)) || (folderDirs || []).find(x => String(x.id || x.path) === String(id))
}

function markFolderPlaying() {
    if (!isAudiobook()) return;
    // 优先用统一的当前播放解析（hostSongMap/queue/顶层 trackId），避免 curTrack 失准导致文件夹示波器整片不显示；
    // 仍保留文件夹持久化兜底（abRestoreTrack/abLast）以兼容跨会话恢复。
    const _r = curPlayingRef();
    const id = (_r && _r.id != null) ? String(_r.id)
        : (curTrack && curTrack.id != null) ? String(curTrack.id)
        : (abRestoreTrack != null) ? String(abRestoreTrack)
        : (abLast() && abLast().track != null) ? String(abLast().track)
        : null;
    if (!id) return;
    document.querySelectorAll(".track").forEach(e => {
        const on = String(e.dataset.id) === String(id);
        e.classList.toggle("playing", on);
        if (on && !e.querySelector(".disc-ring")) {
            const ring = document.createElement("div");
            ring.className = "disc-ring";
            ring.innerHTML = '<svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="16"></circle><circle class="fg" cx="18" cy="18" r="16"></circle></svg>';
            e.appendChild(ring)
        }
    })
}
async function locateFolderCurrent() {
    if (!isAudiobook()) return;
    const cur = (curTrack && curTrack.id) || abRestoreTrack || (abLast() && abLast().track);
    if (!cur) return;
    let el = document.querySelector('.track[data-id="' + String(cur).replace(/"/g, '\\"') + '"]');
    let g = 0;
    while (!el && folderTracks.length < folderTotal && g++ < 120) {
        await loadMoreFolder();
        el = document.querySelector('.track[data-id="' + String(cur).replace(/"/g, '\\"') + '"]')
    }
    if (el) {
        el.scrollIntoView({
            block: "center"
        });
        updateFolderProgress()
    }
}

function abPlayFromCurrent() {
    let id = [...selected][0];
    if (!id && curTrack) id = curTrack.id;
    if (!id) {
        const a = abLast();
        if (a && a.track) id = a.track
    }
    if (!id) {
        toast("无法定位该集");
        return
    }
    playFolderFrom({
        id
    });
    clearSelection()
}
async function abPlayFromFirst() {
    try {
        const fp = folderPath || (abLast() && abLast().folder) || "";
        const e = await api(PLUGIN_BASE + "/batch/tracks", "POST", {
            sourceId: currentSourceId,
            items: [{
                kind: "folder",
                id: fp,
                path: fp
            }]
        });
        if (!e || !e.ok) throw new Error(e && e.message || "读取文件夹失败");
        const all = sortTracksByName(e.list || []);
        abFolderList = all, abFolderPath = fp, abFolderListSave();
        if (!all.length) return toast("这个分类下没有歌曲");
        await playTracks(all, 0);
        if (isAudiobook()) saveAbPosition()
    } catch (err) {
        toast("播放失败：" + (err && err.message || err))
    }
}
window.abPlayFromCurrent = abPlayFromCurrent;
window.abPlayFromFirst = abPlayFromFirst;
async function playFolderFrom(t) {
        if (!isAudiobook()) return playTrack(t);
        try {
            const fp = folderPath || (abLast() && abLast().folder) || "";
            // 记录当前正在播放的文件夹（与 playDirectory 对齐），有声书「播放某集」时
            // 该文件夹卡片要靠 activeFolderId 兜底点亮示波图（playTracks 不会为 currentSong 写 path，
            // 且后端 browseDeep 的 path 在未重启宿主时可能为空，故不能仅依赖 path 前缀匹配）。
            activeFolderId = fp || null;
            const e = await api(PLUGIN_BASE + "/batch/tracks", "POST", {
                sourceId: currentSourceId,
                items: [{
                    kind: "folder",
                    id: fp,
                    path: fp
                }]
            });
            if (!e || !e.ok) throw new Error(e && e.message || "\u8BFB\u53D6\u6587\u4EF6\u5939\u5931\u8D25");
            const all = sortTracksByName(e.list || []);
            abFolderList = all, abFolderPath = fp, abFolderListSave();
            if (!all.length) return toast("\u8FD9\u4E2A\u5206\u7C7B\u4E0B\u6CA1\u6709\u6B4C\u66F2");
            const idx = Math.max(0, all.findIndex(x => x.id === t.id));
            await playTracks(all, idx);
            let _sid = null;
            try {
                const _m = abSongMap(),
                    _c = _m[String(all[idx].id)];
                _sid = (_c && _c.sid) || null;
                if (!_sid) {
                    const _q = playerState.queue || [];
                    for (const _it of _q) {
                        if (String(_it.trackId) === String(all[idx].id)) {
                            const _s = songIdOf(_it);
                            if (_s) {
                                _sid = _s;
                                break
                            }
                        }
                    }
                    if (!_sid) {
                        const _ns = await ensureSongIds([{
                            sourceId: currentSourceId,
                            trackId: all[idx].id,
                            track: all[idx]
                        }]);
                        _sid = _ns && _ns[0] && _ns[0].songId
                    }
                }
            } catch (_e) {}
        } catch (err) {
            toast("\u64AD\u653E\u5931\u8D25\uFF1A" + (err && err.message || err))
        }
    feEqDiag({
        where: "playQueueIndex",
        toIdx: t
    }, !0)
}
    (function() {
        const b = document.getElementById("plRefresh");
        if (b && !b._rb) {
            b._rb = 1;
            b.addEventListener("click", refreshPlaylist)
        }
    })();

function _plFillMore() {
    const t = $("plList");
    if (!t) return;
    const e = playerState.queue || [];
    // 若已渲染完或容器已经能容纳全部内容（无需滚动），直接返回。
    if (plRendered >= e.length) return;
    // 关键兜底：列表总高未超过容器高时，scroll 事件永远不会触发，
    // 必须主动续渲，否则「返回宿主再进入」后抽屉里只显示前 PL_DEFAULT 条、懒加载形同失效。
    let _guard = 0;
    while (plRendered < e.length && t.scrollHeight <= t.clientHeight + 2 && _guard++ < 80) {
        plRendered = Math.min(e.length, plRendered + PL_PAGE);
        renderPlaylist(!0);
    }
}

function bindPlListLazyLoad() {
    const t = $("plList");
    if (!t) return;
    // 幂等绑定：先移除旧监听再添加，避免 dataset.plLazy 一次性标志导致
    // webview 重建/重进后监听丢失且永不重绑（原 bug 根因）。
    try { t.removeEventListener("scroll", _onPlScroll); } catch (_) {}
    t.addEventListener("scroll", _onPlScroll, { passive: !0 });
    _plFillMore();
}

function _onPlScroll() {
    const t = $("plList");
    if (!t) return;
    const e = playerState.queue || [];
    // 用户手动滚动懒加载：仅扩展前端 plRendered，**不**同步宿主。
    if (plRendered >= e.length) return;
    if (t.scrollTop + t.clientHeight >= t.scrollHeight - 200) {
        plRendered = Math.min(e.length, plRendered + PL_PAGE);
        renderPlaylist(!0);
        _plFillMore();
    }
}
async function playQueueIndex(t) {
    const e = ++playSeq;
    clearNowPlayingUI(), queueClearGuard = !1;
    const n = playerState.queue || [];
    if (t < 0 || t >= n.length) return;
    const s = n[t];
    let o = Number(songIdOf(s));
    // 懒加载的窗口外集（有声书）id 可能为空：先 ensure 解析出 host sid 再播，避免「该歌曲无法播放」。
    // 注意：队列项 s.id 是 host sid（窗口外为 null），真正的源 trackId 在 s.trackId；
    // ensureSongIds 内部会把「无 sourceId 的入参」的 trackId 误取为 s.id（null），导致解析失败/宿主无法播放。
    // 因此显式构造 {sourceId, trackId:s.trackId}，保证用源 trackId 解析。
    if (!o) {
        try {
            const r = await ensureSongIds([{
                sourceId: s.sourceId != null ? s.sourceId : currentSourceId,
                trackId: s.trackId != null ? s.trackId : s.id,
                track: s
            }]);
            const got = r && r[0] && r[0].songId != null ? Number(r[0].songId) : 0;
            if (got) {
                s.id = got, o = got
            }
        } catch (_) {}
    }
    if (!o) return toast("\u8BE5\u6B4C\u66F2\u65E0\u6CD5\u64AD\u653E");
    if (playerState = {
            ...playerState,
            currentIndex: t,
            currentSong: s
        }, t >= plRendered && (plRendered = Math.min((playerState.queue || []).length, t + 1)), renderPlaylist(), renderPlayer(), currentLyric = null, currentLyricKey = null, lastLyricIndex = -1, renderLyricIfOpen(), pendingTarget = {
            songId: String(o),
            token: e,
            t: Date.now()
        }, hydrateNowPlaying(), isAudiobook() && syncHostWindow(t), CastManager.isMiot()) {
        await CastManager.castToIndex(t).catch(() => {});
        return
    }
    try {
        if (n.map(r => Number(songIdOf(r))).filter(Boolean).includes(o)) try {
            if (await Player.play(o), await new Promise(c => setTimeout(c, 400)), e !== playSeq) return;
            const r = await Player.getState().catch(() => null),
                l = r && songIdOf(r.currentSong ?? r.current_song);
            if (l && String(l) !== String(o) && e === playSeq) {
                console.warn("[player] play(id) \u672A\u8DF3\u8F6C\u5230\u76EE\u6807\uFF0C\u4EC5\u91CD\u8BD5 play(id)\uFF08\u4E0D\u91CD\u5EFA\u961F\u5217\uFF09", String(o), "=>", String(l));
                try {
                    await Player.play(o)
                } catch {}
            }
        } catch (r) {
            console.warn("[player] play(id) \u5931\u8D25\uFF0C\u56DE\u9000 setQueue \u91CD\u5EFA", r && r.message), await playQueueRebuild(n, t, o, e)
        } else await playQueueRebuild(n, t, o, e);
        if (e !== playSeq) return;
        startActivePoll();
        const a = ++plPlayCheckSeq;
        setTimeout(async () => {
            if (!(e !== playSeq || a !== plPlayCheckSeq)) try {
                const r = await Player.getState().catch(() => null);
                if (!r) return;
                r.current_index === t && !r.is_playing && markPlDead(t)
            } catch {}
        }, 3e3)
    } catch (i) {
        toast("\u64AD\u653E\u5931\u8D25\uFF1A" + (i && i.message || i))
    }
}
async function playQueueRebuild(t, e, n, s) {
    const o = [];
    let i = -1;
    if (t.forEach((a, r) => {
            const l = Number(songIdOf(a));
            l && (o.push(l), r === e && (i = o.length - 1))
        }), i < 0) {
        toast("\u8BE5\u6B4C\u66F2\u65E0\u6CD5\u64AD\u653E");
        return
    }
    if (await Player.setQueue(o, i), s !== playSeq) {
        console.log("[player] \u8FC7\u671F\u64AD\u653E\u6307\u4EE4\uFF08playQueueRebuild setQueue \u540E\uFF09\uFF0C\u4E22\u5F03");
        return
    }
    await Player.play(n).catch(() => {})
}
async function removeFromQueue(t) {
    const e = playerState.queue || [];
    if (t < 0 || t >= e.length) return;
    const n = playerState.currentIndex,
        s = e.filter((a, r) => r !== t),
        o = s.map(songIdOf).filter(a => a !== "" && a != null).map(Number).filter(Boolean);
    let i = n;
    t < n && i--, i >= s.length && (i = s.length - 1), i < 0 && (i = 0);
    try {
        if (o.length) Player.has("removeFromQueue") ? (await Player.removeFromQueue(t), startActivePoll()) : t === n ? (await Player.setQueue(o, i), await Player.play(o[i]).catch(() => {}), startActivePoll()) : (await Player.setQueue(o, i), startActivePoll());
        else {
            queueClearGuard = !0;
            try {
                await Player.removeFromQueue(t)
            } catch (a) {
                console.warn("[queue] removeToEmpty \u540C\u6B65\u5BBF\u4E3B\u5931\u8D25", a && a.message)
            }
            playerState = {
                ...playerState,
                queue: [],
                currentIndex: -1,
                currentSong: null,
                playing: !1,
                position: 0
            }, playerPosAnchor = null
        }
        renderPlaylist(), renderPlayer()
    } catch (a) {
        toast("\u5220\u9664\u5931\u8D25\uFF1A" + (a && a.message || a))
    }
}
async function clearQueue() {
    queueClearGuard = !0;
    // 先暂停宿主：否则随后清空队列时，宿主会因「正在播放的项被移除」而自动跳播下一首
    // —— 这正是「清空播放列表后自动播放且暂停不了」的根因。
    try {
        Player.available() && Player.has("pause") && await Player.pause()
    } catch (_) {}
    // 一次性清空宿主队列：优先 setQueue([])（单次调用、不触发自动跳播）；
    // 旧宿主不支持 setQueue 时回退逐项 removeFromQueue（此时已 pause，移除不会触发自动播放）。
    try {
        // 1) 首选：一次性清空宿主队列。部分设备（如小爱音箱）会忽略空数组，故下面再用逐项删除兜底。
        if (Player.available() && Player.has("setQueue")) await Player.setQueue([])
    } catch (_) {}
    try {
        // 2) 兜底：逐项移除，应对 setQueue([]) 被设备忽略的情况（已先 pause，移除不会触发自动跳播）。
        if (Player.available() && Player.has("removeFromQueue")) {
            let _tries = 300;
            while (_tries-- > 0) {
                try {
                    await Player.removeFromQueue(0)
                } catch (_) {
                    break
                }
            }
        }
    } catch (_) {}
    try {
        // 3) 逐项删除过程中设备可能又自动续播，最后再确保暂停一次。
        if (Player.available() && Player.has("pause")) await Player.pause()
    } catch (_) {}
    try {
        // 4) 持久标记：即便设备/宿主在「返回宿主再进入插件」时把队列自动推回来，
        //    前端也强制保持清空态，直到用户主动点歌播放（loadAndPlay 会清除该标记）。
        localStorage.setItem("mm:queueCleared", "1")
    } catch (_) {}
    // 注意：queueClearGuard 保持为真，直到下一次播放（loadAndPlay 会复位）。
    // 这样清空期间及之后宿主回弹的 onStateChange 都会被 applyState 抑制回填（playing 始终 false），不会凭空恢复「正在播放」。
    playerState = {
        ...playerState,
        queue: [],
        currentIndex: -1,
        currentSong: null,
        playing: !1,
        position: 0
    }, playerPosAnchor = null, curTrack = null, renderPlaylist(), renderPlayer();
    // 设备可能在清空后延迟跳播/自动续播，补一次延时暂停兜底（cleared 分支的持续守护也会覆盖）。
    try {
        setTimeout(() => {
            try {
                if (Player.available() && Player.has("pause")) Player.pause().catch(() => {})
            } catch (_) {}
        }, 800)
    } catch (_) {}
}
// ——— 按音源持久化抽屉播放列表 ———
// 每个音源各自保存一份队列到宿主 mm_ab_store.queue（key = <srcId>），与音源列表同机制永久存储，
// 不再依赖浏览器 localStorage（部署清缓存后会丢失）。切换音源时落盘旧源的、导入新源落盘的。
function saveSourceQueue(t, e) {
    if (!t) return;
    try {
        const n = (e || []).map(it => ({
            id: songIdOf(it) != null ? Number(songIdOf(it)) : null,
            trackId: it.trackId != null ? it.trackId : null,
            title: it.title || "",
            artist: it.artist || "",
            album: it.album || "",
            coverId: it.coverId != null ? it.coverId : null,
            path: it.path != null ? it.path : null
        })).filter(x => x.id || x.trackId);
        if (!_abStore.queue) _abStore.queue = {};
        _abStore.queue[String(t)] = n;
        abStorePersist()
    } catch (_) {}
}
function loadSourceQueue(t) {
    if (!t) return null;
    try {
        const a = _abStore.queue && _abStore.queue[String(t)];
        return Array.isArray(a) ? a : null
    } catch (_) {
        return null
    }
}
// 切换音源时：清空当前队列 + 宿主旧源列表，再把新源之前落盘的队列导入前端与宿主。
// pushHost=true 时同步推给宿主（切换路径）；false 时仅还原前端抽屉显示（初始恢复路径，避免与设备当前队列冲突）。
async function swapQueueForSource(t, e, pushHost) {
    const _src = t;
    // 1) 暂停 + 健壮清空宿主旧源队列
    try {
        if (Player.available() && Player.has("pause")) await Player.pause()
    } catch (_) {}
    try {
        if (Player.available() && Player.has("setQueue")) await Player.setQueue([])
    } catch (_) {}
    try {
        if (Player.available() && Player.has("removeFromQueue")) {
            let k = 300;
            while (k-- > 0) {
                try {
                    await Player.removeFromQueue(0)
                } catch (_) {
                    break
                }
            }
        }
    } catch (_) {}
    try {
        if (Player.available() && Player.has("pause")) await Player.pause()
    } catch (_) {}
    // 2) 前端队列清空
    playerState = {
        ...playerState,
        queue: [],
        currentIndex: -1,
        currentSong: null,
        playing: !1,
        position: 0
    }, playerPosAnchor = null, curTrack = null, renderPlaylist(), renderPlayer();
    // 3) 导入新源落盘队列
    const r = loadSourceQueue(_src);
    if (r && r.length) {
        const _items = r.map(it => ({
            id: it.id,
            trackId: it.trackId,
            title: it.title,
            artist: it.artist,
            album: it.album,
            coverId: it.coverId,
            sourceId: _src,
            path: it.path
        }));
        playerState = {
            ...playerState,
            queue: _items
        }, renderPlaylist();
        if (pushHost && Player.available()) {
            const h = _items.map(x => Number(x.id)).filter(Boolean);
            if (h.length) try {
                if (Player.has("setQueue")) await Player.setQueue(h);
                else await Player.addToQueue(h)
            } catch (_) {
                try {
                    await Player.addToQueue(h)
                } catch (_) {}
            }
        }
    }
    queueSourceId = _src;
    // 切换属于主动导航：解除「已清空队列」标记与 guard，否则刚刚导入的新源队列会被 applyState 强制清空。
    try { localStorage.removeItem("mm:queueCleared") } catch (_) {}
    queueClearGuard = !1
}
async function importToSongloft(t) {
    const e = t || curTrack;
    if (!e) return toast("\u8BF7\u5148\u9009\u62E9\u6B4C\u66F2");
    pendingImport = {
        tracks: [e],
        suggestedName: ""
    }, openImportModal("\u5BFC\u5165 1 \u9996\u6B4C\u66F2")
}

function openPlaylist(t) {
    drill = {
        type: "playlist",
        id: t.id,
        name: t.name,
        coverId: t.coverId
    };
    // 记录当前正在浏览/播放的歌单（含歌单里的文件夹），供 playlists 网格卡片示波图点亮；
    // 在导航时记录而非播放时，可跨视图持久（返回网格仍点亮），且覆盖抽屉切歌等绕过 loadAndPlay 的路径。
    activePlaylistId = t.id, activeFolderId = null, scheduleSaveState(), drill.coverId ? loadDrill() : ensureDrillCover(t.id)
}

function setSelectionKind(t) {
    selectedKind !== t && (selected.clear(), selectedKind = t)
}

function toggleSelect(t, e, n) {
    t.stopPropagation(), setSelectionKind(e), selected.has(n) ? selected.delete(n) : selected.add(n), updateBulkBar(), renderSelection(), scheduleSaveState()
}

function clearSelection() {
    selected.clear(), renderSelection(), updateBulkBar(), scheduleSaveState()
}
async function toggleSelectAll() {
    if (view === "folders") {
        let e2 = 0;
        for (; folderTracks.length < folderTotal && e2++ < 30;) await loadMoreFolder();
        const dIds = folderDirs.map(o => o.id || o.path).filter(o => o != null && o !== "");
        const tIds = folderTracks.map(o => o.id).filter(o => o != null && o !== "");
        const n2 = [...new Set([...dIds, ...tIds])],
            s2 = n2.length > 0 && n2.every(o => selected.has(o));
        setSelectionKind("folder"), s2 ? n2.forEach(o => selected.delete(o)) : n2.forEach(o => selected.add(o)), renderSelection(), updateBulkBar(), scheduleSaveState();
        return
    }
    const t = drill ? drillTotal : listTotal;
    for (let o = 0; o < 100 && listLoading; o++) await new Promise(i => setTimeout(i, 50));
    let e = 0;
    for (; !searchActive && t > 0 && currentList.length < t && e++ < 50;) await loadNextPage();
    const n = [...new Set(currentList.map(o => o.id).filter(o => o != null && o !== ""))],
        s = n.length > 0 && n.every(o => selected.has(o));
    setSelectionKind(drill || view === "tracks" || view === "favorites" ? "track" : view === "albums" ? "album" : view === "artists" ? "artist" : view === "folders" ? "folder" : "playlist"), s ? n.forEach(o => selected.delete(o)) : n.forEach(o => selected.add(o)), renderSelection(), updateBulkBar(), scheduleSaveState()
}

function renderSelection() {
    const t = new Set([...selected].map(String));
    document.querySelectorAll(".track").forEach(e => {
        e.classList.toggle("selected", selectedKind === (view === "folders" ? "folder" : "track") && t.has(String(e.dataset.id)))
    }), document.querySelectorAll(".track .chk, .card .chk").forEach(e => {
        e.checked = t.has(String(e.dataset.id))
    })
}

function kindLabel() {
    return selectedKind === "album" ? "\u5F20\u4E13\u8F91" : selectedKind === "artist" ? "\u4F4D\u827A\u672F\u5BB6" : selectedKind === "folder" ? "\u9879" : selectedKind === "playlist" ? "\u4E2A\u6B4C\u5355" : "\u9996"
}

function updateBulkBar() {
    const t = selected.size;
    $("bulkBar").classList.toggle("collapsed", t === 0), t > 0 && placeBulkBar();
    if (isAudiobook()) {
        const ab = t > 0;
        $("bulkInfo").textContent = "";
        $("selectAllBtn").style.display = "none";
        $("clearSelBtn").style.display = "none";
        $("playSelBtn").style.display = "none";
        $("unfavSelBtn").style.display = "none";
        $("importSelBtn").style.display = "none";
        const pc = $("abPlayCurBtn");
        pc && (pc.style.display = ab ? "inline-block" : "none");
        const pf = $("abPlayFirstBtn");
        pf && (pf.style.display = ab ? "inline-block" : "none");
        const ac = $("abCancelBtn");
        ac && (ac.style.display = ab ? "inline-block" : "none");
        screenLyricOn && positionScreenLyric();
        return
    }
    $("abPlayCurBtn") && ($("abPlayCurBtn").style.display = "none");
    $("abPlayFirstBtn") && ($("abPlayFirstBtn").style.display = "none");
    $("bulkInfo").textContent = t ? `\u5DF2\u9009\u62E9 ${t} ${kindLabel()}` : "\u672A\u9009\u62E9", $("selectAllBtn").style.display = (view === "folders" ? folderDirs.length + folderTracks.length : currentList.length) ? "inline-flex" : "none", $("clearSelBtn").style.display = t ? "inline-block" : "none", $("playSelBtn").style.display = t ? "inline-block" : "none", $("unfavSelBtn").style.display = view === "favorites" && t ? "inline-block" : "none";
    const e = selectedKind === "track" ? "\u9996" : "\u7EC4",
        n = currentSourceId === SONGLOFT_SOURCE_ID || view === "favorites";
    $("importSelBtn").style.display = n ? "none" : "inline-block", $("importSelBtn").textContent = t ? `\u5BFC\u5165\u9009\u4E2D ${t} ${e}\u5230 SongLoft` : "\u5BFC\u5165\u5230 SongLoft", screenLyricOn && positionScreenLyric()
}

function placeBulkBar() {
    const t = $("bulkBar"),
        e = $("playerBar");
    if (!t || !e || t.classList.contains("collapsed")) return;
    const n = e.getBoundingClientRect().top;
    document.documentElement.style.setProperty("--bulk-bottom", Math.max(8, window.innerHeight - n + 16) + "px")
}(function() {
    const e = ".card .text-body .t, .card .text-body .s, .track .ti .t, .track .ti .a";

    function n() {
        document.querySelectorAll(e).forEach(i => {
            if (i._mqDone) return;
            const a = i.innerHTML;
            i.innerHTML = `<span>${a}</span>`, i._mqDone = !0;
            const l = i.firstChild.scrollWidth - i.clientWidth;
            l > 2 ? (i.style.setProperty("--mq-shift", -l + "px"), i.classList.add("mq")) : i.classList.remove("mq")
        })
    }
    document.readyState !== "loading" ? n() : document.addEventListener("DOMContentLoaded", n);
    const s = $("content");
    if (!s) return;
    let o = null;
    new MutationObserver(() => {
        o || (o = requestAnimationFrame(() => {
            o = null, n()
        }))
    }).observe(s, {
        childList: !0,
        subtree: !0
    })
})();
async function importSelected() {
    if (!selected.size) return toast("\u8BF7\u5148\u52FE\u9009\u8981\u5BFC\u5165\u7684\u5185\u5BB9");
    if (selectedKind === "track") {
        const t = currentList.filter(e => selected.has(e.id));
        if (!t.length) return toast("\u5F53\u524D\u5217\u8868\u4E2D\u6CA1\u6709\u9009\u4E2D\u7684\u6B4C\u66F2");
        if (view === "favorites") {
            toast("\u6536\u85CF\u6B4C\u66F2\u5DF2\u5728 SongLoft \u5A92\u4F53\u5E93\u4E2D\uFF0C\u65E0\u9700\u91CD\u590D\u5BFC\u5165");
            return
        }
        pendingImport = {
            tracks: t,
            suggestedName: drill && drill.name || ""
        }, openImportModal(`\u5BFC\u5165 ${t.length} \u9996\u6B4C\u66F2`)
    } else {
        let t;
        if (view === "folders") {
            const d = folderDirs.filter(e => selected.has(e.id || e.path)).map(e => ({
                kind: "folder",
                id: e.id || e.path
            }));
            const k = folderTracks.filter(e => selected.has(e.id)).map(e => ({
                kind: "track",
                id: e.id
            }));
            t = [...d, ...k]
        } else {
            t = currentList.filter(e => selected.has(e.id)).map(e => ({
                kind: selectedKind,
                id: e.id
            }))
        }
        if (!t.length) return toast("\u5F53\u524D\u5217\u8868\u4E2D\u6CA1\u6709\u9009\u4E2D\u7684\u9879\u76EE");
        try {
            const e = await api(`${PLUGIN_BASE}/batch/tracks`, "POST", {
                sourceId: currentSourceId,
                items: t
            });
            if (!e.ok) throw new Error(e.message || "\u8BFB\u53D6\u76EE\u5F55\u5931\u8D25");
            const n = sortTracksByName(e.list || []);
            if (!n.length) return toast("\u8BE5\u76EE\u5F55\u4E0B\u6CA1\u6709\u6B4C\u66F2");
            pendingImport = {
                tracks: n,
                suggestedName: t.length === 1 ? currentList.find(s => s.id === t[0].id)?.name || "" : "\u591A\u6E90\u5BFC\u5165"
            }, openImportModal(`\u5BFC\u5165 ${n.length} \u9996\u6B4C\u66F2`)
        } catch (e) {
            toast("\u8BFB\u53D6\u76EE\u5F55\u5931\u8D25\uFF1A" + (e && e.message || e))
        }
    }
}
async function importDirectory(t, e) {
    const n = t === "album" ? `${PLUGIN_BASE}/album/tracks?sourceId=${currentSourceId}&albumId=${encodeURIComponent(e.id)}&limit=500` : t === "artist" ? `${PLUGIN_BASE}/artist/tracks?sourceId=${currentSourceId}&artistId=${encodeURIComponent(e.id)}&limit=500` : `${PLUGIN_BASE}/playlist/tracks?sourceId=${currentSourceId}&playlistId=${encodeURIComponent(e.id)}&limit=500`,
        s = await api(n);
    if (!s.ok) return toast(s.message || "\u8BFB\u53D6\u76EE\u5F55\u5931\u8D25");
    const o = s.list || [];
    if (!o.length) return toast("\u8BE5\u76EE\u5F55\u4E0B\u6CA1\u6709\u6B4C\u66F2");
    pendingImport = {
        tracks: o,
        suggestedName: e.name
    }, openImportModal(`\u5BFC\u5165\u300C${e.name}\u300D${o.length} \u9996\u6B4C\u66F2`)
}

function scheduleSaveState() {
    clearTimeout(saveStateTimer), saveStateTimer = setTimeout(saveUiState, 300)
};
(function() {
    const _sv = () => {
        try {
            saveUiState()
        } catch (_) {}
    };
    const _reg = (e, f) => {
        try {
            window.addEventListener(e, f)
        } catch (_) {}
    };
    _reg("beforeunload", _sv);
    _reg("pagehide", _sv);
    try {
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") _sv()
        })
    } catch (_) {}
})();
async function saveUiState() {
    try {
        _snapCurrentNav();
        const t = {
            currentSourceId,
            currentSourceType: (sources.find(x => x.id === currentSourceId) || {}).type || null,
            view,
            songMode,
            drill,
            folderPath,
            npOpen: !!($("npMask") && $("npMask").classList.contains("show")),
            npPage: npPage || 0,
            abTrack: (curTrack && curTrack.id) || (abLast() && abLast().track) || null,
            abFolder: (abLast() && abLast().folder) || folderPath || null,
            search: $("searchInput").value,
            scrollTop: $("content").scrollTop,
            selectedKind,
            selected: [...selected],
            playMode,
            currentVolume,
            favoriteIds: [...favoriteIds],
            navState,
            scrollMem,
            savedAt: Date.now()
        };
        // 有声书完整队列持久化：宿主只维护 20 首滑动窗口，退出重进后前端若只同步宿主会只剩 20 条。
        // 把完整队列（含 source trackId + host sid）落盘，重进时直接恢复，避免抽屉只剩窗口、懒加载无内容可滚。
        if (isAudiobook() && playerState.queue && playerState.queue.length) {
            t.abQueue = playerState.queue.map(x => ({
                id: x.id,
                trackId: x.trackId,
                title: x.title,
                artist: x.artist,
                album: x.album,
                coverId: x.coverId,
                sourceId: x.sourceId != null ? x.sourceId : currentSourceId
            }));
            t.abQueueSourceId = currentSourceId
        }
        // 同步落盘草稿：beforeunload/pagehide 时 await api 的网络请求常被浏览器杀掉，
        // 导致退出时状态丢失。localStorage 是同步的，可在此可靠保存，恢复时优先采用。
        try {
            localStorage.setItem(UI_STATE_DRAFT_KEY, JSON.stringify(t))
        } catch (_) {}
        await api(`${PLUGIN_BASE}/ui-state`, "POST", {
            state: t
        })
    } catch (t) {
        console.log("[state] save failed", t)
    }
}
async function restoreUiState() {
    try {
        const t = await api(`${PLUGIN_BASE}/ui-state`);
        let e = (t && t.ok && t.state) ? t.state : null;
        // 优先采用本地同步草稿：beforeunload/pagehide 时后端异步保存常失败，草稿更可靠
        try {
            const d = localStorage.getItem(UI_STATE_DRAFT_KEY);
            if (d) {
                const draft = JSON.parse(d);
                if (!e || (draft.savedAt || 0) >= (e.savedAt || 0)) e = draft
            }
        } catch (_) {}
        if (!e) return;
        if (e.navState && typeof e.navState === "object") navState = e.navState;
        if (e.scrollMem && typeof e.scrollMem === "object") scrollMem = e.scrollMem;
        // 优先精确匹配源 id；若重启后源 id 发生变化（如宿主重新生成配置），
        // 退而按「源类型」匹配，避免刷新/重启插件后回退到本地库等默认源。
        if (e.currentSourceId && sources.find(s => s.id === e.currentSourceId)) {
            currentSourceId = e.currentSourceId
        } else if (e.currentSourceType) {
            const _m = sources.find(s => s.type === e.currentSourceType && s.enabled) || sources.find(s => s.type === e.currentSourceType);
            if (_m) currentSourceId = _m.id
        }
        // 有声书：退出时落盘的完整队列优先恢复，避免重进后只拿到宿主 20 首滑动窗口。
        if (isAudiobook() && e.abQueue && Array.isArray(e.abQueue) && e.abQueue.length && e.abQueueSourceId === currentSourceId) {
            playerState = {
                ...playerState,
                queue: e.abQueue.map(msmMergeMeta),
                currentIndex: -1
            };
            queueSourceId = currentSourceId
        }
        e.view && ["tracks", "albums", "artists", "playlists", "folders", "favorites"].includes(e.view) && (view = e.view);
        e.search && ($("searchInput").value = e.search, searchActive = !0);
        _loadNav(currentSourceId);
        if (isAudiobook()) {
            view = "folders", searchActive = !1, $("searchInput").value = "", restoreFolderPending = !0, drill = null, folderPath = (abLast() && abLast().folder) || e.abFolder || e.folderPath || "", abRestoreTrack = (abLast() && abLast().track) || e.abTrack || (e.selectedKind === "track" && e.selected && e.selected[0] ? String(e.selected[0]) : null)
        } else if (!drill) {
            restoreFolderPending = !0;
            view === "folders" ? (folderPath = viewNav.folders.path, drill = null) : (view === "albums" || view === "artists" || view === "playlists") ? (drill = viewNav[view].drill || (e.drill && e.drill.type === view ? e.drill : null)) : drill = null
        }
        songMode = isAudiobook() ? "folders" : (e.songMode === "tracks" || e.songMode === "folders") ? e.songMode : (view === "tracks" || view === "folders") ? view : songMode;
        isDebugOn() && console.log("[restore] view=", view, "folderPath=", folderPath, "drill=", JSON.stringify(drill));
        renderSources();
        document.querySelectorAll("#tabs .tab").forEach(s => s.classList.toggle("active", s.dataset.v === view || (view === "folders" && s.dataset.v === "tracks")));
        const vb2 = $("viewToggleBtn");
        vb2 && vb2.classList.toggle("active", view === "folders");
        drill ? await loadDrill() : searchActive && e.search ? await doSearch() : await loadView(view);
        await restoreListScroll();
        locatedPlayingKey = null;
        if (!curTrack && playerState.currentSong && currentList.length) syncCurTrackFromState();
        highlightPlaying();
        const n = view === "tracks" ? "track" : view === "albums" ? "album" : view === "artists" ? "artist" : "playlist";
        e.selectedKind === n ? e.selected && Array.isArray(e.selected) && (selected = new Set(e.selected)) : selected = new Set, renderSelection(), updateBulkBar(), e.playMode && PLAY_MODE_LABELS[e.playMode] ? playMode = e.playMode : e.playMode === "repeat" && (playMode = "single"), loadFavoriteIds().catch(() => {}), renderExtraControls(), uiStateRestored = !0;
        if (e.npOpen) pendingNpRestore = {
            open: !0,
            page: e.npPage || 0
        }, maybeRestoreNp(), pendingNpRestore && setTimeout(maybeRestoreNp, 1000)
    } catch (t) {
        console.log("[state] restore failed", t)
    }
}
async function openImportModal(t) {
    $("importTitle").textContent = t || "\u5BFC\u5165\u5230 SongLoft", $("importMsg").textContent = "", $("importTarget").value = "__new__", $("importNewName").value = pendingImport && pendingImport.suggestedName || "", onImportTargetChange(), await refreshSongloftPlaylists(), $("importModal").classList.add("show")
}

function closeImportModal() {
    $("importModal").classList.remove("show"), pendingImport = null
}

function onImportTargetChange() {
    const t = $("importTarget").value === "__new__";
    $("importNewNameField").style.display = t ? "block" : "none"
}
$("importTarget").onchange = onImportTargetChange;
async function refreshSongloftPlaylists() {
    try {
        const n = await api(PLUGIN_BASE + "/playlists/songloft");
        songloftPlaylists = n.ok ? n.list || [] : []
    } catch {
        songloftPlaylists = []
    }
    const t = $("importTarget"),
        e = t.value;
    t.innerHTML = '<option value="">-- \u4EC5\u52A0\u5165\u5A92\u4F53\u5E93\uFF0C\u4E0D\u52A0\u5165\u6B4C\u5355 --</option><option value="__new__">+ \u65B0\u5EFA\u6B4C\u5355</option>';
    for (const n of songloftPlaylists) {
        const s = document.createElement("option");
        s.value = String(n.id), s.textContent = `${n.name} (${n.song_count||0} \u9996)`, t.appendChild(s)
    }
    t.value = e
}
async function confirmImport() {
    if (!pendingImport || !pendingImport.tracks.length) return closeImportModal();
    const t = $("importTarget").value;
    let e = t && t !== "__new__" ? Number(t) : null,
        n = t === "__new__" ? $("importNewName").value.trim() : "";
    t === "__new__" && !n && (n = pendingImport.suggestedName || "\u591A\u6E90\u5BFC\u5165");
    const s = {
        sourceId: currentSourceId,
        tracks: pendingImport.tracks,
        targetPlaylistId: e,
        createPlaylistName: n
    };
    $("importMsg").textContent = "\u5BFC\u5165\u4E2D\u2026";
    try {
        const o = await api(PLUGIN_BASE + "/import", "POST", s);
        if (o.ok) {
            const i = o.playlistId ? "\uFF08\u5DF2\u52A0\u5165\u6B4C\u5355 #" + o.playlistId + "\uFF09" : "";
            toast(`\u5DF2\u5BFC\u5165 ${o.imported||0} \u9996\u5230 SongLoft ${i}`), closeImportModal(), clearSelection(), scheduleSaveState()
        } else $("importMsg").textContent = o.message || "\u5BFC\u5165\u5931\u8D25", $("importMsg").className = "test-msg err"
    } catch (o) {
        $("importMsg").textContent = "\u5BFC\u5165\u5931\u8D25\uFF1A" + (o.message || o), $("importMsg").className = "test-msg err"
    }
}

function toggleSidebar() {
    $("sidebar").classList.toggle("open"), window.innerWidth <= 768 && $("sidebarMask").classList.toggle("show"), $("sidebar").classList.contains("open") && probeUntestedSources().catch(() => {})
}

function openSidebar() {
    $("sidebar").classList.add("open"), $("sidebarMask").classList.add("show"), probeUntestedSources().catch(() => {})
}

function closeSidebar() {
    $("sidebar").classList.remove("open"), $("sidebarMask").classList.remove("show")
}

function onSearchInput() {
    if (!$("searchInput").value.trim() && searchActive) {
        searchActive = !1, searchResultCount = null, loadView(view)
    }
}
async function doSearch() {
    const t = $("searchInput").value.trim();
    if (selected.clear(), !t) {
        setSearchBarOpen(!1);
        searchActive = !1, searchResultCount = null, loadView(view);
        return
    }
    if (view === "favorites") return toast("收藏视图暂不支持搜索，请切换到音源视图搜索");
    if (view === "playlists") return toast("歌单视图暂不支持搜索，请切换到音源视图搜索");
    if (!currentSourceId) return toast("请先选择音源");
    const vt = drill ? "tracks" : view === "albums" ? "albums" : view === "artists" ? "artists" : "tracks";
    switchCtx("v:search"), searchActive = !0, searchResultCount = null;
    const e = await api(`${PLUGIN_BASE}/search?sourceId=${currentSourceId}&q=${encodeURIComponent(t)}&limit=30${drill?`&dir=${encodeURIComponent(drill.id)}`:""}`, "GET", void 0, 2e4, {
        prio: 1
    });
    listScanning = !1;
    if (!e.ok) {
        $("content").innerHTML = `<div class="empty">${esc(e.message||"搜索失败")}</div>`;
        return
    }
    let cnt = 0;
    if (vt === "tracks" && (e.tracks || []).length) {
        cnt = e.tracks.length, currentList = e.tracks
    } else if (vt === "albums" && (e.albums || []).length) {
        cnt = e.albums.length, currentList = e.albums
    } else if (vt === "artists" && (e.artists || []).length) {
        cnt = e.artists.length, currentList = e.artists
    }
    searchResultCount = cnt;
    if (cnt) renderList(vt);
    else $("content").innerHTML = '<div class="empty">未找到结果</div>';
    updateBulkBar(), scheduleSaveState()
}

function openAdd() {
    editingId = null, renderTypePicker(), $("typeModal").classList.add("show")
}

function startAdd(t) {
    closeTypeModal(), $("fType").value = t, $("fName").value = "", $("fBase").value = "", $("fUser").value = "", $("fPass").value = "", $("fAccessCode").value = "", $("fPassSavedHint").textContent = "", $("fAccessSavedHint").textContent = "", $("fPass").placeholder = "\u5BC6\u7801\u5C06\u8FDB\u884C\u52A0\u5BC6\u4FDD\u5B58\uFF0C\u8BF7\u653E\u5FC3\u586B\u5199", $("fAccessCode").placeholder = "\u98DE\u725B\u7CFB\u7EDF\u8BBF\u95EE\u7801\uFF0C\u5F00\u542F\u8BBF\u95EE\u7801\u540E\u5FC5\u586B", dirSelected = [], dirCurrent = "", resetDirList(), renderDirPicker(), $("testMsg").textContent = "", $("testMsg").className = "test-msg", $("modalTitle").textContent = "\u6DFB\u52A0\u97F3\u6E90", $("fTypeField").style.display = "none", onTypeChange(), $("modal").classList.add("show")
}

function closeTypeModal() {
    $("typeModal").classList.remove("show")
}

function closeRiskModal() {
    $("riskModal").classList.remove("show")
}
var riskPendingType = null;

function confirmRisk(t) {
    riskPendingType = t, $("riskModal").classList.add("show"), $("riskAgree").checked = !1, $("riskAgreeBtn").disabled = !0
}

function onRiskAgreeChange(e) {
    $("riskAgreeBtn").disabled = !(e.target || e).checked
}

function agreeRisk() {
    if (!$("riskAgree").checked) {
        alert("\u8BF7\u5148\u52FE\u9009\u98CE\u9669\u77E5\u60DF\u540E\u518D\u4F7F\u7528\u8BE5\u529F\u80FD");
        return
    }
    const t = riskPendingType;
    $("riskModal").classList.remove("show"), startAdd(t)
}

function renderTypePicker() {
    const t = [{
            name: "\u97F3\u4E50\u670D\u52A1",
            items: ["fnMusic", "subsonic", "geak", "daoliyu"]
        }, {
            name: "\u6587\u4EF6\u4E0E NAS",
            items: ["webdav"]
        }],
        e = $("typeGrid");
    if (!e) return;
    let n = "";
    for (const s of t) {
        n += `<div class="type-section"><div class="type-section-title">${esc(s.name)}</div><div class="type-grid">`;
        for (const o of s.items) {
            const u = TYPE_META[o] || {},
                i = TYPE_LABELS[o] || o,
                a = u.desc || "";
            n += `<div class="type-card" data-type="${o}" onclick="${o==='geak'?'confirmRisk':'startAdd'}('${o}')"><div class="type-icon" style="background:${u.color||"#666"}">${u.icon||"?"}</div><div class="type-meta"><div class="type-name">${esc(i)}</div><div class="type-desc">${esc(a)}</div></div></div>`
        }
        n += "</div></div>"
    }
    e.innerHTML = n
}
async function openEdit(t) {
    const e = sources.find(n => n.id === t);
    if (!e) return;
    editingId = t, $("modalTitle").textContent = "\u7F16\u8F91\u97F3\u6E90", $("fType").value = e.type, $("fName").value = e.name, $("fBase").value = e.baseUrl, $("fUser").value = e.username || "", $("fPass").value = "", $("fAccessCode").value = "", dirSelected = dedupePaths(e.rootPaths && e.rootPaths.length ? e.rootPaths.slice() : e.rootPath ? [e.rootPath] : []), dirCurrent = "", resetDirList(), renderDirPicker(!0), $("testMsg").textContent = "", $("testMsg").className = "test-msg", $("fTypeField").style.display = "block", onTypeChange(), $("modal").classList.add("show"), e.baseUrl && (e.type === "webdav" || e.type === "subsonic") && loadDirectories();
    const passHint = $("fPassSavedHint");
    if (e.hasPassword) {
        passHint.textContent = "\u2713 \u5DF2\u586B\u5199\u5E76\u5DF2\u52A0\u5BC6\u4FDD\u5B58";
        $("fPass").placeholder = "\u7559\u7A7A\u5219\u4FDD\u7559\u5DF2\u4FDD\u5B58\u5BC6\u7801";
    } else {
        passHint.textContent = "";
        $("fPass").placeholder = "\u5BC6\u7801\u5C06\u8FDB\u884C\u52A0\u5BC6\u4FDD\u5B58\uFF0C\u8BF7\u653E\u5FC3\u586B\u5199";
    }
    const acHint = $("fAccessSavedHint");
    if (e.hasAccessCode) {
        acHint.textContent = "\u2713 \u5DF2\u586B\u5199\u5E76\u5DF2\u52A0\u5BC6\u4FDD\u5B58";
        $("fAccessCode").placeholder = "\u7559\u7A7A\u5219\u4FDD\u7559\u539F\u8BBF\u95EE\u7801";
    } else {
        acHint.textContent = "";
        $("fAccessCode").placeholder = "\u98DE\u725B\u7CFB\u7EDF\u8BBF\u95EE\u7801\uFF0C\u5F00\u542F\u8BBF\u95EE\u7801\u540E\u5FC5\u586B";
    }
}

function onTypeChange() {
    const t = $("fType").value;
    $("fRootField").style.display = t === "webdav" || t === "subsonic" ? "block" : "none";
    $("fBase").placeholder = t === "fnMusic" ? "\u98DE\u725B\u97F3\u4E50\u5730\u5740 \u6216 FN ID\uFF08\u5982 pcyear\uFF09" : t === "subsonic" ? "http://NAS\u5730\u5740:4040" : t === "geak" ? "http://NAS\u5730\u5740:9080" : t === "daoliyu" ? "http://NAS\u5730\u5740:4000" : "http://NAS\u5730\u5740:5005";
    $("fName").placeholder = t === "fnMusic" ? "\u4F8B\u5982\uFF1A\u6211\u7684\u98DE\u725B\u97F3\u4E50" : t === "subsonic" ? "\u4F8B\u5982\uFF1A\u6211\u7684 Navidrome" : t === "geak" ? "\u4F8B\u5982\uFF1A\u6211\u7684 GEAK NAS" : "\u4F8B\u5982\uFF1A\u6211\u7684 WebDAV";
    const e = t === "fnMusic";
    $("fUserLabel").textContent = e ? "\u98DE\u725B\u97F3\u4E50\u7528\u6237\u540D" : "\u7528\u6237\u540D";
    $("fPassLabel").textContent = e ? "\u98DE\u725B\u97F3\u4E50\u5BC6\u7801" : "\u5BC6\u7801";
    $("fAccessField").style.display = e ? "block" : "none";
    dirCurrent = "";
    resetDirList();
    renderDirPicker()
}

function dirIsSubsonic() {
    return $("fType").value === "subsonic"
}

function esc(t) {
    return String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;").replace(/"/g, "&quot;")
}

function renderDirPicker() {
    renderDirCrumbs(), renderDirSummary(), renderDirSelected();
    const t = $("dirList");
    t.dataset.loaded || (t.innerHTML = '<div class="dir-empty">\u70B9\u300C\u52A0\u8F7D\u76EE\u5F55\u300D\u83B7\u53D6\u53EF\u9009\u76EE\u5F55</div>')
}

function resetDirList() {
    lastDirList = [];
    const t = $("dirList");
    t && (t.dataset.loaded = "")
}

function renderDirCrumbs() {
    const t = $("dirCrumbs");
    if (dirIsSubsonic()) {
        t.innerHTML = '<span class="crumb cur">\u6839</span>';
        return
    }
    const e = dirCurrent.split("/").filter(Boolean);
    let n = '<span class="crumb' + (e.length ? "" : " cur") + `" onclick="goCrumb('')">\u6839</span>`,
        s = "";
    e.forEach((o, i) => {
        s += "/" + o;
        const a = s,
            r = i === e.length - 1;
        n += '<span class="sep">/</span><span class="crumb' + (r ? " cur" : "") + `" onclick="goCrumb('` + esc(a) + `')">` + esc(o) + "</span>"
    }), t.innerHTML = n
}

function renderDirSummary() {
    $("dirSummary").textContent = dirSelected.length ? "\u5DF2\u9009 " + dirSelected.length + " \u4E2A" : "\u672A\u9009\u62E9"
}

function renderDirSelected() {
    const t = $("dirSelected"),
        e = dedupePaths(dirSelected);
    if (!e.length) {
        t.innerHTML = "";
        return
    }
    let n = "";
    for (const s of e) {
        const o = parentOfSelectedPath(s),
            i = s === "/" || o === "" ? "\u70B9\u51FB\u8DF3\u5230\u6839\u76EE\u5F55" : "\u70B9\u51FB\u8DF3\u5230\u4E0A\u7EA7\u76EE\u5F55\uFF1A" + esc(o);
        n += '<span class="dir-chip"><span class="p" title="' + i + `" onclick="parentOfSelected('` + esc(s) + `')">` + esc(s) + `</span><button type="button" class="x" onclick="removeSelected('` + esc(s) + `')" title="\u79FB\u9664\u8BE5\u76EE\u5F55">\xD7</button></span>`
    }
    t.innerHTML = n
}

function parentOfSelectedPath(t) {
    if (!t || t === "/") return "";
    const e = t.lastIndexOf("/");
    return e <= 0 ? "" : t.slice(0, e)
}

function parentOfSelected(t) {
    navigateTo(parentOfSelectedPath(t))
}

function removeSelected(t) {
    t === "/" ? dirSelected = [] : dirSelected = dirSelected.filter(e => e !== t && !e.startsWith(t + "/")), renderDirSummary(), renderDirSelected(), refreshDirListSel()
}
async function loadDirectories(t) {
    renderDirCrumbs();
    const e = $("fType").value;
    if (e !== "webdav" && e !== "subsonic") return;
    const n = $("fBase").value.trim();
    if (!n) {
        $("dirList").innerHTML = '<div class="dir-empty">\u8BF7\u5148\u586B\u5199\u670D\u52A1\u5668\u5730\u5740</div>';
        return
    }
    $("dirList").innerHTML = '<div class="dir-empty">\u52A0\u8F7D\u4E2D\u2026</div>';
    try {
        const s = await api(PLUGIN_BASE + "/sources/directories", "POST", {
            id: editingId || void 0,
            type: e,
            baseUrl: n,
            username: $("fUser").value,
            password: $("fPass").value,
            dirPath: dirCurrent,
            refresh: t ? "1" : void 0
        });
        s && s.ok ? renderDirList(s.list || []) : $("dirList").innerHTML = '<div class="dir-empty">\u52A0\u8F7D\u5931\u8D25\uFF1A' + esc(s && s.message || "\u672A\u77E5\u9519\u8BEF") + "</div>"
    } catch (s) {
        $("dirList").innerHTML = '<div class="dir-empty">\u52A0\u8F7D\u5931\u8D25\uFF1A' + esc(s && s.message || s) + "</div>"
    }
}

function renderDirList(t) {
    lastDirList = t || [];
    const e = dirCurrent || "/";
    if (dirSelected.indexOf(e) >= 0)
        for (const o of t || []) dirSelected.indexOf(o.path) < 0 && dirSelected.push(o.path);
    const n = $("dirList");
    n.dataset.loaded = "1";
    let s = "";
    if (!dirIsSubsonic() && dirCurrent && (s += '<div class="dir-item up" onclick="goUp()"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 19l-7-7 7-7"/></svg><span class="nm">\u8FD4\u56DE\u4E0A\u4E00\u7EA7</span></div>'), !dirIsSubsonic() && t.length) {
        const o = dirCurrent || "/",
            i = dirSelected.indexOf(o) >= 0;
        s += `<div class="dir-item allcur" onclick="if(event.target.tagName!=='INPUT'){const c=this.querySelector('input');c.checked=!c.checked;toggleSelectAllCurrent(c);}"><span class="nm">\u5168\u9009</span><input type="checkbox" class="chk" ` + (i ? "checked" : "") + ' onclick="event.stopPropagation()" onchange="toggleSelectAllCurrent(this)"></div>'
    }
    if (!t.length) {
        if (!s) {
            n.innerHTML = '<div class="dir-empty">' + (dirIsSubsonic() ? "\u8BE5\u670D\u52A1\u5668\u65E0\u97F3\u4E50\u5E93" : "\u6B64\u76EE\u5F55\u4E0B\u6CA1\u6709\u5B50\u76EE\u5F55") + "</div>";
            return
        }
        n.innerHTML = s;
        return
    }
    for (const o of t) {
        const i = dirSelected.indexOf(o.path) >= 0,
            a = dirCountCache[o.path],
            r = typeof a == "number" ? '<span class="cnt" title="\u8BE5\u76EE\u5F55\u4E0B\u7EA6 ' + a + ' \u9996\u6B4C\u66F2">' + a.toLocaleString("en-US") + " \u9996</span>" : '<button type="button" class="cntbtn" data-cnt="' + esc(o.path) + `" onclick="event.stopPropagation();loadOneCount('` + esc(o.path) + `')">\u52A0\u8F7D\u6570\u91CF</button>`;
        s += `<div class="dir-item" onclick="onDirRowClick('` + esc(o.path) + `')"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg><span class="nm">` + esc(o.name) + "</span>" + r + '<input type="checkbox" class="chk" data-path="' + esc(o.path) + '" ' + (i ? "checked" : "") + ` onclick="event.stopPropagation()" onchange="toggleDir('` + esc(o.path) + "','" + esc(o.name) + `',this)"></div>`
    }
    n.innerHTML = s
}
async function loadOneCount(t) {
    const e = $("fType").value;
    if (e !== "webdav" && e !== "subsonic") return;
    const n = document.querySelectorAll(".cntbtn");
    for (const s of n)
        if (s.getAttribute("data-cnt") === t) {
            s.classList.add("loading"), s.textContent = "\u7EDF\u8BA1\u4E2D\u2026", s.disabled = !0;
            break
        } try {
        const s = await api(PLUGIN_BASE + "/sources/directory-count", "POST", {
            id: editingId || void 0,
            type: e,
            baseUrl: $("fBase").value.trim(),
            username: $("fUser").value,
            password: $("fPass").value,
            dirPath: t
        });
        s && s.ok ? dirCountCache[t] = typeof s.count == "number" ? s.count : 0 : dirCountCache[t] = 0
    } catch {
        dirCountCache[t] = 0
    } finally {
        renderDirList(lastDirList)
    }
}
async function loadPageCounts() {
    const t = $("fType").value;
    if (t !== "webdav" && t !== "subsonic") return;
    const e = lastDirList || [];
    if (e.length)
        for (const n of e) await loadOneCount(n.path)
}

function refreshDirListSel() {
    renderDirList(lastDirList)
}

function navigateTo(t) {
    dirCurrent = t || "", renderDirCrumbs(), loadDirectories()
}

function onDirRowClick(t) {
    dirIsSubsonic() || navigateTo(t)
}

function goCrumb(t) {
    navigateTo(t)
}

function goUp() {
    if (!dirCurrent) return;
    const t = dirCurrent.split("/").filter(Boolean);
    t.pop(), navigateTo(t.length ? "/" + t.join("/") : "")
}

function isAllSelected() {
    const t = dirCurrent || "/";
    return dirSelected.indexOf(t) >= 0
}

function toggleSelectAllCurrent(t) {
    const e = dirCurrent || "/",
        n = lastDirList || [];
    if (t.checked) {
        dirSelected.indexOf(e) < 0 && dirSelected.push(e);
        for (const s of n) dirSelected.indexOf(s.path) < 0 && dirSelected.push(s.path)
    } else {
        const s = dirSelected.indexOf(e);
        s >= 0 && dirSelected.splice(s, 1);
        for (const o of n) {
            const i = dirSelected.indexOf(o.path);
            i >= 0 && dirSelected.splice(i, 1)
        }
    }
    renderDirSummary(), renderDirSelected(), refreshDirListSel()
}

function toggleDir(t, e, n) {
    const s = dirCurrent || "/",
        o = lastDirList || [],
        i = dirSelected.indexOf(t);
    if (n.checked) i < 0 && dirSelected.push(t), o.length > 0 && o.every(r => dirSelected.indexOf(r.path) >= 0) && dirSelected.indexOf(s) < 0 && dirSelected.push(s);
    else {
        const a = dirSelected.indexOf(s);
        a >= 0 && dirSelected.splice(a, 1), i >= 0 && dirSelected.splice(i, 1)
    }
    renderDirSummary(), renderDirSelected(), refreshDirListSel()
}

function closeModal() {
    $("modal").classList.remove("show")
}

function openSubsonicSettings() {
    $("subMsg").textContent = "", $("subMsg").className = "test-msg", $("subHost").value = "", updateSubUrl(), api(PLUGIN_BASE + "/subsonic-server-config", "GET").then(t => {
        t && t.ok && t.config && ($("subEnabled").checked = !!t.config.enabled, $("subUser").value = t.config.username || "", $("subPass").value = "", t.config.host && ($("subHost").value = t.config.host), $("subLocalOnly").checked = t.config.localOnly !== !1, updateSubUrl())
    }).catch(() => {}), $("subsonicModal").classList.add("show"), $("subHost").oninput = updateSubUrl
}

function updateSubUrl() {
    const t = $("subHost").value.trim() || typeof location < "u" && location.origin || "",
        e = PLUGIN_BASE.replace(/\/+$/, "");
    $("subUrl").value = t.replace(/\/+$/, "") + e + "/rest"
}

function closeSubsonicModal() {
    $("subsonicModal").classList.remove("show")
}
async function saveSubsonicConfig() {
    const t = {
        enabled: $("subEnabled").checked,
        username: $("subUser").value.trim(),
        password: $("subPass").value,
        host: $("subHost").value.trim(),
        localOnly: $("subLocalOnly").checked
    };
    try {
        const e = await api(PLUGIN_BASE + "/subsonic-server-config", "POST", t);
        e && e.ok ? (toast(t.enabled ? "Subsonic \u670D\u52A1\u7AEF\u5DF2\u5F00\u542F" : "Subsonic \u670D\u52A1\u7AEF\u5DF2\u5173\u95ED"), closeSubsonicModal()) : toast("\u4FDD\u5B58\u5931\u8D25\uFF1A" + (e && e.message || "\u672A\u77E5\u9519\u8BEF"))
    } catch (e) {
        toast("\u4FDD\u5B58\u5931\u8D25\uFF1A" + (e && e.message || e))
    }
}

function openSrcMenu(t) {
    const e = $("srcMenuMask"),
        n = $("srcMenu");
    e.classList.add("show");
    const s = t.getBoundingClientRect(),
        o = n.offsetWidth || 184,
        i = n.offsetHeight || 90;
    let a = s.left - o - 8;
    a < 8 && (a = s.right + 8), a + o > window.innerWidth - 8 && (a = window.innerWidth - o - 8);
    let r = s.top;
    r + i > window.innerHeight - 8 && (r = Math.max(8, window.innerHeight - i - 8)), n.style.left = Math.max(8, a) + "px", n.style.top = r + "px"
}

function closeSrcMenu() {
    $("srcMenuMask").classList.remove("show")
}

function openPluginSettings() {
    $("plDebug").checked = isDebugOn(), $("pluginModal").classList.add("show")
}

function closePluginSettings() {
    $("pluginModal").classList.remove("show")
}

function openLocalLibSettings() {
    $("localLibModal").classList.add("show"), loadLocalLibUI()
}

function closeLocalLibSettings() {
    $("localLibModal").classList.remove("show")
}
async function saveLocalLibSettings() {
    const a = Array.from(document.querySelectorAll("#fuseSources input[type=checkbox]:checked")).map(x => x.value).filter(v => v && v !== "src_msm_songloft" && v !== "src_msm_audiobook"),
        b = $("plExclRemote").checked,
        c = Array.from(document.querySelectorAll("#localFolders input[type=checkbox]:checked")).map(x => x.value).filter(v => v);
    try {
        const f = await api(PLUGIN_BASE + "/sources/fuse", "POST", {
                fused: a
            }),
            l = await api(PLUGIN_BASE + "/sources/local-opts", "POST", {
                excludeRemote: b,
                localRootPaths: c
            });
        if (!f.ok || !l.ok) return toast((f.message || l.message) || "\u4FDD\u5B58\u5931\u8D25");
        try {
            switchView(view)
        } catch (e2) {}
    } catch (e) {
        toast("\u4FDD\u5B58\u5931\u8D25\uFF1A" + (e && e.message || e))
    }
    closeLocalLibSettings(), toast("\u5DF2\u4FDD\u5B58")
}

function buildFolderTree(paths) {
    const root = {
        name: "",
        path: "",
        children: []
    };
    for (const p of paths || []) {
        const parts = String(p).split("/").filter(Boolean);
        let node = root,
            cur = "";
        for (const part of parts) {
            cur = cur ? cur + "/" + part : part;
            let ch = node.children.find(c => c.name === part);
            if (!ch) {
                ch = {
                    name: part,
                    path: cur,
                    children: []
                };
                node.children.push(ch)
            }
            node = ch
        }
    }
    return root.children
}

const FOLDER_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>';
const ROOT_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7.58 2 4 3.79 4 6v12c0 2.21 3.58 4 8 4s8-1.79 8-4V6c0-2.21-3.58-4-8-4zm0 14c-3.31 0-6-1.34-6-3v-1.5c1.47.98 3.53 1.5 6 1.5s4.53-.52 6-1.5V15c0 1.66-2.69 3-6 3z"/></svg>';

function folderTreeHtml(nodes, depth, sel) {
    return nodes.map((n) => {
        const has = n.children.length > 0;
        const pad = depth * 18;
        return '<div class="tree-node"><div class="tree-row" style="padding-left:' + pad + 'px"><span class="tree-toggle' + (has ? ' has-children' : '') + '">' + (has ? '▾' : '') + '</span><label class="tree-label"><input type="checkbox" value="' + esc(n.path) + '"' + (sel.includes(n.path) ? ' checked' : '') + '/><span class="tree-icon">' + FOLDER_ICON + '</span><span class="tree-name">' + esc(n.name) + '</span></label></div>' + (has ? '<div class="tree-children">' + folderTreeHtml(n.children, depth + 1, sel) + '</div>' : '') + '</div>';
    }).join('');
}

function openAudiobookSettings() {
    const m = $("audiobookModal");
    m && m.classList.add("show");
    loadAudiobookUI()
}

function closeAudiobookSettings() {
    const m = $("audiobookModal");
    m && m.classList.remove("show")
}
async function loadAudiobookUI() {
    try {
        const r = await api(PLUGIN_BASE + "/sources/audiobook-folders"),
            o = await api(PLUGIN_BASE + "/sources"),
            folders = r.ok && Array.isArray(r.folders) ? r.folders : [],
            cfg = (o.data || []).find(s => s.id === "src_msm_audiobook") || {},
            sel = Array.isArray(cfg.rootPaths) ? cfg.rootPaths : [];
        const fb = $("abFolders");
        if (fb) {
            const tree = buildFolderTree(folders);
            fb.innerHTML = tree.length ? folderTreeHtml(tree, 0, sel) : '<span style="color:var(--sub);font-size:12px">\uFF08\u65E0\u53EF\u7528\u6587\u4EF6\u5939\uFF09</span>';
            fb.onclick = ev => {
                const tg = ev.target.closest(".tree-toggle");
                if (!tg) return;
                const ch = tg.closest(".tree-node").querySelector(":scope > .tree-children");
                if (ch) {
                    const show = ch.style.display === "none" ? "" : "none";
                    ch.style.display = show;
                    tg.textContent = show === "none" ? "\u25B8" : "\u25BE"
                }
            };
            fb.onchange = ev => {
                const cb = ev.target;
                if (!cb || cb.type !== "checkbox") return;
                const wrap = cb.closest(".tree-node");
                if (!wrap) return;
                const ch = wrap.querySelector(":scope > .tree-children");
                if (ch) ch.querySelectorAll("input[type=checkbox]").forEach(x => x.checked = cb.checked);
                Array.from(fb.querySelectorAll(".tree-children")).reverse().forEach(cd => {
                    const w = cd.parentElement,
                        k = w.querySelector(":scope > .tree-row > label.tree-label > input[type=checkbox]");
                    if (!k) return;
                    k.checked = Array.from(cd.querySelectorAll(":scope > .tree-node > .tree-row > label.tree-label > input[type=checkbox]")).some(x => x.checked)
                })
            }
        }
    } catch (e) {
        console.warn("loadAudiobookUI", e)
    }
}
async function purgeAudiobookBridge() {
    try {
        const r = await api(PLUGIN_BASE + "/sources/audiobook-purge", "POST", {});
        if (r && r.ok) toast("已清理 " + r.purged + " 条失效记录" + (r.failed ? ("（" + r.failed + " 条失败）") : ""));
        else toast((r && r.message) || "清理失败")
    } catch (e) {
        toast("清理失败：" + ((e && e.message) || e))
    }
}
async function saveAudiobookSettings() {
    const fb = $("abFolders"),
        paths = fb ? Array.from(fb.querySelectorAll("input[type=checkbox]:checked")).map(x => x.value).filter(v => v) : [];
    try {
        const r = await api(PLUGIN_BASE + "/sources", "POST", {
            type: "audiobook",
            id: "src_msm_audiobook",
            name: "Songloft \u6709\u58F0\u4E66",
            rootPaths: paths,
            baseUrl: ""
        });
        if (!r.ok) return toast((r.message) || "\u4FDD\u5B58\u5931\u8D25");
        loadSources();
        toast("\u5DF2\u4FDD\u5B58")
    } catch (e) {
        toast("\u4FDD\u5B58\u5931\u8D25\uFF1A" + ((e && e.message) || e))
    }
    closeAudiobookSettings()
}
async function loadLocalLibUI() {
    try {
        const f = await api(PLUGIN_BASE + "/sources/fuse"),
            o = await api(PLUGIN_BASE + "/sources/local-opts"),
            fd = await api(PLUGIN_BASE + "/sources/local-folders"),
            fused = f.ok && Array.isArray(f.fused) ? f.fused : [],
            opts = o.ok && o.opts ? o.opts : {},
            folders = fd.ok && Array.isArray(fd.folders) ? fd.folders : [],
            sel = (opts.localRootPaths || []);
        const box = $("fuseSources");
        if (box) {
            const srcs = (sources || []).filter(s => s.id !== "src_msm_songloft" && s.id !== "src_msm_audiobook");
            box.innerHTML = srcs.map(s => '<label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:4px 8px;background:var(--bg3);border-radius:6px;cursor:pointer"><input type="checkbox" value="' + esc(s.id) + '"' + (fused.includes(s.id) ? " checked" : "") + '/><span>' + esc(s.name || s.type) + '</span></label>').join("") || '<span style="color:var(--sub);font-size:12px">\uFF08\u6682\u65E0\u5176\u5B83\u97F3\u6E90\uFF09</span>'
        }
        const ex = $("plExclRemote");
        ex && (ex.checked = !!opts.excludeRemote);
        const fb = $("localFolders");
        if (fb) {
            const tree = buildFolderTree(folders);
            fb.innerHTML = tree.length ? '<div class="tree-node"><div class="tree-row root-row"><span class="tree-toggle has-children">\u25BE</span><label class="tree-label"><input type="checkbox" id="treeRoot"' + (sel.length ? " checked" : "") + '/><span class="tree-icon">' + ROOT_ICON + '</span><span class="tree-name">\u672C\u5730\u5E93</span></label></div><div class="tree-children">' + folderTreeHtml(tree, 1, sel) + '</div></div>' : '<span style="color:var(--sub);font-size:12px">\uFF08\u672C\u5730\u5E93\u6682\u65E0\u53EF\u9009\u6587\u4EF6\u5939\uFF09</span>';
            fb.onclick = ev => {
                const tg = ev.target.closest(".tree-toggle");
                if (!tg) return;
                const ch = tg.closest(".tree-node").querySelector(":scope > .tree-children");
                if (ch) {
                    const show = ch.style.display === "none" ? "" : "none";
                    ch.style.display = show;
                    tg.textContent = show === "none" ? "\u25B8" : "\u25BE"
                }
            };
            fb.onchange = ev => {
                const cb = ev.target;
                if (!cb || cb.type !== "checkbox") return;
                if (cb.id === "treeRoot") {
                    fb.querySelectorAll("input[type=checkbox]").forEach(x => {
                        if (x.id !== "treeRoot") x.checked = cb.checked
                    });
                    return
                }
                const wrap = cb.closest(".tree-node");
                if (!wrap) return;
                const ch = wrap.querySelector(":scope > .tree-children");
                if (ch) ch.querySelectorAll("input[type=checkbox]").forEach(x => x.checked = cb.checked);
                Array.from(fb.querySelectorAll(".tree-children")).reverse().forEach(cd => {
                    const w = cd.parentElement,
                        k = w.querySelector(":scope > .tree-row > label.tree-label > input[type=checkbox]");
                    if (!k) return;
                    k.checked = Array.from(cd.querySelectorAll(":scope > .tree-node > .tree-row > label.tree-label > input[type=checkbox]")).some(x => x.checked)
                })
            }
        }
    } catch (e) {
        console.warn("loadLocalLibUI", e)
    }
}

function savePluginSettings() {
    setDebugOn($("plDebug").checked), closePluginSettings(), toast("\u5DF2\u4FDD\u5B58")
}

function copySubsonicUrl() {
    const t = $("subUrl").value;
    if (!t) return;
    const e = () => toast("\u5DF2\u590D\u5236\u8FDE\u63A5\u5730\u5740");
    try {
        navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t).then(e).catch(() => fallbackCopy(t, e)) : fallbackCopy(t, e)
    } catch {
        fallbackCopy(t, e)
    }
}

function fallbackCopy(t, e) {
    try {
        const n = document.createElement("textarea");
        n.value = t, n.style.position = "fixed", n.style.opacity = "0", document.body.appendChild(n), n.select(), document.execCommand("copy"), n.remove(), e && e()
    } catch {
        toast("\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u590D\u5236")
    }
}
async function testConn() {
    const rawBase = $("fBase").value.trim();
    if (!rawBase) return setTest("\u8BF7\u586B\u5199\u670D\u52A1\u5668\u5730\u5740", !1);
    const t = collectForm();
    setTest("\u8FDE\u63A5\u6D4B\u8BD5\u4E2D\u2026", null);
    try {
        const e = await api(PLUGIN_BASE + "/sources/test", "POST", t, 2e4),
            n = e && e.message ? e.message : e && e.ok ? "\u8FDE\u63A5\u6210\u529F" : "\u8FDE\u63A5\u5931\u8D25\uFF08HTTP " + (e && e.status) + "\uFF09";
        setTest(n, e ? e.ok : !1), e && e.ok && (collectForm().type === "webdav" || collectForm().type === "subsonic") && loadDirectories()
    } catch (e) {
        setTest("\u8FDE\u63A5\u5931\u8D25\uFF1A" + (e && e.message || e), !1)
    }
}

function setTest(t, e) {
    const n = $("testMsg");
    n.textContent = t, n.className = "test-msg" + (e === !0 ? " ok" : e === !1 ? " err" : "")
}

function dedupePaths(t) {
    const e = Array.from(new Set(t));
    return e.indexOf("/") >= 0 ? ["/"] : e.filter(n => !e.some(s => s !== n && n.startsWith(s + "/")))
}

function collectForm() {
    const t = {};
    if (editingId) {
        const n = sources.find(s => s.id === editingId);
        if (n && n.extra)
            for (const s of Object.keys(n.extra)) t[s] = n.extra[s]
    }
    let e = $("fBase").value.trim();
    return {
        id: editingId || void 0,
        type: $("fType").value,
        name: $("fName").value || TYPE_LABELS[$("fType").value] + " " + (sources.length + 1),
        baseUrl: e,
        username: $("fUser").value,
        password: $("fPass").value,
        accessCode: $("fAccessCode").value.trim(),
        rootPaths: dedupePaths(dirSelected),
        extra: (() => {
            const ex = Object.keys(t).length ? { ...t } : {};
            return Object.keys(ex).length ? ex : void 0;
        })()
    }
}

async function saveSource() {
    const t = collectForm();
    if (!t.baseUrl) return setTest("\u8BF7\u586B\u5199\u670D\u52A1\u5668\u5730\u5740", !1);
    const e = await api(PLUGIN_BASE + "/sources", "POST", t);
    if (!e.ok) return setTest(e.message || "\u4FDD\u5B58\u5931\u8D25", !1);
    sources.length === 0 && e.data && await api(PLUGIN_BASE + "/sources", "POST", {
        ...e.data,
        isDefault: !0
    }), closeModal(), await loadSources(), toast("\u5DF2\u4FDD\u5B58")
}
async function delSource(t) {
    if (!confirm("\u786E\u5B9A\u5220\u9664\u8BE5\u97F3\u6E90\uFF1F")) return;
    try {
        const r = await api(PLUGIN_BASE + "/sources", "POST", { op: 'delete', id: t });
        if (!r || !r.ok) { toast((r && r.message) || "\u5220\u9664\u5931\u8D25"); return; }
    } catch (e) {
        toast("\u5220\u9664\u5931\u8D25\uFF1A" + (e && e.message || e));
        return;
    }
    currentSourceId === t && (currentSourceId = null);
    await loadSources();
    toast("\u5DF2\u5220\u9664");
}
try {
    window.SongloftPlugin && window.SongloftPlugin.onThemeChange && window.SongloftPlugin.onThemeChange(t => {
        document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark")
    })
} catch {}
$("pCov").src = DEFAULT_COVER, $("content").addEventListener("scroll", () => scheduleSaveState(), {
    passive: !0
}), bindListLazyLoad(), bindPullToRefresh(), bindListFloat();

function retryLyricAfterSources() {
    playerState && playerState.currentSong && (hydrateNowPlaying(), renderPlayer(), $("npMask").classList.contains("show") && renderNowPlaying())
}

// ---- 服务端 KV 镜像：把浏览器 localStorage 全量落盘到插件服务端（sl().storage）----
// 目的：用户数据（歌词偏移/播放速率/收藏标记/界面状态等）不被浏览器清缓存抹掉，刷新/清缓存后从服务端恢复。
// 实现：启动时先 kvPull 从服务端拉全量映射写回 localStorage；随后 installKvMirror 拦截所有写入，
// 防抖把最新全量映射上传服务端。cover: 等纯缓存键不落盘。
let kvUploadNow = () => {};
async function kvPull() {
    try {
        const r = await api(PLUGIN_BASE + "/rest/kv");
        if (r && r.ok && r.data && typeof r.data === "object") {
            for (const k in r.data) {
                try { localStorage.setItem(k, r.data[k]) } catch {}
            }
        }
    } catch (e) { /* 离线/首启：忽略，使用本地默认值 */ }
}
function buildKvMap() {
    const map = {};
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || k.indexOf("cover:") === 0) continue; // 纯缓存键不落盘
            // 认证 token 不参与 KV 镜像：避免客户端注入的 token 被空/坏值覆盖到服务端
            if (k === "songloft-auth" || k === "songloft-plugin-token") continue;
            try { map[k] = localStorage.getItem(k) } catch {}
        }
    } catch {}
    return map
}
function installKvMirror() {
    const _set = Storage.prototype.setItem,
        _rm = Storage.prototype.removeItem,
        _clr = Storage.prototype.clear;
    let timer = 0,
        pending = !1;

    function upload() {
        pending = !1;
        const map = buildKvMap();
        if (!Object.keys(map).length) return; // 防空 map 误清空服务端
        api(PLUGIN_BASE + "/rest/kv", "POST", map).catch(() => {})
    }
    function schedule() {
        if (pending) return;
        pending = !0;
        clearTimeout(timer);
        timer = setTimeout(upload, 400)
    }
    Storage.prototype.setItem = function () {
        const r = _set.apply(this, arguments);
        // 认证 token 的写入不触发 KV 上传（其值来自客户端注入或服务端 KV，不应被镜像回写覆盖）
        if (arguments[0] === "songloft-auth" || arguments[0] === "songloft-plugin-token") return r;
        schedule();
        return r
    };
    Storage.prototype.removeItem = function () {
        const r = _rm.apply(this, arguments);
        schedule();
        return r
    };
    Storage.prototype.clear = function () {
        const r = _clr.apply(this, arguments);
        schedule();
        return r
    };
    kvUploadNow = upload;

    // 关键修复：页面关闭/刷新时用 sendBeacon 同步兜底，确保最后状态可靠落盘
    // （防抖的异步 api 在 quick refresh 时往往来不及发出就被卸载取消，导致数据丢失）
    const beaconUrl = (function () {
        try { return new URL(PLUGIN_BASE + "/rest/kv", location.href).toString() } catch { return "" }
    })();
    const flushBeacon = () => {
        try {
            const map = buildKvMap();
            if (!Object.keys(map).length || !beaconUrl || !navigator.sendBeacon) return;
            const blob = new Blob([JSON.stringify(map)], { type: "application/json" });
            navigator.sendBeacon(beaconUrl, blob)
        } catch {}
    };
    window.addEventListener("pagehide", flushBeacon);
    window.addEventListener("beforeunload", flushBeacon);
    document.addEventListener("visibilitychange", () => { document.visibilityState === "hidden" && flushBeacon() })
}
async function initKv() {
    await kvPull(); // 先恢复，再安装拦截，避免恢复写入触发重复上传
    installKvMirror();
}

// 认证自愈：本地缺失 songloft-auth 时，通过宿主公开桥接 songloft.plugin.getToken()
// （无需 HTTP Bearer，直接由客户端原生返回有效 token）恢复，写回 localStorage。
async function ensureLocalAuth() {
    try {
        if (localStorage.getItem("songloft-auth")) return;
    } catch (e) {}
    try {
        const sl = window.songloft;
        if (sl && sl.plugin && typeof sl.plugin.getToken === "function") {
            const t = await sl.plugin.getToken();
            if (t && typeof t === "string" && t.indexOf("eyJ") === 0) {
                localStorage.setItem("songloft-auth", JSON.stringify({ accessToken: t }));
                return;
            }
        }
    } catch (e) { /* 桥接不可用则忽略，落到下方 KV 兜底 */ }
    // 兜底：服务端 KV 已存有合法 JWT，直接取回（此时若已有其他可用 token 则能成功）
    try {
        const r = await api(PLUGIN_BASE + "/rest/kv");
        if (r && r.ok && r.data && typeof r.data === "object" && r.data["songloft-auth"]) {
            localStorage.setItem("songloft-auth", r.data["songloft-auth"]);
        }
    } catch (e) {}
}

document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", boot) : boot();

async function boot() {
    // 自愈：若 webview 缓存了旧版 JS，上次运行版本与本次不符则硬刷新一次，强制拉取最新代码。
    // 平时（版本一致）不触发，不影响正常使用。
    try {
        const _last = localStorage.getItem("songloft_lastver");
        const _cur = String(PLUGIN_VERSION);
        if (_last && _last !== _cur) {
            // 自愈只刷新一次：先记录本次版本，避免壳版本与残留缓存不一致时无限刷新
            try { localStorage.setItem("songloft_lastver", _cur) } catch (_) {}
            location.reload(!0); return
        }
    } catch (_) {}
    await initKv();
    // 诊断：把真机实际加载的插件版本写回 KV，便于远端确认 webview 是否加载到最新构建（缓存排查）。
    try { localStorage.setItem("songloft_bootver", String(PLUGIN_VERSION)) } catch (_) {}
    await restoreHostSongMap(); // 重启后从宿主永久存储回填 host id → 源 trackId/path 映射，使首帧 applyState 即可定位文件夹示波图
    await abStoreLoad(); // 启动即从宿主永久存储（mm_ab_store）装载有声书状态（书单/映射/进度/草稿），不依赖浏览器 localStorage
    // 根除「退出重进抽屉只剩 20 条」：abStoreLoad 仅填 _abStore 内存，必须把完整书单回填到全局
    // abFolderList，否则退出重进后 abFolderList 为空，用户一切换到有声书文件夹视图，loadView 会用
    // 分页的 20 条 folderTracks 覆盖并落盘，把宿主里完整的整本书单永久截断成 20 条（懒加载失效）。
    // 启动即恢复，后续 loadView 的「!abFolderList.length」兜底便不会触发，从根源杜绝截断。
    try { abFolderListLoad() } catch (_) {}
    await ensureLocalAuth();
    refreshAllIcons(), renderExtraControls(), npApplySW(), probeAuth(), loadSources().then(retryLyricAfterSources), initPlayerBridge(), CastManager.init(), lyricFillRAF || lyricFillTick(), initToolbarDrag(), bindNpSongSwipe(), placeBulkBar(), restoreScreenLyric(),     window.addEventListener("resize", _onResizeRaf(() => placeBulkBar()));
    try { localStorage.setItem("songloft_lastver", String(PLUGIN_VERSION)) } catch (_) {}
}

function initToolbarDrag() {
    const t = document.querySelector(".toolbar-scroll");
    if (!t || t.dataset.dragBound === "1") return;
    t.dataset.dragBound = "1";
    let e = !1,
        n = 0,
        s = 0;
    const o = i => {
        if (!i) return !1;
        const a = i.tagName;
        return !!(a === "INPUT" || a === "BUTTON" || a === "TEXTAREA" || a === "SELECT" || a === "A" || a === "LABEL" || i.closest && i.closest("input, button, textarea, select, a, label, .search, .tabs"))
    };
    t.addEventListener("mousedown", i => {
        i.button === 0 && (o(i.target) || (e = !0, n = i.pageX, s = t.scrollLeft, t.classList.add("dragging"), i.preventDefault()))
    }), document.addEventListener("mousemove", i => {
        e && (t.scrollLeft = s - (i.pageX - n))
    }), document.addEventListener("mouseup", () => {
        e && (e = !1, t.classList.remove("dragging"))
    }), t.addEventListener("touchstart", i => {
        i.touches.length === 1 && (o(i.target) || (e = !0, n = i.touches[0].pageX, s = t.scrollLeft, t.classList.add("dragging")))
    }, {
        passive: !0
    }), t.addEventListener("touchmove", i => {
        !e || i.touches.length !== 1 || (t.scrollLeft = s - (i.touches[0].pageX - n))
    }, {
        passive: !0
    }), t.addEventListener("touchend", () => {
        e = !1, t.classList.remove("dragging")
    })
}