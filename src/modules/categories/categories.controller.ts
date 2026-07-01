import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { StoresService } from '../stores/stores.service';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly storesService: StoresService,
  ) {}

  @Get()
  async findAll(
    @Query('active', new ParseBoolPipe({ optional: true })) active?: boolean,
    @Query('storeId') storeId?: string,
  ) {
    return this.categoriesService.findAll(active, storeId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async create(@Body() createCategoryDto: CreateCategoryDto, @Req() req: any) {
    if (req.user.role === 'seller') {
      const stores = await this.storesService.findMine(req.user.userId);
      if (!stores.length) {
        throw new ForbiddenException('No tienes una tienda asignada');
      }
      createCategoryDto.storeId = stores[0].id;
    }
    return this.categoriesService.create(createCategoryDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }
}
