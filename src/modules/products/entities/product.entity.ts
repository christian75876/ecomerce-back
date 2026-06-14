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
import { Category } from '../../categories/entities/category.entity';
import { InventoryMovement } from '../../inventory/entities/inventory-movement.entity';
import { Store } from '../../stores/entities/store.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { InventoryBatch } from '../../inventory/entities/inventory-batch.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  sku: string;

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

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId: string | null;

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
