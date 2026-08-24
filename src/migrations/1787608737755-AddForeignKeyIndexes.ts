import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds indexes on foreign-key columns that were previously unindexed, plus a
 * UNIQUE constraint on users.email. Without these, lookups by customer/product/
 * store/etc. force a sequential scan that gets slower as each table grows —
 * this was flagged across orders, order_items, products, sales, purchases,
 * inventory_*, customers, reviews and cash_* in the performance audit.
 *
 * NOTE: the UNIQUE constraint on users.email will fail to apply if the table
 * already contains duplicate emails. If this migration fails on that step,
 * de-duplicate existing rows first, then re-run it.
 */
export class AddForeignKeyIndexes1787608737755 implements MigrationInterface {
  name = 'AddForeignKeyIndexes1787608737755';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "uq_users_email" UNIQUE ("email")`,
    );

    await queryRunner.query(`CREATE INDEX "idx_orders_customer_id" ON "orders" ("customer_id")`);

    await queryRunner.query(`CREATE INDEX "idx_order_items_order_id" ON "order_items" ("order_id")`);
    await queryRunner.query(`CREATE INDEX "idx_order_items_product_id" ON "order_items" ("product_id")`);

    await queryRunner.query(`CREATE INDEX "idx_products_category_id" ON "products" ("category_id")`);
    await queryRunner.query(`CREATE INDEX "idx_products_store_id" ON "products" ("store_id")`);
    await queryRunner.query(`CREATE INDEX "idx_products_supplier_id" ON "products" ("supplier_id")`);
    await queryRunner.query(`CREATE INDEX "idx_products_menu_category_id" ON "products" ("menu_category_id")`);

    await queryRunner.query(`CREATE INDEX "idx_sales_customer_id" ON "sales" ("customer_id")`);
    await queryRunner.query(`CREATE INDEX "idx_sales_store_id" ON "sales" ("store_id")`);
    await queryRunner.query(`CREATE INDEX "idx_sale_items_sale_id" ON "sale_items" ("sale_id")`);
    await queryRunner.query(`CREATE INDEX "idx_sale_items_product_id" ON "sale_items" ("product_id")`);

    await queryRunner.query(`CREATE INDEX "idx_purchases_supplier_id" ON "purchases" ("supplier_id")`);
    await queryRunner.query(`CREATE INDEX "idx_purchases_store_id" ON "purchases" ("store_id")`);
    await queryRunner.query(`CREATE INDEX "idx_purchase_items_purchase_id" ON "purchase_items" ("purchase_id")`);
    await queryRunner.query(`CREATE INDEX "idx_purchase_items_product_id" ON "purchase_items" ("product_id")`);

    await queryRunner.query(`CREATE INDEX "idx_inventory_batches_product_id" ON "inventory_batches" ("product_id")`);
    await queryRunner.query(`CREATE INDEX "idx_inventory_batches_store_id" ON "inventory_batches" ("store_id")`);
    await queryRunner.query(`CREATE INDEX "idx_inventory_batches_supplier_id" ON "inventory_batches" ("supplier_id")`);
    await queryRunner.query(`CREATE INDEX "idx_inventory_batches_purchase_id" ON "inventory_batches" ("purchase_id")`);

    await queryRunner.query(`CREATE INDEX "idx_inventory_movements_product_id" ON "inventory_movements" ("product_id")`);
    await queryRunner.query(`CREATE INDEX "idx_inventory_movements_batch_id" ON "inventory_movements" ("batch_id")`);
    await queryRunner.query(`CREATE INDEX "idx_inventory_movements_reference_id" ON "inventory_movements" ("reference_id")`);

    await queryRunner.query(`CREATE INDEX "idx_inventory_batch_allocations_batch_id" ON "inventory_batch_allocations" ("batch_id")`);
    await queryRunner.query(`CREATE INDEX "idx_inventory_batch_allocations_product_id" ON "inventory_batch_allocations" ("product_id")`);
    await queryRunner.query(`CREATE INDEX "idx_inventory_batch_allocations_reference_id" ON "inventory_batch_allocations" ("reference_id")`);

    await queryRunner.query(`CREATE INDEX "idx_customers_store_id" ON "customers" ("store_id")`);

    await queryRunner.query(`CREATE INDEX "idx_reviews_customer_id" ON "reviews" ("customer_id")`);
    await queryRunner.query(`CREATE INDEX "idx_reviews_product_id" ON "reviews" ("product_id")`);
    await queryRunner.query(`CREATE INDEX "idx_reviews_order_id" ON "reviews" ("order_id")`);
    await queryRunner.query(`CREATE INDEX "idx_review_images_review_id" ON "review_images" ("review_id")`);

    await queryRunner.query(`CREATE INDEX "idx_store_reviews_customer_id" ON "store_reviews" ("customer_id")`);
    await queryRunner.query(`CREATE INDEX "idx_store_reviews_store_id" ON "store_reviews" ("store_id")`);
    await queryRunner.query(`CREATE INDEX "idx_store_reviews_order_id" ON "store_reviews" ("order_id")`);

    await queryRunner.query(`CREATE INDEX "idx_cash_sessions_store_id" ON "cash_sessions" ("store_id")`);
    await queryRunner.query(`CREATE INDEX "idx_cash_movements_cash_session_id" ON "cash_movements" ("cash_session_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_cash_movements_cash_session_id"`);
    await queryRunner.query(`DROP INDEX "idx_cash_sessions_store_id"`);

    await queryRunner.query(`DROP INDEX "idx_store_reviews_order_id"`);
    await queryRunner.query(`DROP INDEX "idx_store_reviews_store_id"`);
    await queryRunner.query(`DROP INDEX "idx_store_reviews_customer_id"`);

    await queryRunner.query(`DROP INDEX "idx_review_images_review_id"`);
    await queryRunner.query(`DROP INDEX "idx_reviews_order_id"`);
    await queryRunner.query(`DROP INDEX "idx_reviews_product_id"`);
    await queryRunner.query(`DROP INDEX "idx_reviews_customer_id"`);

    await queryRunner.query(`DROP INDEX "idx_customers_store_id"`);

    await queryRunner.query(`DROP INDEX "idx_inventory_batch_allocations_reference_id"`);
    await queryRunner.query(`DROP INDEX "idx_inventory_batch_allocations_product_id"`);
    await queryRunner.query(`DROP INDEX "idx_inventory_batch_allocations_batch_id"`);

    await queryRunner.query(`DROP INDEX "idx_inventory_movements_reference_id"`);
    await queryRunner.query(`DROP INDEX "idx_inventory_movements_batch_id"`);
    await queryRunner.query(`DROP INDEX "idx_inventory_movements_product_id"`);

    await queryRunner.query(`DROP INDEX "idx_inventory_batches_purchase_id"`);
    await queryRunner.query(`DROP INDEX "idx_inventory_batches_supplier_id"`);
    await queryRunner.query(`DROP INDEX "idx_inventory_batches_store_id"`);
    await queryRunner.query(`DROP INDEX "idx_inventory_batches_product_id"`);

    await queryRunner.query(`DROP INDEX "idx_purchase_items_product_id"`);
    await queryRunner.query(`DROP INDEX "idx_purchase_items_purchase_id"`);
    await queryRunner.query(`DROP INDEX "idx_purchases_store_id"`);
    await queryRunner.query(`DROP INDEX "idx_purchases_supplier_id"`);

    await queryRunner.query(`DROP INDEX "idx_sale_items_product_id"`);
    await queryRunner.query(`DROP INDEX "idx_sale_items_sale_id"`);
    await queryRunner.query(`DROP INDEX "idx_sales_store_id"`);
    await queryRunner.query(`DROP INDEX "idx_sales_customer_id"`);

    await queryRunner.query(`DROP INDEX "idx_products_menu_category_id"`);
    await queryRunner.query(`DROP INDEX "idx_products_supplier_id"`);
    await queryRunner.query(`DROP INDEX "idx_products_store_id"`);
    await queryRunner.query(`DROP INDEX "idx_products_category_id"`);

    await queryRunner.query(`DROP INDEX "idx_order_items_product_id"`);
    await queryRunner.query(`DROP INDEX "idx_order_items_order_id"`);

    await queryRunner.query(`DROP INDEX "idx_orders_customer_id"`);

    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "uq_users_email"`);
  }
}
