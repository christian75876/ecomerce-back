/* eslint-disable no-unused-vars */
import {
  Controller,
  Post,
  Patch,
  HttpCode,
  Req,
  Body,
  Get,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
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
import { RefreshTokenDto } from './dto/refresh-token.auth.dto';
import { LogoutDto } from './dto/logout.auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('logout')
  @HttpCode(200)
  @SwaggerLogout()
  @UseGuards(JwtAuthGuard)
  async logoutUser(@Body() dto: LogoutDto) {
    return await this.authService.logout(dto.refreshToken);
  }

  @SwaggerRegister()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async registerController(@Body() credentials: RegisterDto) {
    return await this.authService.register(credentials);
  }

  @Post('register-customer')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async registerCustomerController(@Body() payload: RegisterCustomerDto) {
    return await this.authService.registerCustomer(payload);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return await this.authService.refreshAccessToken(dto.refreshToken);
  }

  @Post('recover-passwords')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async createToken(@Body() body: RecoverPasswordDto) {
    const email = String(body.email).trim();
    return await this.authService.createToken(email);
  }

  @Post('verify-email')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyEmail(@Body() body: VerifyEmailDto) {
    return await this.authService.verifyEmail(body);
  }

  @Post('recover-passwords/verify-otp')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyRecoveryOtp(@Body() body: VerifyRecoverOtpDto) {
    return await this.authService.verifyRecoveryOtp(body);
  }

  @Post('recover-passwords/reset')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resetPassword(@Body() body: ResetPasswordDto) {
    return await this.authService.resetPassword(body);
  }

}
