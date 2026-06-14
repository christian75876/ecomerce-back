import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from './entities/store.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { UpdateStoreNotificationsDto } from './dto/update-store-notifications.dto';

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
  ) {}

  async findAll(active?: boolean) {
    const where =
      typeof active === 'boolean'
        ? { isActive: active }
        : {};

    return this.storesRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOneById(id: string) {
    const store = await this.storesRepository.findOne({ where: { id } });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
  }

  async findOneBySlug(slug: string, publicOnly = false) {
    const store = await this.storesRepository.findOne({
      where: publicOnly ? { slug, isActive: true } : { slug },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
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

  async update(id: string, payload: UpdateStoreDto) {
    const store = await this.findOneById(id);

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
    });

    return this.storesRepository.save(store);
  }

  private async ensureUniqueSlug(slug: string, currentStoreId?: string) {
    const existingStore = await this.storesRepository.findOne({
      where: { slug: slug.trim().toLowerCase() },
    });

    if (existingStore && existingStore.id !== currentStoreId) {
      throw new ConflictException('Store slug is already in use');
    }
  }
}
