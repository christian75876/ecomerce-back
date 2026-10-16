import { MigrationInterface, QueryRunner } from "typeorm";

// Decisión de negocio: los productos creados antes de existir el IVA se
// marcan como "IVA incluido" al 19%. Con INCLUDED el precio cobrado no cambia,
// solo se discrimina el IVA en recibos.
export class SetExistingProductsTaxIncluded1792000000001 implements MigrationInterface {
    name = 'SetExistingProductsTaxIncluded1792000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "products" SET "tax_mode" = 'INCLUDED', "tax_rate" = 19 WHERE "tax_mode" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No hay forma de distinguir los que se marcaron aquí de los que un
        // vendedor marcó después; se revierte todo INCLUDED a sin IVA.
        await queryRunner.query(`UPDATE "products" SET "tax_mode" = NULL WHERE "tax_mode" = 'INCLUDED'`);
    }
}
