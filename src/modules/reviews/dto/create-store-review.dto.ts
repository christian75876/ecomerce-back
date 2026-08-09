import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateStoreReviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? value : String(value).trim()))
  @IsString()
  @MaxLength(1500)
  comment?: string;
}
