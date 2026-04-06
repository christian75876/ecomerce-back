import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryMovementType } from '../inventory/entities/inventory-movement.entity';
import { Sale, SalePaymentMethod } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { Customer } from '../customers/entities/customer.entity';
import { CustomersService } from '../customers/customers.service';
import { CashService } from '../cash/cash.service';
import { AuditService } from '../audit/audit.service';

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

  async findAll() {
    return this.salesRepository.find({
      order: { createdAt: 'DESC' },
    });
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
      const customer =
        createSaleDto.customerId
          ? await customersRepository.findOne({
              where: { id: createSaleDto.customerId },
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
      });
      const savedSale = await manager.save(sale);

      for (const item of items) {
        const saleItem = manager.create(SaleItem, {
          saleId: savedSale.id,
          ...item,
        });
        await manager.save(saleItem);
        await this.inventoryService.createSystemMovement({
          productId: item.productId,
          movementType: InventoryMovementType.SALE,
          quantityDelta: -item.quantity,
          note: `POS sale ${savedSale.id}`,
          manager,
        });
      }

      if (paymentMethod === SalePaymentMethod.CREDIT && customer) {
        await this.customersService.registerCreditSale(customer.id, total, savedSale.id);
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

      return this.findOne(savedSale.id);
    });
  }
}
