import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { EnvConfig } from 'src/common/env.config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly envConfig = EnvConfig();
  private readonly smtpHost = this.envConfig.smtpHost;
  private readonly smtpPort = this.envConfig.smtpPort;
  private readonly smtpSecure = this.envConfig.smtpSecure;
  private readonly smtpUser = this.envConfig.smtpUser;
  private readonly smtpPass = this.envConfig.smtpPass;
  private readonly fromEmail = this.envConfig.emailFrom;
  private readonly appName = this.envConfig.appName;
  private readonly verifyBaseUrl = this.envConfig.emailVerificationUrlBase;
  private readonly transporter = nodemailer.createTransport({
    host: this.smtpHost,
    port: this.smtpPort,
    secure: this.smtpSecure,
    auth: {
      user: this.smtpUser,
      pass: this.smtpPass,
    },
  });

  private assertEmailConfig(): void {
    if (!this.smtpUser || !this.smtpPass) {
      throw new InternalServerErrorException(
        'Missing SMTP_USER/SMTP_PASS configuration',
      );
    }

    if (!this.fromEmail) {
      throw new InternalServerErrorException(
        'Missing EMAIL_FROM configuration',
      );
    }
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    this.assertEmailConfig();
    try {
      await this.transporter.sendMail({
        from: this.fromEmail || this.smtpUser,
        to,
        subject,
        html,
        text,
      });
    } catch (error) {
      const smtpError =
        error instanceof Error ? error.message : 'Unknown SMTP error';
      throw new InternalServerErrorException(
        `SMTP provider error: ${smtpError}`,
      );
    }
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const verificationUrl = `${this.verifyBaseUrl}${encodeURIComponent(token)}`;
    const subject = `Verify your email - ${this.appName}`;
    const text =
      `Welcome to ${this.appName}. Verify your email with this link: ` +
      verificationUrl;
    const html = `
      <h2>Verify your email</h2>
      <p>Welcome to ${this.appName}.</p>
      <p>Click the following link to verify your account:</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
      <p>If you did not create this account, you can ignore this email.</p>
    `;

    await this.sendEmail(to, subject, html, text);
  }

  async sendInvitationEmail(to: string, token: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteUrl = `${frontendUrl}/register?token=${encodeURIComponent(token)}`;
    const subject = `Invitación para crear tu tienda — ${this.appName}`;
    const text = `Fuiste invitado a crear una tienda en ${this.appName}. Acepta la invitación aquí: ${inviteUrl} (válido por 48 horas)`;
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#6366f1">¡Fuiste invitado como vendedor!</h2>
        <p>Hola, el administrador de <strong>${this.appName}</strong> te invitó a crear tu propia tienda en el marketplace.</p>
        <p style="margin:24px 0">
          <a href="${inviteUrl}"
             style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:600;display:inline-block">
            Aceptar invitación
          </a>
        </p>
        <p style="color:#64748b;font-size:13px">Este enlace es válido por 48 horas y es de un solo uso. Si no esperabas este correo, ignóralo.</p>
      </div>
    `;
    await this.sendEmail(to, subject, html, text);
  }

  async sendRecoveryOtpEmail(to: string, otp: string): Promise<void> {
    const subject = `Password recovery code - ${this.appName}`;
    const text =
      `Your ${this.appName} password recovery code is ${otp}. ` +
      'It expires in 10 minutes.';
    const html = `
      <h2>Password recovery</h2>
      <p>Your recovery code is:</p>
      <h1 style="letter-spacing: 4px;">${otp}</h1>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request this code, ignore this email.</p>
    `;

    await this.sendEmail(to, subject, html, text);
  }
}
