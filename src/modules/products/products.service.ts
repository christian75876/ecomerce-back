import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductFavorite } from './entities/product-favorite.entity';
import { ProductVideo, VideoType } from './entities/product-video.entity';
import { ProductImage } from './entities/product-image.entity';
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
import { QueryProductOptionsDto } from './dto/query-product-options.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

const YOUTUBE_REGEX = /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/;
const INSTAGRAM_REGEX = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[\w-]+/;
const FACEBOOK_REGEX = /^https?:\/\/(www\.)?(facebook\.com|fb\.watch)\/.+/;

function detectVideoType(url: string): VideoType {
  if (YOUTUBE_REGEX.test(url)) return 'YOUTUBE';
  if (INSTAGRAM_REGEX.test(url)) return 'INSTAGRAM';
  if (FACEBOOK_REGEX.test(url)) return 'FACEBOOK';
  throw new BadRequestException('URL no válida. Usa un enlace de YouTube, Instagram o Facebook');
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(ProductFavorite)
    private readonly favoritesRepository: Repository<ProductFavorite>,
    @InjectRepository(ProductVideo)
    private readonly videosRepository: Repository<ProductVideo>,
    @InjectRepository(ProductImage)
    private readonly imagesRepository: Repository<ProductImage>,
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
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async findAll(filters: {
    search?: string;
    categoryId?: string;
    storeId?: string;
    active?: boolean;
    sortBy?: string;
    minPrice?: number;
    maxPrice?: number;
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

    let order: Record<string, string> = { createdAt: 'DESC' };
    if (filters.sortBy === 'price_asc') order = { price: 'ASC' };
    else if (filters.sortBy === 'price_desc') order = { price: 'DESC' };
    else if (filters.sortBy === 'name_asc') order = { name: 'ASC' };

    let products = await this.productsRepository.find({ where, order });

    if (filters.active) {
      const now = new Date();
      products = products.filter((product) => {
        if (!product.store) return true;
        if (!product.store.isActive) return false;
        const exp = product.store.subscriptionExpiresAt;
        return !exp || new Date(exp) > now;
      });
    }

    if (filters.minPrice !== undefined) {
      products = products.filter((p) => Number(p.price) >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      products = products.filter((p) => Number(p.price) <= filters.maxPrice!);
    }

    const [stockMap, ratingMap] = await Promise.all([
      this.getStockMap(products.map((p) => p.id)),
      this.getRatingMap(products.map((p) => p.id)),
    ]);
    return products.map((p) => ({
      ...p,
      availableQuantity: stockMap.get(p.id) ?? 0,
      averageRating: ratingMap.get(p.id)?.averageRating ?? null,
      reviewCount: ratingMap.get(p.id)?.reviewCount ?? 0,
    }));
  }

  private async getStockMap(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.imagesRepository.manager
      .createQueryBuilder()
      .select('batch.product_id', 'productId')
      .addSelect('COALESCE(SUM(batch.available_quantity), 0)', 'stock')
      .from('inventory_batches', 'batch')
      .where('batch.product_id IN (:...ids)', { ids: productIds })
      .groupBy('batch.product_id')
      .getRawMany<{ productId: string; stock: string }>();
    const map = new Map<string, number>();
    rows.forEach((row) => map.set(row.productId, Number(row.stock)));
    return map;
  }

  private async getRatingMap(
    productIds: string[],
  ): Promise<Map<string, { averageRating: number; reviewCount: number }>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.imagesRepository.manager
      .createQueryBuilder()
      .select('review.product_id', 'productId')
      .addSelect('ROUND(AVG(review.rating)::numeric, 1)', 'averageRating')
      .addSelect('COUNT(review.id)::int', 'reviewCount')
      .from('reviews', 'review')
      .where('review.product_id IN (:...ids)', { ids: productIds })
      .andWhere('review.is_visible = :visible', { visible: true })
      .groupBy('review.product_id')
      .getRawMany<{ productId: string; averageRating: string; reviewCount: string }>();
    const map = new Map<string, { averageRating: number; reviewCount: number }>();
    rows.forEach((row) =>
      map.set(row.productId, {
        averageRating: Number(row.averageRating),
        reviewCount: Number(row.reviewCount),
      }),
    );
    return map;
  }

  async findOne(id: string) {
    const product = await this.findEntity(id);
    const [stock, ratingMap] = await Promise.all([
      this.inventoryService.getCurrentStock(id),
      this.getRatingMap([id]),
    ]);
    const rating = ratingMap.get(id);
    return {
      ...product,
      availableQuantity: stock,
      averageRating: rating?.averageRating ?? null,
      reviewCount: rating?.reviewCount ?? 0,
    };
  }

  private async findEntity(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async getOptions(query: QueryProductOptionsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.store', 'store')
      .where('product.isActive = :isActive', { isActive: true })
      .orderBy('product.name', 'ASC');

    if (query.search?.trim()) {
      builder.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }

    if (query.storeId) {
      builder.andWhere('product.storeId = :storeId', { storeId: query.storeId });
    }

    const [products, totalItems] = await builder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: products.map((product) => ({
        id: product.id,
        label: product.name,
        secondary: product.sku,
        helper: product.store?.name ?? 'Sin tienda',
        isPerishable: product.isPerishable,
        showStock: product.showStock,
        storeId: product.storeId,
      })),
      pagination: {
        totalItems,
        itemCount: products.length,
        itemsPerPage: limit,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
      },
    };
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
    if (createProductDto.sku) {
      await this.ensureUniqueSku(createProductDto.sku);
    }
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
        sku: createProductDto.sku ? createProductDto.sku.trim().toUpperCase() : null,
        imageUrl: createProductDto.imageUrl?.trim() || null,
        cost: typeof createProductDto.cost === 'number' ? createProductDto.cost : null,
        compareAtPrice: typeof createProductDto.compareAtPrice === 'number' ? createProductDto.compareAtPrice : null,
        showStock: createProductDto.showStock ?? false,
        isActive: createProductDto.isActive ?? true,
        isPerishable: createProductDto.isPerishable ?? false,
        trackBatches: createProductDto.trackBatches ?? true,
        storeId: createProductDto.storeId ?? null,
        supplierId: createProductDto.supplierId ?? null,
        menuCategoryId: createProductDto.menuCategoryId ?? null,
        lowStockThreshold: typeof createProductDto.lowStockThreshold === 'number' ? createProductDto.lowStockThreshold : null,
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
          batchCode: `INITIAL-${savedProduct.sku ?? savedProduct.id}`,
          note: 'Initial stock on product creation',
          manager,
          referenceType: InventoryReferenceType.PRODUCT_INITIAL,
        });
      }

      return savedProduct;
    });
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.findEntity(id);

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
      menuCategoryId: typeof updateProductDto.menuCategoryId === 'string'
        ? updateProductDto.menuCategoryId || null
        : product.menuCategoryId,
      cost:
        typeof updateProductDto.cost === 'number'
          ? updateProductDto.cost
          : product.cost,
      compareAtPrice:
        typeof updateProductDto.compareAtPrice === 'number'
          ? updateProductDto.compareAtPrice
          : updateProductDto.compareAtPrice === null
            ? null
            : product.compareAtPrice,
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
      lowStockThreshold:
        typeof updateProductDto.lowStockThreshold === 'number'
          ? updateProductDto.lowStockThreshold
          : updateProductDto.lowStockThreshold === null
            ? null
            : product.lowStockThreshold,
    });

    return this.productsRepository.save(product);
  }

  async updateStatus(id: string, updateStatusDto: UpdateProductStatusDto) {
    const product = await this.findEntity(id);
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

  private async ensureUniqueSku(sku: string | null | undefined, currentProductId?: string) {
    if (!sku) return;
    const existingProduct = await this.productsRepository.findOne({
      where: {
        sku: sku.trim().toUpperCase(),
      },
    });

    if (existingProduct && existingProduct.id !== currentProductId) {
      throw new ConflictException('SKU is already in use');
    }
  }

  async uploadImage(id: string, file: Express.Multer.File) {
    const product = await this.findEntity(id);
    product.imageUrl = await this.cloudinaryService.uploadImage(file.buffer, 'products');
    return this.productsRepository.save(product);
  }

  async getVideos(productId: string) {
    return this.videosRepository.find({
      where: { productId },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  async addVideo(productId: string, videoUrl: string, title?: string) {
    await this.findOne(productId);
    const videoType = detectVideoType(videoUrl.trim());
    const count = await this.videosRepository.count({ where: { productId } });
    const video = this.videosRepository.create({
      productId,
      videoUrl: videoUrl.trim(),
      videoType,
      title: title?.trim() || null,
      order: count,
    });
    return this.videosRepository.save(video);
  }

  async getGallery(productId: string) {
    return this.imagesRepository.find({
      where: { productId },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  async addGalleryImage(productId: string, file: Express.Multer.File) {
    await this.findOne(productId);
    const count = await this.imagesRepository.count({ where: { productId } });
    const imageUrl = await this.cloudinaryService.uploadImage(file.buffer, 'products/gallery');
    const image = this.imagesRepository.create({ productId, imageUrl, order: count });
    return this.imagesRepository.save(image);
  }

  async reorderGallery(productId: string, imageIds: string[]) {
    await this.findOne(productId);
    await Promise.all(
      imageIds.map((id, index) =>
        this.imagesRepository.update({ id, productId }, { order: index }),
      ),
    );
    return this.getGallery(productId);
  }

  async removeGalleryImage(productId: string, imageId: string) {
    const image = await this.imagesRepository.findOne({
      where: { id: imageId, productId },
    });
    if (!image) {
      throw new NotFoundException('Imagen no encontrada');
    }
    await this.imagesRepository.remove(image);
    return { removed: true };
  }

  async removeVideo(productId: string, videoId: string) {
    const video = await this.videosRepository.findOne({
      where: { id: videoId, productId },
    });
    if (!video) {
      throw new NotFoundException('Video no encontrado');
    }
    await this.videosRepository.remove(video);
    return { removed: true };
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
