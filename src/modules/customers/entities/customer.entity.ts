import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { User } from '../../users/entities/user.entity';
import { CustomerLedgerEntry } from './customer-ledger-entry.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  firstName: string;

  @Column({ type: 'varchar', length: 120 })
  lastName: string;

  @Column({ type: 'varchar', length: 160, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ name: 'credit_enabled', type: 'boolean', default: false })
  creditEnabled: boolean;

  @Column({ name: 'credit_limit', type: 'decimal', precision: 12, scale: 2, nullable: true })
  creditLimit: number | null;

  @Column({ name: 'credit_balance', type: 'decimal', precision: 12, scale: 2, default: 0 })
  creditBalance: number;

  @Column({ name: 'user_id', type: 'int', nullable: true, unique: true })
  userId: number | null;

  @OneToOne(() => User, { eager: false, nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];

  @OneToMany(() => CustomerLedgerEntry, (entry) => entry.customer)
  ledgerEntries: CustomerLedgerEntry[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
