import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyRecoverOtpDto {
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be a 6 digit number' })
  code: string;
}
