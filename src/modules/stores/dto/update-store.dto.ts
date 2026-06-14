import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ButtonStyle, CoverStyle, DeliveryOptions, FontStyle, LayoutStyle, StoreType } from '../entities/store.entity';

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must use lowercase letters, numbers and hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bannerUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsappNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(DeliveryOptions)
  deliveryOptions?: DeliveryOptions;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  accentColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  bgColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  textColor?: string;

  @IsOptional()
  @IsEnum(FontStyle)
  fontStyle?: FontStyle;

  @IsOptional()
  @IsEnum(ButtonStyle)
  buttonStyle?: ButtonStyle;

  @IsOptional()
  @IsEnum(LayoutStyle)
  layoutStyle?: LayoutStyle;

  @IsOptional()
  @IsEnum(CoverStyle)
  coverStyle?: CoverStyle;

  @IsOptional()
  @IsBoolean()
  isAdultContent?: boolean;

  @IsOptional()
  @IsEnum(StoreType)
  storeType?: StoreType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  menuPdfUrl?: string;

  @IsOptional()
  @IsBoolean()
  wppNotificationsEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  wppApiKey?: string;
}
