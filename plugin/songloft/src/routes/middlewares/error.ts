// 统一错误处理中间件（可选包装器）
// 当前各路由已自行 try/catch 保持响应格式兼容；本文件保留统一包装能力供未来接入。

import { jsonResponse, type HTTPRequest, type HTTPResponse } from '@songloft/plugin-sdk';
import { toAppError } from '../../core/errors';

export type RouteHandler = (req: HTTPRequest, params: Record<string, string>) => HTTPResponse | Promise<HTTPResponse>;

export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (req, params) => {
    try {
      return await handler(req, params);
    } catch (e: any) {
      const err = toAppError(e);
      return jsonResponse(
        { ok: false, code: err.code, message: err.message, requestId: (req as any).__requestId },
        err.status || 500,
      );
    }
  };
}
