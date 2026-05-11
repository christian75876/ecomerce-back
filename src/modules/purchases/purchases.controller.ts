import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { RegisterPurchasePaymentDto } from './dto/register-purchase-payment.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { CancelPurchaseDto } from './dto/cancel-purchase.dto';
import { QueryPurchasesDto } from './dto/query-purchases.dto';

@Controller('purchases')
@UseGuards(JwtAuthGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  async findAll(@Query() query: QueryPurchasesDto) {
    return this.purchasesService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.purchasesService.findOne(id);
  }

  @Post()
  async create(@Body() payload: CreatePurchaseDto) {
    return this.purchasesService.create(payload);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() payload: UpdatePurchaseDto) {
    return this.purchasesService.update(id, payload);
  }

  @Post(':id/payments')
  async registerPayment(
    @Param('id') id: string,
    @Body() payload: RegisterPurchasePaymentDto,
  ) {
    return this.purchasesService.registerPayment(id, payload);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Body() payload: CancelPurchaseDto) {
    return this.purchasesService.cancel(id, payload);
  }
}
