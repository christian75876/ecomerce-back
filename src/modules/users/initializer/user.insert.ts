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
      SELECT email FROM users WHERE email  IN('admin@gmail.com')
      `);
    if (existingUser.length > 0) {
      console.log('Admin already exists, skipping insertion.');
      return;
    }

    await this.entityManager.query(`
      INSERT INTO users (email, password, role_id) VALUES ('admin@gmail.com', '$2b$10$bwoSfZaHYiiuqIcIC4dT4Oug4sjnGvG2q4p50lfSkIDj1v.rzYSd2', 1);
      `);
  }
}
