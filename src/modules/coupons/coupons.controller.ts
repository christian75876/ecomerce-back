import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuthedRequest, AuthedUser } from 'src/common/types/authed-request';
import { StoresService } from '../stores/stores.service';

@Controller('coupons')
export class CouponsController {
  constructor(
    private readonly couponsService: CouponsService,
    private readonly storesService: StoresService,
  ) {}

  /** undefined = sin restricción (admin); array = solo esas tiendas (seller). */
  private async resolveAllowedStoreIds(user: AuthedUser): Promise<string[] | undefined> {
    if (user.role !== 'seller') {
      return undefined;
    }
    const stores = await this.storesService.findMine(user.userId);
    return stores.map((s) => s.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async create(@Body() dto: CreateCouponDto, @Req() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.couponsService.create(dto, allowedStoreIds);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async findAll(@Req() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.couponsService.findAll(allowedStoreIds);
  }

  @Get('validate')
  async validateCoupon(
    @Query('code') code: string,
    @Query('orderAmount') orderAmount: string,
    @Query('storeId') storeId?: string,
  ) {
    if (!code) return { valid: false, message: 'Código requerido' };
    const amount = parseFloat(orderAmount) || 0;
    try {
      const { coupon, discountAmount } = await this.couponsService.validate(code, amount, storeId ?? null);
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
  async remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.couponsService.remove(id, allowedStoreIds);
  }
}
