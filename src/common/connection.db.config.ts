import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { EnvConfig } from './env.config';
import { join } from 'path';

@Injectable()
export class DatabaseConfigService implements TypeOrmOptionsFactory {
  createTypeOrmOptions(): TypeOrmModuleOptions {
    const envConfig = EnvConfig();
    return {
      type: 'postgres',
      host: envConfig.host,
      port: envConfig.port,
      username: envConfig.usernameDb,
      password: envConfig.password,
      database: envConfig.database,
      entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
      autoLoadEntities: true,
      synchronize: envConfig.databaseSynchronize,
      dropSchema: envConfig.databaseDropSchema,
      logging: envConfig.databaseLogging,
      logger: 'advanced-console',
    };
  }
}
