import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon, CouponType } from './entities/coupon.entity';
import { CreateCouponDto } from './dto/create-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponsRepository: Repository<Coupon>,
  ) {}

  async create(dto: CreateCouponDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.couponsRepository.findOne({ where: { code } });
    if (existing) throw new ConflictException('Ya existe un cupón con ese código');

    if (dto.type === CouponType.PERCENTAGE && dto.value > 100) {
      throw new BadRequestException('El descuento porcentual no puede superar 100%');
    }

    const coupon = this.couponsRepository.create({
      code,
      type: dto.type,
      value: dto.value,
      minOrderAmount: dto.minOrderAmount ?? null,
      maxUses: dto.maxUses ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    return this.couponsRepository.save(coupon);
  }

  async findAll() {
    return this.couponsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async remove(id: string) {
    const coupon = await this.couponsRepository.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException('Cupón no encontrado');
    await this.couponsRepository.remove(coupon);
    return { removed: true };
  }

  async validate(code: string, orderAmount: number): Promise<{ coupon: Coupon; discountAmount: number }> {
    const normalized = code.trim().toUpperCase();
    const coupon = await this.couponsRepository.findOne({ where: { code: normalized } });

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Cupón inválido o inactivo');
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException('El cupón ha expirado');
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('El cupón ha alcanzado su límite de usos');
    }
    if (coupon.minOrderAmount !== null && orderAmount < Number(coupon.minOrderAmount)) {
      throw new BadRequestException(
        `El pedido mínimo para este cupón es $${Number(coupon.minOrderAmount).toLocaleString('es-CO')}`,
      );
    }

    const discountAmount =
      coupon.type === CouponType.PERCENTAGE
        ? Math.round((orderAmount * Number(coupon.value)) / 100)
        : Math.min(Number(coupon.value), orderAmount);

    return { coupon, discountAmount };
  }

  async incrementUsage(couponId: string) {
    await this.couponsRepository.increment({ id: couponId }, 'usedCount', 1);
  }
}
