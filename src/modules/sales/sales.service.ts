import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { GetSalesQueryDto } from './dto/get-sales-query.dto';
import { Product } from '../products/entities/product.entity';
import { InventoryService } from '../inventory/inventory.service';
import { Sale, SaleDeliveryType, SalePaymentMethod } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { Customer } from '../customers/entities/customer.entity';
import { CustomersService } from '../customers/customers.service';
import { CashService } from '../cash/cash.service';
import { AuditService } from '../audit/audit.service';
import { InventoryReferenceType } from '../inventory/entities/inventory-batch-allocation.entity';
import { Order, DeliveryMethod, PaymentStatus } from '../orders/entities/order.entity';

// Ventana de registros recientes que se combinan en memoria para el historial
// unificado (POS + pedidos online) — evita tener que escribir una consulta SQL
// UNION entre dos tablas con esquemas distintos solo para poder paginar juntas;
// para el volumen de una tienda pequeña esto es más que suficiente.
const UNIFIED_FETCH_CAP = 300;

interface UnifiedSaleItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product: { id: string; name: string; sku: string | null };
}

export interface UnifiedSale {
  id: string;
  source: 'POS' | 'ONLINE';
  paymentMethod: SalePaymentMethod | null;
  paymentMethodLabel: string | null;
  customerId: string | null;
  storeId: string | null;
  cashSessionId: string | null;
  total: number;
  createdAt: string;
  customer: { id: string; firstName: string; lastName: string } | null;
  store: { id: string; name: string } | null;
  guestName: string | null;
  guestPhone: string | null;
  guestDocType: string | null;
  guestDoc: string | null;
  deliveryType: SaleDeliveryType | null;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryNotes: string | null;
  items: UnifiedSaleItem[];
  orderId?: string;
}

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
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly inventoryService: InventoryService,
    private readonly customersService: CustomersService,
    private readonly cashService: CashService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: GetSalesQueryDto = {}, allowedStoreIds?: string[]) {
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

    if (allowedStoreIds) {
      if (storeId && !allowedStoreIds.includes(storeId)) {
        throw new ForbiddenException('No tienes permiso para ver las ventas de esta tienda');
      }
      const ids = storeId ? [storeId] : allowedStoreIds;
      qb.andWhere(ids.length ? 'sale.storeId IN (:...ids)' : '1 = 0', { ids });
    } else if (storeId) {
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

  async findOne(id: string, allowedStoreIds?: string[]) {
    const sale = await this.salesRepository.findOne({
      where: { id },
    });

    if (!sale) {
      throw new BadRequestException('Sale not found');
    }

    if (allowedStoreIds && (!sale.storeId || !allowedStoreIds.includes(sale.storeId))) {
      throw new ForbiddenException('No tienes permiso para ver esta venta');
    }

    return sale;
  }

  /** Historial unificado: ventas de POS + pedidos online ya pagados, combinados y ordenados por fecha. */
  async findAllUnifiedHistory(
    query: GetSalesQueryDto = {},
    allowedStoreIds?: string[],
  ): Promise<{ items: UnifiedSale[]; total: number; page: number; limit: number; totalPages: number }> {
    const { storeId, paymentMethod, deliveryType, from, to, search, page = 1, limit = 20 } = query;
    const take = Math.min(Math.max(+limit, 1), 100);
    const safePage = Math.max(+page, 1);

    // paymentMethod (CASH/CREDIT) y deliveryType=NONE son conceptos exclusivos
    // de POS — un pedido online siempre tiene método de pago propio (Nequi,
    // Bancolombia, etc.) y siempre tiene un deliveryMethod. Si el filtro está
    // activo, solo tiene sentido buscar en POS.
    const includeOnline = !paymentMethod && deliveryType !== 'NONE';

    const [posItems, onlineItems] = await Promise.all([
      this.fetchPosForUnified({ storeId, paymentMethod, deliveryType, from, to, search, allowedStoreIds }),
      includeOnline
        ? this.fetchOnlineForUnified({ storeId, deliveryType, from, to, search, allowedStoreIds })
        : Promise.resolve([]),
    ]);

    const merged = [...posItems, ...onlineItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const total = merged.length;
    const start = (safePage - 1) * take;
    const items = merged.slice(start, start + take);

    return { items, total, page: safePage, limit: take, totalPages: Math.max(1, Math.ceil(total / take)) };
  }

  private async fetchPosForUnified(params: {
    storeId?: string;
    paymentMethod?: SalePaymentMethod;
    deliveryType?: string;
    from?: string;
    to?: string;
    search?: string;
    allowedStoreIds?: string[];
  }): Promise<UnifiedSale[]> {
    const { storeId, paymentMethod, deliveryType, from, to, search, allowedStoreIds } = params;

    const qb = this.salesRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.store', 'store')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('sale.createdAt', 'DESC')
      .take(UNIFIED_FETCH_CAP);

    if (allowedStoreIds) {
      const ids = storeId ? [storeId] : allowedStoreIds;
      qb.andWhere(ids.length ? 'sale.storeId IN (:...ids)' : '1 = 0', { ids });
    } else if (storeId) {
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

    const sales = await qb.getMany();
    return sales.map((sale) => this.normalizeSale(sale));
  }

  private normalizeSale(sale: Sale): UnifiedSale {
    return {
      id: sale.id,
      source: 'POS',
      paymentMethod: sale.paymentMethod,
      paymentMethodLabel: null,
      customerId: sale.customerId,
      storeId: sale.storeId,
      cashSessionId: sale.cashSessionId,
      total: Number(sale.total),
      createdAt: sale.createdAt.toISOString(),
      customer: sale.customer
        ? { id: sale.customer.id, firstName: sale.customer.firstName, lastName: sale.customer.lastName }
        : null,
      store: sale.store ? { id: sale.store.id, name: sale.store.name } : null,
      guestName: sale.guestName,
      guestPhone: sale.guestPhone,
      guestDocType: sale.guestDocType,
      guestDoc: sale.guestDoc,
      deliveryType: sale.deliveryType,
      deliveryAddress: sale.deliveryAddress,
      deliveryCity: sale.deliveryCity,
      deliveryNotes: sale.deliveryNotes,
      items: (sale.items ?? []).map((i) => ({
        id: i.id,
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
        product: { id: i.product.id, name: i.product.name, sku: i.product.sku },
      })),
    };
  }

  private async fetchOnlineForUnified(params: {
    storeId?: string;
    deliveryType?: string;
    from?: string;
    to?: string;
    search?: string;
    allowedStoreIds?: string[];
  }): Promise<UnifiedSale[]> {
    const { storeId, deliveryType, from, to, search, allowedStoreIds } = params;

    let orderDeliveryMethod: DeliveryMethod | undefined;
    if (deliveryType === 'LOCAL') orderDeliveryMethod = DeliveryMethod.PICKUP;
    else if (deliveryType === 'SHIPPING') orderDeliveryMethod = DeliveryMethod.DELIVERY;

    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('product.store', 'itemStore')
      .where('order.paymentStatus = :confirmed', { confirmed: PaymentStatus.CONFIRMED })
      .orderBy('order.paymentConfirmedAt', 'DESC')
      .take(UNIFIED_FETCH_CAP);

    if (orderDeliveryMethod) {
      qb.andWhere('order.deliveryMethod = :dm', { dm: orderDeliveryMethod });
    }

    const scopedStoreIds = storeId ? [storeId] : allowedStoreIds;
    if (scopedStoreIds) {
      qb.andWhere(
        scopedStoreIds.length
          ? `EXISTS (
              SELECT 1 FROM order_items oi
              JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = order.id AND p.store_id IN (:...scopedStoreIds)
            )`
          : '1 = 0',
        { scopedStoreIds },
      );
    }

    if (from) {
      qb.andWhere('order.paymentConfirmedAt >= :from', { from: new Date(from) });
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      qb.andWhere('order.paymentConfirmedAt <= :to', { to: toDate });
    }
    if (search?.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(CAST(order.id AS TEXT)) LIKE :s
          OR LOWER(customer.first_name) LIKE :s
          OR LOWER(customer.last_name) LIKE :s
          OR LOWER(customer.email) LIKE :s)`,
        { s },
      );
    }

    const orders = await qb.getMany();
    return orders.map((order) => this.normalizeOrder(order, scopedStoreIds));
  }

  private normalizeOrder(order: Order, scopedStoreIds?: string[]): UnifiedSale {
    // Un pedido puede mezclar productos de varias tiendas — un seller solo
    // debe ver (y sumar) la parte que le corresponde, no el pedido completo.
    const scopedItems = scopedStoreIds
      ? order.items.filter((i) => i.product?.storeId && scopedStoreIds.includes(i.product.storeId))
      : order.items;
    const relevantItems = scopedItems.length > 0 ? scopedItems : order.items;
    const total = scopedStoreIds
      ? relevantItems.reduce((sum, i) => sum + Number(i.lineTotal), 0)
      : Number(order.total);
    const storeFromItem = relevantItems.find((i) => i.product?.store)?.product.store ?? null;

    return {
      id: order.id,
      source: 'ONLINE',
      paymentMethod: null,
      paymentMethodLabel: order.paymentMethodType ?? 'Pago en línea',
      customerId: order.customerId,
      storeId: storeFromItem?.id ?? null,
      cashSessionId: null,
      total,
      createdAt: (order.paymentConfirmedAt ?? order.createdAt).toISOString(),
      customer: order.customer
        ? { id: order.customer.id, firstName: order.customer.firstName, lastName: order.customer.lastName }
        : null,
      store: storeFromItem ? { id: storeFromItem.id, name: storeFromItem.name } : null,
      guestName: null,
      guestPhone: null,
      guestDocType: null,
      guestDoc: null,
      deliveryType:
        order.deliveryMethod === DeliveryMethod.DELIVERY
          ? SaleDeliveryType.SHIPPING
          : order.deliveryMethod === DeliveryMethod.PICKUP
          ? SaleDeliveryType.LOCAL
          : null,
      deliveryAddress: order.deliveryAddress,
      deliveryCity: order.deliveryCity,
      deliveryNotes: order.deliveryNotes,
      items: relevantItems.map((i) => ({
        id: i.id,
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
        product: { id: i.product.id, name: i.product.name, sku: i.product.sku },
      })),
      orderId: order.id,
    };
  }

  async create(createSaleDto: CreateSaleDto, userId?: number, allowedStoreIds?: string[]) {
    if (allowedStoreIds) {
      if (!createSaleDto.storeId) {
        throw new BadRequestException('La tienda es requerida para registrar la venta');
      }
      if (!allowedStoreIds.includes(createSaleDto.storeId)) {
        throw new ForbiddenException('No tienes permiso para registrar ventas en esta tienda');
      }
    }

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

      const formattedTotal = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
      }).format(total);
      await this.auditService.log({
        userId: userId ?? null,
        action:
          paymentMethod === SalePaymentMethod.CREDIT
            ? 'SALE_CREDIT_CREATED'
            : 'SALE_CREATED',
        entity: 'sale',
        referenceId: savedSale.id,
        detail: `Total: ${formattedTotal}`,
      });

      return manager.getRepository(Sale).findOne({ where: { id: savedSale.id } });
    });
  }
}
