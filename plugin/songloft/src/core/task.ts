// 后台任务管理
// 把扫描等长时任务从 adapter 内部抽出来，支持取消、进度查询与错误记录。

export type TaskStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled';

export interface TaskProgress {
  current: number;
  total?: number;
  message?: string;
}

export interface Task {
  id: string;
  type: string;
  sourceId: string;
  status: TaskStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  progress: TaskProgress;
  error?: string;
  cancel: () => void;
}

interface InternalTask extends Task {
  _promise: Promise<void>;
  _cancelled: boolean;
}

class TaskManager {
  private tasks = new Map<string, InternalTask>();
  private counter = 0;

  private genId(): string {
    this.counter = (this.counter + 1) % 1e6;
    return `task-${Date.now().toString(36)}-${this.counter.toString(36)}`;
  }

  /** 启动一个后台任务 */
  run<T>(
    type: string,
    sourceId: string,
    fn: (task: Task, setProgress: (p: TaskProgress) => void) => Promise<T>,
  ): Task {
    const id = this.genId();
    let task: InternalTask;

    const setProgress = (p: TaskProgress) => {
      task.progress = p;
    };

    const promise = (async () => {
      task.startedAt = Date.now();
      task.status = 'running';
      try {
        await fn(task, setProgress);
        if (!task._cancelled) {
          task.status = 'done';
        } else {
          task.status = 'cancelled';
        }
      } catch (e: any) {
        task.status = 'error';
        task.error = (e && e.message) || String(e);
      } finally {
        task.finishedAt = Date.now();
      }
    })();

    task = {
      id,
      type,
      sourceId,
      status: 'pending',
      createdAt: Date.now(),
      progress: { current: 0 },
      _promise: promise,
      _cancelled: false,
      cancel: () => {
        task._cancelled = true;
        if (task.status === 'pending' || task.status === 'running') {
          task.status = 'cancelled';
          task.finishedAt = Date.now();
        }
      },
    } as InternalTask;

    this.tasks.set(id, task);
    // 任务完成后保留一段时间再自动清理
    promise.finally(() => {
      setTimeout(() => this.tasks.delete(id), 10 * 60 * 1000);
    });
    return task;
  }

  get(id: string): Task | undefined {
    const t = this.tasks.get(id);
    if (!t) return undefined;
    const { _promise, _cancelled, ...rest } = t;
    return rest;
  }

  list(sourceId?: string): Task[] {
    const out: Task[] = [];
    for (const t of this.tasks.values()) {
      if (!sourceId || t.sourceId === sourceId) {
        const { _promise, _cancelled, ...rest } = t;
        out.push(rest);
      }
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** 取某个 source 最近一次的指定类型任务 */
  latest(sourceId: string, type: string): Task | undefined {
    return this.list(sourceId).find((t) => t.type === type);
  }
}

export const taskManager = new TaskManager();
