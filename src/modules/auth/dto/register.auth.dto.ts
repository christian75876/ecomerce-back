import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsStrongPassword,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'securePassword123' })
  @IsStrongPassword()
  @IsNotEmpty()
  password: string;

  @Type(() => Number)
  @IsNotEmpty()
  @IsNumber()
  @IsIn([1, 2, 3], {
    message: 'The only allowed values are "administrator", "vendor" or "buyer"',
  })
  role_id: number;
}
