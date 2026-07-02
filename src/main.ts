// Force SSL for all pg connections (required for Aiven/cloud PostgreSQL)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pg = require('pg');
pg.defaults.ssl = { rejectUnauthorized: false };

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger as logger } from '@nestjs/common';
import 'reflect-metadata';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpErrorFilter } from './common/filters/error.filter';
import { globalValidationPipes } from './common/pipes/global.pipes';
import { setupSwagger } from './common/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT || 3000);
  app.setGlobalPrefix('api');
  setupSwagger(app);
  app.enableCors();
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
