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
  @IsString({ message: 'El nombre debe ser texto' })
  @MaxLength(160, { message: 'El nombre no puede superar 160 caracteres' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'El SKU debe ser texto' })
  @MaxLength(80, { message: 'El SKU no puede superar 80 caracteres' })
  sku?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El precio debe ser un número' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  price?: number;

  @IsOptional()
  @IsUUID('4', { message: 'La categoría no es válida' })
  categoryId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'La tienda no es válida' })
  storeId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'La categoría de menú no es válida' })
  menuCategoryId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El proveedor no es válido' })
  supplierId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El costo debe ser un número' })
  @Min(0, { message: 'El costo no puede ser negativo' })
  cost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El precio de comparación debe ser un número' })
  @Min(0, { message: 'El precio de comparación no puede ser negativo' })
  compareAtPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El stock inicial debe ser un número' })
  @Min(0, { message: 'El stock inicial no puede ser negativo' })
  initialStock?: number;

  @IsOptional()
  @IsString({ message: 'La imagen debe ser una URL de texto' })
  @MaxLength(500, { message: 'La URL de la imagen es demasiado larga' })
  imageUrl?: string;

  @IsOptional()
  @IsBoolean({ message: 'Mostrar stock debe ser verdadero o falso' })
  showStock?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Activo debe ser verdadero o falso' })
  isActive?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Perecedero debe ser verdadero o falso' })
  isPerishable?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Rastrear lotes debe ser verdadero o falso' })
  trackBatches?: boolean;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de vencimiento no es válida' })
  initialExpiresAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El umbral de stock bajo debe ser un número entero' })
  @Min(0, { message: 'El umbral de stock bajo no puede ser negativo' })
  lowStockThreshold?: number;

  @IsOptional()
  @IsString({ message: 'La marca debe ser texto' })
  @MaxLength(120, { message: 'La marca no puede superar 120 caracteres' })
  brand?: string;

  @IsOptional()
  @IsArray({ message: 'Las etiquetas deben ser una lista' })
  @IsString({ each: true, message: 'Cada etiqueta debe ser texto' })
  tags?: string[];

  @IsOptional()
  @IsString({ message: 'La unidad debe ser texto' })
  @MaxLength(50, { message: 'La unidad no puede superar 50 caracteres' })
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El peso debe ser un número' })
  @Min(0, { message: 'El peso no puede ser negativo' })
  weight?: number;

  @IsOptional()
  @IsString({ message: 'La unidad de peso debe ser texto' })
  @MaxLength(10, { message: 'La unidad de peso no puede superar 10 caracteres' })
  weightUnit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El ancho debe ser un número' })
  @Min(0, { message: 'El ancho no puede ser negativo' })
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El alto debe ser un número' })
  @Min(0, { message: 'El alto no puede ser negativo' })
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El fondo debe ser un número' })
  @Min(0, { message: 'El fondo no puede ser negativo' })
  depth?: number;

  @IsOptional()
  @IsString({ message: 'La unidad de dimensiones debe ser texto' })
  @MaxLength(10, { message: 'La unidad de dimensiones no puede superar 10 caracteres' })
  dimensionsUnit?: string;
}
