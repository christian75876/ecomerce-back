import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { PushService } from './push.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return { publicKey: this.pushService.getVapidPublicKey() };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(@Body() dto: SubscribePushDto, @Req() req: { user: { id: number } }) {
    await this.pushService.subscribe(dto, req.user.id);
    return { ok: true };
  }

  @Delete('unsubscribe')
  @UseGuards(JwtAuthGuard)
  async unsubscribe(@Body() dto: { endpoint: string }) {
    await this.pushService.unsubscribe(dto.endpoint);
    return { ok: true };
  }
}
