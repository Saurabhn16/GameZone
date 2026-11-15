import path from 'node:path';

import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';

import type { AppConfig } from '../config.js';
import { AppError, asAppError, toErrorBody } from '../rooms/errors.js';
import { RoomService } from '../rooms/room-service.js';
import { registerApiRoutes } from './routes.js';

export interface AppContext {
  app: Express;
  service: RoomService;
  config: AppConfig;
}

function applyCors(app: Express, config: AppConfig): void {
  if (config.corsOrigin === false) {
    return;
  }
  app.use(cors({ origin: config.corsOrigin, credentials: false }));
}

/** JSON 404 for unknown API routes; the SPA fallback handles everything else. */
function applyApiNotFound(app: Express): void {
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({
      error: { code: 'not_found', message: `No API route matches ${req.method} ${req.originalUrl}.` },
    });
  });
}

function applyErrorHandler(app: Express): void {
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const appError = asAppError(error);
    if (appError.status >= 500) {
      console.error('[bingo-arena] request failed:', appError.message);
    }
    res.status(appError.status).json(toErrorBody(appError));
  });
}

export function createApp(config: AppConfig, service = new RoomService({
  capacity: config.roomCapacity,
  defaultRules: config.defaultRules,
})): AppContext {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  applyCors(app, config);

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: '0.1.0',
      uptimeSeconds: Math.round(process.uptime()),
      rooms: service.store.size,
    });
  });

  registerApiRoutes(app, service);
  applyApiNotFound(app);

  app.use(
    express.static(config.staticDir, {
      index: 'index.html',
      extensions: ['html'],
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  // Single-page app fallback: any non-API GET returns the shell so deep links work.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      next();
      return;
    }
    res.sendFile(path.join(config.staticDir, 'index.html'), (error) => {
      if (error) {
        next(new AppError('not_found', 'Not found.', 404));
      }
    });
  });

  applyErrorHandler(app);

  return { app, service, config };
}
