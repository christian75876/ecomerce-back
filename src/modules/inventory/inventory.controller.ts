import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { InventoryService } from './inventory.service';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { CreateInventoryEntryDto } from './dto/create-inventory-entry.dto';
import { QueryInventoryBatchesDto } from './dto/query-inventory-batches.dto';
import { QueryExpiringInventoryDto } from './dto/query-expiring-inventory.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getInventorySummary() {
    return this.inventoryService.getInventorySummary();
  }

  @Get('movements')
  async getMovements(@Query('productId') productId?: string) {
    return this.inventoryService.getMovements(productId);
  }

  @Get('batches')
  async getBatches(@Query() query: QueryInventoryBatchesDto) {
    return this.inventoryService.getBatches(query);
  }

  @Get('expiring')
  async getExpiring(@Query() query: QueryExpiringInventoryDto) {
    return this.inventoryService.getExpiringBatches(query);
  }

  @Post('entries')
  @UseGuards(JwtAuthGuard)
  async registerEntry(@Body() payload: CreateInventoryEntryDto) {
    return this.inventoryService.registerEntry(payload);
  }

  @Post('movements')
  @UseGuards(JwtAuthGuard)
  async registerMovement(
    @Body() createInventoryMovementDto: CreateInventoryMovementDto,
  ) {
    return this.inventoryService.registerMovement(createInventoryMovementDto);
  }

  @Post('legacy/backfill')
  @UseGuards(JwtAuthGuard)
  async backfillLegacyBatches() {
    return this.inventoryService.backfillLegacyBatches();
  }
}
