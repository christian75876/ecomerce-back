import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dtos/pagination-query.dto';

const PRODUCT_SORT_OPTIONS = ['newest', 'price_asc', 'price_desc', 'name_asc', 'random'] as const;

export class QueryProductsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsUUID('4')
  storeId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsIn(PRODUCT_SORT_OPTIONS)
  sortBy?: (typeof PRODUCT_SORT_OPTIONS)[number];

  @IsOptional()
  @IsString()
  seed?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sponsoredOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  onlyAvailable?: boolean;
}
