import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductTaxMode1792000000000 implements MigrationInterface {
    name = 'AddProductTaxMode1792000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" ADD "tax_mode" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "products" ADD "tax_rate" numeric(5,2) NOT NULL DEFAULT '19'`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD "tax_rate" numeric(5,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD "tax_amount" numeric(12,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "tax_total" numeric(12,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "sale_items" ADD "tax_rate" numeric(5,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "sale_items" ADD "tax_amount" numeric(12,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "sales" ADD "tax_total" numeric(12,2) NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "tax_total"`);
        await queryRunner.query(`ALTER TABLE "sale_items" DROP COLUMN "tax_amount"`);
        await queryRunner.query(`ALTER TABLE "sale_items" DROP COLUMN "tax_rate"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "tax_total"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "tax_amount"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "tax_rate"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "tax_rate"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "tax_mode"`);
    }
}
