import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreatePurchaseItemDto {
  @IsUUID()
  productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @Type(() => Number)
  @Min(0)
  unitCost: number;
}

export class CreatePurchaseDto {
  @IsUUID()
  supplierId: string;

  @IsUUID()
  storeId: string;

  @IsDateString()
  purchaseDate: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items: CreatePurchaseItemDto[];

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  note?: string;
}
