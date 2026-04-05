import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Category } from '../categories/entities/category.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async findAll(filters: {
    search?: string;
    categoryId?: string;
    active?: boolean;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.search) {
      where.name = ILike(`%${filters.search.trim()}%`);
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (typeof filters.active === 'boolean') {
      where.isActive = filters.active;
    }

    return this.productsRepository.find({
      where,
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string) {
    const product = await this.productsRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async create(createProductDto: CreateProductDto) {
    await this.ensureCategoryExists(createProductDto.categoryId);
    await this.ensureUniqueSku(createProductDto.sku);

    const product = this.productsRepository.create({
      ...createProductDto,
      name: createProductDto.name.trim(),
      description: createProductDto.description.trim(),
      sku: createProductDto.sku.trim().toUpperCase(),
      imageUrl: createProductDto.imageUrl?.trim() || null,
      showStock: createProductDto.showStock ?? false,
      isActive: createProductDto.isActive ?? true,
    });

    return this.productsRepository.save(product);
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.findOne(id);

    if (updateProductDto.categoryId) {
      await this.ensureCategoryExists(updateProductDto.categoryId);
    }

    if (updateProductDto.sku) {
      await this.ensureUniqueSku(updateProductDto.sku, id);
    }

    Object.assign(product, {
      ...updateProductDto,
      name: updateProductDto.name?.trim() ?? product.name,
      description:
        updateProductDto.description?.trim() ?? product.description,
      sku: updateProductDto.sku?.trim().toUpperCase() ?? product.sku,
      imageUrl:
        typeof updateProductDto.imageUrl === 'string'
          ? updateProductDto.imageUrl.trim() || null
          : product.imageUrl,
    });

    return this.productsRepository.save(product);
  }

  async updateStatus(id: string, updateStatusDto: UpdateProductStatusDto) {
    const product = await this.findOne(id);
    product.isActive = updateStatusDto.isActive;
    return this.productsRepository.save(product);
  }

  private async ensureCategoryExists(categoryId: string) {
    const category = await this.categoriesRepository.findOne({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }

  private async ensureUniqueSku(sku: string, currentProductId?: string) {
    const existingProduct = await this.productsRepository.findOne({
      where: {
        sku: sku.trim().toUpperCase(),
      },
    });

    if (existingProduct && existingProduct.id !== currentProductId) {
      throw new ConflictException('SKU is already in use');
    }
  }
}
