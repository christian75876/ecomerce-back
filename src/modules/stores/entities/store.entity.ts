import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

export enum DeliveryOptions {
  DELIVERY = 'DELIVERY',
  PICKUP = 'PICKUP',
  BOTH = 'BOTH',
}

export enum FontStyle {
  MODERN = 'MODERN',
  CLASSIC = 'CLASSIC',
  PLAYFUL = 'PLAYFUL',
}

export enum ButtonStyle {
  ROUNDED = 'ROUNDED',
  SHARP = 'SHARP',
  PILL = 'PILL',
}

export enum LayoutStyle {
  GRID = 'GRID',
  LIST = 'LIST',
}

export enum CoverStyle {
  GRADIENT = 'GRADIENT',
  SOLID = 'SOLID',
  MINIMAL = 'MINIMAL',
}

export enum StoreType {
  STORE = 'STORE',
  RESTAURANT = 'RESTAURANT',
}

@Entity('stores')
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 180, unique: true })
  slug: string;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({ name: 'banner_url', type: 'varchar', length: 500, nullable: true })
  bannerUrl: string | null;

  @Column({ name: 'primary_color', type: 'varchar', length: 20, nullable: true })
  primaryColor: string | null;

  @Column({ name: 'secondary_color', type: 'varchar', length: 20, nullable: true })
  secondaryColor: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ name: 'whatsapp_number', type: 'varchar', length: 30, nullable: true })
  whatsappNumber: string | null;

  @Column({
    name: 'delivery_options',
    type: 'enum',
    enum: DeliveryOptions,
    default: DeliveryOptions.BOTH,
  })
  deliveryOptions: DeliveryOptions;

  @Column({ name: 'accent_color', type: 'varchar', length: 20, nullable: true })
  accentColor: string | null;

  @Column({ name: 'bg_color', type: 'varchar', length: 20, nullable: true })
  bgColor: string | null;

  @Column({ name: 'text_color', type: 'varchar', length: 20, nullable: true })
  textColor: string | null;

  @Column({
    name: 'font_style',
    type: 'enum',
    enum: FontStyle,
    default: FontStyle.MODERN,
  })
  fontStyle: FontStyle;

  @Column({
    name: 'button_style',
    type: 'enum',
    enum: ButtonStyle,
    default: ButtonStyle.ROUNDED,
  })
  buttonStyle: ButtonStyle;

  @Column({
    name: 'layout_style',
    type: 'enum',
    enum: LayoutStyle,
    default: LayoutStyle.GRID,
  })
  layoutStyle: LayoutStyle;

  @Column({
    name: 'cover_style',
    type: 'enum',
    enum: CoverStyle,
    default: CoverStyle.GRADIENT,
  })
  coverStyle: CoverStyle;

  @Column({ type: 'varchar', length: 160, nullable: true })
  email: string | null;

  @Column({
    name: 'store_type',
    type: 'enum',
    enum: StoreType,
    default: StoreType.STORE,
  })
  storeType: StoreType;

  @Column({ name: 'menu_pdf_url', type: 'varchar', length: 500, nullable: true })
  menuPdfUrl: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_adult_content', type: 'boolean', default: false })
  isAdultContent: boolean;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @Column({ name: 'wpp_notifications_enabled', type: 'boolean', default: true })
  wppNotificationsEnabled: boolean;

  @Column({ name: 'wpp_api_key', type: 'varchar', length: 100, nullable: true })
  wppApiKey: string | null;

  @OneToMany(() => Product, (product) => product.store)
  products: Product[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
