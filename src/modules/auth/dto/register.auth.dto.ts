import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsStrongPassword } from 'class-validator';

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
}
