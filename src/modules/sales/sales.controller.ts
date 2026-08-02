import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { GetSalesQueryDto } from './dto/get-sales-query.dto';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query() query: GetSalesQueryDto) {
    return this.salesService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createSaleDto: CreateSaleDto) {
    return this.salesService.create(createSaleDto);
  }
}
