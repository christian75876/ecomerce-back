import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductFavorite } from './entities/product-favorite.entity';
import { Category } from '../categories/entities/category.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { Store } from '../stores/entities/store.entity';
import { InventoryService } from '../inventory/inventory.service';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Customer } from '../customers/entities/customer.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { InventoryReferenceType } from '../inventory/entities/inventory-batch-allocation.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(ProductFavorite)
    private readonly favoritesRepository: Repository<ProductFavorite>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(SaleItem)
    private readonly saleItemsRepository: Repository<SaleItem>,
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

  async findRelated(id: string, limit = 6) {
    const product = await this.findOne(id);
    const collected = new Map<string, Product>();

    const categoryMatches = await this.productsRepository.find({
      where: {
        isActive: true,
        categoryId: product.categoryId,
      },
      order: { createdAt: 'DESC' },
      take: limit * 2,
    });

    categoryMatches.forEach((item) => {
      if (item.id !== product.id && (!item.store || item.store.isActive)) {
        collected.set(item.id, item);
      }
    });

    if (collected.size < limit && product.storeId) {
      const storeMatches = await this.productsRepository.find({
        where: {
          isActive: true,
          storeId: product.storeId,
        },
        order: { createdAt: 'DESC' },
        take: limit * 2,
      });

      storeMatches.forEach((item) => {
        if (item.id !== product.id && (!item.store || item.store.isActive)) {
          collected.set(item.id, item);
        }
      });
    }

    if (collected.size < limit) {
      const fallbackMatches = await this.productsRepository.find({
        where: { isActive: true },
        order: { createdAt: 'DESC' },
        take: limit * 3,
      });

      fallbackMatches.forEach((item) => {
        if (item.id !== product.id && (!item.store || item.store.isActive)) {
          collected.set(item.id, item);
        }
      });
    }

    return Array.from(collected.values()).slice(0, limit);
  }

  async getFeaturedSections(limit = 8) {
    const newestProducts = await this.productsRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
      take: limit * 2,
    });

    const bestSellingRows = await this.saleItemsRepository
      .createQueryBuilder('sale_item')
      .select('sale_item.product_id', 'productId')
      .addSelect('SUM(sale_item.quantity)', 'totalSold')
      .groupBy('sale_item.product_id')
      .orderBy('SUM(sale_item.quantity)', 'DESC')
      .limit(limit * 2)
      .getRawMany<{ productId: string; totalSold: string }>();

    const bestSellingProducts = (
      await Promise.all(
        bestSellingRows.map(async (row) =>
          this.productsRepository.findOne({
            where: { id: row.productId, isActive: true },
          }),
        ),
      )
    ).filter(
      (product): product is Product =>
        Boolean(product) && (!product.store || product.store.isActive),
    );

    const filteredNewestProducts = newestProducts.filter(
      (product) => !product.store || product.store.isActive,
    );

    return {
      newestProducts: filteredNewestProducts.slice(0, limit),
      bestSellingProducts:
        bestSellingProducts.length > 0
          ? bestSellingProducts.slice(0, limit)
          : filteredNewestProducts.slice(0, limit),
    };
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
    const initialCost =
      typeof createProductDto.cost === 'number' ? createProductDto.cost : 0;

    if (createProductDto.isPerishable && initialStock > 0 && !createProductDto.initialExpiresAt) {
      throw new ConflictException(
        'Perishable products require expiration date for initial stock',
      );
    }

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
        isPerishable: createProductDto.isPerishable ?? false,
        trackBatches: createProductDto.trackBatches ?? true,
        storeId: createProductDto.storeId ?? null,
        supplierId: createProductDto.supplierId ?? null,
      });

      const savedProduct = await manager.getRepository(Product).save(product);

      if (initialStock > 0) {
        await this.inventoryService.createSystemBatchEntry({
          productId: savedProduct.id,
          storeId: savedProduct.storeId,
          supplierId: savedProduct.supplierId,
          quantity: initialStock,
          unitCost: initialCost,
          expiresAt: createProductDto.initialExpiresAt
            ? new Date(createProductDto.initialExpiresAt)
            : null,
          batchCode: `INITIAL-${savedProduct.sku}`,
          note: 'Initial stock on product creation',
          manager,
          referenceType: InventoryReferenceType.PRODUCT_INITIAL,
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
      isPerishable:
        typeof updateProductDto.isPerishable === 'boolean'
          ? updateProductDto.isPerishable
          : product.isPerishable,
      trackBatches:
        typeof updateProductDto.trackBatches === 'boolean'
          ? updateProductDto.trackBatches
          : product.trackBatches,
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

  async getMyFavorites(userId: number) {
    const customer = await this.getCustomerByUserId(userId);

    const favorites = await this.favoritesRepository.find({
      where: { customerId: customer.id },
      order: { createdAt: 'DESC' },
    });

    return favorites
      .map((favorite) => favorite.product)
      .filter((product) => product.isActive && (!product.store || product.store.isActive));
  }

  async favoriteProduct(productId: string, userId: number) {
    const customer = await this.getCustomerByUserId(userId);
    const product = await this.productsRepository.findOne({
      where: { id: productId, isActive: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const existingFavorite = await this.favoritesRepository.findOne({
      where: {
        customerId: customer.id,
        productId,
      },
    });

    if (existingFavorite) {
      return existingFavorite;
    }

    const favorite = this.favoritesRepository.create({
      customerId: customer.id,
      productId,
    });

    return this.favoritesRepository.save(favorite);
  }

  async unfavoriteProduct(productId: string, userId: number) {
    const customer = await this.getCustomerByUserId(userId);

    const favorite = await this.favoritesRepository.findOne({
      where: {
        customerId: customer.id,
        productId,
      },
    });

    if (!favorite) {
      return { removed: true };
    }

    await this.favoritesRepository.remove(favorite);
    return { removed: true };
  }

  async getMyFavoriteProductIds(userId: number) {
    const customer = await this.getCustomerByUserId(userId);
    const favorites = await this.favoritesRepository.find({
      where: { customerId: customer.id },
    });

    return favorites.map((favorite) => favorite.productId);
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

  private async getCustomerByUserId(userId: number) {
    const customer = await this.customersRepository.findOne({
      where: { userId },
    });

    if (!customer) {
      throw new UnauthorizedException('Only authenticated customers can manage favorites');
    }

    return customer;
  }
}
