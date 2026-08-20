// WebDAV 元数据：文件 → Track、集合 id 编解码、音频/图片判断

import { Track } from '../../types';
import { AUDIO_EXT, DavEntry } from './types';

export class WebDavMetadata {
  private sourceId: string;
  private roots: string[];
  readonly relToRoot: Map<string, string>;

  constructor(sourceId: string, roots: string[], relToRoot: Map<string, string>) {
    this.sourceId = sourceId;
    this.roots = roots;
    this.relToRoot = relToRoot;
  }

  private normalize(p: string): string {
    return ('/' + p).replace(/\/+/g, '/').replace(/\/$/, '');
  }

  get rootList(): string[] {
    return this.roots.length ? this.roots : ['/'];
  }

  /** 相对路径 → 该 root 下的绝对路径 */
  absUnder(root: string, rel: string): string {
    const base = root === '/' ? '' : root;
    return this.normalize((base ? base + '/' : '/') + (rel || ''));
  }

  /** 把相对 root 的 rel 拼成完整服务器路径（多 root 时按 relToRoot 反查） */
  absOf(rel: string): string {
    const root = this.relToRoot.get(rel) || this.roots[0] || '/';
    const base = root === '/' ? '' : root;
    return this.normalize((base ? base + '/' : '/') + rel);
  }

  isAudio(name: string): boolean {
    const i = name.lastIndexOf('.');
    if (i < 0) return false;
    return AUDIO_EXT.indexOf(name.slice(i + 1).toLowerCase()) >= 0;
  }

  /** 是否图片文件（封面侧车图 / cover.jpg 等） */
  isImage(name: string): boolean {
    const i = name.lastIndexOf('.');
    if (i < 0) return false;
    const ext = name.slice(i + 1).toLowerCase();
    return ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp' || ext === 'gif' || ext === 'bmp';
  }

  /**
   * 从路径推断元数据。
   * 相对根目录的层级：
   *   a/b/file → artist=a, album=b
   *   a/file   → album=a（艺术家未知）
   *   file     → 都未知
   * 文件名形如「艺术家 - 标题」时优先用它。
   */
  fileToTrack(e: DavEntry, root: string): Track {
    const rel = e.href.slice(root === '/' ? 0 : root.length).replace(/^\/+/, '');
    const segs = rel.split('/');
    const filename = segs[segs.length - 1];
    const dot = filename.lastIndexOf('.');
    const stem = dot > 0 ? filename.slice(0, dot) : filename;
    const ext = dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';

    let artist = '未知艺术家';
    let album = segs.length >= 2 ? segs[segs.length - 2] : '未知专辑';
    if (segs.length >= 3) artist = segs[segs.length - 3];

    let title = stem;
    // 「01. 艺术家 - 标题」/「艺术家 - 标题」
    const dash = stem.split(' - ');
    if (dash.length >= 2) {
      const left = dash[0].replace(/^\d+[.\-\s]*/, '').trim();
      const right = dash.slice(1).join(' - ').trim();
      if (left && right) {
        if (artist === '未知艺术家') artist = left;
        title = right;
      }
    } else {
      title = stem.replace(/^\d+[.\-\s]+/, '').trim() || stem;
    }

    const trackNoM = filename.match(/^(\d{1,3})[.\-\s]/);

    const track: Track = {
      id: rel,                 // 用相对路径作为 ID，天然唯一且可直接定位
      title,
      artist,
      album,
      trackNo: trackNoM ? parseInt(trackNoM[1], 10) : undefined,
      size: e.size,
      codec: ext,
      path: e.href,
      // 用相对路径作为封面标识：/cover-data 会据此探测同目录下的 cover.jpg 等
      coverId: rel,
      _source: this.sourceId,
    };
    // 记录所属 root 并随 Track 持久化：从 KV 恢复扫描结果时没有走过 fileToTrack，
    // 若不带 _root 就无法重建 relToRoot，absOf 会回落 roots[0] 拼出错误路径 → 封面/播放全失败。
    (track as any)._root = root;
    this.relToRoot.set(rel, root);
    return track;
  }

  /** 集合 id ↔ (root, 相对目录) 互转。多 root 时用 r<idx>: 前缀区分，单 root 时 id 就是相对路径。 */
  mkId(root: string, rel: string): string {
    const idx = this.rootList.indexOf(root);
    return (this.rootList.length > 1 && idx > 0) ? `r${idx}:${rel}` : rel;
  }

  /** 解析集合 id 为 (root, rel)；兼容历史的「艺术家||专辑」名字型 id */
  parseCollectionId(id: string): { root: string; rel: string } {
    const roots = this.rootList;
    if (id && id.indexOf('||') >= 0) {
      const parts = id.split('||');
      const artist = parts[0] === '未知艺术家' ? '' : parts[0];
      const album = (!parts[1] || parts[1] === '未知专辑') ? '' : parts[1];
      return { root: roots[0], rel: [artist, album].filter(Boolean).join('/') };
    }
    const m = /^r(\d+):([\s\S]*)$/.exec(id || '');
    if (m) {
      const i = parseInt(m[1], 10);
      return { root: roots[i] || roots[0], rel: m[2] };
    }
    const rel = (id === '未知艺术家' || id === '未知专辑') ? '' : (id || '');
    return { root: roots[0], rel };
  }
}
