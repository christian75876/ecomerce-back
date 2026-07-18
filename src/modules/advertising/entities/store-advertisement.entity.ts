import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Store } from '../../stores/entities/store.entity';

export type AdPaymentMethod = 'CASH' | 'TRANSFER' | 'OTHER';
export type AdStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

@Entity('store_advertisements')
export class StoreAdvertisement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'store_id' })
  storeId: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ name: 'payment_method', type: 'enum', enum: ['CASH', 'TRANSFER', 'OTHER'], default: 'CASH' })
  paymentMethod: AdPaymentMethod;

  @Column({ type: 'enum', enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'], default: 'ACTIVE' })
  status: AdStatus;

  @Column({ nullable: true, type: 'text' })
  notes: string | null;

  @Column({ name: 'registered_by_user_id', nullable: true })
  registeredByUserId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
