import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuthedRequest, AuthedUser } from 'src/common/types/authed-request';
import { StoresService } from '../stores/stores.service';
import { InventoryService } from './inventory.service';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { CreateInventoryEntryDto } from './dto/create-inventory-entry.dto';
import { QueryInventoryBatchesDto } from './dto/query-inventory-batches.dto';
import { QueryExpiringInventoryDto } from './dto/query-expiring-inventory.dto';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly storesService: StoresService,
  ) {}

  /** undefined = sin restricción (admin); array = solo esas tiendas (seller). */
  private async resolveAllowedStoreIds(user: AuthedUser): Promise<string[] | undefined> {
    if (user.role !== 'seller') {
      return undefined;
    }
    const stores = await this.storesService.findMine(user.userId);
    return stores.map((s) => s.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async getInventorySummary(
    @Req() req: AuthedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('storeId') storeId?: string,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.inventoryService.getInventorySummary(
      page ? Number(page) : 1,
      limit ? Math.min(Number(limit), 500) : 20,
      storeId,
      allowedStoreIds,
    );
  }

  @Get('movements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async getMovements(
    @Req() req: AuthedRequest,
    @Query('productId') productId?: string,
    @Query('storeId') storeId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.inventoryService.getMovements(
      productId,
      page ? Number(page) : 1,
      limit ? Math.min(Number(limit), 500) : 20,
      storeId,
      allowedStoreIds,
    );
  }

  @Get('batches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async getBatches(@Query() query: QueryInventoryBatchesDto, @Req() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.inventoryService.getBatches(query, allowedStoreIds);
  }

  @Get('expiring')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async getExpiring(@Query() query: QueryExpiringInventoryDto, @Req() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.inventoryService.getExpiringBatches(query, allowedStoreIds);
  }

  @Post('entries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async registerEntry(@Body() payload: CreateInventoryEntryDto, @Req() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.inventoryService.registerEntry(payload, allowedStoreIds);
  }

  @Post('movements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async registerMovement(
    @Body() createInventoryMovementDto: CreateInventoryMovementDto,
    @Req() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.inventoryService.registerMovement(createInventoryMovementDto, allowedStoreIds);
  }

  @Post('legacy/backfill')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async backfillLegacyBatches() {
    return this.inventoryService.backfillLegacyBatches();
  }
}
