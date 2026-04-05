import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async findAll(active?: boolean) {
    const where =
      typeof active === 'boolean'
        ? {
            isActive: active,
          }
        : {};

    return this.categoriesRepository.find({
      where,
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async create(createCategoryDto: CreateCategoryDto) {
    const normalizedName = createCategoryDto.name.trim();
    const existingCategory = await this.categoriesRepository.findOne({
      where: {
        name: normalizedName,
      },
    });

    if (existingCategory) {
      throw new ConflictException('Category name is already in use');
    }

    const category = this.categoriesRepository.create({
      name: normalizedName,
      isActive: createCategoryDto.isActive ?? true,
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
        where: { name: normalizedName },
      });

      if (existingCategory && existingCategory.id !== id) {
        throw new ConflictException('Category name is already in use');
      }

      category.name = normalizedName;
    }

    if (typeof updateCategoryDto.isActive === 'boolean') {
      category.isActive = updateCategoryDto.isActive;
    }

    return this.categoriesRepository.save(category);
  }
}
