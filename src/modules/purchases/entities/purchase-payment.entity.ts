import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Purchase } from './purchase.entity';

export enum PurchasePaymentMethod {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
}

@Entity('purchase_payments')
export class PurchasePayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_id', type: 'uuid' })
  purchaseId: string;

  @ManyToOne(() => Purchase, (purchase) => purchase.payments)
  @JoinColumn({ name: 'purchase_id' })
  purchase: Purchase;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PurchasePaymentMethod,
    default: PurchasePaymentMethod.CASH,
  })
  paymentMethod: PurchasePaymentMethod;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reference: string | null;

  @Column({ name: 'receipt_image_path', type: 'varchar', length: 255, nullable: true })
  receiptImagePath: string | null;

  @Column({ name: 'paid_at', type: 'timestamp' })
  paidAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
