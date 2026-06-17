import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query('storeId') storeId?: string) {
    return this.ordersService.findAll(storeId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async findMine(@Req() req: Request & { user: { userId: number } }) {
    return this.ordersService.findMine(req.user.userId);
  }

  @Get('me/:id')
  @UseGuards(JwtAuthGuard)
  async findMyOne(
    @Param('id') id: string,
    @Req() req: Request & { user: { userId: number } },
  ) {
    return this.ordersService.findMyOne(id, req.user.userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  async create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, updateOrderStatusDto);
  }
}
