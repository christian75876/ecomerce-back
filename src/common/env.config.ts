import { config } from 'dotenv';

config();
export const EnvConfig = () => ({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.PORT_DB),
  database: process.env.DATABASE_NAME,
  usernameDb: process.env.USERNAME_DB,
  password: process.env.DATABASE_PASSWORD,
  databaseSynchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
  databaseDropSchema: process.env.DATABASE_DROP_SCHEMA === 'true',
  databaseLogging: process.env.DATABASE_LOGGING === 'true',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587'),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  emailFrom: process.env.EMAIL_FROM,
  appName: process.env.APP_NAME || 'Ecommerce App',
  emailVerificationUrlBase:
    process.env.EMAIL_VERIFICATION_URL_BASE ||
    'http://localhost:5173/verify-email?token=',
});
