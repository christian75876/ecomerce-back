import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class RecoverPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => String(value).trim())
  email: string;
}
