import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';

export type VideoType = 'YOUTUBE' | 'INSTAGRAM';

@Entity('product_videos')
export class ProductVideo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'video_url', type: 'varchar', length: 500 })
  videoUrl: string;

  @Column({ name: 'video_type', type: 'varchar', length: 20 })
  videoType: VideoType;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  @Column({ type: 'int', default: 0 })
  order: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
