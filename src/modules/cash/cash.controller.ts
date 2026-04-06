import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { CashService } from './cash.service';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';

@Controller('cash')
@UseGuards(JwtAuthGuard)
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Get('sessions')
  async findSessions() {
    return this.cashService.findSessions();
  }

  @Get('sessions/:id/movements')
  async getSessionMovements(@Param('id') id: string) {
    return this.cashService.getSessionMovements(id);
  }

  @Post('sessions')
  async openSession(
    @Req() req: Request & { user: { userId: number } },
    @Body() payload: OpenCashSessionDto,
  ) {
    return this.cashService.openSession(req.user.userId, payload);
  }

  @Patch('sessions/:id/close')
  async closeSession(@Param('id') id: string, @Body() payload: CloseCashSessionDto) {
    return this.cashService.closeSession(id, payload);
  }

  @Post('sessions/:id/movements')
  async addMovement(@Param('id') id: string, @Body() payload: CreateCashMovementDto) {
    return this.cashService.addMovement(id, payload);
  }
}
