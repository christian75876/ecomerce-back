import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

@Injectable()
export class InsertUserService {
  private readonly logger = new Logger(InsertUserService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  async insertAdminUser(): Promise<void> {
    const email = process.env.ADMIN_EMAIL;
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!email || !passwordHash) {
      this.logger.warn(
        'ADMIN_EMAIL/ADMIN_PASSWORD_HASH no están definidos — se omite la creación del usuario admin inicial.',
      );
      return;
    }

    const existingUser = await this.entityManager.query(
      `SELECT email FROM users WHERE email = $1`,
      [email],
    );
    if (existingUser.length > 0) {
      await this.entityManager.query(
        `UPDATE users SET is_email_verified = true WHERE email = $1`,
        [email],
      );
      this.logger.log('Admin already exists, skipping insertion.');
      return;
    }

    const [adminRole] = await this.entityManager.query(`
      SELECT id FROM roles WHERE name = 'admin' LIMIT 1
      `);

    if (!adminRole?.id) {
      this.logger.warn('Admin role does not exist, skipping admin user insertion.');
      return;
    }

    await this.entityManager.query(
      `
      INSERT INTO users (email, password, role_id, is_email_verified)
      VALUES ($1, $2, $3, true);
      `,
      [email, passwordHash, adminRole.id],
    );
  }
}
