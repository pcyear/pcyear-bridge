// WebDAV 适配器公共类型与工具函数

export const AUDIO_EXT = [
  'mp3', 'flac', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'wma', 'ape', 'alac', 'aiff', 'aif', 'dsf', 'dff', 'wv', 'mpc',
];

export interface DavEntry {
  href: string;        // 解码后的绝对路径（服务器路径部分）
  name: string;
  isDir: boolean;
  size?: number;
  contentType?: string;
}

/** 给 Promise 加超时：超时抛错（不中断原请求，但调用方可捕获继续） */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`请求超时（${ms}ms）`)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** 简单延时，用于「最多等首批扫描结果」的竞速 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
