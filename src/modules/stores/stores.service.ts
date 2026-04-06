import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from './entities/store.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

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
      email: payload.email?.trim().toLowerCase() || null,
      isActive: payload.isActive ?? true,
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
      email:
        typeof payload.email === 'string'
          ? payload.email.trim().toLowerCase() || null
          : store.email,
      isActive:
        typeof payload.isActive === 'boolean'
          ? payload.isActive
          : store.isActive,
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
