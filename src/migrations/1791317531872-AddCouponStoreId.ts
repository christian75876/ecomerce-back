import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCouponStoreId1791317531872 implements MigrationInterface {
    name = 'AddCouponStoreId1791317531872'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "coupons" DROP CONSTRAINT "UQ_e025109230e82925843f2a14c48"`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD "store_id" uuid`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD CONSTRAINT "FK_coupons_store_id" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_coupons_store_code_unique" ON "coupons" ("store_id", "code") WHERE "store_id" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_coupons_store_code_unique"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP CONSTRAINT "FK_coupons_store_id"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "store_id"`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD CONSTRAINT "UQ_e025109230e82925843f2a14c48" UNIQUE ("code")`);
    }
}
