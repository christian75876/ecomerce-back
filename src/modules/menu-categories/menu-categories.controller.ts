import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MenuCategoriesService } from './menu-categories.service';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('menu-categories')
export class MenuCategoriesController {
  constructor(private readonly service: MenuCategoriesService) {}

  @Get()
  findByStore(@Query('storeId') storeId: string) {
    return this.service.findByStore(storeId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  create(@Body() payload: CreateMenuCategoryDto, @Req() req: any) {
    return this.service.create(payload, req.user.userId as number, req.user.role === 'admin');
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  update(@Param('id') id: string, @Body() payload: UpdateMenuCategoryDto, @Req() req: any) {
    return this.service.update(id, payload, req.user.userId as number, req.user.role === 'admin');
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.userId as number, req.user.role === 'admin');
  }
}
