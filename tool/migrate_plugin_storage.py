#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SongLoft 插件 KV/配置迁移：旧 entryPath(multisource-music) -> 新 entryPath(pcyear-bridge)

背景
----
把插件对外标识从 multisource-music 改名为 pcyear-bridge 后，SongLoft 宿主按 entryPath
隔离插件存储，导致旧的多媒体源配置、扫描缓存、songMap 等全部「留」在旧命名空间下，
新插件读不到，表现为：App/Web 调 /play-url 报 404「未找到音源」、/lyric 兜底失败等。

SongLoft 的存储有两套：
  1. 文件存储（songloft.storage 桥接）：
       <data 根>/jsplugins_data/<entryPath>/data/<key>      # 真正生效的 KV（含 msm_sources）
       <data 根>/jsplugins_data/<entryPath>/sources.json   # fs 镜像（兜底）
     static/ 是插件安装代码，切勿覆盖。
  2. SQLite 存储（songloft.persistentStorage 桥接）：
       <data 根>/songloft.db 的 plugin_storage 表
       (plugin_entry_path, key, value)，按 entryPath 隔离。

本工具做两件事：
  A. 把 jsplugins_data/<from>/ 下的【用户数据】复制到 <to>/，跳过 static/；
     其中 msm_sources 与 sources.json 做数组合并（按 id 去重），其余文件只补缺不覆盖。
  B. 把 songloft.db 中 plugin_storage 表里 plugin_entry_path=<from> 的行复制到 <to>
     （INSERT OR IGNORE，已存在的 <to> 行不被覆盖）。

重要
----
- 运行前请先【停止 SongLoft 服务】，避免 SQLite WAL 写入冲突 / 文件被占用。
- 本工具只【新增/补全】数据，不删除旧 <from> 行，可安全重跑。
- 数据根目录 = songloft.db 与 jsplugins_data/ 共同所在的目录（即启动参数 -db / 环境变量
  DB_PATH 指向文件的目录，默认 data/）。

用法
----
  python3 migrate_plugin_storage.py <data 根目录> \
      [--db <songloft.db 路径>] \
      [--from multisource-music] [--to pcyear-bridge] \
      [--dry-run]

示例
----
  # 先预览
  python3 migrate_plugin_storage.py /var/lib/songloft --dry-run
  # 确认无误后执行
  python3 migrate_plugin_storage.py /var/lib/songloft
  # Docker 场景（数据卷挂到 /srv/songloft/data）
  python3 migrate_plugin_storage.py /srv/songloft/data
