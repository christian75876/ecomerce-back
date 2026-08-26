import {
  BadRequestException,
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
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { isValidImageBuffer } from 'src/common/utils/validate-image-magic-bytes';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async findAll(
    @Req() req: Request & { user: { userId: number; role: string } },
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
      req.user.userId,
      req.user.role,
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: { userId: number; role: string } },
  ) {
    return this.ordersService.findOne(id, req.user.userId, req.user.role);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
    @Req() req: Request & { user: { userId: number; role: string } },
  ) {
    return this.ordersService.updateStatus(id, updateOrderStatusDto, req.user.userId, req.user.role);
  }

  @Patch(':id/payment')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('evidenceImage', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (/image\/(jpeg|png|webp)/.test(file.mimetype)) cb(null, true);
        else cb(new Error('Solo se permiten imágenes (jpg, png, webp)'), false);
      },
    }),
  )
  async submitPayment(
    @Param('id') id: string,
    @Body() submitPaymentDto: SubmitPaymentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file && !isValidImageBuffer(file.buffer)) {
      throw new BadRequestException('El comprobante no es una imagen JPEG, PNG o WebP válida');
    }
    const imagePath = file
      ? await this.cloudinaryService.uploadImage(file.buffer, 'payment-evidence')
      : undefined;
    return this.ordersService.submitPayment(id, submitPaymentDto, imagePath);
  }

  @Patch(':id/confirm-payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async confirmPayment(
    @Param('id') id: string,
    @Req() req: Request & { user: { userId: number; role: string } },
  ) {
    return this.ordersService.confirmPayment(id, req.user.userId, req.user.role);
  }
}
