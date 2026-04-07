import { IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryInventoryBatchesDto {
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
