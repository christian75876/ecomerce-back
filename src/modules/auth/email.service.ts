import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { EnvConfig } from 'src/common/env.config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly envConfig = EnvConfig();
  private readonly fromEmail = this.envConfig.emailFrom;
  private readonly appName = this.envConfig.appName;
  private readonly verifyBaseUrl = this.envConfig.emailVerificationUrlBase;
  private readonly transporter = nodemailer.createTransport({
    host: this.envConfig.smtpHost,
    port: this.envConfig.smtpPort,
    secure: this.envConfig.smtpSecure,
    connectionTimeout: 10_000,
    greetingTimeout: 8_000,
    socketTimeout: 15_000,
    auth: {
      user: this.envConfig.smtpUser,
      pass: this.envConfig.smtpPass,
    },
  });

  private assertEmailConfig(): void {
    if (!this.envConfig.smtpUser || !this.envConfig.smtpPass) {
      throw new InternalServerErrorException('Missing SMTP_USER/SMTP_PASS configuration');
    }
    if (!this.fromEmail) {
      throw new InternalServerErrorException('Missing EMAIL_FROM configuration');
    }
  }

  private async sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    this.assertEmailConfig();
    this.logger.log(`Sending email to ${to} — host: ${this.envConfig.smtpHost}:${this.envConfig.smtpPort} user: ${this.envConfig.smtpUser}`);
    try {
      const info = await this.transporter.sendMail({ from: this.fromEmail, to, subject, html, text });
      this.logger.log(`Email sent — messageId: ${info.messageId}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown SMTP error';
      this.logger.error(`SMTP failed: ${msg}`);
      throw new InternalServerErrorException(`SMTP error: ${msg}`);
    }
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const verificationUrl = `${this.verifyBaseUrl}${encodeURIComponent(token)}`;
    const subject = `Verifica tu correo — ${this.appName}`;
    const text = `Bienvenido a ${this.appName}. Verifica tu correo aquí: ${verificationUrl}`;
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#6366f1">Verifica tu correo</h2>
        <p>Bienvenido a <strong>${this.appName}</strong>.</p>
        <p style="margin:24px 0">
          <a href="${verificationUrl}" style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:600;display:inline-block">
            Verificar correo
          </a>
        </p>
        <p style="color:#64748b;font-size:13px">Si no creaste esta cuenta, ignora este correo.</p>
      </div>
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
          <a href="${inviteUrl}" style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:600;display:inline-block">
            Aceptar invitación
          </a>
        </p>
        <p style="color:#64748b;font-size:13px">Este enlace es válido por 48 horas y es de un solo uso. Si no esperabas este correo, ignóralo.</p>
      </div>
    `;
    await this.sendEmail(to, subject, html, text);
  }

  async sendRecoveryOtpEmail(to: string, otp: string): Promise<void> {
    const subject = `Código de recuperación — ${this.appName}`;
    const text = `Tu código de recuperación de ${this.appName} es: ${otp}. Expira en 10 minutos.`;
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#6366f1">Recuperación de contraseña</h2>
        <p>Tu código es:</p>
        <h1 style="letter-spacing:8px;color:#1e293b;font-size:40px;margin:16px 0">${otp}</h1>
        <p style="color:#64748b;font-size:13px">Expira en 10 minutos. Si no solicitaste esto, ignora este correo.</p>
      </div>
    `;
    await this.sendEmail(to, subject, html, text);
  }
}
