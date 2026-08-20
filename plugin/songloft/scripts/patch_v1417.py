# v1.4.17 列表懒加载「可视数量 × 2」预加载
# 1) LIST_PAGE_SIZE 固定 50 → listPageSize() 动态：可视条数 × 2（行高按视图估算，保底 20，上限 100）
# 2) 封面/元数据懒加载 rootMargin 固定 200px → listPreloadPx()：1 倍可视高度（扩展一倍），保底 200
import io

p = 'static/js/app.js'
s = io.open(p, 'r', encoding='utf-8').read()

# ---- 1. LIST_PAGE_SIZE 定义 → 动态函数 ----
old = 'const LIST_PAGE_SIZE=50;'
new = ('function listPageSize(){const e=document.getElementById("content");'
       'if(!e||!e.clientHeight)return 50;'
       'const t=drill||view==="tracks"?56:200;'
       'return Math.min(100,Math.max(20,Math.ceil(e.clientHeight/t)*2))}'
       'function listPreloadPx(){const e=document.getElementById("content");'
       'return Math.max(200,e&&e.clientHeight||0)}')
assert old in s, 'anchor1 LIST_PAGE_SIZE def not found'
s = s.replace(old, new, 1)

# ---- 2. 所有 ${LIST_PAGE_SIZE} → ${listPageSize()}（应恰好 8 处）----
n = s.count('${LIST_PAGE_SIZE}')
assert n == 8, 'LIST_PAGE_SIZE usage count=%d != 8' % n
s = s.replace('${LIST_PAGE_SIZE}', '${listPageSize()}')

# ---- 3. 两处 rootMargin 固定 200px → 动态 1 倍可视高度 ----
old2 = 'rootMargin:"200px 0px"'
assert s.count(old2) == 2, 'rootMargin count=%d != 2' % s.count(old2)
s = s.replace(old2, 'rootMargin:listPreloadPx()+"px 0px"')

# ---- 4. 版本 1.4.16 -> 1.4.17 ----
s = s.replace('1.4.16', '1.4.17')
io.open(p, 'w', encoding='utf-8').write(s)

q = 'plugin.json'
t = io.open(q, 'r', encoding='utf-8').read()
t = t.replace('1.4.16', '1.4.17')
io.open(q, 'w', encoding='utf-8').write(t)

print('patched OK')
