import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { InventoryService } from '../inventory/inventory.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { InventoryReferenceType } from '../inventory/entities/inventory-batch-allocation.entity';

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
  ) {}

  async findAll() {
    return this.ordersRepository.find({
      order: { createdAt: 'DESC' },
    });
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
    return this.dataSource.transaction(async (manager) => {
      const customer = await this.resolveCustomer(createOrderDto, manager);
      const productsRepository = manager.getRepository(Product);
      const items = [];
      let total = 0;

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

        const lineTotal = Number(product.price) * item.quantity;
        total += lineTotal;

        items.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: Number(product.price),
          lineTotal,
        });
      }

      const order = manager.create(Order, {
        customerId: customer.id,
        total,
        status: OrderStatus.PENDING,
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

      return this.findOne(savedOrder.id);
    });
  }

  private async resolveCustomer(
    createOrderDto: CreateOrderDto,
    manager: EntityManager,
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
      where: { email: normalizedEmail },
    });

    if (existingCustomer) {
      return existingCustomer;
    }

    const customer = customersRepository.create({
      firstName: createOrderDto.customer.firstName.trim(),
      lastName: createOrderDto.customer.lastName.trim(),
      email: normalizedEmail,
      phone: createOrderDto.customer.phone?.trim() || null,
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
