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
import { Throttle } from '@nestjs/throttler';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuthedRequest } from 'src/common/types/authed-request';
import { StoresService } from '../stores/stores.service';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly storesService: StoresService,
  ) {}

  /** undefined = sin restricción (admin); array = solo esas tiendas (seller). */
  private async resolveAllowedStoreIds(user: AuthedRequest['user']): Promise<string[] | undefined> {
    if (user.role !== 'seller') {
      return undefined;
    }
    const stores = await this.storesService.findMine(user.userId);
    return stores.map((s) => s.id);
  }

  @Get()
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async findAll(
    @Query('active', new ParseBoolPipe({ optional: true })) active?: boolean,
    @Query('storeId') storeId?: string,
  ) {
    return this.categoriesService.findAll(active, storeId);
  }

  // Panel de gestión (seller/admin): a diferencia de GET /categories
  // (catálogo público), esta SIEMPRE restringe a las tiendas del usuario
  // autenticado (más las categorías globales), sin depender de que el
  // frontend recuerde mandar storeId.
  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async findMine(
    @Query('active', new ParseBoolPipe({ optional: true })) active: boolean | undefined,
    @Query('storeId') storeId: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.categoriesService.findAll(active, storeId, allowedStoreIds);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async create(@Body() createCategoryDto: CreateCategoryDto, @Req() req: AuthedRequest) {
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
    @Req() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.categoriesService.update(id, updateCategoryDto, allowedStoreIds);
  }
}
