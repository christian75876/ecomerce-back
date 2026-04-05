import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger as logger } from '@nestjs/common';
import 'reflect-metadata';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpErrorFilter } from './common/filters/error.filter';
import { globalValidationPipes } from './common/pipes/global.pipes';
import { setupSwagger } from './common/swagger.config';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const uploadsPath = join(process.cwd(), 'uploads');
  const reviewUploadsPath = join(uploadsPath, 'reviews');

  if (!existsSync(reviewUploadsPath)) {
    mkdirSync(reviewUploadsPath, { recursive: true });
  }

  app.setGlobalPrefix('api');
  setupSwagger(app);
  app.enableCors();
  app.use('/uploads', express.static(uploadsPath));
  app.useGlobalPipes(globalValidationPipes);
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpErrorFilter());
  await app.listen(process.env.PORT);
  logger.log(`App running on port ${process.env.PORT}`);
}
bootstrap();
