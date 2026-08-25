import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

@Injectable()
export class RoleSeederService {
  private readonly logger = new Logger(RoleSeederService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  async insertRoles(): Promise<void> {
    const existingRoles = await this.entityManager.query(`
      SELECT name FROM roles WHERE name IN ('admin', 'seller','buyer')
      `);

    if (existingRoles.length > 0) {
      this.logger.log('Roles already exist, skipping insertion.');
      return;
    }

    await this.entityManager.query(`
      INSERT INTO roles (name) VALUES
      ('admin'),
      ('buyer'),
      ('seller')
    `);
  }
}
