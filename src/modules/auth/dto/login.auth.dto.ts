import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginAuthDto {
  @IsEmail()
  @IsNotEmpty()
  @IsString()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  cfToken?: string;
}
