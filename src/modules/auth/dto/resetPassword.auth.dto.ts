import { IsNotEmpty, IsStrongPassword } from 'class-validator';
import { VerifyRecoverOtpDto } from './verifyRecoverOtp.auth.dto';

export class ResetPasswordDto extends VerifyRecoverOtpDto {
  @IsNotEmpty()
  @IsStrongPassword()
  newPassword: string;
}
