// 统一日志封装
// 提供结构化前缀与 child logger，方便按 requestId / sourceId / operation 过滤。

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  sourceId?: string;
  operation?: string;
  [key: string]: any;
}

function safeStringify(ctx: LogContext): string {
  const parts: string[] = [];
  if (ctx.requestId) parts.push(ctx.requestId);
  if (ctx.sourceId) parts.push(ctx.sourceId);
  if (ctx.operation) parts.push(ctx.operation);
  for (const key of Object.keys(ctx)) {
    if (key === 'requestId' || key === 'sourceId' || key === 'operation') continue;
    const v = ctx[key];
    if (v === undefined || v === null) continue;
    parts.push(`${key}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
  }
  return parts.length ? `[${parts.join('][')}] ` : '';
}

function nativeLog(level: LogLevel, message: string): void {
  const g = globalThis as any;
  const sl = g.songloft;
  if (sl && typeof sl.log === 'object' && sl.log) {
    const fn = sl.log[level];
    if (typeof fn === 'function') {
      try { fn(message); return; } catch { /* fallthrough */ }
    }
  }
  // 兜底：宿主日志不可用时直接打印到 stderr（某些 QuickJS 环境支持）
  try {
    const prefix = `[${level.toUpperCase()}] `;
    if (typeof g.print === 'function') g.print(prefix + message);
  } catch { /* ignore */ }
}

export class Logger {
  private ctx: LogContext;
  private prefix: string;

  constructor(ctx: LogContext = {}) {
    this.ctx = ctx;
    this.prefix = safeStringify(ctx);
  }

  /** 创建一个带额外上下文的子日志 */
  child(extra: LogContext): Logger {
    return new Logger({ ...this.ctx, ...extra });
  }

  debug(msg: string): void { nativeLog('debug', this.prefix + msg); }
  info(msg: string): void { nativeLog('info', this.prefix + msg); }
  warn(msg: string): void { nativeLog('warn', this.prefix + msg); }
  error(msg: string): void { nativeLog('error', this.prefix + msg); }

  /** 快捷方法：记录函数执行结果与耗时 */
  async timed<T>(op: string, fn: () => Promise<T>): Promise<T> {
    const child = this.child({ operation: op });
    const t0 = Date.now();
    try {
      const r = await fn();
      child.debug(`ok ${Date.now() - t0}ms`);
      return r;
    } catch (e: any) {
      child.warn(`fail ${Date.now() - t0}ms: ${(e && e.message) || String(e)}`);
      throw e;
    }
  }
}

/** 全局 root logger */
export const rootLogger = new Logger();
