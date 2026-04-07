import { Type } from 'class-transformer';
import { IsOptional, IsUUID, Min } from 'class-validator';

export class QueryExpiringInventoryDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  days?: number;

  @IsOptional()
  @IsUUID()
  storeId?: string;
}