"""
import argparse
import json
import os
import shutil
import sqlite3
import sys

CONFIG_FILES = ("msm_sources", "sources.json")  # 需要数组合并的配置


def log(msg):
    print(msg, flush=True)


def find_db(data_root, explicit=None):
    if explicit:
        if not os.path.isfile(explicit):
            raise SystemExit(f"[错误] 指定的 --db 不存在：{explicit}")
        return explicit
    for name in ("songloft.db", "mimusic.db"):
        p = os.path.join(data_root, name)
        if os.path.isfile(p):
            return p
    # 递归找一下，避免用户给的不是精确根目录
    for name in ("songloft.db", "mimusic.db"):
        for root, _dirs, files in os.walk(data_root):
            if name in files:
                return os.path.join(root, name)
    return None


def merge_sources(old_raw, new_raw):
    """合并两个 source 配置数组（JSON 文本），按 id 去重，旧配置优先补全。"""
    try:
        old_list = json.loads(old_raw) if old_raw else []
    except Exception:
        old_list = []
    try:
        new_list = json.loads(new_raw) if new_raw else []
    except Exception:
        new_list = []
    if not isinstance(old_list, list):
        old_list = []
    if not isinstance(new_list, list):
        new_list = []

    by_id = {}
    # 先放新的（若已存在 pcyear-bridge 配置，保留）
    for item in new_list:
        if isinstance(item, dict) and item.get("id"):
            by_id[item["id"]] = item
    # 旧的补缺（不覆盖已有 id）
    for item in old_list:
        if isinstance(item, dict) and item.get("id"):
            by_id.setdefault(item["id"], item)
        else:
            # 无 id 的项直接追加
            by_id.setdefault("__no_id_%d" % len(by_id), item)
    merged = list(by_id.values())
    return json.dumps(merged, ensure_ascii=False, indent=2)


def copy_tree(src_root, dst_root, dry_run):
    """复制 <from> 下的用户数据到 <to>，跳过 static/，配置文件合并、其余补缺。"""
    if not os.path.isdir(src_root):
        log(f"[跳过] 源目录不存在：{src_root}")
        return
    os.makedirs(dst_root, exist_ok=True)

    for entry in sorted(os.listdir(src_root)):
        src = os.path.join(src_root, entry)
        dst = os.path.join(dst_root, entry)
        if entry == "static":
            log(f"[跳过] static/（插件安装代码，不迁移）：{src}")
            continue
        if os.path.isdir(src):
            copy_tree(src, dst, dry_run)
        else:
            # 文件
            if entry in CONFIG_FILES:
                # 配置文件一律合并（按 id 去重）；目标不存在视为空
                old_raw = read_text(src)
                new_raw = read_text(dst) if os.path.isfile(dst) else ""
                merged = merge_sources(old_raw, new_raw)
                if dry_run:
                    n_old = len(json.loads(old_raw)) if old_raw else 0
                    log(f"[合并(预览)] {dst}  <-  合并 {entry}（旧 {n_old} 条 + 新）")
                else:
                    with open(dst, "w", encoding="utf-8") as f:
                        f.write(merged)
                    log(f"[合并] {dst}（按 id 去重）")
            elif os.path.isfile(dst):
                log(f"[跳过] 目标已存在，不覆盖：{dst}")
            else:
                if dry_run:
                    log(f"[复制(预览)] {dst}")
                else:
                    shutil.copy2(src, dst)
                    log(f"[复制] {dst}")


def read_text(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""


def migrate_sqlite(db_path, src_ep, dst_ep, dry_run):
    if not db_path or not os.path.isfile(db_path):
        log(f"[跳过] 未找到 SQLite 数据库（{db_path}），跳过 plugin_storage 表迁移。")
        return
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='plugin_storage'"
        )
        if not cur.fetchone():
            log("[跳过] plugin_storage 表不存在，跳过。")
            conn.close()
            return
        cur.execute(
            "SELECT COUNT(*) FROM plugin_storage WHERE plugin_entry_path=?", (src_ep,)
        )
        n = cur.fetchone()[0]
        if n == 0:
            log(f"[跳过] plugin_storage 中无 {src_ep} 的行。")
            conn.close()
            return
        if dry_run:
            log(f"[SQL 预览] 将把 plugin_storage 中 {n} 行 {src_ep} -> {dst_ep}（INSERT OR IGNORE）")
            conn.close()
            return
        cur.execute(
            """
            INSERT INTO plugin_storage (plugin_entry_path, key, value, created_at, updated_at)
            SELECT ?, key, value, created_at, updated_at
            FROM plugin_storage WHERE plugin_entry_path=?
            ON CONFLICT(plugin_entry_path, key) DO NOTHING
            """,
            (dst_ep, src_ep),
        )
        conn.commit()
        cur.execute(
            "SELECT COUNT(*) FROM plugin_storage WHERE plugin_entry_path=?", (dst_ep,)
        )
        log(f"[SQL] 已复制 {n} 行：{src_ep} -> {dst_ep}（当前 {dst_ep} 共 {cur.fetchone()[0]} 行）")
        conn.close()
    except Exception as e:
        log(f"[错误] SQLite 迁移失败：{e}")


def main():
    ap = argparse.ArgumentParser(description="迁移 SongLoft 插件存储：旧 entryPath -> 新 entryPath")
    ap.add_argument("data_root", help="数据根目录（songloft.db 与 jsplugins_data/ 所在目录）")
    ap.add_argument("--db", help="显式指定 songloft.db 路径")
    ap.add_argument("--from", dest="src_ep", default="multisource-music")
    ap.add_argument("--to", dest="dst_ep", default="pcyear-bridge")
    ap.add_argument("--dry-run", action="store_true", help="仅预览，不实际写入")
    args = ap.parse_args()

    data_root = os.path.abspath(args.data_root)
    if not os.path.isdir(data_root):
        raise SystemExit(f"[错误] 数据根目录不存在：{data_root}")

    db_path = find_db(data_root, args.db)
    log("=" * 60)
    log(f"数据根目录 : {data_root}")
    log(f"数据库     : {db_path or '(未找到)'}")
    log(f"迁移       : {args.src_ep} -> {args.dst_ep}")
    log(f"模式       : {'预览(dry-run)' if args.dry_run else '执行'}")
    log("=" * 60)

    src_dir = os.path.join(data_root, "jsplugins_data", args.src_ep)
    dst_dir = os.path.join(data_root, "jsplugins_data", args.dst_ep)

    log("\n--- A. 文件系统 KV（jsplugins_data/<entryPath>/...）---")
    copy_tree(src_dir, dst_dir, args.dry_run)

    log("\n--- B. SQLite plugin_storage 表 ---")
    migrate_sqlite(db_path, args.src_ep, args.dst_ep, args.dry_run)

    log("\n完成。请重启 SongLoft 服务后再验证（Web/App 调 /play-url 应不再 404）。")


if __name__ == "__main__":
    main()
