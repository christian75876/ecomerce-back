import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStoreHideLocation1787512189089 implements MigrationInterface {
    name = 'AddStoreHideLocation1787512189089'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stores" ADD "hide_location" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN "hide_location"`);
    }
}
