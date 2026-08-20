// 开发版本号自动递增（铁律，见文档仓 development-documentation/README.md 变更记录）：
// 规则：1.4.52 → 1.4.52.1（首次进入开发）；1.4.52.1 → 1.4.52.2（每次打包开发位 +1）；
//       发版时手动把 version 改为主版本（如 1.4.53，去掉开发位）再构建。
import { readFileSync, writeFileSync, renameSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pjPath = join(root, 'plugin.json');
const pj = JSON.parse(readFileSync(pjPath, 'utf8'));
const v = String(pj.version || '').trim();
const m = v.match(/^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$/);
if (!m) {
  console.log('[bump-version] version 格式无法识别，跳过：' + v);
  process.exit(0);
}
const [, a, b, c, d] = m;
pj.version = d === undefined ? `${a}.${b}.${c}.1` : `${a}.${b}.${c}.${Number(d) + 1}`;
// Windows 下 plugin.json 可能被外部监视器（索引/同步）以共享读方式锁住，
// 直接 writeFileSync 会因请求独占写而 EPERM。改用「临时文件 + 原子 rename」：
// rename(MoveFileEx) 不打开文件读写，只改目录项，可绕过共享读锁。
const _tmp = pjPath + '.tmp-' + process.pid;
try {
  writeFileSync(_tmp, JSON.stringify(pj, null, 2) + '\n', 'utf8');
  renameSync(_tmp, pjPath);
} catch (e) {
  try { unlinkSync(_tmp); } catch {}
  console.warn('[bump-version] 无法写入 plugin.json（可能被外部进程以独占方式锁住，EPERM），跳过版本自增：' + (e && e.message ? e.message : e));
  console.warn('[bump-version] 当前版本保持为 ' + pj.version + '（如需自增请在无锁环境构建，或手动修改 plugin.json）');
}
console.log('[bump-version] version ' + v + ' -> ' + pj.version);
