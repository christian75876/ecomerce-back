import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { EnvConfig } from 'src/common/env.config';

interface BrevoEmailPayload {
  sender: { email: string; name?: string };
  to: { email: string }[];
  subject: string;
  htmlContent: string;
  textContent: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly envConfig = EnvConfig();
  private readonly appName = this.envConfig.appName;
  private readonly verifyBaseUrl = this.envConfig.emailVerificationUrlBase;
  // Acepta tanto "correo@dominio.com" como el formato RFC 5322 'Nombre <correo@dominio.com>'
  // (este último es lo que documenta .env.example) — Brevo exige el correo puro en sender.email.
  private readonly fromEmail = this.parseFromEmail(this.envConfig.emailFrom);
  private readonly fromName = this.parseFromName(this.envConfig.emailFrom) ?? this.appName;

  private parseFromEmail(raw: string | undefined): string | undefined {
    const match = raw?.match(/<([^>]+)>/);
    return (match ? match[1] : raw)?.trim();
  }

  private parseFromName(raw: string | undefined): string | undefined {
    const match = raw?.match(/^(.*)<[^>]+>/);
    return match?.[1].trim().replace(/^"|"$/g, '') || undefined;
  }

  private async sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    const apiKey = this.envConfig.brevoApiKey;
    if (!apiKey) throw new InternalServerErrorException('Missing BREVO_API_KEY configuration');
    if (!this.fromEmail) throw new InternalServerErrorException('Missing EMAIL_FROM configuration');

    this.logger.log(`Sending email to ${to} via Brevo API`);

    const payload: BrevoEmailPayload = {
      sender: { email: this.fromEmail, name: this.fromName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    };

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Brevo API error ${res.status}: ${body}`);
      throw new InternalServerErrorException(`Brevo error ${res.status}: ${body}`);
    }

    const data = await res.json() as { messageId?: string };
    this.logger.log(`Email sent — messageId: ${data.messageId ?? 'ok'}`);
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

  async sendNewOrderEmail(to: string, opts: {
    storeName: string;
    customerName: string;
    orderId: string;
    total: number;
    itemCount: number;
    deliveryMethod: string | null;
  }): Promise<void> {
    const { storeName, customerName, orderId, total, itemCount, deliveryMethod } = opts;
    const subject = `🛍️ Nuevo pedido recibido — ${storeName}`;
    const deliveryLabel = deliveryMethod === 'DELIVERY' ? 'Domicilio' : 'Recoger en tienda';
    const totalFormatted = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(total);
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#6366f1">Nuevo pedido en ${storeName}</h2>
        <p>Tienes un nuevo pedido de <strong>${customerName}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#64748b">ID del pedido</td><td style="padding:8px 0;font-weight:600">${orderId.slice(0, 8).toUpperCase()}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Cliente</td><td style="padding:8px 0;font-weight:600">${customerName}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Total</td><td style="padding:8px 0;font-weight:600">${totalFormatted}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Artículos</td><td style="padding:8px 0;font-weight:600">${itemCount}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Entrega</td><td style="padding:8px 0;font-weight:600">${deliveryLabel}</td></tr>
        </table>
        <p style="color:#64748b;font-size:13px">Inicia sesión en el panel de administración para gestionar el pedido.</p>
      </div>
    `;
    const text = `Nuevo pedido en ${storeName}. Cliente: ${customerName}. Total: ${totalFormatted}. Artículos: ${itemCount}. Entrega: ${deliveryLabel}.`;
    await this.sendEmail(to, subject, html, text);
  }

  async sendOrderStatusEmail(to: string, opts: {
    customerName: string;
    orderId: string;
    status: string;
    statusLabel: string;
    statusColor: string;
    statusEmoji: string;
    total: number;
    storeName: string;
  }): Promise<void> {
    const { customerName, orderId, statusLabel, statusColor, statusEmoji, total, storeName } = opts;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const orderUrl = `${frontendUrl}/my-orders/${orderId}`;
    const totalFormatted = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(total);
    const subject = `${statusEmoji} Tu pedido ha sido actualizado — ${this.appName}`;
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#6366f1">Actualización de tu pedido</h2>
        <p>Hola <strong>${customerName}</strong>, tu pedido en <strong>${storeName}</strong> ha cambiado de estado.</p>
        <div style="background:${statusColor}15;border-left:4px solid ${statusColor};padding:12px 16px;border-radius:8px;margin:20px 0">
          <p style="margin:0;font-size:18px;font-weight:700;color:${statusColor}">${statusEmoji} ${statusLabel}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#64748b">ID del pedido</td><td style="padding:8px 0;font-weight:600">${orderId.slice(0, 8).toUpperCase()}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Total</td><td style="padding:8px 0;font-weight:600">${totalFormatted}</td></tr>
        </table>
        <p style="margin:24px 0">
          <a href="${orderUrl}" style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:600;display:inline-block">
            Ver mi pedido
          </a>
        </p>
        <p style="color:#64748b;font-size:13px">Si tienes dudas, contáctanos respondiendo este correo.</p>
      </div>
    `;
    const text = `Hola ${customerName}, tu pedido ${orderId.slice(0, 8).toUpperCase()} en ${storeName} ahora está: ${statusLabel}. Total: ${totalFormatted}. Ver pedido: ${orderUrl}`;
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
