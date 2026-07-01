import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStoreNotificationsDto {
  @IsOptional()
  @IsBoolean()
  wppNotificationsEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  wppApiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsappNumber?: string;
}
