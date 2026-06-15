import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('app_config')
export class AppConfig {
  @PrimaryColumn()
  id: number;

  @Column({ name: 'is_access_blocked', type: 'boolean', default: false })
  isAccessBlocked: boolean;

  @Column({ name: 'blocked_message', type: 'text', nullable: true })
  blockedMessage: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
