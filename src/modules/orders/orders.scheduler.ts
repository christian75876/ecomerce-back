import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrdersService } from './orders.service';

@Injectable()
export class OrdersScheduler {
  private readonly logger = new Logger(OrdersScheduler.name);

  constructor(private readonly ordersService: OrdersService) {}

  // Runs every day at 2 AM UTC to cancel orders with no payment after 5 days
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleAutoCancelUnpaid() {
    const cancelled = await this.ordersService.autoCancelUnpaidOrders();
    if (cancelled > 0) {
      this.logger.log(`Auto-cancelled ${cancelled} unpaid order(s) older than 5 days`);
    }
  }
}
