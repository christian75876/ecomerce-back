import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { InventoryMovementType } from '../entities/inventory-movement.entity';
import { Type } from 'class-transformer';

export class CreateInventoryMovementDto {
  @IsUUID()
  productId: string;

  @IsEnum(InventoryMovementType)
  movementType: InventoryMovementType;

  @Type(() => Number)
  @IsInt()
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
