import { IsArray, IsNumber, IsOptional } from 'class-validator';
export class IdentifyDto {
  @IsArray() descriptor!: number[];
  @IsOptional() @IsNumber() threshold?: number;
  @IsOptional() @IsNumber() k?: number;
}
