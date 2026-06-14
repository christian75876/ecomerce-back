import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuCategory } from './entities/menu-category.entity';
import { Store } from '../stores/entities/store.entity';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';

@Injectable()
export class MenuCategoriesService {
  constructor(
    @InjectRepository(MenuCategory)
    private readonly repo: Repository<MenuCategory>,
    @InjectRepository(Store)
    private readonly storesRepo: Repository<Store>,
  ) {}

  findByStore(storeId: string) {
    return this.repo.find({
      where: { storeId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async create(payload: CreateMenuCategoryDto, requestingUserId: number, isAdmin: boolean) {
    const store = await this.storesRepo.findOne({ where: { id: payload.storeId } });
    if (!store) throw new NotFoundException('Store not found');
    if (!isAdmin && store.userId !== requestingUserId) {
      throw new ForbiddenException('No tienes permisos para gestionar esta tienda');
    }

    const cat = this.repo.create({
      storeId: payload.storeId,
      name: payload.name.trim(),
      sortOrder: payload.sortOrder ?? 0,
    });
    return this.repo.save(cat);
  }

  async update(id: string, payload: UpdateMenuCategoryDto, requestingUserId: number, isAdmin: boolean) {
    const cat = await this.findOneOrFail(id);
    await this.checkOwnership(cat.storeId, requestingUserId, isAdmin);

    Object.assign(cat, {
      name: payload.name?.trim() ?? cat.name,
      sortOrder: payload.sortOrder ?? cat.sortOrder,
    });
    return this.repo.save(cat);
  }

  async remove(id: string, requestingUserId: number, isAdmin: boolean) {
    const cat = await this.findOneOrFail(id);
    await this.checkOwnership(cat.storeId, requestingUserId, isAdmin);
    await this.repo.remove(cat);
    return { removed: true };
  }

  private async findOneOrFail(id: string) {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Menu category not found');
    return cat;
  }

  private async checkOwnership(storeId: string, userId: number, isAdmin: boolean) {
    if (isAdmin) return;
    const store = await this.storesRepo.findOne({ where: { id: storeId } });
    if (store?.userId !== userId) {
      throw new ForbiddenException('No tienes permisos para gestionar esta tienda');
    }
  }
}
