/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VOSK_MODEL_ARCHIVE_ROUTE } from '@/common/config/voice';

vi.mock('@process/services/database', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('@process/utils/initStorage', () => ({
  getSystemDir: vi.fn(() => ({
    cacheDir: '/tmp/aion-cache',
  })),
}));

vi.mock('@process/webserver/auth/middleware/TokenMiddleware', () => ({
  TokenMiddleware: {
    validateToken: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  },
}));

vi.mock('@process/extensions', () => ({
  ExtensionRegistry: {
    getInstance: () => ({
      getWebuiContributions: () => [],
      getLoadedExtensions: () => [],
    }),
  },
}));

vi.mock('@process/bridge/pptPreviewBridge', () => ({
  isActivePreviewPort: () => false,
}));

vi.mock('@process/webserver/directoryApi', () => {
  const router = express.Router();
  return {
    default: router,
  };
});

vi.mock('@process/webserver/middleware/security', () => ({
  apiRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

function getRegisteredGetRoutePaths(app: express.Express): string[] {
  return app.router.stack
    .filter(
      (layer: { route?: { path: string | RegExp; methods?: Record<string, boolean> } }) => layer.route?.methods?.get
    )
    .map((layer: { route?: { path: string | RegExp } }) => layer.route?.path)
    .filter((value): value is string => typeof value === 'string');
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('registerApiRoutes vosk archive route', () => {
  it('registers the explicit tar.gz route for web speech recognition', async () => {
    const { registerApiRoutes } = await import('@process/webserver/routes/apiRoutes');
    const app = express();

    registerApiRoutes(app);

    expect(getRegisteredGetRoutePaths(app)).toContain(VOSK_MODEL_ARCHIVE_ROUTE);
  });

  it('keeps the legacy alias route registered for compatibility', async () => {
    const { registerApiRoutes } = await import('@process/webserver/routes/apiRoutes');
    const app = express();

    registerApiRoutes(app);

    expect(getRegisteredGetRoutePaths(app)).toContain('/api/vosk-model');
  });
});
