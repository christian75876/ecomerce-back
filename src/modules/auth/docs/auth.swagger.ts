import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RegisterDto } from '../dto/register.auth.dto';
import { LoginAuthDto } from '../dto/login.auth.dto';
import { RecoverPasswordDto } from '../dto/recoverPassword.auth.dto';
import { applyDecorators } from '@nestjs/common';

export const SwaggerLogout = () => {
  return applyDecorators(
    ApiOperation({ summary: 'Cerrar sesión del usuario' }),
    ApiResponse({ status: 200, description: 'Logout exitoso.' }),
  );
};
export const SwaggerRegister = () => {
  return applyDecorators(
    ApiBody({ type: RegisterDto }),
    ApiOperation({ summary: 'Registrar un nuevo usuario' }),
    ApiResponse({
      status: 201,
      description: 'Usuario registrado exitosamente.',
    }),
  );
};

export const SwaggerLogin = () => {
  return [
    ApiOperation({ summary: 'Login del usuario' }),
    ApiBody({ type: LoginAuthDto }),
    ApiResponse({ status: 200, description: 'Login exitoso, devuelve JWT.' }),
  ];
};

export const SwaggerRecoverPassword = () => {
  return [
    ApiOperation({ summary: 'Solicitar recuperación de contraseña' }),
    ApiBody({ type: RecoverPasswordDto }),
    ApiResponse({ status: 201, description: 'Código enviado al correo.' }),
  ];
};
