import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AdvertisingService } from './advertising.service';
import { CreateAdvertisementDto } from './dto/create-advertisement.dto';

@Controller('advertising')
@UseGuards(JwtAuthGuard)
export class AdvertisingController {
  constructor(private readonly advertisingService: AdvertisingService) {}

  @Get('admin-dashboard')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async getAdminDashboard() {
    return this.advertisingService.getAdminDashboard();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async registerAdvertisement(
    @Body() dto: CreateAdvertisementDto,
    @Req() req: Request & { user: { userId: number } },
  ) {
    return this.advertisingService.registerAdvertisement(dto, req.user?.userId);
  }

  @Get('stores/:storeId')
  async getStoreAdvertisements(@Param('storeId') storeId: string) {
    return this.advertisingService.getStoreAdvertisements(storeId);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async cancelAdvertisement(@Param('id') id: string) {
    return this.advertisingService.cancelAdvertisement(id);
  }
}
