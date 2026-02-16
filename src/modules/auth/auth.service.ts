import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { IsNull, Repository } from 'typeorm';
import { RegisterDto } from './dto/register.auth.dto';
import { LoginAuthDto } from './dto/login.auth.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RecoverToken } from './entities/token.entity';
import { randomBytes, createHash } from 'crypto';
import { VerifyEmailDto } from './dto/verifyEmail.auth.dto';
import { VerifyRecoverOtpDto } from './dto/verifyRecoverOtp.auth.dto';
import { ResetPasswordDto } from './dto/resetPassword.auth.dto';
import { EmailService } from './email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly recoveryOtpTtlMinutes = 10;
  private readonly verificationTtlHours = 24;
  private readonly maxOtpAttempts = 5;

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private jwtService: JwtService,
    @InjectRepository(RecoverToken)
    private readonly recoverTokenRepository: Repository<RecoverToken>,
    private readonly emailService: EmailService,
  ) {}

  private normalizeEmail(email: string): string {
    return String(email).trim().toLowerCase();
  }

  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }

  private generateRandomCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private getTokenExpiry(minutes: number): Date {
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  private async deactivateActiveTokens(
    email: string,
    purpose: RecoverToken['purpose'],
  ): Promise<void> {
    await this.recoverTokenRepository.update(
      { email, purpose, isActive: true, usedAt: IsNull() },
      { isActive: false },
    );
  }

  async checkDoesEmailExist(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (user) {
      throw new BadRequestException('The email has already been used');
    }
    return normalizedEmail;
  }

  async checkCredentials(
    email: string,
    password: string,
  ): Promise<User | void> {
    const normalizedEmail = this.normalizeEmail(email);
    const userData = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (!userData) {
      throw new NotFoundException('The email does not exist.');
    }
    if (!userData.isEmailVerified) {
      throw new ForbiddenException('You must verify your email before login');
    }
    const result = await bcrypt.compare(password, userData.password);
    if (userData.email && result) {
      return userData;
    }
    throw new UnauthorizedException('Your email or password are incorrect.');
  }

  async login({ email, password }: LoginAuthDto) {
    const userData = await this.checkCredentials(email, password);
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: userData instanceof User && userData.id,
      iat: now,
      role_id: userData instanceof User && userData.role_id,
      email: userData instanceof User && userData.email,
    };
    return {
      message: 'Here is your token: ',
      token: await this.jwtService.signAsync(payload, { expiresIn: '1h' }),
    };
  }

  async register({ email, password, role_id }: RegisterDto) {
    const normalizedEmail = await this.checkDoesEmailExist(email);
    const { user, verificationToken } =
      await this.userRepository.manager.transaction(async (em) => {
      const hashedPass = await bcrypt.hash(password, bcrypt.genSaltSync(10));
      const user = em.create(User, {
        role_id,
        email: normalizedEmail,
        password: hashedPass,
        isEmailVerified: false,
      });
      await em.save(user);

      const verificationToken = this.generateVerificationToken();
      await this.deactivateActiveTokens(
        normalizedEmail,
        'register_verification',
      );
      const emailToken = this.recoverTokenRepository.create({
        email: normalizedEmail,
        tokenHash: this.hashValue(verificationToken),
        purpose: 'register_verification',
        expiresAt: this.getTokenExpiry(this.verificationTtlHours * 60),
        attempts: 0,
        isActive: true,
      });
      await em.save(emailToken);

      return { user, verificationToken };
    });

    let emailSent = true;
    try {
      await this.emailService.sendVerificationEmail(
        normalizedEmail,
        verificationToken,
      );
    } catch (error) {
      emailSent = false;
      this.logger.error(
        `Could not send verification email to ${normalizedEmail}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return {
      statusCode: 201,
      message: emailSent
        ? 'Usuario registrado. Revisa tu correo para verificar la cuenta.'
        : 'Usuario registrado, pero no se pudo enviar el correo de verificacion.',
      data: {
        id: user.id,
        email: user.email,
        role_id: user.role_id,
        ...(process.env.NODE_ENV !== 'production' && !emailSent
          ? { verification_token: verificationToken }
          : {}),
      },
      metadata: {
        email_delivery: emailSent ? 'sent' : 'failed',
      },
    };
  }

  async verifyEmail({ token }: VerifyEmailDto) {
    const tokenHash = this.hashValue(token);
    const verificationToken = await this.recoverTokenRepository.findOne({
      where: {
        tokenHash,
        purpose: 'register_verification',
        isActive: true,
        usedAt: IsNull(),
      },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid verification token');
    }

    if (verificationToken.expiresAt.getTime() < Date.now()) {
      verificationToken.isActive = false;
      await this.recoverTokenRepository.save(verificationToken);
      throw new BadRequestException('Verification token has expired');
    }

    const user = await this.userRepository.findOne({
      where: { email: verificationToken.email },
    });
    if (!user) {
      throw new NotFoundException('User not found for this token');
    }

    user.isEmailVerified = true;
    verificationToken.isActive = false;
    verificationToken.usedAt = new Date();
    await this.userRepository.save(user);
    await this.recoverTokenRepository.save(verificationToken);

    return { message: 'Email verified successfully' };
  }

  async createToken(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return {
        message:
          'If the account exists, we sent an OTP code to the registered email.',
      };
    }

    const code = this.generateRandomCode();
    await this.deactivateActiveTokens(normalizedEmail, 'password_recovery');
    const token = this.recoverTokenRepository.create({
      email: normalizedEmail,
      tokenHash: this.hashValue(code),
      purpose: 'password_recovery',
      expiresAt: this.getTokenExpiry(this.recoveryOtpTtlMinutes),
      attempts: 0,
      isActive: true,
    });
    await this.recoverTokenRepository.save(token);

    let emailSent = true;
    try {
      await this.emailService.sendRecoveryOtpEmail(normalizedEmail, code);
    } catch (error) {
      emailSent = false;
      this.logger.error(
        `Could not send recovery OTP to ${normalizedEmail}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return {
      message:
        'If the account exists, we sent an OTP code to the registered email.',
      metadata: {
        email_delivery: emailSent ? 'sent' : 'failed',
      },
      ...(process.env.NODE_ENV !== 'production' && !emailSent
        ? { otp_code: code }
        : {}),
    };
  }

  private async validateRecoveryOtp(email: string, code: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const recoveryToken = await this.recoverTokenRepository.findOne({
      where: {
        email: normalizedEmail,
        purpose: 'password_recovery',
        isActive: true,
        usedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });

    if (!recoveryToken) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (recoveryToken.expiresAt.getTime() < Date.now()) {
      recoveryToken.isActive = false;
      await this.recoverTokenRepository.save(recoveryToken);
      throw new BadRequestException('OTP has expired');
    }

    if (recoveryToken.attempts >= this.maxOtpAttempts) {
      recoveryToken.isActive = false;
      await this.recoverTokenRepository.save(recoveryToken);
      throw new BadRequestException('OTP attempts exceeded. Request a new OTP');
    }

    if (recoveryToken.tokenHash !== this.hashValue(code)) {
      recoveryToken.attempts += 1;
      if (recoveryToken.attempts >= this.maxOtpAttempts) {
        recoveryToken.isActive = false;
      }
      await this.recoverTokenRepository.save(recoveryToken);
      throw new BadRequestException('Invalid OTP');
    }

    return recoveryToken;
  }

  async verifyRecoveryOtp({ email, code }: VerifyRecoverOtpDto) {
    await this.validateRecoveryOtp(email, code);
    return { message: 'OTP is valid' };
  }

  async resetPassword({ email, code, newPassword }: ResetPasswordDto) {
    const recoveryToken = await this.validateRecoveryOtp(email, code);
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.password = await bcrypt.hash(newPassword, bcrypt.genSaltSync(10));
    recoveryToken.isActive = false;
    recoveryToken.usedAt = new Date();
    await this.userRepository.save(user);
    await this.recoverTokenRepository.save(recoveryToken);

    return { message: 'Password updated successfully' };
  }

  async issueTokenForUser(userId: number, roleId: string, email: string) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: userId,
      role_id: roleId,
      email,
      iat: now,
      expiresIn: '1h',
    };
    return {
      message: 'Here is your token:',
      token: await this.jwtService.signAsync(payload),
    };
  }
}
