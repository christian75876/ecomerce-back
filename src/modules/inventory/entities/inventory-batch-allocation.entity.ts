import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InventoryBatch } from './inventory-batch.entity';
import { Product } from '../../products/entities/product.entity';

export enum InventoryReferenceType {
  PRODUCT_INITIAL = 'PRODUCT_INITIAL',
  MANUAL_ENTRY = 'MANUAL_ENTRY',
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  ORDER = 'ORDER',
  ORDER_CANCEL = 'ORDER_CANCEL',
  ADJUSTMENT = 'ADJUSTMENT',
  RETURN = 'RETURN',
  LEGACY = 'LEGACY',
}

@Entity('inventory_batch_allocations')
export class InventoryBatchAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'batch_id', type: 'uuid' })
  batchId: string;

  @ManyToOne(() => InventoryBatch, (batch) => batch.allocations, { eager: false })
  @JoinColumn({ name: 'batch_id' })
  batch: InventoryBatch;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { eager: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({
    name: 'reference_type',
    type: 'enum',
    enum: InventoryReferenceType,
  })
  referenceType: InventoryReferenceType;

  @Column({ name: 'reference_id', type: 'uuid' })
  referenceId: string;

  @Column({ name: 'reference_item_id', type: 'uuid', nullable: true })
  referenceItemId: string | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'unit_cost_snapshot', type: 'decimal', precision: 12, scale: 2 })
  unitCostSnapshot: number;

  @Column({ name: 'expires_at_snapshot', type: 'timestamp', nullable: true })
  expiresAtSnapshot: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
