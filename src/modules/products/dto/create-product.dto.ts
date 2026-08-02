import {
  IsArray,
  IsDateString,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsUUID()
  menuCategoryId?: string;

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
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialStock?: number;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

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
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsDateString()
  initialExpiresAt?: string;

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
  @IsString()
  @MaxLength(10)
  weightUnit?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(10)
  dimensionsUnit?: string;
}
