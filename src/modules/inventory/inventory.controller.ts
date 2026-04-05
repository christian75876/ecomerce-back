import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { InventoryService } from './inventory.service';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';

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

  @Post('movements')
  @UseGuards(JwtAuthGuard)
  async registerMovement(
    @Body() createInventoryMovementDto: CreateInventoryMovementDto,
  ) {
    return this.inventoryService.registerMovement(createInventoryMovementDto);
  }
}
