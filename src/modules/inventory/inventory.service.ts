import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import {
  InventoryMovement,
  InventoryMovementType,
} from './entities/inventory-movement.entity';
import { Product } from '../products/entities/product.entity';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import {
  InventoryBatch,
  InventoryBatchStatus,
} from './entities/inventory-batch.entity';
import {
  InventoryBatchAllocation,
  InventoryReferenceType,
} from './entities/inventory-batch-allocation.entity';
import { CreateInventoryEntryDto } from './dto/create-inventory-entry.dto';
import { QueryInventoryBatchesDto } from './dto/query-inventory-batches.dto';
import { QueryExpiringInventoryDto } from './dto/query-expiring-inventory.dto';
import { PaginatedResultDto } from 'src/common/dtos/paginated-result.dto';
import { Supplier } from '../suppliers/entities/supplier.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryMovement)
    private readonly inventoryRepository: Repository<InventoryMovement>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(InventoryBatch)
    private readonly batchesRepository: Repository<InventoryBatch>,
    @InjectRepository(InventoryBatchAllocation)
    private readonly allocationsRepository: Repository<InventoryBatchAllocation>,
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
  ) {}

  async getInventorySummary(page = 1, limit = 20): Promise<PaginatedResultDto<Record<string, unknown>>> {
    const skip = (page - 1) * limit;

    const [products, totalItems] = await this.productsRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const productIds = products.map((p) => p.id);
    const batches = productIds.length > 0
      ? await this.batchesRepository.find({
          where: productIds.map((id) => ({ productId: id })),
          order: { receivedAt: 'DESC' },
        })
      : [];

    const items = products.map((product) => {
      const productBatches = batches.filter((batch) => batch.productId === product.id);
      const activeBatches = productBatches.filter((batch) => batch.availableQuantity > 0);
      const nextExpiration =
        activeBatches
          .filter((batch) => batch.expiresAt)
          .sort((a, b) => {
            if (!a.expiresAt || !b.expiresAt) return 0;
            return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
          })[0]?.expiresAt ?? null;

      const inventoryValue = activeBatches.reduce(
        (acc, batch) => acc + Number(batch.unitCost) * batch.availableQuantity,
        0,
      );

      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        category: product.category?.name ?? null,
        isActive: product.isActive,
        isPerishable: product.isPerishable,
        trackBatches: product.trackBatches,
        stock: activeBatches.reduce((acc, batch) => acc + batch.availableQuantity, 0),
        activeBatchCount: activeBatches.length,
        nextExpiration,
        inventoryValue: Number(inventoryValue.toFixed(2)),
        lowStockThreshold: product.lowStockThreshold,
      };
    });

    return {
      items,
      pagination: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
      },
    };
  }

  async getBatches(filters: QueryInventoryBatchesDto): Promise<PaginatedResultDto<Record<string, unknown>>> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 500);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters.productId) where.productId = filters.productId;
    if (filters.storeId) where.storeId = filters.storeId;
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.status) where.status = filters.status;

    const [batches, totalItems] = await this.batchesRepository.findAndCount({
      where,
      order: { expiresAt: 'ASC', receivedAt: 'ASC' },
      skip,
      take: limit,
    });

    return {
      items: batches as unknown as Record<string, unknown>[],
      pagination: {
        totalItems,
        itemCount: batches.length,
        itemsPerPage: limit,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
      },
    };
  }

  async getExpiringBatches(filters: QueryExpiringInventoryDto): Promise<PaginatedResultDto<Record<string, unknown>>> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 500);
    const skip = (page - 1) * limit;
    const days = filters.days ?? 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() + days);

    const qb = this.batchesRepository
      .createQueryBuilder('batch')
      .where('batch.expiresAt <= :threshold', { threshold })
      .andWhere('batch.availableQuantity > 0')
      .andWhere('batch.expiresAt IS NOT NULL');

    if (filters.storeId) {
      qb.andWhere('batch.storeId = :storeId', { storeId: filters.storeId });
    }

    qb.orderBy('batch.expiresAt', 'ASC').addOrderBy('batch.receivedAt', 'ASC');

    const [batches, totalItems] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      items: batches as unknown as Record<string, unknown>[],
      pagination: {
        totalItems,
        itemCount: batches.length,
        itemsPerPage: limit,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
      },
    };
  }

  async getMovements(productId?: string, page = 1, limit = 20): Promise<PaginatedResultDto<Record<string, unknown>>> {
    const skip = (page - 1) * limit;
    const [movements, totalItems] = await this.inventoryRepository.findAndCount({
      where: productId ? { productId } : {},
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
      relations: ['product', 'batch'],
    });
    return {
      items: movements as unknown as Record<string, unknown>[],
      pagination: {
        totalItems,
        itemCount: movements.length,
        itemsPerPage: limit,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
      },
    };
  }

  async registerEntry(createInventoryEntryDto: CreateInventoryEntryDto) {
    const product = await this.productsRepository.findOne({
      where: { id: createInventoryEntryDto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (createInventoryEntryDto.supplierId) {
      const supplier = await this.suppliersRepository.findOne({
        where: { id: createInventoryEntryDto.supplierId, isActive: true },
      });
      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }
    }

    this.ensurePerishableRules(product, createInventoryEntryDto.expiresAt);

    return this.createBatchEntry({
      productId: product.id,
      storeId: product.storeId ?? null,
      supplierId: createInventoryEntryDto.supplierId ?? product.supplierId ?? null,
      quantity: createInventoryEntryDto.quantity,
      unitCost: createInventoryEntryDto.unitCost,
      receivedAt: createInventoryEntryDto.receivedAt
        ? new Date(createInventoryEntryDto.receivedAt)
        : new Date(),
      expiresAt: createInventoryEntryDto.expiresAt
        ? new Date(createInventoryEntryDto.expiresAt)
        : null,
      batchCode: createInventoryEntryDto.batchCode ?? null,
      note: createInventoryEntryDto.note ?? 'Manual inventory entry',
      movementType: InventoryMovementType.IN,
      referenceType: InventoryReferenceType.MANUAL_ENTRY,
    });
  }

  async registerMovement(createInventoryMovementDto: CreateInventoryMovementDto) {
    const product = await this.productsRepository.findOne({
      where: { id: createInventoryMovementDto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (
      ![
        InventoryMovementType.IN,
        InventoryMovementType.ADJUSTMENT,
      ].includes(createInventoryMovementDto.movementType)
    ) {
      throw new BadRequestException(
        'Only IN and ADJUSTMENT movements can be created manually',
      );
    }

    if (createInventoryMovementDto.quantity === 0) {
      throw new BadRequestException('Quantity cannot be zero');
    }

    if (createInventoryMovementDto.movementType === InventoryMovementType.IN) {
      return this.createBatchEntry({
        productId: product.id,
        storeId: product.storeId ?? null,
        supplierId: product.supplierId ?? null,
        quantity: createInventoryMovementDto.quantity,
        unitCost: Number(product.cost ?? 0),
        receivedAt: new Date(),
        expiresAt: null,
        batchCode: null,
        note: createInventoryMovementDto.note ?? 'Manual inventory IN',
        movementType: InventoryMovementType.IN,
        referenceType: InventoryReferenceType.MANUAL_ENTRY,
      });
    }

    const quantityDelta =
      createInventoryMovementDto.quantityDeltaOverride ??
      createInventoryMovementDto.quantity;

    return this.applyAdjustment({
      productId: product.id,
      quantityDelta,
      note: createInventoryMovementDto.note ?? 'Inventory adjustment',
    });
  }

  async createSystemBatchEntry(params: {
    productId: string;
    storeId?: string | null;
    supplierId?: string | null;
    purchaseId?: string | null;
    purchaseItemId?: string | null;
    quantity: number;
    unitCost: number;
    receivedAt?: Date;
    expiresAt?: Date | null;
    batchCode?: string | null;
    note?: string;
    manager?: EntityManager;
    referenceType: InventoryReferenceType;
  }) {
    return this.createBatchEntry({
      ...params,
      storeId: params.storeId ?? null,
      supplierId: params.supplierId ?? null,
      purchaseId: params.purchaseId ?? null,
      purchaseItemId: params.purchaseItemId ?? null,
      receivedAt: params.receivedAt ?? new Date(),
      expiresAt: params.expiresAt ?? null,
      batchCode: params.batchCode ?? null,
      note: params.note ?? null,
      movementType: InventoryMovementType.IN,
    });
  }

  async createSystemMovement(params: {
    productId: string;
    movementType: InventoryMovementType;
    quantityDelta: number;
    note?: string;
    manager?: EntityManager;
    batchId?: string | null;
    referenceType?: InventoryReferenceType | null;
    referenceId?: string | null;
    unitCostSnapshot?: number | null;
  }) {
    const inventoryRepository = params.manager
      ? params.manager.getRepository(InventoryMovement)
      : this.inventoryRepository;

    const movement = inventoryRepository.create({
      productId: params.productId,
      batchId: params.batchId ?? null,
      movementType: params.movementType,
      quantityDelta: params.quantityDelta,
      referenceType: params.referenceType ?? null,
      referenceId: params.referenceId ?? null,
      unitCostSnapshot:
        typeof params.unitCostSnapshot === 'number'
          ? params.unitCostSnapshot
          : null,
      note: params.note?.trim() || null,
    });

    return inventoryRepository.save(movement);
  }

  async consumeStock(params: {
    productId: string;
    quantity: number;
    referenceType: InventoryReferenceType;
    referenceId: string;
    referenceItemId?: string | null;
    note?: string;
    manager?: EntityManager;
  }) {
    const productRepository = params.manager
      ? params.manager.getRepository(Product)
      : this.productsRepository;
    const batchRepository = params.manager
      ? params.manager.getRepository(InventoryBatch)
      : this.batchesRepository;
    const allocationRepository = params.manager
      ? params.manager.getRepository(InventoryBatchAllocation)
      : this.allocationsRepository;

    const product = await productRepository.findOne({
      where: { id: params.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const candidates = await batchRepository.find({
      where: {
        productId: params.productId,
        status: InventoryBatchStatus.ACTIVE,
      },
      order: product.isPerishable
        ? { expiresAt: 'ASC', receivedAt: 'ASC', createdAt: 'ASC' }
        : { receivedAt: 'ASC', createdAt: 'ASC' },
    });

    if (candidates.length === 0) {
      await this.createLegacyBatchForProduct(params.productId, params.manager);
    }

    const refreshedCandidates = await batchRepository.find({
      where: {
        productId: params.productId,
        status: InventoryBatchStatus.ACTIVE,
      },
      order: product.isPerishable
        ? { expiresAt: 'ASC', receivedAt: 'ASC', createdAt: 'ASC' }
        : { receivedAt: 'ASC', createdAt: 'ASC' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validCandidates = refreshedCandidates.filter((batch) => {
      if (batch.availableQuantity <= 0) {
        return false;
      }
      if (product.isPerishable) {
        return Boolean(batch.expiresAt) && new Date(batch.expiresAt) >= today;
      }
      return true;
    });

    const available = validCandidates.reduce(
      (acc, batch) => acc + batch.availableQuantity,
      0,
    );

    if (available < params.quantity) {
      throw new BadRequestException(
        `Insufficient stock for product ${product.name}`,
      );
    }

    let remaining = params.quantity;
    const allocations: InventoryBatchAllocation[] = [];

    for (const batch of validCandidates) {
      if (remaining <= 0) {
        break;
      }

      const consumed = Math.min(batch.availableQuantity, remaining);
      batch.availableQuantity -= consumed;
      batch.status =
        batch.availableQuantity <= 0
          ? InventoryBatchStatus.DEPLETED
          : InventoryBatchStatus.ACTIVE;
      await batchRepository.save(batch);

      const allocation = allocationRepository.create({
        batchId: batch.id,
        productId: batch.productId,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        referenceItemId: params.referenceItemId ?? null,
        quantity: consumed,
        unitCostSnapshot: Number(batch.unitCost),
        expiresAtSnapshot: batch.expiresAt ?? null,
      });
      allocations.push(await allocationRepository.save(allocation));

      await this.createSystemMovement({
        productId: batch.productId,
        batchId: batch.id,
        movementType:
          params.referenceType === InventoryReferenceType.ORDER
            ? InventoryMovementType.ORDER
            : InventoryMovementType.SALE,
        quantityDelta: -consumed,
        note: params.note,
        manager: params.manager,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        unitCostSnapshot: Number(batch.unitCost),
      });

      remaining -= consumed;
    }

    return allocations;
  }

  async restoreStockFromAllocations(params: {
    referenceType: InventoryReferenceType;
    referenceId: string;
    note?: string;
    manager?: EntityManager;
    restoredReferenceType?: InventoryReferenceType;
  }) {
    const allocationRepository = params.manager
      ? params.manager.getRepository(InventoryBatchAllocation)
      : this.allocationsRepository;
    const batchRepository = params.manager
      ? params.manager.getRepository(InventoryBatch)
      : this.batchesRepository;

    const allocations = await allocationRepository.find({
      where: {
        referenceType: params.referenceType,
        referenceId: params.referenceId,
      },
    });

    for (const allocation of allocations) {
      const batch = await batchRepository.findOne({
        where: { id: allocation.batchId },
      });

      if (!batch) {
        continue;
      }

      batch.availableQuantity += allocation.quantity;
      batch.status = InventoryBatchStatus.ACTIVE;
      await batchRepository.save(batch);

      await this.createSystemMovement({
        productId: allocation.productId,
        batchId: batch.id,
        movementType: InventoryMovementType.ORDER_CANCEL,
        quantityDelta: allocation.quantity,
        note: params.note,
        manager: params.manager,
        referenceType:
          params.restoredReferenceType ?? InventoryReferenceType.ORDER_CANCEL,
        referenceId: params.referenceId,
        unitCostSnapshot: Number(allocation.unitCostSnapshot),
      });
    }
  }

  async getCurrentStock(productId: string, manager?: EntityManager) {
    const batchRepository = manager
      ? manager.getRepository(InventoryBatch)
      : this.batchesRepository;
    const inventoryRepository = manager
      ? manager.getRepository(InventoryMovement)
      : this.inventoryRepository;

    const result = await batchRepository
      .createQueryBuilder('batch')
      .select('COALESCE(SUM(batch.availableQuantity), 0)', 'stock')
      .where('batch.productId = :productId', { productId })
      .getRawOne<{ stock: string }>();

    const batchStock = Number(result?.stock ?? 0);
    if (batchStock > 0) {
      return batchStock;
    }

    const legacyResult = await inventoryRepository
      .createQueryBuilder('movement')
      .select('COALESCE(SUM(movement.quantityDelta), 0)', 'stock')
      .where('movement.productId = :productId', { productId })
      .getRawOne<{ stock: string }>();

    return Number(legacyResult?.stock ?? 0);
  }

  async createLegacyBatchForProduct(productId: string, manager?: EntityManager) {
    const batchRepository = manager
      ? manager.getRepository(InventoryBatch)
      : this.batchesRepository;
    const productRepository = manager
      ? manager.getRepository(Product)
      : this.productsRepository;
    const inventoryRepository = manager
      ? manager.getRepository(InventoryMovement)
      : this.inventoryRepository;

    const existingBatch = await batchRepository.findOne({
      where: {
        productId,
        batchCode: `LEGACY-${productId}`,
      },
    });

    if (existingBatch) {
      return existingBatch;
    }

    const product = await productRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const result = await inventoryRepository
      .createQueryBuilder('movement')
      .select('COALESCE(SUM(movement.quantityDelta), 0)', 'stock')
      .where('movement.productId = :productId', { productId })
      .getRawOne<{ stock: string }>();

    const stock = Number(result?.stock ?? 0);
    if (stock <= 0) {
      return null;
    }

    return this.createBatchEntry({
      productId: product.id,
      storeId: product.storeId ?? null,
      supplierId: product.supplierId ?? null,
      quantity: stock,
      unitCost: Number(product.cost ?? 0),
      receivedAt: new Date(),
      expiresAt: null,
      batchCode: `LEGACY-${productId}`,
      note: 'Legacy stock migration',
      movementType: InventoryMovementType.IN,
      referenceType: InventoryReferenceType.LEGACY,
      manager,
      createMovement: false,
    });
  }

  async backfillLegacyBatches() {
    const products = await this.productsRepository.find();
    for (const product of products) {
      await this.createLegacyBatchForProduct(product.id);
    }
    return { migratedProducts: products.length };
  }

  private async applyAdjustment(params: {
    productId: string;
    quantityDelta: number;
    note?: string;
  }) {
    const product = await this.productsRepository.findOne({
      where: { id: params.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const currentStock = await this.getCurrentStock(product.id);
    const nextStock = currentStock + params.quantityDelta;
    if (nextStock < 0) {
      throw new BadRequestException('The requested movement leaves stock below zero');
    }

    let targetBatch = await this.batchesRepository.findOne({
      where: {
        productId: product.id,
        batchCode: `LEGACY-${product.id}`,
      },
    });

    if (!targetBatch) {
      targetBatch = await this.createLegacyBatchForProduct(product.id);
    }

    if (!targetBatch) {
      targetBatch = await this.createBatchEntry({
        productId: product.id,
        storeId: product.storeId ?? null,
        supplierId: product.supplierId ?? null,
        quantity: 0,
        unitCost: Number(product.cost ?? 0),
        receivedAt: new Date(),
        expiresAt: null,
        batchCode: `LEGACY-${product.id}`,
        note: 'Batch created for inventory adjustment',
        movementType: InventoryMovementType.IN,
        referenceType: InventoryReferenceType.LEGACY,
        createMovement: false,
      });
    }

    targetBatch.availableQuantity += params.quantityDelta;
    targetBatch.initialQuantity += params.quantityDelta > 0 ? params.quantityDelta : 0;
    targetBatch.status =
      targetBatch.availableQuantity <= 0
        ? InventoryBatchStatus.DEPLETED
        : InventoryBatchStatus.ACTIVE;
    await this.batchesRepository.save(targetBatch);

    return this.createSystemMovement({
      productId: product.id,
      batchId: targetBatch.id,
      movementType: InventoryMovementType.ADJUSTMENT,
      quantityDelta: params.quantityDelta,
      note: params.note,
      referenceType: InventoryReferenceType.ADJUSTMENT,
      referenceId: targetBatch.id,
      unitCostSnapshot: Number(targetBatch.unitCost),
    });
  }

  private async createBatchEntry(params: {
    productId: string;
    storeId?: string | null;
    supplierId?: string | null;
    purchaseId?: string | null;
    purchaseItemId?: string | null;
    quantity: number;
    unitCost: number;
    receivedAt: Date;
    expiresAt?: Date | null;
    batchCode?: string | null;
    note?: string | null;
    movementType: InventoryMovementType;
    referenceType: InventoryReferenceType;
    manager?: EntityManager;
    createMovement?: boolean;
  }) {
    if (params.quantity < 0) {
      throw new BadRequestException('Quantity cannot be negative');
    }

    const productRepository = params.manager
      ? params.manager.getRepository(Product)
      : this.productsRepository;
    const batchRepository = params.manager
      ? params.manager.getRepository(InventoryBatch)
      : this.batchesRepository;

    const product = await productRepository.findOne({
      where: { id: params.productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    this.ensurePerishableRules(product, params.expiresAt?.toISOString());

    const batch = batchRepository.create({
      productId: params.productId,
      storeId: params.storeId ?? product.storeId ?? null,
      supplierId: params.supplierId ?? null,
      purchaseId: params.purchaseId ?? null,
      purchaseItemId: params.purchaseItemId ?? null,
      batchCode: params.batchCode ?? null,
      receivedAt: params.receivedAt,
      expiresAt: params.expiresAt ?? null,
      unitCost: params.unitCost,
      initialQuantity: params.quantity,
      availableQuantity: params.quantity,
      status:
        params.quantity > 0
          ? InventoryBatchStatus.ACTIVE
          : InventoryBatchStatus.DEPLETED,
    });

    const savedBatch = await batchRepository.save(batch);

    if (params.createMovement !== false && params.quantity > 0) {
      await this.createSystemMovement({
        productId: params.productId,
        batchId: savedBatch.id,
        movementType: params.movementType,
        quantityDelta: params.quantity,
        note: params.note ?? undefined,
        manager: params.manager,
        referenceType: params.referenceType,
        referenceId: savedBatch.id,
        unitCostSnapshot: params.unitCost,
      });
    }

    return savedBatch;
  }

  private ensurePerishableRules(product: Product, expiresAt?: string | null) {
    if (product.isPerishable && !expiresAt) {
      throw new BadRequestException(
        `Product ${product.name} requires an expiration date`,
      );
    }
  }
}
