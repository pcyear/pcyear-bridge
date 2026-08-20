// 统一错误分类
// 让后端响应与日志都携带明确的错误类型，方便前端降级与问题排查。

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: any;

  constructor(code: string, message: string, status: number, details?: any) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  toResponse(requestId?: string): Record<string, any> {
    const out: Record<string, any> = { ok: false, code: this.code, message: this.message };
    if (this.details !== undefined) out.details = this.details;
    if (requestId) out.requestId = requestId;
    return out;
  }
}

export class UserError extends AppError {
  constructor(message: string, details?: any) {
    super('USER_ERROR', message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super('NOT_FOUND', id ? `${resource} 不存在：${id}` : `${resource} 不存在`, 404, { resource, id });
  }
}

export class AuthError extends AppError {
  constructor(message = '鉴权失败') {
    super('AUTH_ERROR', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '无权访问') {
    super('FORBIDDEN', message, 403);
  }
}

export class ExternalError extends AppError {
  constructor(message: string, details?: any) {
    super('EXTERNAL_ERROR', message, 502, details);
  }
}

export class TimeoutError extends AppError {
  constructor(message = '操作超时', details?: any) {
    super('TIMEOUT', message, 504, details);
  }
}

export class InternalError extends AppError {
  constructor(message = '内部错误', details?: any) {
    super('INTERNAL_ERROR', message, 500, details);
  }
}

/** 把任意异常转成 AppError */
export function toAppError(e: any): AppError {
  if (e instanceof AppError) return e;
  const msg = (e && e.message) || String(e);
  if (typeof msg === 'string') {
    if (/timeout|超时/i.test(msg)) return new TimeoutError(msg);
    if (/auth|unauthorized|401/i.test(msg)) return new AuthError(msg);
    if (/not found|404|不存在/i.test(msg)) return new NotFoundError('资源');
  }
  return new InternalError(msg, e && e.stack ? String(e.stack) : undefined);
}
