import { IsOptional, IsString } from 'class-validator';

export class QueryAuditDto {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
