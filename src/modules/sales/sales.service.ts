import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryMovementType } from '../inventory/entities/inventory-movement.entity';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItemsRepository: Repository<SaleItem>,
    private readonly inventoryService: InventoryService,
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
      const items = [];
      let total = 0;

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

      const sale = manager.create(Sale, { total });
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

      return this.findOne(savedSale.id);
    });
  }
}
