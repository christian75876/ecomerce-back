import { User } from 'src/modules/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('face_enrollments')
export class FaceEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ux_face_enroll_user_id', { unique: true })
  @Column({ name: 'user_id', type: 'int', unique: true })
  userId!: number;

  @OneToOne(() => User, (u) => u.faceEnrollment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'jsonb' })
  descriptor!: number[];

  @Column({ type: 'jsonb', nullable: true })
  images?: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
