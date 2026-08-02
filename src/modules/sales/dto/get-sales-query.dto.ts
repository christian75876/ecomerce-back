import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SalePaymentMethod } from '../entities/sale.entity';

export class GetSalesQueryDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsEnum(SalePaymentMethod)
  paymentMethod?: SalePaymentMethod;

  /** 'LOCAL' | 'SHIPPING' | 'NONE' (NONE = deliveryType is null) */
  @IsOptional()
  @IsString()
  deliveryType?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
