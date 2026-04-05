import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryMovementType } from '../inventory/entities/inventory-movement.entity';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CustomersService } from '../customers/customers.service';

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
    private readonly customersService: CustomersService,
  ) {}

  async findAll() {
    return this.ordersRepository.find({
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

  async create(createOrderDto: CreateOrderDto) {
    const customer = await this.resolveCustomer(createOrderDto);

    return this.dataSource.transaction(async (manager) => {
      const items = [];
      let total = 0;

      for (const item of createOrderDto.items) {
        const product = await this.productsRepository.findOne({
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
        await this.inventoryService.createSystemMovement({
          productId: item.productId,
          movementType: InventoryMovementType.ORDER,
          quantityDelta: -item.quantity,
          note: `Order ${savedOrder.id}`,
        });
      }

      return this.findOne(savedOrder.id);
    });
  }

  private async resolveCustomer(createOrderDto: CreateOrderDto) {
    if (createOrderDto.customerId) {
      const customer = await this.customersRepository.findOne({
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

    const existingCustomer = await this.customersService.findByEmail(
      createOrderDto.customer.email,
    );

    if (existingCustomer) {
      return existingCustomer;
    }

    return this.customersService.create(createOrderDto.customer);
  }

  async updateStatus(id: string, updateOrderStatusDto: UpdateOrderStatusDto) {
    const order = await this.findOne(id);
    this.validateTransition(order.status, updateOrderStatusDto.status);

    if (
      updateOrderStatusDto.status === OrderStatus.CANCELLED &&
      order.status !== OrderStatus.CANCELLED
    ) {
      for (const item of order.items) {
        await this.inventoryService.createSystemMovement({
          productId: item.productId,
          movementType: InventoryMovementType.ORDER_CANCEL,
          quantityDelta: item.quantity,
          note: `Order cancellation ${order.id}`,
        });
      }
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
