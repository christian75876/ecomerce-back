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
import { Store } from '../stores/entities/store.entity';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryMovementType } from '../inventory/entities/inventory-movement.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
    private readonly inventoryService: InventoryService,
  ) {}

  async findAll(filters: {
    search?: string;
    categoryId?: string;
    storeId?: string;
    active?: boolean;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.search) {
      where.name = ILike(`%${filters.search.trim()}%`);
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.storeId) {
      where.storeId = filters.storeId;
    }

    if (typeof filters.active === 'boolean') {
      where.isActive = filters.active;
    }

    const products = await this.productsRepository.find({
      where,
      order: {
        createdAt: 'DESC',
      },
    });

    if (filters.active) {
      return products.filter((product) => !product.store || product.store.isActive);
    }

    return products;
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
    if (createProductDto.storeId) {
      await this.ensureStoreExists(createProductDto.storeId);
    }
    if (createProductDto.supplierId) {
      await this.ensureSupplierExists(createProductDto.supplierId);
    }
    await this.ensureUniqueSku(createProductDto.sku);
    const initialStock = Number(createProductDto.initialStock ?? 0);

    return this.productsRepository.manager.transaction(async (manager) => {
      const product = manager.getRepository(Product).create({
        ...createProductDto,
        name: createProductDto.name.trim(),
        description: createProductDto.description.trim(),
        sku: createProductDto.sku.trim().toUpperCase(),
        imageUrl: createProductDto.imageUrl?.trim() || null,
        cost: typeof createProductDto.cost === 'number' ? createProductDto.cost : null,
        showStock: createProductDto.showStock ?? false,
        isActive: createProductDto.isActive ?? true,
        storeId: createProductDto.storeId ?? null,
        supplierId: createProductDto.supplierId ?? null,
      });

      const savedProduct = await manager.getRepository(Product).save(product);

      if (initialStock > 0) {
        await this.inventoryService.createSystemMovement({
          productId: savedProduct.id,
          movementType: InventoryMovementType.IN,
          quantityDelta: initialStock,
          note: 'Initial stock on product creation',
          manager,
        });
      }

      return savedProduct;
    });
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.findOne(id);

    if (updateProductDto.categoryId) {
      await this.ensureCategoryExists(updateProductDto.categoryId);
    }

    if (updateProductDto.storeId) {
      await this.ensureStoreExists(updateProductDto.storeId);
    }
    if (updateProductDto.supplierId) {
      await this.ensureSupplierExists(updateProductDto.supplierId);
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
      storeId: updateProductDto.storeId ?? product.storeId,
      supplierId: updateProductDto.supplierId ?? product.supplierId,
      cost:
        typeof updateProductDto.cost === 'number'
          ? updateProductDto.cost
          : product.cost,
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

  private async ensureStoreExists(storeId: string) {
    const store = await this.storesRepository.findOne({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }
  }

  private async ensureSupplierExists(supplierId: string) {
    const supplier = await this.suppliersRepository.findOne({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
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
