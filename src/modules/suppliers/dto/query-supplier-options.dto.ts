import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos/pagination-query.dto';

export class QuerySupplierOptionsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
