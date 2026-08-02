import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SaleDeliveryType, SalePaymentMethod } from '../entities/sale.entity';

class CreateSaleItemDto {
  @IsUUID()
  productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateSaleDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsUUID()
  cashSessionId?: string;

  @IsOptional()
  @IsEnum(SalePaymentMethod)
  paymentMethod?: SalePaymentMethod;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];

  // Guest customer
  @IsOptional() @IsString() @MaxLength(160) guestName?: string;
  @IsOptional() @IsString() @MaxLength(30)  guestPhone?: string;
  @IsOptional() @IsString() @MaxLength(10)  guestDocType?: string;
  @IsOptional() @IsString() @MaxLength(30)  guestDoc?: string;

  // Delivery
  @IsOptional() @IsEnum(SaleDeliveryType)   deliveryType?: SaleDeliveryType;
  @IsOptional() @IsString() @MaxLength(300) deliveryAddress?: string;
  @IsOptional() @IsString() @MaxLength(100) deliveryCity?: string;
  @IsOptional() @IsString()                 deliveryNotes?: string;
}
