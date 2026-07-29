import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('push_subscriptions')
export class PushSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', nullable: true, type: 'int' })
  userId: number | null;

  @Column({ type: 'text' })
  endpoint: string;

  @Column({ name: 'p256dh', type: 'text' })
  p256dh: string;

  @Column({ name: 'auth_key', type: 'text' })
  authKey: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
