import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';

@Injectable()
export class CallMeBotService {
  private readonly logger = new Logger(CallMeBotService.name);

  send(phone: string, apiKey: string, text: string): Promise<void> {
    return new Promise((resolve) => {
      const params = new URLSearchParams({ phone, text, apikey: apiKey });
      const url = `https://api.callmebot.com/whatsapp.php?${params.toString()}`;

      const req = https.get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          // CallMeBot devuelve 200/203 incluso para errores (API key
          // inválida, límite diario alcanzado, número no registrado) — el
          // mensaje real de éxito o error viene en el cuerpo, no en el
          // status. Antes se descartaba el cuerpo, así que estas fallas
          // pasaban completamente desapercibidas.
          const looksSuccessful = /message (queued|sent)/i.test(body);
          const log = `CallMeBot → ${phone} [${res.statusCode}] ${body.replace(/\s+/g, ' ').trim().slice(0, 200)}`;
          if (looksSuccessful) {
            this.logger.log(log);
          } else {
            this.logger.warn(log);
          }
          resolve();
        });
      });

      req.on('error', (err) => {
        this.logger.warn(`CallMeBot failed for ${phone}: ${err.message}`);
        resolve();
      });

      req.setTimeout(10_000, () => {
        req.destroy();
        this.logger.warn(`CallMeBot timeout for ${phone}`);
        resolve();
      });
    });
  }
}
