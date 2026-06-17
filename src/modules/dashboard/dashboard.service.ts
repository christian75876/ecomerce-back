import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Sale } from '../sales/entities/sale.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { InventoryBatch } from '../inventory/entities/inventory-batch.entity';
import { QueryDashboardAnalyticsDto } from './dto/query-dashboard-analytics.dto';
import { Purchase } from '../purchases/entities/purchase.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CustomerLedgerEntry, CustomerLedgerEntryType } from '../customers/entities/customer-ledger-entry.entity';
import { CashSession, CashSessionStatus } from '../cash/entities/cash-session.entity';
import { CashMovement } from '../cash/entities/cash-movement.entity';
import { Store } from '../stores/entities/store.entity';

type SalesPoint = {
  label: string;
  pos: number;
  online: number;
  total: number;
  profit: number;
};

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    @InjectRepository(InventoryMovement)
    private readonly inventoryRepository: Repository<InventoryMovement>,
    @InjectRepository(InventoryBatch)
    private readonly inventoryBatchesRepository: Repository<InventoryBatch>,
    @InjectRepository(Purchase)
    private readonly purchasesRepository: Repository<Purchase>,
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(CustomerLedgerEntry)
    private readonly customerLedgerRepository: Repository<CustomerLedgerEntry>,
    @InjectRepository(CashSession)
    private readonly cashSessionsRepository: Repository<CashSession>,
    @InjectRepository(CashMovement)
    private readonly cashMovementsRepository: Repository<CashMovement>,
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
  ) {}

  async getSummary() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const analytics = await this.getAnalytics({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      criticalStockThreshold: 5,
      rotationDays: 30,
    });

    return {
      totalProducts: analytics.kpis.totalProducts,
      lowStockProducts: analytics.kpis.lowStockProducts,
      salesToday: analytics.kpis.salesToday,
      pendingOrders: analytics.kpis.pendingOrders,
      salesByDay: analytics.salesByPeriod.map((item) => ({
        label: item.label,
        total: item.total,
      })),
      latestOrders: analytics.latestOrders,
    };
  }

  async getAnalytics(query: QueryDashboardAnalyticsDto) {
    const criticalStockThreshold = query.criticalStockThreshold ?? 5;
    const rotationDays = query.rotationDays ?? 30;
    // Date-only strings ("YYYY-MM-DD") are parsed as UTC midnight by the JS engine,
    // making setHours() operate on the wrong local day. Appending T00:00:00 (no Z)
    // forces local-time parsing. Full ISO strings (from getSummary) are left as-is.
    const parseDate = (s: string) => (s.length === 10 ? new Date(`${s}T00:00:00`) : new Date(s));
    const endDate = query.endDate ? parseDate(query.endDate) : new Date();
    const startDate = query.startDate
      ? parseDate(query.startDate)
      : new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000);

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const [
      products,
      orders,
      sales,
      movements,
      batches,
      purchases,
      customers,
      customerLedgerEntries,
      cashSessions,
      cashMovements,
      stores,
    ] = await Promise.all([
      this.productsRepository.find({ order: { createdAt: 'DESC' } }),
      this.ordersRepository.find({
        order: { createdAt: 'DESC' },
        relations: ['customer', 'items', 'items.product'],
      }),
      this.salesRepository.find({ order: { createdAt: 'DESC' } }),
      this.inventoryRepository.find({ order: { createdAt: 'DESC' } }),
      this.inventoryBatchesRepository.find({ order: { receivedAt: 'DESC' } }),
      this.purchasesRepository.find({ order: { purchaseDate: 'DESC' } }),
      this.customersRepository.find({ order: { updatedAt: 'DESC' } }),
      this.customerLedgerRepository.find({
        relations: { customer: true },
        order: { createdAt: 'DESC' },
      }),
      this.cashSessionsRepository.find({ order: { openedAt: 'DESC' } }),
      this.cashMovementsRepository.find({ order: { createdAt: 'DESC' } }),
      this.storesRepository.find({ order: { name: 'ASC' } }),
    ]);

    const filteredProducts = products.filter(
      (product) => !query.storeId || !product.storeId || product.storeId === query.storeId,
    );
    const productIds = new Set(filteredProducts.map((product) => product.id));

    const filteredMovements = movements.filter((movement) =>
      productIds.has(movement.productId),
    );

    const stockByProduct = new Map<string, number>();
    for (const batch of batches.filter((batch) => productIds.has(batch.productId))) {
      stockByProduct.set(
        batch.productId,
        (stockByProduct.get(batch.productId) ?? 0) + batch.availableQuantity,
      );
    }

    const isWithinRange = (value: Date | string) => {
      const date = new Date(value);
      return date >= startDate && date <= endDate;
    };

    const filteredSales = sales.filter(
      (sale) =>
        (!query.storeId || !sale.storeId || sale.storeId === query.storeId) &&
        isWithinRange(sale.createdAt),
    );

    const relevantOrderItemsForStore = (order: Order) =>
      order.items.filter(
        (item) => !query.storeId || !item.product.storeId || item.product.storeId === query.storeId,
      );

    const filteredOrders = orders.filter((order) => {
      if (!isWithinRange(order.createdAt)) {
        return false;
      }

      if (!query.storeId) {
        return true;
      }

      return relevantOrderItemsForStore(order).length > 0;
    });

    // Only count orders with confirmed payment; PENDING means not yet paid
    const activeOrders = filteredOrders.filter((order) =>
      [OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.SHIPPED, OrderStatus.DELIVERED].includes(order.status),
    );

    const filteredPurchases = purchases.filter(
      (purchase) =>
        purchase.status !== 'CANCELLED' &&
        (!query.storeId || purchase.storeId === query.storeId) &&
        isWithinRange(purchase.purchaseDate),
    );

    const filteredCashSessions = cashSessions.filter(
      (session) =>
        (!query.storeId || session.storeId === query.storeId) &&
        isWithinRange(session.openedAt),
    );

    const openCashSessionIds = new Set(
      filteredCashSessions
        .filter((session) => session.status === CashSessionStatus.OPEN)
        .map((session) => session.id),
    );

    const filteredCashMovements = cashMovements.filter((movement) =>
      openCashSessionIds.has(movement.cashSessionId),
    );

    const filteredCustomers = customers.filter(
      (customer) => !query.storeId || customer.storeId === query.storeId,
    );

    const pendingOrders = filteredOrders.filter((order) =>
      [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.PREPARING].includes(
        order.status,
      ),
    ).length;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const salesTodayPos = sales
      .filter(
        (sale) =>
          (!query.storeId || !sale.storeId || sale.storeId === query.storeId) &&
          new Date(sale.createdAt) >= todayStart &&
          new Date(sale.createdAt) <= todayEnd,
      )
      .reduce((acc, sale) => acc + Number(sale.total), 0);

    const salesTodayOnline = orders
      .filter(
        (order) =>
          order.status !== OrderStatus.CANCELLED &&
          new Date(order.createdAt) >= todayStart &&
          new Date(order.createdAt) <= todayEnd,
      )
      .reduce((acc, order) => {
        const total = relevantOrderItemsForStore(order).reduce(
          (sum, item) => sum + Number(item.lineTotal),
          0,
        );
        return acc + total;
      }, 0);

    const posRevenue = filteredSales.reduce(
      (acc, sale) => acc + Number(sale.total),
      0,
    );

    const onlineRevenue = activeOrders.reduce((acc, order) => {
      const total = relevantOrderItemsForStore(order).reduce(
        (sum, item) => sum + Number(item.lineTotal),
        0,
      );
      return acc + total;
    }, 0);

    const totalRevenue = posRevenue + onlineRevenue;
    const totalTransactions = filteredSales.length + activeOrders.length;

    // COGS: cost of goods sold across POS sales and confirmed online orders
    const posCogs = filteredSales.reduce((acc, sale) => {
      return acc + sale.items.reduce((sum, item) => {
        const costPerUnit = item.product?.cost != null ? Number(item.product.cost) : 0;
        return sum + costPerUnit * item.quantity;
      }, 0);
    }, 0);
    const orderCogs = activeOrders.reduce((acc, order) => {
      return acc + relevantOrderItemsForStore(order).reduce((sum, item) => {
        const costPerUnit = item.product?.cost != null ? Number(item.product.cost) : 0;
        return sum + costPerUnit * item.quantity;
      }, 0);
    }, 0);
    const cogs = posCogs + orderCogs;
    const grossProfit = totalRevenue - cogs;
    const grossMargin = totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(1)) : 0;

    const buildDailySeries = (): SalesPoint[] => {
      const days = Math.max(
        1,
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
        ) + 1,
      );

      return Array.from({ length: days }, (_, index) => {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + index);
        day.setHours(0, 0, 0, 0);
        const nextDay = new Date(day);
        nextDay.setDate(day.getDate() + 1);

        const daySales = filteredSales.filter((sale) => {
          const createdAt = new Date(sale.createdAt);
          return createdAt >= day && createdAt < nextDay;
        });

        const pos = daySales.reduce((acc, sale) => acc + Number(sale.total), 0);

        const dayCogs = daySales.reduce((acc, sale) => {
          return acc + sale.items.reduce((sum, item) => {
            const costPerUnit = item.product?.cost != null ? Number(item.product.cost) : 0;
            return sum + costPerUnit * item.quantity;
          }, 0);
        }, 0);

        const online = activeOrders
          .filter((order) => {
            const createdAt = new Date(order.createdAt);
            return createdAt >= day && createdAt < nextDay;
          })
          .reduce((acc, order) => {
            const total = relevantOrderItemsForStore(order).reduce(
              (sum, item) => sum + Number(item.lineTotal),
              0,
            );
            return acc + total;
          }, 0);

        return {
          label: day.toLocaleDateString('es-CO', {
            month: 'short',
            day: 'numeric',
          }),
          pos: Number(pos.toFixed(2)),
          online: Number(online.toFixed(2)),
          total: Number((pos + online).toFixed(2)),
          profit: Number((pos - dayCogs).toFixed(2)),
        };
      });
    };

    const productPerformance = new Map<
      string,
      {
        productId: string;
        name: string;
        categoryName: string;
        storeName: string;
        quantity: number;
        revenue: number;
      }
    >();

    const categoryPerformance = new Map<
      string,
      {
        categoryId: string;
        name: string;
        quantity: number;
        revenue: number;
      }
    >();

    const registerProductPerformance = (
      productId: string,
      quantity: number,
      lineTotal: number,
    ) => {
      const product = filteredProducts.find((item) => item.id === productId);
      if (!product) {
        return;
      }

      const currentProduct = productPerformance.get(productId) ?? {
        productId,
        name: product.name,
        categoryName: product.category?.name ?? 'Sin categoría',
        storeName: product.store?.name ?? 'Sin tienda',
        quantity: 0,
        revenue: 0,
      };

      currentProduct.quantity += quantity;
      currentProduct.revenue += lineTotal;
      productPerformance.set(productId, currentProduct);

      const categoryKey = product.categoryId;
      const currentCategory = categoryPerformance.get(categoryKey) ?? {
        categoryId: categoryKey,
        name: product.category?.name ?? 'Sin categoría',
        quantity: 0,
        revenue: 0,
      };

      currentCategory.quantity += quantity;
      currentCategory.revenue += lineTotal;
      categoryPerformance.set(categoryKey, currentCategory);
    };

    for (const sale of filteredSales) {
      for (const item of sale.items) {
        registerProductPerformance(
          item.productId,
          item.quantity,
          Number(item.lineTotal),
        );
      }
    }

    for (const order of activeOrders) {
      for (const item of relevantOrderItemsForStore(order)) {
        registerProductPerformance(
          item.productId,
          item.quantity,
          Number(item.lineTotal),
        );
      }
    }

    const inventoryFlow = buildDailySeries().map((point) => ({
      label: point.label,
      inbound: 0,
      outbound: 0,
      adjustments: 0,
      net: 0,
    }));

    const inventoryFlowMap = new Map(inventoryFlow.map((item) => [item.label, item]));
    for (const movement of filteredMovements.filter((item) => isWithinRange(item.createdAt))) {
      const label = new Date(movement.createdAt).toLocaleDateString('es-CO', {
        month: 'short',
        day: 'numeric',
      });
      const bucket = inventoryFlowMap.get(label);
      if (!bucket) {
        continue;
      }

      if (movement.quantityDelta >= 0) {
        bucket.inbound += movement.quantityDelta;
      } else {
        bucket.outbound += Math.abs(movement.quantityDelta);
      }

      if (movement.movementType === 'ADJUSTMENT') {
        bucket.adjustments += movement.quantityDelta;
      }

      bucket.net = bucket.inbound - bucket.outbound;
    }

    const activeProducts = filteredProducts.filter((product) => product.isActive);
    const criticalProducts = activeProducts
      .map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        stock: stockByProduct.get(product.id) ?? 0,
        storeName: product.store?.name ?? 'Sin tienda',
        categoryName: product.category?.name ?? 'Sin categoría',
      }))
      .filter((product) => product.stock > 0 && product.stock <= criticalStockThreshold)
      .sort((a, b) => a.stock - b.stock);

    const outOfStockProducts = activeProducts
      .map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        stock: stockByProduct.get(product.id) ?? 0,
        storeName: product.store?.name ?? 'Sin tienda',
        categoryName: product.category?.name ?? 'Sin categoría',
      }))
      .filter((product) => product.stock <= 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    const rotationCutoff = new Date(endDate);
    rotationCutoff.setDate(rotationCutoff.getDate() - rotationDays);

    const soldProductIdsSinceRotation = new Set<string>();
    for (const sale of sales.filter(
      (item) =>
        (!query.storeId || !item.storeId || item.storeId === query.storeId) &&
        new Date(item.createdAt) >= rotationCutoff &&
        new Date(item.createdAt) <= endDate,
    )) {
      sale.items.forEach((item) => soldProductIdsSinceRotation.add(item.productId));
    }
    for (const order of orders.filter(
      (item) =>
        item.status !== OrderStatus.CANCELLED &&
        new Date(item.createdAt) >= rotationCutoff &&
        new Date(item.createdAt) <= endDate,
    )) {
      relevantOrderItemsForStore(order).forEach((item) =>
        soldProductIdsSinceRotation.add(item.productId),
      );
    }

    const noRotationProducts = activeProducts
      .map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        stock: stockByProduct.get(product.id) ?? 0,
        storeName: product.store?.name ?? 'Sin tienda',
        categoryName: product.category?.name ?? 'Sin categoría',
      }))
      .filter(
        (product) =>
          product.stock > 0 && !soldProductIdsSinceRotation.has(product.id),
      )
      .sort((a, b) => b.stock - a.stock);

    const customerPaymentById = new Map<string, Date>();
    for (const entry of customerLedgerEntries) {
      if (query.storeId && entry.customer?.storeId !== query.storeId) {
        continue;
      }

      if (
        entry.type === CustomerLedgerEntryType.PAYMENT &&
        !customerPaymentById.has(entry.customerId)
      ) {
        customerPaymentById.set(entry.customerId, new Date(entry.createdAt));
      }
    }

    const customersWithDebt = filteredCustomers
      .filter((customer) => Number(customer.creditBalance) > 0)
      .map((customer) => ({
        customerId: customer.id,
        name: `${customer.firstName} ${customer.lastName}`.trim(),
        email: customer.email,
        balance: Number(customer.creditBalance),
        creditLimit: customer.creditLimit ? Number(customer.creditLimit) : null,
        lastPaymentAt: customerPaymentById.get(customer.id)?.toISOString() ?? null,
      }))
      .sort((a, b) => b.balance - a.balance);

    const supplierDebtMap = new Map<
      string,
      {
        supplierId: string;
        name: string;
        balance: number;
        lastPurchaseAt: string | null;
        lastPaidAmount: number;
      }
    >();

    for (const purchase of purchases.filter(
      (item) =>
        item.status !== 'CANCELLED' &&
        (!query.storeId || item.storeId === query.storeId),
    )) {
      const current = supplierDebtMap.get(purchase.supplierId) ?? {
        supplierId: purchase.supplierId,
        name: purchase.supplier.name,
        balance: 0,
        lastPurchaseAt: null,
        lastPaidAmount: 0,
      };

      current.balance += Number(purchase.balance);
      if (
        !current.lastPurchaseAt ||
        new Date(purchase.purchaseDate) > new Date(current.lastPurchaseAt)
      ) {
        current.lastPurchaseAt = new Date(purchase.purchaseDate).toISOString();
        current.lastPaidAmount = Number(purchase.paidAmount);
      }

      supplierDebtMap.set(purchase.supplierId, current);
    }

    const suppliersWithDebt = Array.from(supplierDebtMap.values())
      .filter((supplier) => supplier.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    const availableStores = stores.map((store) => ({
      id: store.id,
      name: store.name,
      isActive: store.isActive,
    }));

    const latestOrders = filteredOrders.slice(0, 5).map((order) => ({
      id: order.id,
      status: order.status,
      total: Number(
        (!query.storeId
          ? Number(order.total)
          : relevantOrderItemsForStore(order).reduce(
              (acc, item) => acc + Number(item.lineTotal),
              0,
            )
        ).toFixed(2),
      ),
      customerName: order.customer
        ? `${order.customer.firstName} ${order.customer.lastName}`.trim()
        : 'Sin cliente',
    }));

    return {
      filters: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        storeId: query.storeId ?? null,
        criticalStockThreshold,
        rotationDays,
      },
      availableStores,
      kpis: {
        totalProducts: activeProducts.length,
        salesToday: Number((salesTodayPos + salesTodayOnline).toFixed(2)),
        salesThisPeriod: Number(totalRevenue.toFixed(2)),
        posRevenue: Number(posRevenue.toFixed(2)),
        onlineRevenue: Number(onlineRevenue.toFixed(2)),
        totalTransactions,
        averageTicket:
          totalTransactions > 0
            ? Number((totalRevenue / totalTransactions).toFixed(2))
            : 0,
        pendingOrders,
        lowStockProducts: criticalProducts.length,
        outOfStockProducts: outOfStockProducts.length,
        noRotationProducts: noRotationProducts.length,
        stockUnits: Array.from(stockByProduct.values()).reduce(
          (acc, stock) => acc + Math.max(0, stock),
          0,
        ),
        customerDebt: Number(
          customersWithDebt.reduce((acc, item) => acc + item.balance, 0).toFixed(2),
        ),
        supplierDebt: Number(
          suppliersWithDebt.reduce((acc, item) => acc + item.balance, 0).toFixed(2),
        ),
        openCashSessions: filteredCashSessions.filter(
          (session) => session.status === CashSessionStatus.OPEN,
        ).length,
        inventoryEntries: filteredPurchases.reduce(
          (acc, purchase) => acc + purchase.items.length,
          0,
        ),
        cogs: Number(cogs.toFixed(2)),
        grossProfit: Number(grossProfit.toFixed(2)),
        grossMargin,
      },
      salesByPeriod: buildDailySeries(),
      topProducts: Array.from(productPerformance.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8)
        .map((item) => ({
          ...item,
          revenue: Number(item.revenue.toFixed(2)),
        })),
      topCategories: Array.from(categoryPerformance.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6)
        .map((item) => ({
          ...item,
          revenue: Number(item.revenue.toFixed(2)),
        })),
      channelComparison: [
        {
          channel: 'POS',
          count: filteredSales.length,
          revenue: Number(posRevenue.toFixed(2)),
        },
        {
          channel: 'ONLINE',
          count: activeOrders.length,
          revenue: Number(onlineRevenue.toFixed(2)),
        },
      ],
      inventoryFlow: inventoryFlow.map((item) => ({
        ...item,
        net: Number(item.net.toFixed(2)),
      })),
      stockAlerts: {
        critical: criticalProducts.slice(0, 10),
        outOfStock: outOfStockProducts.slice(0, 10),
        noRotation: noRotationProducts.slice(0, 10),
      },
      receivables: {
        totalOutstanding: Number(
          customersWithDebt.reduce((acc, item) => acc + item.balance, 0).toFixed(2),
        ),
        customersWithDebt: customersWithDebt.length,
        items: customersWithDebt.slice(0, 10),
      },
      payables: {
        totalOutstanding: Number(
          suppliersWithDebt.reduce((acc, item) => acc + item.balance, 0).toFixed(2),
        ),
        suppliersWithDebt: suppliersWithDebt.length,
        items: suppliersWithDebt.slice(0, 10),
      },
      cashOverview: {
        openSessions: filteredCashSessions.filter(
          (session) => session.status === CashSessionStatus.OPEN,
        ).length,
        closedSessions: filteredCashSessions.filter(
          (session) => session.status === CashSessionStatus.CLOSED,
        ).length,
        manualMovementsTotal: Number(
          filteredCashMovements
            .reduce((acc, movement) => acc + Number(movement.amount), 0)
            .toFixed(2),
        ),
      },
      purchasesOverview: {
        totalPurchases: filteredPurchases.length,
        purchaseVolume: Number(
          filteredPurchases
            .reduce((acc, purchase) => acc + Number(purchase.total), 0)
            .toFixed(2),
        ),
      },
      latestOrders,
    };
  }
}
