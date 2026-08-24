import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, LessThan, Repository } from 'typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { Store } from '../stores/entities/store.entity';
import { User } from '../users/entities/user.entity';
import { InventoryService } from '../inventory/inventory.service';
import { Order, OrderStatus, PaymentStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { InventoryReferenceType } from '../inventory/entities/inventory-batch-allocation.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CouponsService } from '../coupons/coupons.service';
import { EmailService } from '../auth/email.service';
import { PushService } from '../push/push.service';

@Injectable()
export class OrdersService {
  // Minutos que el stock queda reservado en firme sin comprobante de pago ni
  // confirmación de la tienda antes de liberarse automáticamente (ver
  // releaseExpiredReservations() y orders.scheduler.ts).
  static readonly RESERVATION_MINUTES = 20;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    private readonly inventoryService: InventoryService,
    private readonly notificationsService: NotificationsService,
    private readonly couponsService: CouponsService,
    private readonly emailService: EmailService,
    private readonly pushService: PushService,
  ) {}

  async findAll(storeId?: string, page = 1, limit = 20, status?: string, search?: string, paymentStatus?: string, requestingUserId?: number, role?: string) {
    const take = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const skip = (safePage - 1) * take;

    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .orderBy('order.createdAt', 'DESC')
      .take(take)
      .skip(skip);

    // Sellers must see only their own stores; ignore any storeId they might pass
    if (role && role !== 'admin' && requestingUserId) {
      const sellerStores = await this.storesRepository.find({
        where: { userId: requestingUserId },
        select: ['id'],
      });
      const sellerStoreIds = sellerStores.map((s) => s.id);
      if (sellerStoreIds.length === 0) return { items: [], total: 0, page, limit, totalPages: 0 };
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = order.id AND p.store_id IN (:...sellerStoreIds)
        )`,
        { sellerStoreIds },
      );
    } else if (storeId) {
      // Admin can filter by a specific storeId
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = order.id AND p.store_id = :storeId
        )`,
        { storeId },
      );
    }

    if (status) {
      qb.andWhere('order.status = :status', { status });
    }

    if (paymentStatus) {
      qb.andWhere('order.payment_status = :paymentStatus', { paymentStatus });
    }

    if (search) {
      const s = `%${search.toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(CAST(order.id AS TEXT)) LIKE :s
          OR LOWER(customer.first_name) LIKE :s
          OR LOWER(customer.last_name) LIKE :s
          OR LOWER(customer.email) LIKE :s)`,
        { s },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: safePage, limit: take, totalPages: Math.ceil(total / take) };
  }

  async findMine(userId: number) {
    const customer = await this.customersRepository.findOne({
      where: { userId },
    });

    if (!customer) {
      return [];
    }

    // Include orders from orphan customers with same email (created before login)
    const allCustomers = await this.customersRepository.find({
      where: { email: customer.email },
      select: ['id'],
    });
    const customerIds = allCustomers.map((c) => c.id);

    return this.ordersRepository.find({
      where: { customerId: In(customerIds) },
      relations: { items: { product: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, requestingUserId?: number, role?: string) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id)) throw new NotFoundException('Order not found');

    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: { items: { product: true }, customer: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (role && role !== 'admin' && requestingUserId) {
      await this.verifyOrderAccess(order, requestingUserId);
    }
    return order;
  }

  async findMyOne(id: string, userId: number) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id)) throw new NotFoundException('Pedido no encontrado');

    const customer = await this.customersRepository.findOne({
      where: { userId },
    });

    if (!customer) {
      throw new NotFoundException('Pedido no encontrado');
    }

    const allCustomers = await this.customersRepository.find({
      where: { email: customer.email },
      select: ['id'],
    });
    const customerIds = allCustomers.map((c) => c.id);

    const order = await this.ordersRepository.findOne({
      where: { id, customerId: In(customerIds) },
      relations: { items: { product: true }, customer: true },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
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
          relations: { store: true },
        });

        if (!product) {
          throw new BadRequestException('One of the selected products is invalid');
        }

        const stock = await this.inventoryService.getCurrentStock(product.id, manager);
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

      // El stock se reserva (descuenta) de inmediato para no sobrevender, pero
      // es una reserva temporal: si en RESERVATION_MINUTES no llega comprobante
      // de pago ni confirmación de la tienda, releaseExpiredReservations() la
      // libera automáticamente (ver orders.scheduler.ts) sin cancelar el pedido.
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

    // Fire-and-forget: notify via SSE + WhatsApp + email + Web Push
    void this.notificationsService.notifyNewOrder(fullOrder, notifyCustomer!, notifyStores);
    void this.sendOrderEmailsToStores(fullOrder, notifyCustomer!, notifyStores);
    void this.pushService.sendToAll({
      title: '🛍️ Nuevo pedido',
      body: `${notifyCustomer!.firstName} ${notifyCustomer!.lastName} — $${Number(fullOrder.total).toLocaleString('es-CO')}`,
      url: '/private/orders',
      tag: `order-new-${fullOrder.id}`,
    });

    // Include store payment instructions in response so the customer can pay immediately
    const storePaymentInstructions =
      notifyStores.length === 1 ? (notifyStores[0].paymentInstructions ?? null) : null;

    return Object.assign(fullOrder, { storePaymentInstructions });
  }

  // Descuenta el stock de un pedido una sola vez (idempotente vía hasAllocations),
  // sin importar si se llega por confirmPayment() o por un avance manual de estado.
  private async consumeOrderStock(order: Order, manager?: EntityManager) {
    const alreadyConsumed = await this.inventoryService.hasAllocations(
      InventoryReferenceType.ORDER,
      order.id,
      manager,
    );
    if (alreadyConsumed) {
      return;
    }

    for (const item of order.items) {
      await this.inventoryService.consumeStock({
        productId: item.productId,
        quantity: item.quantity,
        referenceType: InventoryReferenceType.ORDER,
        referenceId: order.id,
        referenceItemId: item.id,
        note: `Order ${order.id}`,
        manager,
      });
    }
  }

  async submitPayment(id: string, dto: SubmitPaymentDto, evidenceImagePath?: string) {
    const order = await this.findOne(id);
    if (dto.paymentMethodType) order.paymentMethodType = dto.paymentMethodType.trim();
    if (dto.paymentReference) order.paymentReference = dto.paymentReference.trim();
    if (evidenceImagePath) order.paymentEvidenceImagePath = evidenceImagePath;
    if (order.paymentStatus === PaymentStatus.NONE) {
      order.paymentStatus = PaymentStatus.SUBMITTED;
    }
    return this.ordersRepository.save(order);
  }

  async confirmPayment(id: string, confirmedByUserId: number, role?: string) {
    const order = await this.findOne(id);
    if (role && role !== 'admin') {
      await this.verifyOrderAccess(order, confirmedByUserId);
    }
    if (order.paymentConfirmedAt) {
      return order;
    }
    order.paymentConfirmedAt = new Date();
    order.paymentConfirmedByUserId = confirmedByUserId;
    order.paymentStatus = PaymentStatus.CONFIRMED;
    if (order.status === OrderStatus.PENDING) {
      order.status = OrderStatus.PAID;
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      await this.consumeOrderStock(order, manager);
      return manager.getRepository(Order).save(order);
    });
    void this.notifyCustomerStatusChange(saved);
    return saved;
  }

  async autoCancelUnpaidOrders(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 5);

    const staleOrders = await this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .where('order.payment_status = :ps', { ps: PaymentStatus.NONE })
      .andWhere('order.status = :st', { st: OrderStatus.PENDING })
      .andWhere('order.created_at < :cutoff', { cutoff })
      .getMany();

    for (const order of staleOrders) {
      await this.inventoryService.restoreStockFromAllocations({
        referenceType: InventoryReferenceType.ORDER,
        referenceId: order.id,
        note: `Order abandoned ${order.id}`,
        restoredReferenceType: InventoryReferenceType.ORDER_CANCEL,
      });
      order.status = OrderStatus.CANCELLED;
      await this.ordersRepository.save(order);
      void this.notifyCustomerStatusChange(order).catch(() => null);
    }
    return staleOrders.length;
  }

  // Pedidos sin comprobante de pago ni confirmación de la tienda dentro de la
  // ventana de reserva: se libera el stock (para que otros clientes puedan
  // comprarlo) pero el pedido SIGUE apareciendo como pendiente para la tienda
  // — no se cancela solo, para que la tienda pueda confirmarlo si el cliente
  // se comunica después (y re-reservar el stock si aún hay disponible).
  async releaseExpiredReservations(): Promise<number> {
    const cutoff = new Date(Date.now() - OrdersService.RESERVATION_MINUTES * 60 * 1000);

    const staleOrders = await this.ordersRepository.find({
      where: {
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.NONE,
        createdAt: LessThan(cutoff),
      },
    });

    for (const order of staleOrders) {
      await this.inventoryService.restoreStockFromAllocations({
        referenceType: InventoryReferenceType.ORDER,
        referenceId: order.id,
        note: `Reserva de stock expirada (pedido ${order.id})`,
        restoredReferenceType: InventoryReferenceType.ORDER_CANCEL,
      });
    }
    return staleOrders.length;
  }

  /** Used by the /uploads/payment-evidence static middleware in main.ts — JWT alone doesn't prove the requester owns this order. */
  async canAccessPaymentEvidence(filename: string, userId: number): Promise<boolean> {
    const evidencePath = `uploads/payment-evidence/${filename}`;
    const order = await this.ordersRepository.findOne({
      where: { paymentEvidenceImagePath: evidencePath },
      relations: { items: { product: true } },
    });
    if (!order) return false;

    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      relations: { role: true },
    });
    if (user?.role?.name === 'admin') return true;

    const orderCustomer = await this.customersRepository.findOne({ where: { id: order.customerId } });
    if (orderCustomer?.userId === userId) return true;

    // Same rule as findMine/findMyOne: a customer created before the buyer had an
    // account (orphan, matched only by email) still counts as "their" order.
    if (orderCustomer) {
      const requestingCustomer = await this.customersRepository.findOne({ where: { userId } });
      if (requestingCustomer && requestingCustomer.email === orderCustomer.email) return true;
    }

    const storeIds = (order.items ?? [])
      .map((item) => item.product?.storeId)
      .filter((sid): sid is string => Boolean(sid));
    if (storeIds.length === 0) return false;

    const ownsStore = await this.storesRepository.count({ where: { id: In(storeIds), userId } });
    return ownsStore > 0;
  }

  private async verifyOrderAccess(order: Order, userId: number): Promise<void> {
    const storeIds = (order.items ?? [])
      .map((item) => item.product?.storeId)
      .filter((sid): sid is string => Boolean(sid));

    if (storeIds.length === 0) throw new ForbiddenException('Acceso denegado');

    const count = await this.storesRepository.count({
      where: { id: In(storeIds), userId },
    });

    if (count === 0) throw new ForbiddenException('Acceso denegado');
  }

  private async resolveCustomer(
    createOrderDto: CreateOrderDto,
    manager: EntityManager,
    storeId?: string | null,
  ) {
    const customersRepository = manager.getRepository(Customer);

    if (createOrderDto.customerId) {
      const customer = await customersRepository.findOne({
        where: { id: createOrderDto.customerId },
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

  private async sendOrderEmailsToStores(order: Order, customer: Customer, stores: Store[]) {
    const customerName = `${customer.firstName} ${customer.lastName}`.trim();
    const itemCount = order.items?.length ?? 0;

    for (const store of stores) {
      if (!store.email) continue;
      try {
        await this.emailService.sendNewOrderEmail(store.email, {
          storeName: store.name,
          customerName,
          orderId: order.id,
          total: Number(order.total),
          itemCount,
          deliveryMethod: order.deliveryMethod ?? null,
        });
      } catch {
        // Non-critical: SSE notification already sent
      }
    }
  }

  async updateStatus(id: string, updateOrderStatusDto: UpdateOrderStatusDto, requestingUserId?: number, role?: string) {
    const order = await this.findOne(id);
    if (role && role !== 'admin' && requestingUserId) {
      await this.verifyOrderAccess(order, requestingUserId);
    }
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

    // Si la tienda avanza el pedido manualmente (sin usar "Confirmar pago"),
    // el stock se descuenta igual al salir de PENDING — es el único otro
    // punto por el que un pedido puede pasar a estar "en curso".
    if (
      order.status === OrderStatus.PENDING &&
      updateOrderStatusDto.status !== OrderStatus.PENDING &&
      updateOrderStatusDto.status !== OrderStatus.CANCELLED
    ) {
      await this.consumeOrderStock(order);
    }

    order.status = updateOrderStatusDto.status;
    const saved = await this.ordersRepository.save(order);

    void this.notifyCustomerStatusChange(saved);

    return saved;
  }

  private async notifyCustomerStatusChange(order: Order): Promise<void> {
    const STATUS_META: Record<string, { label: string; emoji: string; color: string }> = {
      PENDING:   { label: 'Pendiente',        emoji: '⏳', color: '#94a3b8' },
      PAID:      { label: 'Pagado',            emoji: '✅', color: '#22c55e' },
      PREPARING: { label: 'En preparación',   emoji: '🔧', color: '#3b82f6' },
      SHIPPED:   { label: 'Enviado',           emoji: '🚚', color: '#8b5cf6' },
      DELIVERED: { label: 'Entregado',         emoji: '📦', color: '#16a34a' },
      CANCELLED: { label: 'Cancelado',         emoji: '❌', color: '#ef4444' },
    };

    try {
      const customer = await this.customersRepository.findOne({
        where: { id: order.customerId },
      });
      if (!customer?.email) return;

      const meta = STATUS_META[order.status] ?? { label: order.status, emoji: '📋', color: '#6366f1' };

      const storeNameResult = await this.ordersRepository.query<{ store_name: string }[]>(
        `SELECT DISTINCT s.name AS store_name
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         JOIN stores s ON p.store_id = s.id
         WHERE oi.order_id = $1
         LIMIT 1`,
        [order.id],
      );
      const storeName = storeNameResult?.[0]?.store_name ?? 'la tienda';

      await this.emailService.sendOrderStatusEmail(customer.email, {
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
        orderId: order.id,
        status: order.status,
        statusLabel: meta.label,
        statusColor: meta.color,
        statusEmoji: meta.emoji,
        total: Number(order.total),
        storeName,
      });

      // SSE + Web Push to buyer (if they are connected / have a push subscription)
      if (customer.userId) {
        this.notificationsService.notifyUser(customer.userId, {
          type: 'order_status_update',
          orderId: order.id,
          status: order.status,
          statusLabel: meta.label,
          statusEmoji: meta.emoji,
          storeName,
          updatedAt: new Date().toISOString(),
        });

        void this.pushService.sendToUser(customer.userId, {
          title: `${meta.emoji} Pedido ${meta.label.toLowerCase()}`,
          body: `Tu pedido en ${storeName} está ${meta.label.toLowerCase()}`,
          url: '/my-orders',
          tag: `order-status-${order.id}`,
        });
      }
    } catch (err) {
      // Fire-and-forget: log but don't break the response
      console.error(`[OrdersService] Could not send status email for order ${order.id}:`, err);
    }
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
