import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { QuerySupplierOptionsDto } from './dto/query-supplier-options.dto';

@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  async findAll(@Query('search') search?: string) {
    return this.suppliersService.findAll(search);
  }

  @Get('options')
  async getOptions(@Query() query: QuerySupplierOptionsDto) {
    return this.suppliersService.getOptions(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Post()
  async create(@Body() payload: CreateSupplierDto) {
    return this.suppliersService.create(payload);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() payload: UpdateSupplierDto) {
    return this.suppliersService.update(id, payload);
  }
}
