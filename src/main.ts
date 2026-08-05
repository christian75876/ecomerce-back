// Force UTC so all Date serialization is timezone-agnostic regardless of server OS.
process.env.TZ = 'UTC';

// Sentry must be initialized before any other imports.
import * as Sentry from '@sentry/node';
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  });
}

// SSL only for cloud databases (Aiven/Railway). Not needed for local Docker.
if (process.env.DB_SSL === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pg = require('pg');
  pg.defaults.ssl = { rejectUnauthorized: false };
}

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Logger as logger } from '@nestjs/common';
import { join } from 'path';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import 'reflect-metadata';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpErrorFilter } from './common/filters/error.filter';
import { globalValidationPipes } from './common/pipes/global.pipes';
import { setupSwagger } from './common/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Protect payment evidence files — require a valid JWT before serving.
  // Accepts token via Authorization header OR ?token= query param (needed for <img src> tags).
  app.use('/uploads/payment-evidence', (req: Request, res: Response, next: NextFunction) => {
    const headerToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const queryToken = (req.query?.token as string | undefined) ?? '';
    const token = headerToken || queryToken;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    try {
      jwt.verify(token, process.env.JWT_SECRET ?? '');
      next();
    } catch {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  });

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  const port = Number(process.env.PORT || 3000);
  app.setGlobalPrefix('api', { exclude: ['sitemap.xml', 'og/product/:id', 'og/store/:slug'] });
  setupSwagger(app);
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) cb(null, true);
      else cb(new Error(`CORS bloqueado: ${origin}`), false);
    },
    credentials: true,
  });
  app.useGlobalPipes(globalValidationPipes);
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpErrorFilter());
  await app.listen(port, '0.0.0.0');
  logger.log(`App running on port ${port}`);
}
bootstrap().catch((error) => {
  logger.error('Failed to bootstrap application', error);
  process.exit(1);
});
