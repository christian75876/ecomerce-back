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
  async subscribe(@Body() dto: SubscribePushDto, @Req() req: { user: { userId: number } }) {
    // JwtStrategy.validate() devuelve { userId, ... } — no { id } — así que esto
    // guardaba userId undefined en cada suscripción, dejando sendToUser() (usado
    // para avisar al comprador el cambio de estado de su pedido) sin nada que
    // encontrar nunca, aunque sendToAll() (nuevo pedido para vendedores) no le
    // afectaba porque ignora el userId.
    await this.pushService.subscribe(dto, req.user.userId);
    return { ok: true };
  }

  @Delete('unsubscribe')
  @UseGuards(JwtAuthGuard)
  async unsubscribe(@Body() dto: { endpoint: string }) {
    await this.pushService.unsubscribe(dto.endpoint);
    return { ok: true };
  }
}
