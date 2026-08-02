import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class TurnstileService {
  async verify(token: string | undefined): Promise<void> {
    const secretKey = process.env.TURNSTILE_SECRET_KEY;
    // Skip verification in dev or when no secret key is configured
    if (!secretKey || !token) return;

    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: secretKey, response: token }),
      },
    );
    const data = (await res.json()) as { success: boolean };
    if (!data.success) {
      throw new UnauthorizedException(
        'Verificación de seguridad fallida. Intenta de nuevo.',
      );
    }
  }
}
