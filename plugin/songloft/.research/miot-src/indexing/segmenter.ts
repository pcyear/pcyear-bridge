// MIoT 智能音箱插件 - 轻量中文切分 + 拼音查表
// 运行时不导入 pinyin-pro / segmentit，避免 ARM QuickJS 在 import 阶段同步初始化大词典。

/// <reference types="@songloft/plugin-sdk" />

import { pinyinMap } from '../data/pinyin-map';

/**
 * 口语停用词/助词：切分后剔除。
 * 注意：这里只过滤独立 token，不在词内部拆字，避免误伤歌名。
 */
const EXTRA_STOPWORDS = new Set<string>([
  '我', '你', '他', '她', '想', '要', '听', '想听', '放', '播', '播放',
  '来', '点', '首', '那', '这', '那首', '这首', '一首', '一下', '一',
  '了', '吧', '啊', '嘛', '呢', '请', '帮', '帮我', '给', '给我',
  '唱', '歌', '歌曲', '音乐', '换', '再', '给我来', '来一首', '来首',
  '的', '和', '与', '跟', '或', '着', '把',
]);

const SPLIT_RE = /[\s，,、。.!！?？;；:："'“”‘’（）()【】\[\]《》<>/\\|]+/;

/**
 * 对 query 做轻量切分并剔除口语停用词。
 * 分词能力有意降级为空格/标点切分，换取 QuickJS import 阶段零词典初始化成本。
 */
export function segmentQuery(query: string): string[] {
  const q = (query || '').trim();
  if (!q) return [];

  const words = q.split(SPLIT_RE).map(w => w.trim()).filter(w => w.length > 0);
  const out = words.filter(w => !EXTRA_STOPWORDS.has(w));

  // 全是停用词时保留原始切分，避免 query 变空导致零命中。
  return out.length > 0 ? out : words;
}

/**
 * 转拼音（无声调，音节以空格分隔，小写）。非中文连续字符原样合并。
 * 中文拼音来自构建期生成的静态映射表，运行时只做 O(n) 查表。
 */
export function toPinyin(text: string): string {
  const t = (text || '').trim();
  if (!t) return '';

  const parts: string[] = [];
  let nonZh = '';

  const flushNonZh = (): void => {
    const value = nonZh.trim();
    if (value) {
      parts.push(value);
    }
    nonZh = '';
  };

  for (const ch of Array.from(t)) {
    const py = pinyinMap[ch];
    if (py) {
      flushNonZh();
      parts.push(py);
    } else {
      nonZh += ch;
    }
  }
  flushNonZh();

  return parts.join(' ').trim().toLowerCase();
}
