import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CancelPurchaseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reason?: string;
}
