import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

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

  @Column({
    name: 'movement_type',
    type: 'enum',
    enum: InventoryMovementType,
  })
  movementType: InventoryMovementType;

  @Column({ name: 'quantity_delta', type: 'int' })
  quantityDelta: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
