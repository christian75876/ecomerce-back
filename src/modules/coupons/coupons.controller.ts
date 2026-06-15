import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  findAll() {
    return this.couponsService.findAll();
  }

  @Get('validate')
  async validateCoupon(
    @Query('code') code: string,
    @Query('orderAmount') orderAmount: string,
  ) {
    if (!code) return { valid: false, message: 'Código requerido' };
    const amount = parseFloat(orderAmount) || 0;
    try {
      const { coupon, discountAmount } = await this.couponsService.validate(code, amount);
      return {
        valid: true,
        coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: Number(coupon.value) },
        discountAmount,
      };
    } catch (err) {
      return { valid: false, message: (err as Error).message };
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }
}
