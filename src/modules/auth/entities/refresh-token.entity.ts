import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// El JWT de acceso vive poco (15 min) y no se puede revocar server-side. Este
// token vive en la base de datos, dura más (30 días), y sí se puede invalidar
// — cada vez que se usa para renovar, se marca revocado y se emite uno nuevo
// (rotación): si alguien roba uno viejo ya usado, el intento falla en vez de
// darle acceso indefinido.
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'token_hash', type: 'varchar', unique: true })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
