import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('recoverTokens')
export class RecoverToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar' })
  tokenHash: string;

  @Column({ type: 'varchar', length: 30 })
  purpose: 'register_verification' | 'password_recovery';

  @Column({
    name: 'expires_at',
    type: 'timestamp',
  })
  expiresAt: Date;

  @Column({
    name: 'used_at',
    type: 'timestamp',
    nullable: true,
  })
  usedAt?: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({ default: true })
  isActive: boolean;
}
