import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';

const evidenceStorage = diskStorage({
  destination: './uploads/payment-evidence',
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${extname(file.originalname)}`);
  },
});

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query('storeId') storeId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('paymentStatus') paymentStatus?: string,
  ) {
    return this.ordersService.findAll(
      storeId,
      page ? (parseInt(page, 10) || 1) : 1,
      limit ? (parseInt(limit, 10) || 20) : 20,
      status || undefined,
      search?.trim() || undefined,
      paymentStatus || undefined,
    );
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
  @UseGuards(JwtAuthGuard)
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

  @Patch(':id/payment')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('evidenceImage', {
      storage: evidenceStorage,
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (/image\/(jpeg|png|webp|gif)/.test(file.mimetype)) cb(null, true);
        else cb(new Error('Solo se permiten imágenes (jpg, png, webp)'), false);
      },
    }),
  )
  async submitPayment(
    @Param('id') id: string,
    @Body() submitPaymentDto: SubmitPaymentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const imagePath = file ? `uploads/payment-evidence/${file.filename}` : undefined;
    return this.ordersService.submitPayment(id, submitPaymentDto, imagePath);
  }

  @Patch(':id/confirm-payment')
  @UseGuards(JwtAuthGuard)
  async confirmPayment(
    @Param('id') id: string,
    @Req() req: Request & { user: { userId: number } },
  ) {
    return this.ordersService.confirmPayment(id, req.user.userId);
  }
}
