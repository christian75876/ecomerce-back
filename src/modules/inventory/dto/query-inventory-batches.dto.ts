import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dtos/pagination-query.dto';

export class QueryInventoryBatchesDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
