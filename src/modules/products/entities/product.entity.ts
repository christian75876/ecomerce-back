import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductVariant } from './product-variant.entity';
import { Category } from '../../categories/entities/category.entity';
import { InventoryMovement } from '../../inventory/entities/inventory-movement.entity';
import { Store } from '../../stores/entities/store.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { InventoryBatch } from '../../inventory/entities/inventory-batch.entity';
import { MenuCategory } from '../../menu-categories/entities/menu-category.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 80, unique: true, nullable: true })
  sku: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  cost: number | null;

  @Column({ name: 'compare_at_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  compareAtPrice: number | null;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'show_stock', type: 'boolean', default: false })
  showStock: boolean;

  @Column({ name: 'is_perishable', type: 'boolean', default: false })
  isPerishable: boolean;

  @Column({ name: 'track_batches', type: 'boolean', default: true })
  trackBatches: boolean;

  @Column({ name: 'low_stock_threshold', type: 'int', nullable: true })
  lowStockThreshold: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  brand: string | null;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[] | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  weight: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  width: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  height: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  depth: number | null;

  @Column({ name: 'weight_unit', type: 'varchar', length: 10, nullable: true })
  weightUnit: string | null;

  @Column({ name: 'dimensions_unit', type: 'varchar', length: 10, nullable: true })
  dimensionsUnit: string | null;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId: string | null;

  @Column({ name: 'menu_category_id', type: 'uuid', nullable: true })
  menuCategoryId: string | null;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string | null;

  @ManyToOne(() => Category, (category) => category.products, {
    eager: true,
  })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @ManyToOne(() => Store, (store) => store.products, {
    eager: true,
    nullable: true,
  })
  @JoinColumn({ name: 'store_id' })
  store: Store | null;

  @ManyToOne(() => Supplier, { eager: true, nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier | null;

  @ManyToOne(() => MenuCategory, { eager: true, nullable: true })
  @JoinColumn({ name: 'menu_category_id' })
  menuCategory: MenuCategory | null;

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants: ProductVariant[];

  @OneToMany(
    () => InventoryMovement,
    (inventoryMovement) => inventoryMovement.product,
  )
  inventoryMovements: InventoryMovement[];

  @OneToMany(() => InventoryBatch, (inventoryBatch) => inventoryBatch.product)
  inventoryBatches: InventoryBatch[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
