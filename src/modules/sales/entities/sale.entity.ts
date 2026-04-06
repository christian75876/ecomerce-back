import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SaleItem } from './sale-item.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Store } from '../../stores/entities/store.entity';

export enum SalePaymentMethod {
  CASH = 'CASH',
  CREDIT = 'CREDIT',
}

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: SalePaymentMethod,
    default: SalePaymentMethod.CASH,
  })
  paymentMethod: SalePaymentMethod;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  @ManyToOne(() => Customer, { eager: true, nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId: string | null;

  @ManyToOne(() => Store, { eager: true, nullable: true })
  @JoinColumn({ name: 'store_id' })
  store: Store | null;

  @Column({ name: 'cash_session_id', type: 'uuid', nullable: true })
  cashSessionId: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @OneToMany(() => SaleItem, (saleItem) => saleItem.sale, {
    cascade: true,
    eager: true,
  })
  items: SaleItem[];
}
