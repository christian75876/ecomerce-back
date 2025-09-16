import { config } from 'dotenv';

config();
export const EnvConfig = () => ({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.PORT_DB),
  database: process.env.DATABASE_NAME,
  usernameDb: process.env.USERNAME_DB,
  password: process.env.DATABASE_PASSWORD,
});
