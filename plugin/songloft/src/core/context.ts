// 请求上下文
// 每个请求生成唯一 requestId，解析 sourceId，并挂载日志与指标。

import { HTTPRequest } from '@songloft/plugin-sdk';
import { Logger } from './logger';
import { defaultSourceId, loadConfigs, builtinSongloftConfig, SONGLOFT_SOURCE_ID } from '../manager';

let reqCounter = 0;

export interface RequestContext {
  requestId: string;
  sourceId?: string;
  startedAt: number;
  logger: Logger;
}

function parseQueryRaw(req: HTTPRequest): Record<string, string> {
  const raw = (req.query || '') as string;
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const part of raw.split('&')) {
    const [k, v] = part.split('=');
    if (!k) continue;
    try { out[decodeURIComponent(k)] = v ? decodeURIComponent(v) : ''; } catch { out[k] = v || ''; }
  }
  return out;
}

function genRequestId(): string {
  reqCounter = (reqCounter + 1) % 1e6;
  return `${Date.now().toString(36)}-${reqCounter.toString(36)}`;
}

export async function resolveSourceId(req: HTTPRequest): Promise<string | null> {
  const qs = parseQueryRaw(req);
  let sid = qs.sourceId || qs.source_id;
  if (sid) return sid;

  // POST body 中也可能带 sourceId
  try {
    const body = req.body;
    let text = '';
    if (typeof body === 'string') text = body;
    else if (body instanceof Uint8Array) text = new TextDecoder().decode(body);
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed && parsed.sourceId) return String(parsed.sourceId);
    }
  } catch { /* ignore */ }

  const configs = await loadConfigs();
  const hasBuiltin = configs.some((c) => c.id === SONGLOFT_SOURCE_ID);
  const all = hasBuiltin ? configs : [builtinSongloftConfig(), ...configs];
  return defaultSourceId(all);
}

export async function createContext(req: HTTPRequest): Promise<RequestContext> {
  const requestId = genRequestId();
  const sid = await resolveSourceId(req);
  const logger = new Logger({ requestId, sourceId: sid || undefined });
  return { requestId, sourceId: sid || undefined, startedAt: Date.now(), logger };
}
