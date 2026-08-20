// 请求上下文日志中间件（可选包装器）
// 当前路由器不支持 .use 链式中间件，故以包装器形式提供；实际注册由各路由自行决定。

import { type HTTPRequest, type HTTPResponse } from '@songloft/plugin-sdk';
import { createContext } from '../../core/context';

export type RouteHandler = (req: HTTPRequest, params: Record<string, string>) => HTTPResponse | Promise<HTTPResponse>;

export function withContext(handler: RouteHandler): RouteHandler {
  return async (req, params) => {
    const ctx = await createContext(req);
    (req as any).__context = ctx;
    (req as any).__requestId = ctx.requestId;
    ctx.logger.debug(`${req.method} ${req.path}`);
    return await handler(req, params);
  };
}
