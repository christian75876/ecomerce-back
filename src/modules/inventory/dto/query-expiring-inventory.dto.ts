import { Type } from 'class-transformer';
import { IsOptional, IsUUID, Min } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dtos/pagination-query.dto';

export class QueryExpiringInventoryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  days?: number;

  @IsOptional()
  @IsUUID()
  storeId?: string;
}
