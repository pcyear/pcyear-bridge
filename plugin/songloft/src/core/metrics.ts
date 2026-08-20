// 简单指标收集
// 统计请求数、错误数、缓存命中、各操作耗时，供 /diag/metrics 暴露。

export interface TimerEntry {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
}

export interface MetricsSnapshot {
  counters: Record<string, number>;
  timers: Record<string, TimerEntry>;
}

class Metrics {
  private counters = new Map<string, number>();
  private timers = new Map<string, TimerEntry>();

  inc(name: string, delta = 1): void {
    this.counters.set(name, (this.counters.get(name) || 0) + delta);
  }

  time<T>(name: string, fn: () => Promise<T>): Promise<T>;
  time<T>(name: string, fn: () => T): T;
  time<T>(name: string, fn: (() => T) | (() => Promise<T>)): T | Promise<T> {
    const t0 = Date.now();
    const done = (v: T) => { this.record(name, Date.now() - t0); return v; };
    const fail = (e: any) => { this.record(name, Date.now() - t0); throw e; };
    const r = fn();
    if (r && typeof (r as any).then === 'function') {
      return (r as Promise<T>).then(done, fail);
    }
    return done(r as T);
  }

  record(name: string, ms: number): void {
    const cur = this.timers.get(name);
    if (!cur) {
      this.timers.set(name, { count: 1, totalMs: ms, minMs: ms, maxMs: ms });
    } else {
      cur.count++;
      cur.totalMs += ms;
      if (ms < cur.minMs) cur.minMs = ms;
      if (ms > cur.maxMs) cur.maxMs = ms;
    }
  }

  snapshot(): MetricsSnapshot {
    const counters: Record<string, number> = {};
    for (const [k, v] of this.counters.entries()) counters[k] = v;
    const timers: Record<string, TimerEntry> = {};
    for (const [k, v] of this.timers.entries()) timers[k] = { ...v };
    return { counters, timers };
  }

  reset(): void {
    this.counters.clear();
    this.timers.clear();
  }
}

export const metrics = new Metrics();
