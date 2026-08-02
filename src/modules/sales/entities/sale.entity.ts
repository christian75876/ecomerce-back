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

export enum SaleDeliveryType {
  LOCAL    = 'LOCAL',
  SHIPPING = 'SHIPPING',
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

  // Guest (unregistered) customer data
  @Column({ name: 'guest_name',     type: 'varchar', length: 160, nullable: true })
  guestName: string | null;

  @Column({ name: 'guest_phone',    type: 'varchar', length: 30,  nullable: true })
  guestPhone: string | null;

  @Column({ name: 'guest_doc_type', type: 'varchar', length: 10,  nullable: true })
  guestDocType: string | null;

  @Column({ name: 'guest_doc',      type: 'varchar', length: 30,  nullable: true })
  guestDoc: string | null;

  // Delivery
  @Column({
    name: 'delivery_type',
    type: 'enum',
    enum: SaleDeliveryType,
    nullable: true,
  })
  deliveryType: SaleDeliveryType | null;

  @Column({ name: 'delivery_address', type: 'varchar', length: 300, nullable: true })
  deliveryAddress: string | null;

  @Column({ name: 'delivery_city',    type: 'varchar', length: 100, nullable: true })
  deliveryCity: string | null;

  @Column({ name: 'delivery_notes',   type: 'text', nullable: true })
  deliveryNotes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @OneToMany(() => SaleItem, (saleItem) => saleItem.sale, {
    cascade: true,
    eager: true,
  })
  items: SaleItem[];
}
