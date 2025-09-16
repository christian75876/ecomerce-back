import { ArrayMinSize, IsArray, IsInt } from 'class-validator';
export class EnrollByIdDto {
  @IsInt() userId!: number;
  @IsArray() @ArrayMinSize(2) descriptors!: number[][];
}
