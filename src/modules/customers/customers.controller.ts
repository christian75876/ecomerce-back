import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RegisterCustomerPaymentDto } from './dto/register-customer-payment.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { StoresService } from '../stores/stores.service';

type AuthedRequest = { user: { userId: number; role: string } };

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'seller')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
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
  async findAll(@Query() query: QueryCustomersDto, @Request() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.customersService.findAll(query, allowedStoreIds);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('storeId') storeId: string | undefined,
    @Request() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.customersService.findOne(id, storeId, allowedStoreIds);
  }

  @Post()
  async create(@Body() createCustomerDto: CreateCustomerDto, @Request() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.customersService.create(createCustomerDto, allowedStoreIds);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @Query('storeId') storeId: string | undefined,
    @Request() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.customersService.update(id, updateCustomerDto, storeId, allowedStoreIds);
  }

  @Get(':id/credit')
  async getCreditStatus(
    @Param('id') id: string,
    @Query('storeId') storeId: string | undefined,
    @Request() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.customersService.getCreditStatus(id, storeId, allowedStoreIds);
  }

  @Post(':id/payments')
  async registerPayment(
    @Param('id') id: string,
    @Body() payload: RegisterCustomerPaymentDto,
    @Query('storeId') storeId: string | undefined,
    @Request() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.customersService.registerPayment(id, payload, storeId, allowedStoreIds);
  }
}
