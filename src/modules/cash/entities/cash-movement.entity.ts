import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CashSession } from './cash-session.entity';

export enum CashMovementType {
  MANUAL_IN = 'MANUAL_IN',
  MANUAL_OUT = 'MANUAL_OUT',
  ADJUSTMENT = 'ADJUSTMENT',
}

@Entity('cash_movements')
export class CashMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cash_session_id', type: 'uuid' })
  cashSessionId: string;

  @ManyToOne(() => CashSession, { eager: false })
  @JoinColumn({ name: 'cash_session_id' })
  cashSession: CashSession;

  @Column({
    type: 'enum',
    enum: CashMovementType,
  })
  type: CashMovementType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 255 })
  reason: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
