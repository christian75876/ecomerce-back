import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from '../../stores/entities/store.entity';

export enum CouponType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

// Dos tiendas distintas pueden querer el mismo código ("BIENVENIDO10") sin
// pisarse — el código solo debe ser único DENTRO de su propia tienda. Mismo
// patrón que customers.entity.ts (store_id, email): los cupones globales
// (storeId null, solo admin) no quedan cubiertos por este índice, se
// deduplican a nivel de aplicación en el service.
@Index('IDX_coupons_store_code_unique', ['storeId', 'code'], {
  unique: true,
  where: '"store_id" IS NOT NULL',
})
@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId: string | null;

  @ManyToOne(() => Store, { eager: false, nullable: true })
  @JoinColumn({ name: 'store_id' })
  store: Store | null;

  @Column({ type: 'enum', enum: CouponType })
  type: CouponType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number;

  @Column({ name: 'min_order_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  minOrderAmount: number | null;

  @Column({ name: 'max_uses', type: 'int', nullable: true })
  maxUses: number | null;

  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
