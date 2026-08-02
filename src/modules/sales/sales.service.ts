import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { GetSalesQueryDto } from './dto/get-sales-query.dto';
import { Product } from '../products/entities/product.entity';
import { InventoryService } from '../inventory/inventory.service';
import { Sale, SalePaymentMethod } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { Customer } from '../customers/entities/customer.entity';
import { CustomersService } from '../customers/customers.service';
import { CashService } from '../cash/cash.service';
import { AuditService } from '../audit/audit.service';
import { InventoryReferenceType } from '../inventory/entities/inventory-batch-allocation.entity';

@Injectable()
export class SalesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItemsRepository: Repository<SaleItem>,
    private readonly inventoryService: InventoryService,
    private readonly customersService: CustomersService,
    private readonly cashService: CashService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: GetSalesQueryDto = {}) {
    const { storeId, paymentMethod, deliveryType, from, to, search, page = 1, limit = 20 } = query;
    const take = Math.min(Math.max(+limit, 1), 100);
    const skip = (Math.max(+page, 1) - 1) * take;

    const qb = this.salesRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.store', 'store')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('sale.createdAt', 'DESC')
      .take(take)
      .skip(skip);

    if (storeId) {
      qb.andWhere('sale.storeId = :storeId', { storeId });
    }
    if (paymentMethod) {
      qb.andWhere('sale.paymentMethod = :paymentMethod', { paymentMethod });
    }
    if (deliveryType === 'NONE') {
      qb.andWhere('sale.deliveryType IS NULL');
    } else if (deliveryType === 'LOCAL' || deliveryType === 'SHIPPING') {
      qb.andWhere('sale.deliveryType = :deliveryType', { deliveryType });
    }
    if (from) {
      qb.andWhere('sale.createdAt >= :from', { from: new Date(from) });
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      qb.andWhere('sale.createdAt <= :to', { to: toDate });
    }
    if (search?.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((b) => {
          b.where('LOWER(CAST(sale.id AS varchar)) LIKE :s')
            .orWhere("LOWER(COALESCE(sale.guestName, '')) LIKE :s")
            .orWhere("LOWER(COALESCE(customer.firstName, '')) LIKE :s")
            .orWhere("LOWER(COALESCE(customer.lastName, '')) LIKE :s");
        }),
        { s },
      );
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page: Math.max(+page, 1),
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async findOne(id: string) {
    const sale = await this.salesRepository.findOne({
      where: { id },
    });

    if (!sale) {
      throw new BadRequestException('Sale not found');
    }

    return sale;
  }

  async create(createSaleDto: CreateSaleDto) {
    return this.dataSource.transaction(async (manager) => {
      const productsRepository = manager.getRepository(Product);
      const customersRepository = manager.getRepository(Customer);
      const items = [];
      let total = 0;
      const paymentMethod = createSaleDto.paymentMethod ?? SalePaymentMethod.CASH;

      if (paymentMethod === SalePaymentMethod.CREDIT && !createSaleDto.storeId) {
        throw new BadRequestException('Credit sale requires a store');
      }

      const customer =
        createSaleDto.customerId
          ? await customersRepository.findOne({
              where: createSaleDto.storeId
                ? { id: createSaleDto.customerId, storeId: createSaleDto.storeId }
                : { id: createSaleDto.customerId },
            })
          : null;

      if (paymentMethod === SalePaymentMethod.CREDIT && !customer) {
        throw new BadRequestException('Credit sale requires a customer');
      }

      for (const item of createSaleDto.items) {
        const product = await productsRepository.findOne({
          where: { id: item.productId, isActive: true },
        });

        if (!product) {
          throw new BadRequestException('One of the selected products is invalid');
        }

        if (createSaleDto.storeId && product.storeId !== createSaleDto.storeId) {
          throw new BadRequestException(
            'One of the selected products does not belong to the selected store',
          );
        }

        const stock = await this.inventoryService.getCurrentStock(product.id);
        if (stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${product.name}`,
          );
        }

        const lineTotal = Number(product.price) * item.quantity;
        total += lineTotal;

        items.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: Number(product.price),
          lineTotal,
        });
      }

      const sale = manager.create(Sale, {
        total,
        paymentMethod,
        customerId: customer?.id ?? null,
        storeId: createSaleDto.storeId ?? null,
        cashSessionId: createSaleDto.cashSessionId ?? null,
        guestName: createSaleDto.guestName ?? null,
        guestPhone: createSaleDto.guestPhone ?? null,
        guestDocType: createSaleDto.guestDocType ?? null,
        guestDoc: createSaleDto.guestDoc ?? null,
        deliveryType: createSaleDto.deliveryType ?? null,
        deliveryAddress: createSaleDto.deliveryAddress ?? null,
        deliveryCity: createSaleDto.deliveryCity ?? null,
        deliveryNotes: createSaleDto.deliveryNotes ?? null,
      });
      const savedSale = await manager.save(sale);

      for (const item of items) {
        const saleItem = manager.create(SaleItem, {
          saleId: savedSale.id,
          ...item,
        });
        await manager.save(saleItem);
        await this.inventoryService.consumeStock({
          productId: item.productId,
          quantity: item.quantity,
          referenceType: InventoryReferenceType.SALE,
          referenceId: savedSale.id,
          referenceItemId: saleItem.id,
          note: `POS sale ${savedSale.id}`,
          manager,
        });
      }

      if (paymentMethod === SalePaymentMethod.CREDIT && customer) {
        await this.customersService.registerCreditSale(
          customer.id,
          total,
          savedSale.id,
          createSaleDto.storeId,
        );
      }

      if (paymentMethod === SalePaymentMethod.CASH && createSaleDto.cashSessionId) {
        await this.cashService.registerCashSale(createSaleDto.cashSessionId, total);
      }

      await this.auditService.log({
        action:
          paymentMethod === SalePaymentMethod.CREDIT
            ? 'SALE_CREDIT_CREATED'
            : 'SALE_CREATED',
        entity: 'sale',
        referenceId: savedSale.id,
        detail: `Sale total ${total}`,
      });

      return manager.getRepository(Sale).findOne({ where: { id: savedSale.id } });
    });
  }
}
