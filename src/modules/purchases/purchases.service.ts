import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Purchase } from './entities/purchase.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Store } from '../stores/entities/store.entity';
import { Product } from '../products/entities/product.entity';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryReferenceType } from '../inventory/entities/inventory-batch-allocation.entity';

@Injectable()
export class PurchasesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Purchase)
    private readonly purchasesRepository: Repository<Purchase>,
    @InjectRepository(PurchaseItem)
    private readonly purchaseItemsRepository: Repository<PurchaseItem>,
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    private readonly inventoryService: InventoryService,
  ) {}

  async findAll() {
    return this.purchasesRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const purchase = await this.purchasesRepository.findOne({ where: { id } });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    return purchase;
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

    return this.dataSource.transaction(async (manager) => {
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
        note: payload.note?.trim() || null,
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

      return this.findOne(savedPurchase.id);
    });
  }
}
