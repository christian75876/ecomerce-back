import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsUUID('4', { message: 'El rol no es válido' })
  roleId?: string;

  @IsOptional()
  @IsBoolean({ message: 'La verificación debe ser verdadera o falsa' })
  isEmailVerified?: boolean;
}
