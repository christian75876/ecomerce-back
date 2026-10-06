import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CouponType } from '../entities/coupon.entity';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'El código solo puede contener letras mayúsculas, números, guiones y guiones bajos' })
  code: string;

  // Opcional para admin (null = cupón global, válido en cualquier tienda).
  // Un seller siempre lo trae forzado a la suya desde el controller.
  @IsOptional()
  @IsUUID('4', { message: 'La tienda no es válida' })
  storeId?: string;

  @IsEnum(CouponType)
  type: CouponType;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  value: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
