import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefreshTokens1787666580340 implements MigrationInterface {
    name = 'AddRefreshTokens1787666580340'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "refresh_tokens" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" integer NOT NULL,
                "token_hash" character varying NOT NULL,
                "expires_at" timestamp NOT NULL,
                "revoked_at" timestamp,
                "created_at" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "uq_refresh_tokens_token_hash" UNIQUE ("token_hash"),
                CONSTRAINT "pk_refresh_tokens" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    }
}
