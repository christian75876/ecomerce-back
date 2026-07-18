import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { AdPaymentMethod } from '../entities/store-advertisement.entity';

export class CreateAdvertisementDto {
  @IsUUID()
  storeId: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsNumber()
  @Min(0)
  paidAmount: number;

  @IsEnum(['CASH', 'TRANSFER', 'OTHER'])
  paymentMethod: AdPaymentMethod;

  @IsOptional()
  @IsString()
  notes?: string;
}
