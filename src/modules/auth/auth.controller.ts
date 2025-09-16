/* eslint-disable no-unused-vars */
import { Controller, Post, Res, HttpCode, Req, Body } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.auth.dto';
import { LoginAuthDto } from './dto/login.auth.dto';
import { RecoverPasswordDto } from './dto/recoverPassword.auth.dto';
import { SwaggerLogout, SwaggerRegister } from './docs/auth.swagger';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('logout')
  @HttpCode(200)
  @SwaggerLogout()
  // @UseGuards(JwtAuthGuard)
  logoutUser(@Req() _req: Request, @Res() res: Response) {
    res.status(200).send({ message: 'Successfully logged out' });
  }

  @SwaggerRegister()
  @Post('register')
  async registerController(@Body() credentials: RegisterDto) {
    return await this.authService.register(credentials);
  }

  @Post('login')
  async loginController(@Body() credentials: LoginAuthDto) {
    return await this.authService.login(credentials);
  }
  @Post('RecoverPasswords')
  async createToken(@Body() body: RecoverPasswordDto) {
    const email = String(body.email).trim();
    return await this.authService.createToken(email);
  }
}
