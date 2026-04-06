import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RegisterCustomerPaymentDto } from './dto/register-customer-payment.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async findAll(@Query('search') search?: string) {
    return this.customersService.findAll(search);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Get(':id/credit')
  @UseGuards(JwtAuthGuard)
  async getCreditStatus(@Param('id') id: string) {
    return this.customersService.getCreditStatus(id);
  }

  @Post(':id/payments')
  @UseGuards(JwtAuthGuard)
  async registerPayment(
    @Param('id') id: string,
    @Body() payload: RegisterCustomerPaymentDto,
  ) {
    return this.customersService.registerPayment(id, payload);
  }
}
