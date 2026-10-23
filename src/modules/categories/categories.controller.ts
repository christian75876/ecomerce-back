import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
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
import { DataSource } from 'typeorm';
import { findPublicCategoryCollection, findPublicCategoryCollections } from './category-collections';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly storesService: StoresService,
    private readonly dataSource: DataSource,
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

  // Catálogo público por categoría (/categorias y /categorias/:slug): agrupa
  // por nombre las categorías de todas las tiendas. categoryIds no se expone:
  // el frontend filtra productos por slug (GET /products?categorySlug=).
  @Get('collections')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async findCollections() {
    const collections = await findPublicCategoryCollections(this.dataSource.manager);
    return collections.map(({ categoryIds: _ids, ...collection }) => collection);
  }

  @Get('collections/:slug')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async findCollection(@Param('slug') slug: string) {
    const collection = await findPublicCategoryCollection(this.dataSource.manager, slug);
    if (!collection) throw new NotFoundException('Categoría no encontrada');
    const { categoryIds: _ids, ...rest } = collection;
    return rest;
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
