import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Sale } from '../sales/entities/sale.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';

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
  ) {}

  async getSummary() {
    const [products, orders, sales, movements] = await Promise.all([
      this.productsRepository.find(),
      this.ordersRepository.find({ order: { createdAt: 'DESC' } }),
      this.salesRepository.find({ order: { createdAt: 'DESC' } }),
      this.inventoryRepository.find(),
    ]);

    const stockByProduct = new Map<string, number>();
    for (const movement of movements) {
      stockByProduct.set(
        movement.productId,
        (stockByProduct.get(movement.productId) ?? 0) + movement.quantityDelta,
      );
    }

    const lowStockProducts = products.filter(
      (product) => (stockByProduct.get(product.id) ?? 0) <= 5,
    ).length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const salesToday = sales
      .filter((sale) => new Date(sale.createdAt) >= today)
      .reduce((acc, sale) => acc + Number(sale.total), 0);

    const pendingOrders = orders.filter(
      (order) =>
        order.status === OrderStatus.PENDING ||
        order.status === OrderStatus.PAID ||
        order.status === OrderStatus.PREPARING,
    ).length;

    const salesByDay = Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (6 - index));
      day.setHours(0, 0, 0, 0);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);

      const total = sales
        .filter((sale) => {
          const createdAt = new Date(sale.createdAt);
          return createdAt >= day && createdAt < nextDay;
        })
        .reduce((acc, sale) => acc + Number(sale.total), 0);

      return {
        label: day.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' }),
        total: Number(total.toFixed(2)),
      };
    });

    return {
      totalProducts: products.length,
      lowStockProducts,
      salesToday: Number(salesToday.toFixed(2)),
      pendingOrders,
      salesByDay,
      latestOrders: orders.slice(0, 5).map((order) => ({
        id: order.id,
        status: order.status,
        total: Number(order.total),
        customerName: `${order.customer.firstName} ${order.customer.lastName}`,
      })),
    };
  }
}
