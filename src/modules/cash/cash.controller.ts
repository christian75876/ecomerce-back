import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { StoresService } from '../stores/stores.service';
import { CashService } from './cash.service';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';

type AuthedRequest = Request & { user: { userId: number; role: string } };

@Controller('cash')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'seller')
export class CashController {
  constructor(
    private readonly cashService: CashService,
    private readonly storesService: StoresService,
  ) {}

  private async resolveAllowedStoreIds(
    user: AuthedRequest['user'],
  ): Promise<string[] | undefined> {
    if (user.role !== 'seller') {
      return undefined;
    }
    const stores = await this.storesService.findMine(user.userId);
    return stores.map((s) => s.id);
  }

  @Get('sessions')
  async findSessions(@Query('storeId') storeId: string | undefined, @Req() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.cashService.findSessions(storeId, allowedStoreIds);
  }

  @Get('sessions/:id/movements')
  async getSessionMovements(@Param('id') id: string, @Req() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.cashService.getSessionMovements(id, allowedStoreIds);
  }

  @Post('sessions')
  async openSession(@Req() req: AuthedRequest, @Body() payload: OpenCashSessionDto) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.cashService.openSession(req.user.userId, payload, allowedStoreIds);
  }

  @Patch('sessions/:id/close')
  async closeSession(
    @Param('id') id: string,
    @Body() payload: CloseCashSessionDto,
    @Req() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.cashService.closeSession(id, payload, allowedStoreIds);
  }

  @Post('sessions/:id/movements')
  async addMovement(
    @Param('id') id: string,
    @Body() payload: CreateCashMovementDto,
    @Req() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.cashService.addMovement(id, payload, allowedStoreIds);
  }
}
