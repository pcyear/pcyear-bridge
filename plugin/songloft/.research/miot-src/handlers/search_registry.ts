// MIoT 智能音箱插件 - 搜索源候选注册（插件间通信入口）
// 其他插件通过 songloft.comm.call('miot', 'register-search-provider', {...}) 把自己
// 登记为外部搜索源候选；miot 以宿主注入的可信 from 作为 entryPath 落盘。
// 注册表随后在 GET /search-providers 与内置 knownProviders 合并，供配置页下拉选择。

/// <reference types="@songloft/plugin-sdk" />

import { ConfigManager } from '../config/manager';

/** register-search-provider 的 payload（entryPath 不在此，以可信 from 为准） */
interface RegisterProviderPayload {
  name?: string;
  searchPath?: string;
  icon?: string;
}

/**
 * 注册搜索源候选相关的 comm 处理器。
 * 在插件 onInit 中调用一次即可（handler 常驻）。
 */
export function registerSearchProviderComm(configManager: ConfigManager): void {
  // 其他插件注册自己为搜索源候选。from 由宿主强制注入，插件无法伪造。
  songloft.comm.onMessage('register-search-provider', async (payload: unknown, from: string) => {
    const entryPath = (from || '').trim();
    if (!entryPath) {
      return { ok: false, error: 'missing caller identity' };
    }
    const p = (payload || {}) as RegisterProviderPayload;
    await configManager.upsertSearchProvider({
      entryPath,
      name: typeof p.name === 'string' ? p.name : entryPath,
      searchPath: typeof p.searchPath === 'string' ? p.searchPath : '',
      icon: typeof p.icon === 'string' ? p.icon : undefined,
    });
    songloft.log.info(`[search-registry] 已注册搜索源候选: ${entryPath} (${p.name || entryPath})`);
    return { ok: true };
  });

  // 提供方主动注销（可选；installed/active 校验也会过滤失效项）。
  songloft.comm.onMessage('unregister-search-provider', async (_payload: unknown, from: string) => {
    const entryPath = (from || '').trim();
    if (!entryPath) {
      return { ok: false, error: 'missing caller identity' };
    }
    await configManager.removeSearchProvider(entryPath);
    songloft.log.info(`[search-registry] 已注销搜索源候选: ${entryPath}`);
    return { ok: true };
  });
}
