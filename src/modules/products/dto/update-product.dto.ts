import {
  IsArray,
  IsDateString,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';


export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsUUID()
  menuCategoryId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  showStock?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isPerishable?: boolean;

  @IsOptional()
  @IsBoolean()
  trackBatches?: boolean;

  @IsOptional()
  @IsDateString()
  initialExpiresAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depth?: number;
}
