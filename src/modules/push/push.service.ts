import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { SubscribePushDto } from './dto/subscribe-push.dto';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectRepository(PushSubscriptionEntity)
    private readonly repo: Repository<PushSubscriptionEntity>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const email = this.config.get<string>('VAPID_EMAIL', 'mailto:admin@example.com');

    if (publicKey && privateKey) {
      webpush.setVapidDetails(email, publicKey, privateKey);
    } else {
      this.logger.warn('VAPID keys not configured — Web Push disabled');
    }
  }

  getVapidPublicKey(): string {
    return this.config.get<string>('VAPID_PUBLIC_KEY', '');
  }

  async subscribe(dto: SubscribePushDto, userId: number | null): Promise<void> {
    const existing = await this.repo.findOne({ where: { endpoint: dto.endpoint } });
    if (existing) {
      existing.userId = userId;
      existing.p256dh = dto.keys.p256dh;
      existing.authKey = dto.keys.auth;
      await this.repo.save(existing);
      return;
    }
    await this.repo.save(
      this.repo.create({
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        authKey: dto.keys.auth,
        userId,
      }),
    );
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.repo.delete({ endpoint });
  }

  async sendToUser(userId: number, payload: object): Promise<void> {
    const subs = await this.repo.find({ where: { userId } });
    await this.sendToSubscriptions(subs, payload);
  }

  async sendToAll(payload: object): Promise<void> {
    const subs = await this.repo.find();
    await this.sendToSubscriptions(subs, payload);
  }

  private async sendToSubscriptions(
    subs: PushSubscriptionEntity[],
    payload: object,
  ): Promise<void> {
    const body = JSON.stringify(payload);
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.authKey } },
          body,
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await this.repo.delete({ id: sub.id });
        } else {
          this.logger.warn(`Push send failed for ${sub.endpoint.substring(0, 30)}…`);
        }
      }
    }
  }
}
