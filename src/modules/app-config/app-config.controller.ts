import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { UpdateAppConfigDto } from './dto/update-app-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('app-config')
export class AppConfigController {
  constructor(private readonly service: AppConfigService) {}

  @Get()
  getConfig() {
    return this.service.getConfig();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateConfig(@Body() dto: UpdateAppConfigDto) {
    return this.service.updateConfig(dto);
  }
}
