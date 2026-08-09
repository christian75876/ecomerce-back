import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { QueryDashboardAnalyticsDto } from './dto/query-dashboard-analytics.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'seller')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@Req() req: Request & { user: { userId: number; role: string } }) {
    return this.dashboardService.getSummary(req.user.userId, req.user.role);
  }

  @Get('analytics')
  async getAnalytics(
    @Query() query: QueryDashboardAnalyticsDto,
    @Req() req: Request & { user: { userId: number; role: string } },
  ) {
    return this.dashboardService.getAnalytics(query, req.user.userId, req.user.role);
  }
}
