import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { QuerySupplierOptionsDto } from './dto/query-supplier-options.dto';
import { StoresService } from '../stores/stores.service';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'seller')
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly storesService: StoresService,
  ) {}

  private async getSellerStoreIds(userId: number): Promise<string[]> {
    const stores = await this.storesService.findMine(userId);
    return stores.map((s) => s.id);
  }

  @Get()
  async findAll(
    @Query('search') search: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('storeId') storeId: string | undefined,
    @Request() req: { user: { userId: number; role: string } },
  ) {
    let allowedStoreIds: string[] | undefined;
    if (req.user.role === 'seller') {
      allowedStoreIds = await this.getSellerStoreIds(req.user.userId);
    } else if (storeId) {
      allowedStoreIds = [storeId];
    }
    return this.suppliersService.findAll(
      search,
      allowedStoreIds,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 15,
    );
  }

  @Get('options')
  async getOptions(
    @Query() query: QuerySupplierOptionsDto,
    @Request() req: { user: { userId: number; role: string } },
  ) {
    const allowedStoreIds =
      req.user.role === 'seller'
        ? await this.getSellerStoreIds(req.user.userId)
        : undefined;
    return this.suppliersService.getOptions(query, allowedStoreIds);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Post()
  async create(
    @Body() payload: CreateSupplierDto,
    @Request() req: { user: { userId: number; role: string } },
  ) {
    if (req.user.role === 'seller' && !payload.storeId) {
      const stores = await this.storesService.findMine(req.user.userId);
      if (stores.length > 0) payload.storeId = stores[0].id;
    }
    return this.suppliersService.create(payload);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() payload: UpdateSupplierDto) {
    return this.suppliersService.update(id, payload);
  }
}
