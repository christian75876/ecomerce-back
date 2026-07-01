import { Type } from 'class-transformer';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class OpenCashSessionDto {
  @IsUUID()
  storeId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingAmount: number;
}
