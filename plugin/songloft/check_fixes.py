# -*- coding: utf-8 -*-
"""彻底对账：逐项 grep 记忆里记录的修复特征，确认当前代码是否存活。"""
import os
BASE = os.path.dirname(os.path.abspath(__file__))
checks = [
    # 前端 app.js
    ("列表后台刷新 bgRefreshList", "static/js/app.js", "bgRefreshList"),
    ("顶部封面 backfill drill.coverId", "static/js/app.js", "drill.coverId"),
    ("删除音源 delSource op:delete", "static/js/app.js", '"delete"'),
    ("隐藏有声书 src_msm_audiobook", "static/js/app.js", "src_msm_audiobook"),
    ("非法访问 illegalAccess", "static/js/app.js", "illegalAccess"),
    ("download封面 dataUrl兼容", "static/js/app.js", "dataUrl"),
    ("详情页 np-cover-wrap", "static/js/app.js", "np-cover-wrap"),
    ("GEAK前端 TYPE_LABELS", "static/js/app.js", "TYPE_LABELS"),
    ("api SDK守卫 GET||POST", "static/js/app.js", '"GET"||e==="POST"'),
    ("版本占位 PLUGIN_VERSION", "static/js/app.js", "PLUGIN_VERSION"),
    # 后端 songloft.ts
    ("歌单封面 pickFirstDrawableCoverSong", "src/sources/songloft.ts", "pickFirstDrawableCoverSong"),
    ("封面压缩 COVER_MAX_WIDTH", "src/sources/songloft.ts", "COVER_MAX_WIDTH"),
    # 后端 sources.ts
    ("删除音源后端 handleDeleteSource", "src/routes/sources.ts", "handleDeleteSource"),
    ("删除音源后端 op=delete", "src/routes/sources.ts", "op=delete"),
    # 后端 library.ts
    ("飞牛聚合 fusedKey", "src/routes/library.ts", "fusedKey"),
    # geak
    ("GEAK源 geak", "src/sources/geak.ts", "geak"),
    # main.ts
    ("直连 FORCE_PROXY", "src/main.ts", "FORCE_PROXY"),
    # 构建脚本
    ("版本注入 __VERSION__", "scripts/gen-ui.mjs", "__VERSION__"),
    ("版本注入 build.mjs", "scripts/build.mjs", "__VERSION__"),
]
for label, f, p in checks:
    fp = os.path.join(BASE, f)
    try:
        lines = open(fp, encoding='utf-8', errors='replace').read().splitlines()
    except Exception as e:
        print("### %s [%s] 读取失败: %s" % (label, f, e)); continue
    hits = [i for i, l in enumerate(lines, 1) if p in l]
    mark = "OK" if hits else "!!! 缺失"
    print("### %s [%s] 命中%d  %s" % (label, f, len(hits), mark))
    for i in hits[:4]:
        seg = lines[i-1]
        if len(seg) > 170:
            seg = seg[:170] + "..."
        print("   L%d: %s" % (i, seg))
