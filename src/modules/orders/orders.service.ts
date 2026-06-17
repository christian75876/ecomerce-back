import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { Store } from '../stores/entities/store.entity';
import { InventoryService } from '../inventory/inventory.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { InventoryReferenceType } from '../inventory/entities/inventory-batch-allocation.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CouponsService } from '../coupons/coupons.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    private readonly inventoryService: InventoryService,
    private readonly notificationsService: NotificationsService,
    private readonly couponsService: CouponsService,
  ) {}

  async findAll(storeId?: string, page = 1, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    if (!storeId) {
      const [items, total] = await this.ordersRepository.findAndCount({
        order: { createdAt: 'DESC' },
        relations: ['customer', 'items', 'items.product'],
        take,
        skip,
      });
      return { items, total, page: Math.max(page, 1), limit: take, totalPages: Math.ceil(total / take) };
    }

    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .where('product.storeId = :storeId', { storeId })
      .orderBy('order.createdAt', 'DESC')
      .take(take)
      .skip(skip);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: Math.max(page, 1), limit: take, totalPages: Math.ceil(total / take) };
  }

  async findMine(userId: number) {
    const customer = await this.customersRepository.findOne({
      where: { userId },
    });

    if (!customer) {
      return [];
    }

    return this.ordersRepository.find({
      where: { customerId: customer.id },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const order = await this.ordersRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async findMyOne(id: string, userId: number) {
    const customer = await this.customersRepository.findOne({
      where: { userId },
    });

    if (!customer) {
      throw new NotFoundException('Order not found');
    }

    const order = await this.ordersRepository.findOne({
      where: {
        id,
        customerId: customer.id,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async create(createOrderDto: CreateOrderDto) {
    let notifyCustomer: Customer;
    let notifyStores: Store[] = [];
    let appliedCouponId: string | null = null;
    let appliedCouponCode: string | null = null;

    const savedOrderId = await this.dataSource.transaction(async (manager) => {
      const productsRepository = manager.getRepository(Product);
      const items = [];
      let total = 0;
      const storeMap = new Map<string, Store>();

      for (const item of createOrderDto.items) {
        const product = await productsRepository.findOne({
          where: { id: item.productId, isActive: true },
        });

        if (!product) {
          throw new BadRequestException('One of the selected products is invalid');
        }

        const stock = await this.inventoryService.getCurrentStock(product.id);
        if (stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${product.name}`,
          );
        }

        if (product.store && !storeMap.has(product.store.id)) {
          storeMap.set(product.store.id, product.store);
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

      notifyStores = [...storeMap.values()];
      const customerStoreId =
        storeMap.size === 1 ? Array.from(storeMap.keys())[0] : null;
      const customer = await this.resolveCustomer(
        createOrderDto,
        manager,
        customerStoreId,
      );
      notifyCustomer = customer;

      let discountAmount = 0;

      if (createOrderDto.couponCode?.trim()) {
        try {
          const { coupon, discountAmount: discount } = await this.couponsService.validate(
            createOrderDto.couponCode,
            total,
          );
          discountAmount = discount;
          appliedCouponCode = coupon.code;
          appliedCouponId = coupon.id;
        } catch {
          throw new BadRequestException(
            `Cupón inválido: ${createOrderDto.couponCode}`,
          );
        }
      }

      const finalTotal = Math.max(0, total - discountAmount);

      const order = manager.create(Order, {
        customerId: customer.id,
        total: finalTotal,
        status: OrderStatus.PENDING,
        deliveryMethod: createOrderDto.deliveryMethod ?? null,
        deliveryAddress: createOrderDto.deliveryAddress?.trim() || null,
        deliveryCity: createOrderDto.deliveryCity?.trim() || null,
        deliveryDepartment: createOrderDto.deliveryDepartment?.trim() || null,
        deliveryNotes: createOrderDto.deliveryNotes?.trim() || null,
        deliveryLat: createOrderDto.deliveryLat ?? null,
        deliveryLng: createOrderDto.deliveryLng ?? null,
        couponCode: appliedCouponCode,
        discountAmount,
      });
      const savedOrder = await manager.save(order);

      for (const item of items) {
        const orderItem = manager.create(OrderItem, {
          orderId: savedOrder.id,
          ...item,
        });
        await manager.save(orderItem);
        await this.inventoryService.consumeStock({
          productId: item.productId,
          quantity: item.quantity,
          referenceType: InventoryReferenceType.ORDER,
          referenceId: savedOrder.id,
          referenceItemId: orderItem.id,
          note: `Order ${savedOrder.id}`,
          manager,
        });
      }

      return savedOrder.id;
    });

    const fullOrder = await this.findOne(savedOrderId);

    // Increment coupon usage (outside transaction to avoid blocking)
    if (appliedCouponId) {
      void this.couponsService.incrementUsage(appliedCouponId);
    }

    // Fire-and-forget: notify via SSE + WhatsApp
    void this.notificationsService.notifyNewOrder(fullOrder, notifyCustomer!, notifyStores);

    return fullOrder;
  }

  private async resolveCustomer(
    createOrderDto: CreateOrderDto,
    manager: EntityManager,
    storeId?: string | null,
  ) {
    const customersRepository = manager.getRepository(Customer);

    if (createOrderDto.customerId) {
      const customer = await customersRepository.findOne({
        where: storeId
          ? { id: createOrderDto.customerId, storeId }
          : { id: createOrderDto.customerId },
      });

      if (!customer) {
        throw new BadRequestException('Customer not found');
      }

      return customer;
    }

    if (!createOrderDto.customer) {
      throw new BadRequestException('Customer information is required');
    }

    const normalizedEmail = createOrderDto.customer.email.trim().toLowerCase();
    const existingCustomer = await customersRepository.findOne({
      where: storeId
        ? { email: normalizedEmail, storeId }
        : { email: normalizedEmail },
    });

    if (existingCustomer) {
      return existingCustomer;
    }

    const customer = customersRepository.create({
      firstName: createOrderDto.customer.firstName.trim(),
      lastName: createOrderDto.customer.lastName.trim(),
      email: normalizedEmail,
      phone: createOrderDto.customer.phone?.trim() || null,
      storeId: storeId ?? null,
    });

    return customersRepository.save(customer);
  }

  async updateStatus(id: string, updateOrderStatusDto: UpdateOrderStatusDto) {
    const order = await this.findOne(id);
    this.validateTransition(order.status, updateOrderStatusDto.status);

    if (
      updateOrderStatusDto.status === OrderStatus.CANCELLED &&
      order.status !== OrderStatus.CANCELLED
    ) {
      await this.inventoryService.restoreStockFromAllocations({
        referenceType: InventoryReferenceType.ORDER,
        referenceId: order.id,
        note: `Order cancellation ${order.id}`,
        restoredReferenceType: InventoryReferenceType.ORDER_CANCEL,
      });
    }

    order.status = updateOrderStatusDto.status;
    return this.ordersRepository.save(order);
  }

  private validateTransition(currentStatus: OrderStatus, nextStatus: OrderStatus) {
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [
        OrderStatus.PAID,
        OrderStatus.PREPARING,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.PAID]: [
        OrderStatus.PREPARING,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.PREPARING]: [
        OrderStatus.SHIPPED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (currentStatus === nextStatus) {
      return;
    }

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new BadRequestException('Invalid order status transition');
    }
  }
}
