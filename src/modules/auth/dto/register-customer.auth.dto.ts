import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  MaxLength,
} from 'class-validator';

export class RegisterCustomerDto {
  @ApiProperty({ example: 'Christian' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  firstName: string;

  @ApiProperty({ example: 'Pabón' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  lastName: string;

  @ApiProperty({ example: 'buyer@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'secure1@' })
  @IsStrongPassword(
    { minLength: 6, minLowercase: 0, minUppercase: 0, minNumbers: 1, minSymbols: 1 },
    { message: 'La contraseña debe tener mínimo 6 caracteres, un número y un símbolo especial' },
  )
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: '3001234567' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inviteToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cfToken?: string;
}
