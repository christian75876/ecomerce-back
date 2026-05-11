import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Purchase } from './entities/purchase.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { PurchasePayment } from './entities/purchase-payment.entity';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Store } from '../stores/entities/store.entity';
import { Product } from '../products/entities/product.entity';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryReferenceType } from '../inventory/entities/inventory-batch-allocation.entity';
import {
  InventoryBatch,
  InventoryBatchStatus,
} from '../inventory/entities/inventory-batch.entity';
import { InventoryMovementType } from '../inventory/entities/inventory-movement.entity';
import { RegisterPurchasePaymentDto } from './dto/register-purchase-payment.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { CancelPurchaseDto } from './dto/cancel-purchase.dto';
import { PurchaseStatus } from './entities/purchase.entity';
import { QueryPurchasesDto } from './dto/query-purchases.dto';

@Injectable()
export class PurchasesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Purchase)
    private readonly purchasesRepository: Repository<Purchase>,
    @InjectRepository(PurchasePayment)
    private readonly purchasePaymentsRepository: Repository<PurchasePayment>,
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(InventoryBatch)
    private readonly inventoryBatchesRepository: Repository<InventoryBatch>,
    private readonly inventoryService: InventoryService,
  ) {}

  async findAll(query: QueryPurchasesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.purchasesRepository
      .createQueryBuilder('purchase')
      .leftJoinAndSelect('purchase.supplier', 'supplier')
      .leftJoinAndSelect('purchase.store', 'store')
      .leftJoinAndSelect('purchase.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('purchase.payments', 'payments')
      .orderBy('purchase.purchaseDate', 'DESC')
      .addOrderBy('purchase.createdAt', 'DESC');

    if (query.search?.trim()) {
      builder.andWhere(
        '(supplier.name ILIKE :search OR purchase.note ILIKE :search OR CAST(purchase.id AS TEXT) ILIKE :search)',
        {
          search: `%${query.search.trim()}%`,
        },
      );
    }

    if (query.supplierId) {
      builder.andWhere('purchase.supplierId = :supplierId', {
        supplierId: query.supplierId,
      });
    }

    if (query.dateFrom) {
      builder.andWhere('purchase.purchaseDate >= :dateFrom', {
        dateFrom: new Date(query.dateFrom).toISOString(),
      });
    }

    if (query.dateTo) {
      const dateTo = new Date(query.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      builder.andWhere('purchase.purchaseDate <= :dateTo', {
        dateTo: dateTo.toISOString(),
      });
    }

    const [purchases, totalItems] = await builder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const items = purchases.map((purchase) => this.serializePurchase(purchase));
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return {
      items,
      pagination: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    };
  }

  async findOne(id: string) {
    const purchase = await this.findPurchaseOrFail(id);
    const cancelability = await this.getCancelability(purchase.id);

    return this.serializePurchase(purchase, cancelability);
  }

  async create(payload: CreatePurchaseDto) {
    const supplier = await this.suppliersRepository.findOne({
      where: { id: payload.supplierId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const store = await this.storesRepository.findOne({
      where: { id: payload.storeId, isActive: true },
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const paidAmount = Number(payload.paidAmount ?? 0);

    const purchaseId = await this.dataSource.transaction(async (manager) => {
      const items = [];
      let total = 0;

      for (const item of payload.items) {
        const product = await this.productsRepository.findOne({
          where: { id: item.productId },
        });

        if (!product) {
          throw new BadRequestException('One of the selected products is invalid');
        }

        if (product.storeId && product.storeId !== store.id) {
          throw new BadRequestException(
            `Product ${product.name} does not belong to the selected store`,
          );
        }

        const lineTotal = Number(item.unitCost) * item.quantity;
        total += lineTotal;

        if (product.isPerishable && !item.expiresAt) {
          throw new BadRequestException(
            `Product ${product.name} requires expiration date`,
          );
        }

        items.push({
          productId: product.id,
          quantity: item.quantity,
          unitCost: Number(item.unitCost),
          lineTotal,
          expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
          batchCode: item.batchCode?.trim() || null,
        });
      }

      if (paidAmount > total) {
        throw new BadRequestException('Paid amount cannot exceed purchase total');
      }

      const purchase = manager.getRepository(Purchase).create({
        supplierId: supplier.id,
        storeId: store.id,
        purchaseDate: new Date(payload.purchaseDate),
        total,
        paidAmount,
        balance: total - paidAmount,
        status: this.resolveStatus(total, paidAmount, false),
        note: payload.note?.trim() || null,
        cancelReason: null,
        cancelledAt: null,
      });
      const savedPurchase = await manager.getRepository(Purchase).save(purchase);

      for (const item of items) {
        const purchaseItem = manager.getRepository(PurchaseItem).create({
          purchaseId: savedPurchase.id,
          ...item,
        });
        const savedPurchaseItem = await manager
          .getRepository(PurchaseItem)
          .save(purchaseItem as unknown as PurchaseItem);
        await this.inventoryService.createSystemBatchEntry({
          productId: item.productId,
          storeId: store.id,
          supplierId: supplier.id,
          purchaseId: savedPurchase.id,
          purchaseItemId: savedPurchaseItem.id,
          quantity: item.quantity,
          unitCost: item.unitCost,
          expiresAt: item.expiresAt,
          batchCode: item.batchCode,
          note: `Purchase ${savedPurchase.id}`,
          manager,
          referenceType: InventoryReferenceType.PURCHASE,
        });
      }

      return savedPurchase.id;
    });

    return this.findOne(purchaseId);
  }

  async update(id: string, payload: UpdatePurchaseDto) {
    const purchase = await this.findPurchaseOrFail(id);

    if (purchase.status === PurchaseStatus.CANCELLED) {
      throw new BadRequestException('Cancelled purchases cannot be edited');
    }

    if (payload.purchaseDate) {
      purchase.purchaseDate = new Date(payload.purchaseDate);
    }

    if (typeof payload.note === 'string') {
      purchase.note = payload.note.trim() || null;
    }

    await this.purchasesRepository.save(purchase);

    return this.findOne(id);
  }

  async registerPayment(id: string, payload: RegisterPurchasePaymentDto) {
    const purchase = await this.findPurchaseOrFail(id);

    if (purchase.status === PurchaseStatus.CANCELLED) {
      throw new BadRequestException('Cancelled purchases cannot receive payments');
    }

    if (payload.amount > Number(purchase.balance)) {
      throw new BadRequestException('Payment exceeds current purchase balance');
    }

    purchase.paidAmount = Number(purchase.paidAmount) + payload.amount;
    purchase.balance = Math.max(0, Number(purchase.total) - Number(purchase.paidAmount));
    purchase.status = this.resolveStatus(
      Number(purchase.total),
      Number(purchase.paidAmount),
      false,
    );

    const payment = this.purchasePaymentsRepository.create({
      purchaseId: purchase.id,
      amount: payload.amount,
      note: payload.note?.trim() || null,
      paidAt: payload.paidAt ? new Date(payload.paidAt) : new Date(),
    });

    await this.purchasesRepository.save(purchase);
    await this.purchasePaymentsRepository.save(payment);

    return this.findOne(id);
  }

  async cancel(id: string, payload: CancelPurchaseDto) {
    const purchase = await this.findPurchaseOrFail(id);

    if (purchase.status === PurchaseStatus.CANCELLED) {
      throw new BadRequestException('Purchase is already cancelled');
    }

    const cancelability = await this.getCancelability(purchase.id);
    if (!cancelability.canCancel) {
      throw new BadRequestException(
        cancelability.reason ?? 'Purchase cannot be cancelled',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const purchaseRepository = manager.getRepository(Purchase);
      const batchRepository = manager.getRepository(InventoryBatch);
      const batches = await batchRepository.find({
        where: { purchaseId: purchase.id },
      });

      for (const batch of batches) {
        if (batch.availableQuantity > 0) {
          await this.inventoryService.createSystemMovement({
            productId: batch.productId,
            batchId: batch.id,
            movementType: InventoryMovementType.OUT,
            quantityDelta: -batch.availableQuantity,
            note: `Purchase cancellation ${purchase.id}`,
            manager,
            referenceType: InventoryReferenceType.ADJUSTMENT,
            referenceId: purchase.id,
            unitCostSnapshot: Number(batch.unitCost),
          });
        }

        batch.availableQuantity = 0;
        batch.status = InventoryBatchStatus.BLOCKED;
        await batchRepository.save(batch);
      }

      purchase.status = PurchaseStatus.CANCELLED;
      purchase.cancelReason = payload.reason?.trim() || null;
      purchase.cancelledAt = new Date();
      purchase.balance = 0;

      await purchaseRepository.save(purchase);
    });

    return this.findOne(id);
  }

  private async findPurchaseOrFail(id: string) {
    const purchase = await this.purchasesRepository.findOne({ where: { id } });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    return purchase;
  }

  private resolveStatus(total: number, paidAmount: number, cancelled: boolean) {
    if (cancelled) {
      return PurchaseStatus.CANCELLED;
    }

    if (paidAmount <= 0) {
      return PurchaseStatus.OPEN;
    }

    if (paidAmount >= total) {
      return PurchaseStatus.PAID;
    }

    return PurchaseStatus.PARTIALLY_PAID;
  }

  private async getCancelability(purchaseId: string) {
    const batches = await this.inventoryBatchesRepository.find({
      where: { purchaseId },
    });

    if (batches.length === 0) {
      return { canCancel: true, reason: null as string | null };
    }

    const hasConsumedStock = batches.some(
      (batch) => batch.availableQuantity < batch.initialQuantity,
    );

    if (hasConsumedStock) {
      return {
        canCancel: false,
        reason:
          'No se puede cancelar la compra porque alguno de sus lotes ya tuvo consumo o ajuste.',
      };
    }

    return { canCancel: true, reason: null as string | null };
  }

  private serializePurchase(
    purchase: Purchase,
    cancelability?: { canCancel: boolean; reason: string | null },
  ) {
    const normalizedStatus =
      purchase.status !== PurchaseStatus.CANCELLED &&
      Number(purchase.balance) <= 0
        ? PurchaseStatus.PAID
        : purchase.status;
    const payments = [...(purchase.payments ?? [])].sort(
      (left, right) =>
        new Date(right.paidAt).getTime() - new Date(left.paidAt).getTime(),
    );

    return {
      ...purchase,
      status: normalizedStatus,
      payments,
      canCancel: cancelability?.canCancel,
      cancellationBlockedReason: cancelability?.reason ?? null,
    };
  }
}
