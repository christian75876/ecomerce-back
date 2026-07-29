import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsStrongPassword,
  IsUUID,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
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

  @IsNotEmpty()
  @ApiProperty({ example: 'b1ff81be-8f45-4f13-9d00-4ca5c6d5ef77' })
  @IsUUID('4', { message: 'role_id must be a valid UUID v4' })
  role_id: string;

}
