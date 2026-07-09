import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { EnvConfig } from './env.config';
import { join } from 'path';

@Injectable()
export class DatabaseConfigService implements TypeOrmOptionsFactory {
  createTypeOrmOptions(): TypeOrmModuleOptions {
    const envConfig = EnvConfig();
    const databaseUrl = process.env.DATABASE_URL;

    const base: Partial<TypeOrmModuleOptions> = {
      type: 'postgres',
      entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
      autoLoadEntities: true,
      synchronize: envConfig.databaseSynchronize,
      dropSchema: envConfig.databaseDropSchema,
      logging: envConfig.databaseLogging,
      logger: 'advanced-console',
    };

    const useSSL = process.env.DB_SSL === 'true';

    if (databaseUrl) {
      return {
        ...base,
        type: 'postgres',
        url: databaseUrl,
        ...(useSSL ? { ssl: { rejectUnauthorized: false }, extra: { ssl: { rejectUnauthorized: false } } } : {}),
      } as TypeOrmModuleOptions;
    }

    return {
      ...base,
      type: 'postgres',
      host: envConfig.host,
      port: envConfig.port,
      username: envConfig.usernameDb,
      password: envConfig.password,
      database: envConfig.database,
    } as TypeOrmModuleOptions;
  }
}
