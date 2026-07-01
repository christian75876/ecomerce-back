import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async findAll(active?: boolean, storeId?: string) {
    const where: any = {};
    if (typeof active === 'boolean') where.isActive = active;

    if (storeId) {
      // Return store-specific categories for this store
      where.storeId = storeId;
    } else {
      // Return global categories (no store assigned) for admin views
      where.storeId = IsNull();
    }

    return this.categoriesRepository.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async create(createCategoryDto: CreateCategoryDto) {
    const normalizedName = createCategoryDto.name.trim();
    const storeId = createCategoryDto.storeId ?? null;

    const existingCategory = await this.categoriesRepository.findOne({
      where: {
        name: normalizedName,
        storeId: storeId ?? IsNull(),
      },
    });

    if (existingCategory) {
      throw new ConflictException('Ya existe una categoría con ese nombre en esta tienda');
    }

    const category = this.categoriesRepository.create({
      name: normalizedName,
      isActive: createCategoryDto.isActive ?? true,
      storeId,
    });

    return this.categoriesRepository.save(category);
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.categoriesRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (updateCategoryDto.name) {
      const normalizedName = updateCategoryDto.name.trim();
      const existingCategory = await this.categoriesRepository.findOne({
        where: {
          name: normalizedName,
          storeId: category.storeId ?? IsNull(),
        },
      });

      if (existingCategory && existingCategory.id !== id) {
        throw new ConflictException('Ya existe una categoría con ese nombre');
      }

      category.name = normalizedName;
    }

    if (typeof updateCategoryDto.isActive === 'boolean') {
      category.isActive = updateCategoryDto.isActive;
    }

    return this.categoriesRepository.save(category);
  }
}
