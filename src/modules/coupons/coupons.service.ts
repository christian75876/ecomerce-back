import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Coupon, CouponType } from './entities/coupon.entity';
import { CreateCouponDto } from './dto/create-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponsRepository: Repository<Coupon>,
  ) {}

  async create(dto: CreateCouponDto, allowedStoreIds?: string[]) {
    const code = dto.code.trim().toUpperCase();
    const storeId = dto.storeId ?? null;

    if (allowedStoreIds && (!storeId || !allowedStoreIds.includes(storeId))) {
      throw new ForbiddenException('No tienes permisos para crear cupones en esta tienda');
    }

    const existing = await this.couponsRepository.findOne({
      where: { code, storeId: storeId ?? IsNull() },
    });
    if (existing) throw new ConflictException('Ya existe un cupón con ese código en esta tienda');

    if (dto.type === CouponType.PERCENTAGE && dto.value > 100) {
      throw new BadRequestException('El descuento porcentual no puede superar 100%');
    }

    const coupon = this.couponsRepository.create({
      code,
      storeId,
      type: dto.type,
      value: dto.value,
      minOrderAmount: dto.minOrderAmount ?? null,
      maxUses: dto.maxUses ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    return this.couponsRepository.save(coupon);
  }

  async findAll(allowedStoreIds?: string[]) {
    return this.couponsRepository.find({
      where: allowedStoreIds ? { storeId: In(allowedStoreIds) } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async remove(id: string, allowedStoreIds?: string[]) {
    const coupon = await this.couponsRepository.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException('Cupón no encontrado');
    if (allowedStoreIds && (!coupon.storeId || !allowedStoreIds.includes(coupon.storeId))) {
      throw new NotFoundException('Cupón no encontrado');
    }
    await this.couponsRepository.remove(coupon);
    return { removed: true };
  }

  /**
   * storeId: la tienda única del carrito que se está cotizando/creando, o
   * `null` cuando el carrito mezcla productos de varias tiendas (mismo
   * criterio que `customerStoreId` en orders.service.ts) o aún no se sabe
   * (preview de "aplicar cupón" antes de calcular el desglose por tienda).
   * Un cupón de tienda (storeId propio) solo es válido si coincide
   * exactamente con esa tienda — nunca aplica a pedidos de otra tienda ni a
   * carritos multi-tienda. Uno global (storeId null) siempre aplica.
   */
  async validate(
    code: string,
    orderAmount: number,
    storeId?: string | null,
  ): Promise<{ coupon: Coupon; discountAmount: number }> {
    const normalized = code.trim().toUpperCase();
    const coupon = await this.couponsRepository.findOne({ where: { code: normalized } });

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Cupón inválido o inactivo');
    }
    if (coupon.storeId && coupon.storeId !== storeId) {
      throw new BadRequestException('Este cupón no aplica a los productos de tu carrito');
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
