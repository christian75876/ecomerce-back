import { User } from 'src/modules/users/entities/user.entity';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity('recoverTokens')
export class RecoverToken {
  @PrimaryGeneratedColumn()
  id: string;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'int' })
  code: Number;

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({ default: true })
  isActive: boolean; //
}
