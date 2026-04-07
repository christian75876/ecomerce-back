import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { InventoryBatch } from './inventory-batch.entity';
import { InventoryReferenceType } from './inventory-batch-allocation.entity';

export enum InventoryMovementType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUSTMENT = 'ADJUSTMENT',
  SALE = 'SALE',
  ORDER = 'ORDER',
  ORDER_CANCEL = 'ORDER_CANCEL',
}

@Entity('inventory_movements')
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.inventoryMovements, {
    eager: true,
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'batch_id', type: 'uuid', nullable: true })
  batchId: string | null;

  @ManyToOne(() => InventoryBatch, (batch) => batch.movements, {
    eager: true,
    nullable: true,
  })
  @JoinColumn({ name: 'batch_id' })
  batch: InventoryBatch | null;

  @Column({
    name: 'movement_type',
    type: 'enum',
    enum: InventoryMovementType,
  })
  movementType: InventoryMovementType;

  @Column({ name: 'quantity_delta', type: 'int' })
  quantityDelta: number;

  @Column({
    name: 'reference_type',
    type: 'enum',
    enum: InventoryReferenceType,
    nullable: true,
  })
  referenceType: InventoryReferenceType | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({
    name: 'unit_cost_snapshot',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  unitCostSnapshot: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
