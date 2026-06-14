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
        res.resume();
        this.logger.log(`CallMeBot → ${phone} [${res.statusCode}]`);
        resolve();
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
