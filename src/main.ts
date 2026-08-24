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

// Note: DB_SSL (Aiven/Railway) is handled per-connection in connection.db.config.ts
// and data-source.ts via `ssl: { rejectUnauthorized: false }` on the pg client options.
// We deliberately do NOT set process.env.NODE_TLS_REJECT_UNAUTHORIZED here anymore —
// that used to disable TLS certificate validation for the entire Node process,
// including unrelated outbound HTTPS calls (Turnstile, Cloudinary, SMTP, Sentry),
// not just the database connection.

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
import { OrdersService } from './modules/orders/orders.service';
import { PurchasesService } from './modules/purchases/purchases.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const ordersService = app.get(OrdersService);
  const purchasesService = app.get(PurchasesService);

  // Protect payment evidence files — require a valid JWT AND ownership of the order
  // (buyer, the store that sold it, or admin). A valid token alone used to be enough,
  // which let any logged-in account read any other order's payment proof.
  // Accepts token via Authorization header OR ?token= query param (needed for <img src> tags).
  app.use('/uploads/payment-evidence', async (req: Request, res: Response, next: NextFunction) => {
    const headerToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const queryToken = (req.query?.token as string | undefined) ?? '';
    const token = headerToken || queryToken;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    let payload: unknown;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET ?? '');
    } catch {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { sub, userId: userIdClaim } = payload as { sub?: number | string; userId?: number | string };
    const userId = Number(sub ?? userIdClaim);
    const filename = req.path.replace(/^\/+/, '');
    if (!userId || !filename) return res.status(403).json({ message: 'Forbidden' });

    try {
      const allowed = await ordersService.canAccessPaymentEvidence(filename, userId);
      if (!allowed) return res.status(403).json({ message: 'Forbidden' });
      next();
    } catch {
      return res.status(403).json({ message: 'Forbidden' });
    }
  });

  // Same protection as /uploads/payment-evidence above, for legacy purchase receipts
  // that still live on local disk (current uploads go straight to Cloudinary, but
  // this directory predates that migration and is still statically served below).
  app.use('/uploads/purchase-payments', async (req: Request, res: Response, next: NextFunction) => {
    const headerToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const queryToken = (req.query?.token as string | undefined) ?? '';
    const token = headerToken || queryToken;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    let payload: unknown;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET ?? '');
    } catch {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { sub, userId: userIdClaim } = payload as { sub?: number | string; userId?: number | string };
    const userId = Number(sub ?? userIdClaim);
    const filename = req.path.replace(/^\/+/, '');
    if (!userId || !filename) return res.status(403).json({ message: 'Forbidden' });

    try {
      const allowed = await purchasesService.canAccessPurchasePaymentEvidence(filename, userId);
      if (!allowed) return res.status(403).json({ message: 'Forbidden' });
      next();
    } catch {
      return res.status(403).json({ message: 'Forbidden' });
    }
  });

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  const port = Number(process.env.PORT || 3000);
  app.setGlobalPrefix('api', { exclude: ['/', 'robots.txt', 'health', 'sitemap.xml', 'og/product/:id', 'og/store/:slug'] });
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
