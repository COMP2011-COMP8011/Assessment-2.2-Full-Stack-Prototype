import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { corsOptions } from './config/cors.js';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import api from './routes/index.js';

/** Builds the Express app (kept separate from server.js so tests can use it without a port). */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);

  // The API is called from another origin (the Vite app), so allow cross-origin reads of responses.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '100kb' }));
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  // Responses depend on who is signed in: browsers may keep them but must revalidate (ETag → 304).
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'private, no-cache');
    next();
  });

  // Canonical, versioned base path from Assessment 1 (§4 "Base URL: /api/v1").
  app.use('/api/v1', api);
  // Unversioned alias so the paths quoted in the 2.2 brief (e.g. /api/users) also work.
  app.use('/api', api);

  app.get('/', (_req, res) => res.json({ name: 'TaskParty API', health: '/api/v1/health' }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
