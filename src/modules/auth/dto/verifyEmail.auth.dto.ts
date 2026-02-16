import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsNotEmpty()
  @IsString()
  @Length(32, 256)
  token: string;
}
