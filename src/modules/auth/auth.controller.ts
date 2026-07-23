/* eslint-disable no-unused-vars */
import {
  Controller,
  Post,
  Patch,
  Res,
  HttpCode,
  Req,
  Body,
  Get,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.auth.dto';
import { RegisterCustomerDto } from './dto/register-customer.auth.dto';
import { LoginAuthDto } from './dto/login.auth.dto';
import { RecoverPasswordDto } from './dto/recoverPassword.auth.dto';
import { VerifyEmailDto } from './dto/verifyEmail.auth.dto';
import { VerifyRecoverOtpDto } from './dto/verifyRecoverOtp.auth.dto';
import { ResetPasswordDto } from './dto/resetPassword.auth.dto';
import { SwaggerLogout, SwaggerRegister } from './docs/auth.swagger';
import { JwtAuthGuard } from './guards/jwt.auth.guard';
import { UpdateMyProfileDto } from './dto/update-my-profile.auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
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

  @Post('register-customer')
  async registerCustomerController(@Body() payload: RegisterCustomerDto) {
    return await this.authService.registerCustomer(payload);
  }

  @Post('login')
  async loginController(@Body() credentials: LoginAuthDto) {
    return await this.authService.login(credentials);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getAuthenticatedUser(@Req() req: Request & {
    user: { userId: number };
  }) {
    return await this.authService.getAuthenticatedProfile(req.user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMyProfile(
    @Req() req: Request & { user: { userId: number } },
    @Body() dto: UpdateMyProfileDto,
  ) {
    return await this.authService.updateMyProfile(req.user.userId, dto);
  }

  @Post('refresh')
  @HttpCode(200)
  async refreshToken(@Req() req: Request) {
    const authHeader = req.headers['authorization'] as string | undefined;
    const token = authHeader?.split(' ')[1];
    if (!token) throw new UnauthorizedException('No token provided');
    return await this.authService.renewToken(token);
  }

  @Post('recover-passwords')
  async createToken(@Body() body: RecoverPasswordDto) {
    const email = String(body.email).trim();
    return await this.authService.createToken(email);
  }

  @Post('verify-email')
  async verifyEmail(@Body() body: VerifyEmailDto) {
    return await this.authService.verifyEmail(body);
  }

  @Post('recover-passwords/verify-otp')
  async verifyRecoveryOtp(@Body() body: VerifyRecoverOtpDto) {
    return await this.authService.verifyRecoveryOtp(body);
  }

  @Post('recover-passwords/reset')
  async resetPassword(@Body() body: ResetPasswordDto) {
    return await this.authService.resetPassword(body);
  }

}
