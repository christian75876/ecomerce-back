import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class CloseCashSessionDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  closingAmount: number;
}
