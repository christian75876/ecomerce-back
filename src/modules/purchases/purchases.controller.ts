import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Controller('purchases')
@UseGuards(JwtAuthGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  async findAll() {
    return this.purchasesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.purchasesService.findOne(id);
  }

  @Post()
  async create(@Body() payload: CreatePurchaseDto) {
    return this.purchasesService.create(payload);
  }
}
