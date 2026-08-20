// 路由聚合入口

import { createRouter } from '@songloft/plugin-sdk';
import { registerSourceRoutes } from './sources';
import { registerLibraryRoutes } from './library';
import { registerSearchRoutes } from './search';
import { registerCoverRoutes } from './cover';
import { registerLyricRoutes } from './lyric';
import { registerImportRoutes } from './import';
import { registerFavoriteRoutes } from './favorite';
import { registerUiRoutes } from './ui';
import { registerDiagRoutes } from './diag';
import { registerUpdateRoutes } from './update';
import { registerMiotRoutes } from './miot';
import { registerCastRoutes } from './cast';

type Router = ReturnType<typeof createRouter>;

export function registerRoutes(router: Router): void {
  registerSourceRoutes(router);
  registerLibraryRoutes(router);
  registerSearchRoutes(router);
  registerCoverRoutes(router);
  registerLyricRoutes(router);
  registerImportRoutes(router);
  registerFavoriteRoutes(router);
  registerUiRoutes(router);
  registerDiagRoutes(router);
  registerUpdateRoutes(router);
  registerMiotRoutes(router);
  registerCastRoutes(router);
}
