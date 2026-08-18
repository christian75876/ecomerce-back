import { config } from 'dotenv';

config();

import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'path';

const databaseUrl = process.env.DATABASE_URL;
const useSSL = process.env.DB_SSL === 'true';

const base = {
  type: 'postgres' as const,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
  migrationsTableName: 'migrations',
};

const options: DataSourceOptions = databaseUrl
  ? ({
      ...base,
      url: databaseUrl,
      ...(useSSL && { ssl: { rejectUnauthorized: false } }),
    } as DataSourceOptions)
  : ({
      ...base,
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.PORT_DB || '5432', 10),
      username: process.env.USERNAME_DB,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
    } as DataSourceOptions);

export default new DataSource(options);
