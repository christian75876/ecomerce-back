import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PurchasePaymentMethod } from '../entities/purchase-payment.entity';

export class RegisterPurchasePaymentDto {
  @Type(() => Number)
  @Min(0.01)
  amount: number;

  @IsEnum(PurchasePaymentMethod)
  paymentMethod: PurchasePaymentMethod;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  note?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reference?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
