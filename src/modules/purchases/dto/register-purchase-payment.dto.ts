import { Type } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class RegisterPurchasePaymentDto {
  @Type(() => Number)
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  note?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
