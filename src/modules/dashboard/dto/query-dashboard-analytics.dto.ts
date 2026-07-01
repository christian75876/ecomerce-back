import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString, Min } from 'class-validator';

export class QueryDashboardAnalyticsDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  criticalStockThreshold?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  rotationDays?: number;
}
