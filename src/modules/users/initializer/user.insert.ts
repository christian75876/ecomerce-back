import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

@Injectable()
export class InsertUserService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  async insertAdminUser(): Promise<void> {
    const existingUser = await this.entityManager.query(`
      SELECT email FROM users WHERE email IN('christian75876@gmail.com', 'admin@gmail.com')
      `);
    if (existingUser.length > 0) {
      await this.entityManager.query(`
        UPDATE users SET is_email_verified = true WHERE email IN('christian75876@gmail.com', 'admin@gmail.com')
        `);
      console.log('Admin already exists, skipping insertion.');
      return;
    }

    const [adminRole] = await this.entityManager.query(`
      SELECT id FROM roles WHERE name = 'admin' LIMIT 1
      `);

    if (!adminRole?.id) {
      console.log('Admin role does not exist, skipping admin user insertion.');
      return;
    }

    await this.entityManager.query(
      `
      INSERT INTO users (email, password, role_id, is_email_verified)
      VALUES ('christian75876@gmail.com', '$2b$10$Ns.Y8dk2kjJpDsmLQFHOZOuSMPWVuTtIyAFt8BlkCPX.fOWQ4PPtq', $1, true);
      `,
      [adminRole.id],
    );
  }
}
