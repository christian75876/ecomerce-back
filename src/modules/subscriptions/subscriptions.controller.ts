import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CreatePlanDto } from './dto/create-plan.dto';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // ── Admin Dashboard ──────────────────────────────────────────────────────
  @Get('admin-dashboard')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async getAdminDashboard() {
    return this.subscriptionsService.getAdminDashboard();
  }

  // ── Plans ────────────────────────────────────────────────────────────────
  @Get('plans')
  async getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Post('plans')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.subscriptionsService.createPlan(dto);
  }

  @Patch('plans/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async updatePlan(@Param('id') id: string, @Body() dto: Partial<CreatePlanDto>) {
    return this.subscriptionsService.updatePlan(id, dto);
  }

  // ── Store Subscriptions ──────────────────────────────────────────────────
  @Get('stores/:storeId')
  async getStoreSubscriptions(@Param('storeId') storeId: string) {
    return this.subscriptionsService.getStoreSubscriptions(storeId);
  }

  @Get('stores/:storeId/status')
  async getStoreStatus(@Param('storeId') storeId: string) {
    return this.subscriptionsService.getStoreSubscriptionStatus(storeId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async registerPayment(
    @Body() dto: CreateSubscriptionDto,
    @Req() req: Request & { user: { userId: number } },
  ) {
    return this.subscriptionsService.registerPayment(dto, req.user?.userId);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async cancelSubscription(@Param('id') id: string) {
    return this.subscriptionsService.cancelSubscription(id);
  }
}
