import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAllocationRestoredAt1787593650807 implements MigrationInterface {
    name = 'AddAllocationRestoredAt1787593650807'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "inventory_batch_allocations" ADD "restored_at" timestamp`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "inventory_batch_allocations" DROP COLUMN "restored_at"`);
    }
}
