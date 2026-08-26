import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { StoresService } from '../stores/stores.service';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { GetSalesQueryDto } from './dto/get-sales-query.dto';

type AuthedRequest = Request & { user: { userId: number; role: string } };

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'seller')
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly storesService: StoresService,
  ) {}

  private async resolveAllowedStoreIds(
    user: AuthedRequest['user'],
  ): Promise<string[] | undefined> {
    if (user.role !== 'seller') {
      return undefined;
    }
    const stores = await this.storesService.findMine(user.userId);
    return stores.map((s) => s.id);
  }

  @Get()
  async findAll(@Query() query: GetSalesQueryDto, @Req() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.salesService.findAll(query, allowedStoreIds);
  }

  @Get('unified-history')
  async findAllUnifiedHistory(@Query() query: GetSalesQueryDto, @Req() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.salesService.findAllUnifiedHistory(query, allowedStoreIds);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.salesService.findOne(id, allowedStoreIds);
  }

  @Post()
  async create(@Body() createSaleDto: CreateSaleDto, @Req() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.salesService.create(createSaleDto, req.user.userId, allowedStoreIds);
  }
}
