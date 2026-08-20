#!/usr/bin/env python3
"""
SongLoft 数据库迁移脚本：把旧插件名 multisource-music 统一改为 pcyear-bridge。

背景：项目从 fnmusic-bridge/multisource-music 改名为 pcyear-bridge 后，
SongLoft 数据库里已入库歌曲的 plugin_entry_path / source_data.provider / dedup_key
仍是旧名，导致宿主 /api/v1/songs/{id}/play 返回 502：
  plugin multisource-music invocation failed: plugin multisource-music not available

本脚本直接修改 SQLite 数据库（SongLoft 默认用 SQLite），把相关字段替换成新名。

用法（在 SongLoft 服务器上执行）：
  python3 migrate_songloft_provider.py /path/to/songloft.db

常见数据库位置（供参考）：
  - /var/lib/songloft/songloft.db
  - /opt/songloft/data/songloft.db
  - ~/.config/songloft/songloft.db
  - ~/.local/share/songloft/songloft.db
  - /app/data/songloft.db（部分 Docker 镜像）

如果是 Docker 部署，先进入容器再执行：
  docker exec -it <container> sh
  python3 /path/to/migrate_songloft_provider.py /app/data/songloft.db

执行前务必先备份数据库！
"""
import sqlite3
import sys
import shutil
from pathlib import Path

OLD = 'multisource-music'
NEW = 'pcyear-bridge'


def migrate(db_path: str) -> None:
    p = Path(db_path)
    if not p.exists():
        print(f'数据库不存在：{db_path}', file=sys.stderr)
        sys.exit(1)

    backup = p.with_suffix('.db.bak')
    shutil.copy2(p, backup)
    print(f'已备份到：{backup}')

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # 确认表存在
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='songs'")
    if not cur.fetchone():
        print("未找到 songs 表，请确认数据库路径正确。", file=sys.stderr)
        sys.exit(1)

    # 先统计受影响行数
    cur.execute('SELECT COUNT(*) FROM songs WHERE plugin_entry_path = ?', (OLD,))
    before = cur.fetchone()[0]
    print(f'plugin_entry_path={OLD} 的歌曲数：{before}')

    # 执行替换
    cur.execute(
        """
        UPDATE songs
        SET plugin_entry_path = ?,
            source_data = REPLACE(source_data, '"provider":"' || ? || '"', '"provider":"' || ? || '"'),
            dedup_key = REPLACE(dedup_key, ? || ':', ? || ':'),
            source_cover_url = REPLACE(source_cover_url, '/api/v1/jsplugin/' || ? || '/', '/api/v1/jsplugin/' || ? || '/')
        WHERE plugin_entry_path = ?
        """,
        (NEW, OLD, NEW, OLD, NEW, OLD, NEW, OLD),
    )
    updated = cur.rowcount
    conn.commit()

    cur.execute('SELECT COUNT(*) FROM songs WHERE plugin_entry_path = ?', (OLD,))
    after = cur.fetchone()[0]
    conn.close()

    print(f'已更新 {updated} 行，剩余 plugin_entry_path={OLD} 的歌曲数：{after}')
    if after > 0:
        print('警告：仍有部分歌曲未更新，可能 source_data 格式特殊，请手动检查。', file=sys.stderr)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(f'用法：{sys.argv[0]} <songloft.db 路径>', file=sys.stderr)
        sys.exit(1)
    migrate(sys.argv[1])
