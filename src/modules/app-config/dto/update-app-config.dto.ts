import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAppConfigDto {
  @IsOptional()
  @IsBoolean()
  isAccessBlocked?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  blockedMessage?: string | null;
}
