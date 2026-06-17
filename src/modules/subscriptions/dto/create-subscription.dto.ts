import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { SubscriptionPaymentMethod, SubscriptionStatus } from '../entities/store-subscription.entity';

export class CreateSubscriptionDto {
  @IsUUID()
  storeId: string;

  @IsUUID()
  planId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsNumber()
  @Min(0)
  paidAmount: number;

  @IsEnum(SubscriptionPaymentMethod)
  paymentMethod: SubscriptionPaymentMethod;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}
