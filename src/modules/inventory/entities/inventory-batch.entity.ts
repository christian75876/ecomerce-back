import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { Store } from '../../stores/entities/store.entity';
import { Purchase } from '../../purchases/entities/purchase.entity';
import { PurchaseItem } from '../../purchases/entities/purchase-item.entity';
import { InventoryMovement } from './inventory-movement.entity';
import { InventoryBatchAllocation } from './inventory-batch-allocation.entity';

export enum InventoryBatchStatus {
  ACTIVE = 'ACTIVE',
  DEPLETED = 'DEPLETED',
  EXPIRED = 'EXPIRED',
  BLOCKED = 'BLOCKED',
}

@Entity('inventory_batches')
export class InventoryBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.inventoryBatches, {
    eager: true,
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId: string | null;

  @ManyToOne(() => Store, { eager: true, nullable: true })
  @JoinColumn({ name: 'store_id' })
  store: Store | null;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string | null;

  @ManyToOne(() => Supplier, { eager: true, nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier | null;

  @Column({ name: 'purchase_id', type: 'uuid', nullable: true })
  purchaseId: string | null;

  @ManyToOne(() => Purchase, { eager: false, nullable: true })
  @JoinColumn({ name: 'purchase_id' })
  purchase: Purchase | null;

  @Column({ name: 'purchase_item_id', type: 'uuid', nullable: true })
  purchaseItemId: string | null;

  @ManyToOne(() => PurchaseItem, { eager: false, nullable: true })
  @JoinColumn({ name: 'purchase_item_id' })
  purchaseItem: PurchaseItem | null;

  @Column({ name: 'batch_code', type: 'varchar', length: 120, nullable: true })
  batchCode: string | null;

  @Column({ name: 'received_at', type: 'timestamp' })
  receivedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 12, scale: 2 })
  unitCost: number;

  @Column({ name: 'initial_quantity', type: 'int' })
  initialQuantity: number;

  @Column({ name: 'available_quantity', type: 'int' })
  availableQuantity: number;

  @Column({
    type: 'enum',
    enum: InventoryBatchStatus,
    default: InventoryBatchStatus.ACTIVE,
  })
  status: InventoryBatchStatus;

  @OneToMany(() => InventoryMovement, (movement) => movement.batch)
  movements: InventoryMovement[];

  @OneToMany(() => InventoryBatchAllocation, (allocation) => allocation.batch)
  allocations: InventoryBatchAllocation[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
