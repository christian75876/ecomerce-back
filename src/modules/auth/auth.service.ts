import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { Customer } from '../customers/entities/customer.entity';
import { IsNull, Repository } from 'typeorm';
import { RegisterDto } from './dto/register.auth.dto';
import { RegisterCustomerDto } from './dto/register-customer.auth.dto';
import { LoginAuthDto } from './dto/login.auth.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RecoverToken } from './entities/token.entity';
import { randomBytes, createHash } from 'crypto';
import { VerifyEmailDto } from './dto/verifyEmail.auth.dto';
import { VerifyRecoverOtpDto } from './dto/verifyRecoverOtp.auth.dto';
import { ResetPasswordDto } from './dto/resetPassword.auth.dto';
import { EmailService } from './email.service';
import { InvitationsService } from '../invitations/invitations.service';
import { StoresService } from '../stores/stores.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly recoveryOtpTtlMinutes = 10;
  private readonly verificationTtlHours = 24;
  private readonly maxOtpAttempts = 5;

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private jwtService: JwtService,
    @InjectRepository(RecoverToken)
    private readonly recoverTokenRepository: Repository<RecoverToken>,
    private readonly emailService: EmailService,
    private readonly invitationsService: InvitationsService,
    private readonly storesService: StoresService,
    private readonly notificationsService: NotificationsService,
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
      throw new BadRequestException('El correo ya está registrado.');
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
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }
    if (!userData.isEmailVerified) {
      throw new ForbiddenException('Debes verificar tu correo antes de ingresar.');
    }
    const result = await bcrypt.compare(password, userData.password);
    if (userData.email && result) {
      return userData;
    }
    throw new UnauthorizedException('Correo o contraseña incorrectos.');
  }

  async login({ email, password }: LoginAuthDto) {
    const userData = await this.checkCredentials(email, password);
    const user =
      userData instanceof User
        ? await this.userRepository.findOne({
            where: { id: userData.id },
            relations: { role: true },
          })
        : null;

    const customer = user
      ? await this.customerRepository.findOne({ where: { userId: user.id } })
      : null;

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: user?.id ?? null,
      iat: now,
      role_id: user?.role_id ?? null,
      email: user?.email ?? null,
    };
    return {
      message: 'Login successful',
      token: await this.jwtService.signAsync(payload, { expiresIn: '1h' }),
      user: {
        id: user?.id ?? null,
        email: user?.email ?? null,
        role_id: user?.role_id ?? null,
        role: user?.role?.name ?? null,
        customer: customer
          ? { id: customer.id, firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone }
          : null,
      },
    };
  }

  async renewToken(expiredToken: string): Promise<{ token: string }> {
    let payload: { sub: number; role_id: number | null; email: string | null };
    try {
      payload = await this.jwtService.verifyAsync(expiredToken, { ignoreExpiration: true });
    } catch {
      throw new UnauthorizedException('Token inválido.');
    }
    const user = await this.userRepository.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado.');
    const now = Math.floor(Date.now() / 1000);
    const newPayload = { sub: user.id, iat: now, role_id: payload.role_id, email: user.email };
    return { token: await this.jwtService.signAsync(newPayload, { expiresIn: '1h' }) };
  }

  async getAuthenticatedProfile(userId: number) {
    const [user, customer] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId }, relations: { role: true } }),
      this.customerRepository.findOne({ where: { userId } }),
    ]);

    if (!user) {
      throw new NotFoundException('Usuario autenticado no encontrado.');
    }

    return {
      id: user.id,
      email: user.email,
      role_id: user.role_id,
      role: user.role?.name ?? null,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      customer: customer
        ? {
            id: customer.id,
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
          }
        : null,
    };
  }

  async updateMyProfile(
    userId: number,
    dto: import('./dto/update-my-profile.auth.dto').UpdateMyProfileDto,
  ) {
    const customer = await this.customerRepository.findOne({ where: { userId } });
    if (!customer) {
      throw new NotFoundException('Profile not found');
    }

    if (typeof dto.firstName === 'string') customer.firstName = dto.firstName.trim();
    if (typeof dto.lastName === 'string') customer.lastName = dto.lastName.trim();
    if (typeof dto.phone === 'string') customer.phone = dto.phone.trim() || null;

    const saved = await this.customerRepository.save(customer);

    return {
      id: saved.id,
      firstName: saved.firstName,
      lastName: saved.lastName,
      phone: saved.phone,
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
      message: emailSent
        ? 'Usuario registrado. Revisa tu correo para verificar la cuenta.'
        : 'Usuario registrado, pero no se pudo enviar el correo de verificacion.',
      id: user.id,
      email: user.email,
      role_id: user.role_id,
      email_delivery: emailSent ? 'sent' : 'failed',
      ...(process.env.NODE_ENV !== 'production' && !emailSent
        ? { verification_token: verificationToken }
        : {}),
    };
  }

  async registerCustomer({
    firstName,
    lastName,
    email,
    password,
    phone,
    inviteToken,
  }: RegisterCustomerDto) {
    const normalizedEmail = await this.checkDoesEmailExist(email);

    let assignedRole = await this.roleRepository.findOne({ where: { name: 'buyer' } });
    let isInvited = false;

    if (inviteToken) {
      const invitation = await this.invitationsService.validateToken(inviteToken);
      if (invitation.email !== normalizedEmail) {
        throw new BadRequestException('El correo no coincide con la invitación');
      }
      const sellerRole = await this.roleRepository.findOne({ where: { name: 'seller' } });
      if (sellerRole) {
        assignedRole = sellerRole;
        isInvited = true;
      }
    }

    if (!assignedRole) {
      throw new NotFoundException('Rol no configurado.');
    }

    let verificationToken: string | null = null;

    const { user, customer } =
      await this.userRepository.manager.transaction(async (em) => {
        const hashedPass = await bcrypt.hash(password, bcrypt.genSaltSync(10));
        const user = em.create(User, {
          role_id: assignedRole.id,
          email: normalizedEmail,
          password: hashedPass,
          isEmailVerified: isInvited,
        });
        await em.save(user);

        if (!isInvited) {
          verificationToken = this.generateVerificationToken();
          await this.deactivateActiveTokens(normalizedEmail, 'register_verification');
          const emailToken = this.recoverTokenRepository.create({
            email: normalizedEmail,
            tokenHash: this.hashValue(verificationToken),
            purpose: 'register_verification',
            expiresAt: this.getTokenExpiry(this.verificationTtlHours * 60),
            attempts: 0,
            isActive: true,
          });
          await em.save(emailToken);
        }

        const customer = em.create(Customer, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: normalizedEmail,
          phone: phone?.trim() || null,
          userId: user.id,
        });
        await em.save(customer);

        return { user, customer };
      });

    if (isInvited && inviteToken) {
      await this.invitationsService.markAccepted(inviteToken);
      // Auto-create store for new seller
      let newStoreName = `${customer.firstName} ${customer.lastName}`.trim();
      try {
        const baseSlug = newStoreName.toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-')
          .slice(0, 40);
        const slug = `${baseSlug}-${user.id}`;
        const store = await this.storesService.create({ name: newStoreName, slug, userId: user.id });
        newStoreName = store.name ?? newStoreName;
      } catch {
        // Non-critical: store can be created later by admin
      }

      this.notificationsService.notifyAdmins({
        type: 'invitation_accepted',
        userId: user.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        storeName: newStoreName,
        createdAt: new Date().toISOString(),
      });

      const now = Math.floor(Date.now() / 1000);
      const jwtPayload = { sub: user.id, iat: now, role_id: assignedRole.id, email: user.email };
      return {
        message: 'Vendedor registrado correctamente',
        token: await this.jwtService.signAsync(jwtPayload, { expiresIn: '1h' }),
        user: { id: user.id, email: user.email, role_id: user.role_id, role: assignedRole.name },
        customer: { id: customer.id, firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone },
      };
    }

    // Regular buyer — send verification email; rollback registration if it fails
    try {
      await this.emailService.sendVerificationEmail(normalizedEmail, verificationToken!);
    } catch (error) {
      this.logger.error(
        `Could not send verification email to ${normalizedEmail}`,
        error instanceof Error ? error.stack : String(error),
      );

      // In development: auto-verify the user so testing doesn't require email
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(`[DEV] Auto-verifying ${normalizedEmail} because email service failed.`);
        user.isEmailVerified = true;
        await this.userRepository.save(user);
        this.notificationsService.notifyAdmins({
          type: 'user_registered',
          userId: user.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          createdAt: new Date().toISOString(),
        });
        const now = Math.floor(Date.now() / 1000);
        const jwtPayload = { sub: user.id, iat: now, role_id: assignedRole.id, email: user.email };
        return {
          message: '[DEV] Correo no enviado — cuenta auto-verificada para pruebas.',
          email_delivery: 'failed',
          token: await this.jwtService.signAsync(jwtPayload, { expiresIn: '1h' }),
          user: { id: user.id, email: user.email, role_id: user.role_id, role: assignedRole.name },
          customer: { id: customer.id, firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone },
        };
      }

      await this.userRepository.manager.transaction(async (em) => {
        await em.delete(Customer, { userId: user.id });
        await em.delete(RecoverToken, { email: normalizedEmail, purpose: 'register_verification' });
        await em.delete(User, { id: user.id });
      });
      throw new InternalServerErrorException(
        'No se pudo enviar el correo de verificación. Por favor intenta de nuevo en unos momentos.',
      );
    }

    this.notificationsService.notifyAdmins({
      type: 'user_registered',
      userId: user.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      createdAt: new Date().toISOString(),
    });

    return {
      message: 'Cuenta creada. Revisa tu correo para verificar tu cuenta antes de ingresar.',
      email_delivery: 'sent',
    };
  }

  async verifyEmail({ token }: VerifyEmailDto) {
    const tokenHash = this.hashValue(token);
    let verificationToken = await this.recoverTokenRepository.findOne({
      where: {
        tokenHash,
        purpose: 'register_verification',
        isActive: true,
        usedAt: IsNull(),
      },
    });

    if (!verificationToken) {
      const existingToken = await this.recoverTokenRepository.findOne({
        where: {
          tokenHash,
          purpose: 'register_verification',
        },
      });

      if (existingToken?.usedAt) {
        const alreadyVerifiedUser = await this.userRepository.findOne({
          where: { email: existingToken.email },
        });
        if (alreadyVerifiedUser?.isEmailVerified) {
          return { message: 'Email already verified' };
        }
      }

      throw new BadRequestException('Token de verificación inválido.');
    }

    if (verificationToken.expiresAt.getTime() < Date.now()) {
      verificationToken.isActive = false;
      await this.recoverTokenRepository.save(verificationToken);
      throw new BadRequestException('El enlace de verificación ha expirado.');
    }

    const user = await this.userRepository.findOne({
      where: { email: verificationToken.email },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado para este token.');
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
      throw new BadRequestException('Código OTP inválido o expirado.');
    }

    if (recoveryToken.expiresAt.getTime() < Date.now()) {
      recoveryToken.isActive = false;
      await this.recoverTokenRepository.save(recoveryToken);
      throw new BadRequestException('El código OTP ha expirado.');
    }

    if (recoveryToken.attempts >= this.maxOtpAttempts) {
      recoveryToken.isActive = false;
      await this.recoverTokenRepository.save(recoveryToken);
      throw new BadRequestException('Demasiados intentos. Solicita un nuevo código.');
    }

    if (recoveryToken.tokenHash !== this.hashValue(code)) {
      recoveryToken.attempts += 1;
      if (recoveryToken.attempts >= this.maxOtpAttempts) {
        recoveryToken.isActive = false;
      }
      await this.recoverTokenRepository.save(recoveryToken);
      throw new BadRequestException('Código OTP incorrecto.');
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
      throw new NotFoundException('Usuario no encontrado.');
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
