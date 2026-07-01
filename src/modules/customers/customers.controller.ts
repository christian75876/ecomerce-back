import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RegisterCustomerPaymentDto } from './dto/register-customer-payment.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { StoresService } from '../stores/stores.service';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly storesService: StoresService,
  ) {}

  @Get()
  async findAll(
    @Query() query: QueryCustomersDto,
    @Request() req: { user: { userId: number; role: string } },
  ) {
    let allowedStoreIds: string[] | undefined;
    if (req.user.role === 'seller') {
      const stores = await this.storesService.findMine(req.user.userId);
      allowedStoreIds = stores.map((s) => s.id);
    }
    return this.customersService.findAll(query, allowedStoreIds);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.customersService.findOne(id, storeId);
  }

  @Post()
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @Query('storeId') storeId?: string,
  ) {
    return this.customersService.update(id, updateCustomerDto, storeId);
  }

  @Get(':id/credit')
  async getCreditStatus(
    @Param('id') id: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.customersService.getCreditStatus(id, storeId);
  }

  @Post(':id/payments')
  async registerPayment(
    @Param('id') id: string,
    @Body() payload: RegisterCustomerPaymentDto,
    @Query('storeId') storeId?: string,
  ) {
    return this.customersService.registerPayment(id, payload, storeId);
  }
}
