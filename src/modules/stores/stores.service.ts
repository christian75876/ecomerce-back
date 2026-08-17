import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Or, Repository } from 'typeorm';
import { Store, StoreType } from './entities/store.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { UpdateStoreNotificationsDto } from './dto/update-store-notifications.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async findAll(active?: boolean) {
    const where: Record<string, unknown> =
      typeof active === 'boolean' ? { isActive: active } : {};

    // Only show stores that belong to a seller (userId not null)
    // System/default stores (userId = null) are excluded from the public marketplace
    where.userId = Not(IsNull());

    if (active === true) {
      // Exclude stores with an expired subscription
      where.subscriptionExpiresAt = Or(IsNull(), MoreThan(new Date()));
    }

    const stores = await this.storesRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    const ratingMap = await this.getStoreRatingMap(stores.map((s) => s.id));
    return stores.map(({ wppApiKey: _omit, email: _email, ...rest }) => ({
      ...rest,
      averageRating: ratingMap.get(rest.id)?.averageRating ?? null,
      reviewCount: ratingMap.get(rest.id)?.reviewCount ?? 0,
    }));
  }

  async findOneById(id: string) {
    const store = await this.storesRepository.findOne({ where: { id } });

    if (!store) {
      throw new NotFoundException('Tienda no encontrada');
    }

    return store;
  }

  async findOneBySlug(slug: string, publicOnly = false) {
    const store = await this.storesRepository.findOne({
      where: publicOnly ? { slug, isActive: true } : { slug },
    });

    if (!store) throw new NotFoundException('Tienda no encontrada');

    if (publicOnly && store.subscriptionExpiresAt && new Date(store.subscriptionExpiresAt) < new Date()) {
      throw new NotFoundException('Tienda no encontrada');
    }

    const ratingMap = await this.getStoreRatingMap([store.id]);
    const rating = {
      averageRating: ratingMap.get(store.id)?.averageRating ?? null,
      reviewCount: ratingMap.get(store.id)?.reviewCount ?? 0,
    };

    if (publicOnly) {
      const { wppApiKey: _omit, email: _email, ...rest } = store;
      return { ...rest, ...rating };
    }

    return { ...store, ...rating };
  }

  async findMine(userId: number) {
    return this.storesRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateNotifications(
    id: string,
    payload: UpdateStoreNotificationsDto,
    requestingUserId: number,
    isAdmin: boolean,
  ) {
    const store = await this.findOneById(id);

    if (!isAdmin && store.userId !== requestingUserId) {
      throw new ForbiddenException('No tienes permisos para editar esta tienda');
    }

    Object.assign(store, {
      wppNotificationsEnabled: typeof payload.wppNotificationsEnabled === 'boolean'
        ? payload.wppNotificationsEnabled
        : store.wppNotificationsEnabled,
      wppApiKey: typeof payload.wppApiKey === 'string'
        ? payload.wppApiKey.trim() || null
        : store.wppApiKey,
      whatsappNumber: typeof payload.whatsappNumber === 'string'
        ? payload.whatsappNumber.trim() || null
        : store.whatsappNumber,
    });

    return this.storesRepository.save(store);
  }

  async create(payload: CreateStoreDto) {
    await this.ensureUniqueSlug(payload.slug);

    const store = this.storesRepository.create({
      name: payload.name.trim(),
      slug: payload.slug.trim().toLowerCase(),
      logoUrl: payload.logoUrl?.trim() || null,
      bannerUrl: payload.bannerUrl?.trim() || null,
      primaryColor: payload.primaryColor?.trim() || null,
      secondaryColor: payload.secondaryColor?.trim() || null,
      description: payload.description?.trim() || null,
      phone: payload.phone?.trim() || null,
      whatsappNumber: payload.whatsappNumber?.trim() || null,
      email: payload.email?.trim().toLowerCase() || null,
      isActive: payload.isActive ?? true,
      isAdultContent: false,
      storeType: payload.storeType ?? StoreType.STORE,
      menuPdfUrl: payload.menuPdfUrl?.trim() || null,
      userId: payload.userId ?? null,
      deliveryOptions: payload.deliveryOptions,
      accentColor: payload.accentColor?.trim() || null,
      bgColor: payload.bgColor?.trim() || null,
      textColor: payload.textColor?.trim() || null,
      fontStyle: payload.fontStyle,
      buttonStyle: payload.buttonStyle,
      layoutStyle: payload.layoutStyle,
      coverStyle: payload.coverStyle,
    });

    return this.storesRepository.save(store);
  }

  async update(id: string, payload: UpdateStoreDto, userId?: number, isAdmin = true) {
    const store = isAdmin ? await this.findOneById(id) : await this.findOneOwned(id, userId!, false);

    if (!isAdmin) {
      // Sellers cannot change admin-controlled fields
      delete payload.isActive;
      delete payload.isPremiumAdvertiser;
      delete payload.subscriptionExpiresAt;
    }

    if (payload.slug) {
      await this.ensureUniqueSlug(payload.slug, id);
    }

    Object.assign(store, {
      name: payload.name?.trim() ?? store.name,
      slug: payload.slug?.trim().toLowerCase() ?? store.slug,
      logoUrl:
        typeof payload.logoUrl === 'string'
          ? payload.logoUrl.trim() || null
          : store.logoUrl,
      bannerUrl:
        typeof payload.bannerUrl === 'string'
          ? payload.bannerUrl.trim() || null
          : store.bannerUrl,
      primaryColor:
        typeof payload.primaryColor === 'string'
          ? payload.primaryColor.trim() || null
          : store.primaryColor,
      secondaryColor:
        typeof payload.secondaryColor === 'string'
          ? payload.secondaryColor.trim() || null
          : store.secondaryColor,
      description:
        typeof payload.description === 'string'
          ? payload.description.trim() || null
          : store.description,
      phone:
        typeof payload.phone === 'string'
          ? payload.phone.trim() || null
          : store.phone,
      whatsappNumber:
        typeof payload.whatsappNumber === 'string'
          ? payload.whatsappNumber.trim() || null
          : store.whatsappNumber,
      email:
        typeof payload.email === 'string'
          ? payload.email.trim().toLowerCase() || null
          : store.email,
      isActive:
        typeof payload.isActive === 'boolean'
          ? payload.isActive
          : store.isActive,
      isAdultContent:
        typeof payload.isAdultContent === 'boolean'
          ? payload.isAdultContent
          : store.isAdultContent,
      isPremiumAdvertiser:
        typeof payload.isPremiumAdvertiser === 'boolean'
          ? payload.isPremiumAdvertiser
          : store.isPremiumAdvertiser,
      subscriptionExpiresAt:
        payload.subscriptionExpiresAt !== undefined
          ? (payload.subscriptionExpiresAt ? new Date(payload.subscriptionExpiresAt) : null)
          : store.subscriptionExpiresAt,
      storeType: payload.storeType ?? store.storeType,
      menuPdfUrl:
        typeof payload.menuPdfUrl === 'string'
          ? payload.menuPdfUrl.trim() || null
          : store.menuPdfUrl,
      deliveryOptions: payload.deliveryOptions ?? store.deliveryOptions,
      accentColor: typeof payload.accentColor === 'string' ? payload.accentColor.trim() || null : store.accentColor,
      bgColor: typeof payload.bgColor === 'string' ? payload.bgColor.trim() || null : store.bgColor,
      textColor: typeof payload.textColor === 'string' ? payload.textColor.trim() || null : store.textColor,
      fontStyle: payload.fontStyle ?? store.fontStyle,
      buttonStyle: payload.buttonStyle ?? store.buttonStyle,
      layoutStyle: payload.layoutStyle ?? store.layoutStyle,
      coverStyle: payload.coverStyle ?? store.coverStyle,
      wppNotificationsEnabled: typeof payload.wppNotificationsEnabled === 'boolean' ? payload.wppNotificationsEnabled : store.wppNotificationsEnabled,
      wppApiKey: typeof payload.wppApiKey === 'string' ? payload.wppApiKey.trim() || null : store.wppApiKey,
      lat: payload.lat !== undefined ? payload.lat : store.lat,
      lng: payload.lng !== undefined ? payload.lng : store.lng,
      addressText: typeof payload.addressText === 'string' ? payload.addressText.trim() || null : store.addressText,
    });

    return this.storesRepository.save(store);
  }

  async findAllAdmin(query: { page?: number; limit?: number; search?: string; status?: string }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 15;
    const now = new Date();

    const builder = this.storesRepository
      .createQueryBuilder('store')
      .orderBy('store.createdAt', 'DESC');

    if (query.search?.trim()) {
      builder.where('(store.name ILIKE :search OR store.email ILIKE :search)', {
        search: `%${query.search.trim()}%`,
      });
    }

    if (query.status === 'active') {
      builder.andWhere('store.isActive = true');
    } else if (query.status === 'inactive') {
      builder.andWhere('store.isActive = false');
    }

    const [stores, totalItems] = await builder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const items = stores.map((store) => ({
      ...store,
      subscriptionStatus: !store.subscriptionExpiresAt
        ? ('NEVER' as const)
        : store.subscriptionExpiresAt > now
        ? ('ACTIVE' as const)
        : ('EXPIRED' as const),
    }));

    return {
      items,
      pagination: {
        totalItems,
        itemCount: stores.length,
        itemsPerPage: limit,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
      },
    };
  }

  async uploadLogo(id: string, file: Express.Multer.File, userId: number, isAdmin: boolean) {
    const store = await this.findOneOwned(id, userId, isAdmin);
    store.logoUrl = await this.cloudinaryService.uploadImage(file.buffer, 'stores/logos');
    return this.storesRepository.save(store);
  }

  async uploadBanner(id: string, file: Express.Multer.File, userId: number, isAdmin: boolean) {
    const store = await this.findOneOwned(id, userId, isAdmin);
    store.bannerUrl = await this.cloudinaryService.uploadImage(file.buffer, 'stores/banners');
    return this.storesRepository.save(store);
  }

  private async findOneOwned(id: string, userId: number, isAdmin: boolean): Promise<Store> {
    const store = await this.storesRepository.findOne({ where: { id } });
    if (!store) throw new NotFoundException('Tienda no encontrada');
    if (!isAdmin && store.userId !== userId) throw new ForbiddenException('No tienes permiso');
    return store;
  }

  // Prefers real store reviews (rates the seller/service experience on a
  // delivered order — see StoreReview) when a store has any. Stores with no
  // direct reviews yet fall back to the v1 stand-in: the average of their own
  // products' reviews, which measures product quality, not service, but is
  // better than showing nothing.
  private async getStoreRatingMap(
    storeIds: string[],
  ): Promise<Map<string, { averageRating: number; reviewCount: number }>> {
    if (storeIds.length === 0) return new Map();

    const map = new Map<string, { averageRating: number; reviewCount: number }>();

    const directRows = await this.storesRepository.manager
      .createQueryBuilder()
      .select('review.store_id', 'storeId')
      .addSelect('ROUND(AVG(review.rating)::numeric, 1)', 'averageRating')
      .addSelect('COUNT(review.id)::int', 'reviewCount')
      .from('store_reviews', 'review')
      .where('review.store_id IN (:...ids)', { ids: storeIds })
      .andWhere('review.is_visible = :visible', { visible: true })
      .groupBy('review.store_id')
      .getRawMany<{ storeId: string; averageRating: string; reviewCount: number }>();

    directRows.forEach((row) => {
      map.set(row.storeId, {
        averageRating: Number(row.averageRating),
        reviewCount: row.reviewCount,
      });
    });

    const fallbackIds = storeIds.filter((id) => !map.has(id));
    if (fallbackIds.length > 0) {
      const fallbackRows = await this.storesRepository.manager
        .createQueryBuilder()
        .select('product.store_id', 'storeId')
        .addSelect('ROUND(AVG(review.rating)::numeric, 1)', 'averageRating')
        .addSelect('COUNT(review.id)::int', 'reviewCount')
        .from('reviews', 'review')
        .innerJoin('products', 'product', 'product.id = review.product_id')
        .where('product.store_id IN (:...ids)', { ids: fallbackIds })
        .andWhere('review.is_visible = :visible', { visible: true })
        .groupBy('product.store_id')
        .getRawMany<{ storeId: string; averageRating: string; reviewCount: number }>();

      fallbackRows.forEach((row) => {
        map.set(row.storeId, {
          averageRating: Number(row.averageRating),
          reviewCount: row.reviewCount,
        });
      });
    }

    return map;
  }

  private async ensureUniqueSlug(slug: string, currentStoreId?: string) {
    const existingStore = await this.storesRepository.findOne({
      where: { slug: slug.trim().toLowerCase() },
    });

    if (existingStore && existingStore.id !== currentStoreId) {
      throw new ConflictException('La URL de la tienda ya está en uso');
    }
  }

  /**
   * Hard delete — admin only. Blocked if the store has any real order history
   * (via order_items → products), so a paid transaction can never be erased by
   * mistake. Use `update(..., { isActive: false })` for anything that has sold.
   */
  async remove(id: string): Promise<{ message: string }> {
    const store = await this.storesRepository.findOne({ where: { id } });
    if (!store) throw new NotFoundException('Tienda no encontrada');

    const [{ count }] = await this.storesRepository.manager.query(
      `SELECT COUNT(*)::int AS count
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE p.store_id = $1`,
      [id],
    );
    if (Number(count) > 0) {
      throw new BadRequestException(
        'Esta tienda tiene pedidos asociados y no se puede eliminar — desactívala en su lugar para conservar el historial.',
      );
    }

    await this.storesRepository.manager.transaction(async (manager) => {
      // Product-scoped rows first (all RESTRICT, no cascade at the DB level)
      await manager.query(
        `DELETE FROM review_images WHERE review_id IN (
           SELECT id FROM reviews WHERE product_id IN (SELECT id FROM products WHERE store_id = $1)
         )`,
        [id],
      );
      await manager.query(
        `DELETE FROM reviews WHERE product_id IN (SELECT id FROM products WHERE store_id = $1)`,
        [id],
      );
      await manager.query(
        `DELETE FROM product_favorites WHERE product_id IN (SELECT id FROM products WHERE store_id = $1)`,
        [id],
      );
      await manager.query(
        `DELETE FROM sale_items WHERE product_id IN (SELECT id FROM products WHERE store_id = $1)`,
        [id],
      );
      await manager.query(
        `DELETE FROM purchase_items WHERE product_id IN (SELECT id FROM products WHERE store_id = $1)`,
        [id],
      );
      await manager.query(
        `DELETE FROM inventory_batch_allocations WHERE product_id IN (SELECT id FROM products WHERE store_id = $1)`,
        [id],
      );
      await manager.query(
        `DELETE FROM inventory_movements WHERE product_id IN (SELECT id FROM products WHERE store_id = $1)`,
        [id],
      );
      await manager.query(
        `DELETE FROM inventory_batches WHERE product_id IN (SELECT id FROM products WHERE store_id = $1) OR store_id = $1`,
        [id],
      );
      // product_images / product_videos / product_variants cascade automatically at the DB level
      await manager.query(`DELETE FROM products WHERE store_id = $1`, [id]);

      // Store-scoped rows
      await manager.query(
        `DELETE FROM cash_movements WHERE cash_session_id IN (SELECT id FROM cash_sessions WHERE store_id = $1)`,
        [id],
      );
      await manager.query(`DELETE FROM cash_sessions WHERE store_id = $1`, [id]);
      await manager.query(
        `DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE store_id = $1)`,
        [id],
      );
      await manager.query(`DELETE FROM sales WHERE store_id = $1`, [id]);
      await manager.query(
        `DELETE FROM purchase_payments WHERE purchase_id IN (SELECT id FROM purchases WHERE store_id = $1)`,
        [id],
      );
      await manager.query(
        `DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE store_id = $1)`,
        [id],
      );
      await manager.query(`DELETE FROM purchases WHERE store_id = $1`, [id]);
      await manager.query(`DELETE FROM suppliers WHERE store_id = $1`, [id]);
      await manager.query(`DELETE FROM store_reviews WHERE store_id = $1`, [id]);
      await manager.query(
        `DELETE FROM customer_ledger_entries WHERE customer_id IN (SELECT id FROM customers WHERE store_id = $1)`,
        [id],
      );
      await manager.query(`DELETE FROM customers WHERE store_id = $1`, [id]);
      // menu_categories / store_advertisements / store_subscriptions / categories cascade automatically
      await manager.query(`DELETE FROM stores WHERE id = $1`, [id]);
    });

    return { message: 'Tienda eliminada correctamente' };
  }
}
