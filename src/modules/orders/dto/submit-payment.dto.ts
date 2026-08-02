import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentMethodType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  paymentReference?: string;
}
