/* eslint-disable no-unused-vars */
import {
  Controller,
  Post,
  Res,
  HttpCode,
  Req,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.auth.dto';
import { LoginAuthDto } from './dto/login.auth.dto';
import { RecoverPasswordDto } from './dto/recoverPassword.auth.dto';
import { SwaggerLogout, SwaggerRegister } from './docs/auth.swagger';
import { FaceService } from '../face/face.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly faceService: FaceService,
  ) {}

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

  @Post('login-face')
  @HttpCode(200)
  async loginFace(@Body() body: { descriptor: number[]; threshold?: number }) {
    const res = await this.faceService.identify(
      body.descriptor,
      body.threshold ?? 0.55,
    );
    if (!res.match || !res.user)
      throw new UnauthorizedException('Rostro no reconocido');
    return this.authService.issueTokenForUser(
      res.user.id,
      res.user.role_id,
      res.user.email,
    );
  }
}
