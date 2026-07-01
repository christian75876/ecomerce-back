import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdatePurchaseDto {
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  note?: string;
}
