import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'varchar', length: 50, nullable: true })
  size: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  color: string | null;

  @Column({ name: 'color_hex', type: 'varchar', length: 7, nullable: true })
  colorHex: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true, unique: true })
  sku: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  price: number | null;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  order: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
