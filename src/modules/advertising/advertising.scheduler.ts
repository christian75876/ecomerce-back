import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdvertisingService } from './advertising.service';

@Injectable()
export class AdvertisingScheduler {
  private readonly logger = new Logger(AdvertisingScheduler.name);

  constructor(private readonly advertisingService: AdvertisingService) {}

  // Runs every day at 3 AM UTC to turn off `isPremiumAdvertiser` for stores
  // whose paid campaign already ended.
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleExpireOverdueAdvertisements() {
    const expired = await this.advertisingService.expireOverdueAdvertisements();
    if (expired > 0) {
      this.logger.log(`Expired advertising for ${expired} store(s)`);
    }
  }
}
