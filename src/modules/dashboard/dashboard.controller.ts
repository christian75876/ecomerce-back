import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
  async getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('analytics')
  async getAnalytics(@Query() query: QueryDashboardAnalyticsDto) {
    return this.dashboardService.getAnalytics(query);
  }
}
