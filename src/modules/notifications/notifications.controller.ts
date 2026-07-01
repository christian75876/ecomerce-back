import {
  CanActivate,
  Controller,
  ExecutionContext,
  Injectable,
  MessageEvent,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { NotificationsService } from './notifications.service';

@Injectable()
class SseJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const token: string | undefined =
      (req.headers.authorization as string | undefined)?.replace('Bearer ', '') ??
      (req.query?.token as string | undefined);

    if (!token) return false;

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      req.user = {
        userId: payload.sub ?? payload.userId,
        role: payload.role ?? null,
      };
      return true;
    } catch {
      return false;
    }
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Sse('stream')
  @UseGuards(SseJwtGuard)
  stream(@Req() req: any): Observable<MessageEvent> {
    return this.notificationsService.subscribe(req.user.userId as number);
  }
}
