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
import { Request } from 'express';
import { PurchasesService } from './purchases.service';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { RegisterPurchasePaymentDto } from './dto/register-purchase-payment.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { CancelPurchaseDto } from './dto/cancel-purchase.dto';
import { QueryPurchasesDto } from './dto/query-purchases.dto';
import { memoryStorage } from 'multer';

type AuthedRequest = Request & { user: { userId: number; role: string } };

const allowedReceiptMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Controller('purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'seller')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  async findAll(@Query() query: QueryPurchasesDto, @Req() req: AuthedRequest) {
    return this.purchasesService.findAll(query, req.user.userId, req.user.role);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.purchasesService.findOne(id, req.user.userId, req.user.role);
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
  @UseInterceptors(
    FileInterceptor('receiptImage', {
      storage: memoryStorage(),
      fileFilter: (_req, file, callback) => {
        if (!allowedReceiptMimeTypes.has(file.mimetype)) {
          return callback(new BadRequestException('Invalid receipt image format'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async registerPayment(
    @Param('id') id: string,
    @Body() payload: RegisterPurchasePaymentDto,
    @UploadedFile() receiptImage?: Express.Multer.File,
  ) {
    return this.purchasesService.registerPayment(id, payload, receiptImage);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Body() payload: CancelPurchaseDto) {
    return this.purchasesService.cancel(id, payload);
  }
}
