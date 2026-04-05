import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InventoryMovement,
  InventoryMovementType,
} from './entities/inventory-movement.entity';
import { Product } from '../products/entities/product.entity';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryMovement)
    private readonly inventoryRepository: Repository<InventoryMovement>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async getInventorySummary() {
    const products = await this.productsRepository.find({
      order: { createdAt: 'DESC' },
    });

    const inventory = await Promise.all(
      products.map(async (product) => ({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        category: product.category?.name ?? null,
        isActive: product.isActive,
        stock: await this.getCurrentStock(product.id),
      })),
    );

    return inventory;
  }

  async getMovements(productId?: string) {
    return this.inventoryRepository.find({
      where: productId ? { productId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async registerMovement(createInventoryMovementDto: CreateInventoryMovementDto) {
    const product = await this.productsRepository.findOne({
      where: { id: createInventoryMovementDto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (
      ![
        InventoryMovementType.IN,
        InventoryMovementType.ADJUSTMENT,
      ].includes(createInventoryMovementDto.movementType)
    ) {
      throw new BadRequestException(
        'Only IN and ADJUSTMENT movements can be created manually',
      );
    }

    if (createInventoryMovementDto.quantity === 0) {
      throw new BadRequestException('Quantity cannot be zero');
    }

    const quantityDelta = this.resolveQuantityDelta(createInventoryMovementDto);
    const currentStock = await this.getCurrentStock(product.id);
    const nextStock = currentStock + quantityDelta;

    if (nextStock < 0) {
      throw new BadRequestException('The requested movement leaves stock below zero');
    }

    const movement = this.inventoryRepository.create({
      productId: product.id,
      movementType: createInventoryMovementDto.movementType,
      quantityDelta,
      note: createInventoryMovementDto.note?.trim() || null,
    });

    return this.inventoryRepository.save(movement);
  }

  async createSystemMovement(params: {
    productId: string;
    movementType: InventoryMovementType;
    quantityDelta: number;
    note?: string;
  }) {
    const currentStock = await this.getCurrentStock(params.productId);
    const nextStock = currentStock + params.quantityDelta;

    if (nextStock < 0) {
      throw new BadRequestException('Insufficient stock for inventory movement');
    }

    const movement = this.inventoryRepository.create({
      productId: params.productId,
      movementType: params.movementType,
      quantityDelta: params.quantityDelta,
      note: params.note?.trim() || null,
    });

    return this.inventoryRepository.save(movement);
  }

  async getCurrentStock(productId: string) {
    const result = await this.inventoryRepository
      .createQueryBuilder('movement')
      .select('COALESCE(SUM(movement.quantityDelta), 0)', 'stock')
      .where('movement.productId = :productId', { productId })
      .getRawOne<{ stock: string }>();

    return Number(result?.stock ?? 0);
  }

  private resolveQuantityDelta(
    createInventoryMovementDto: CreateInventoryMovementDto,
  ) {
    if (createInventoryMovementDto.movementType === InventoryMovementType.IN) {
      if (createInventoryMovementDto.quantity < 0) {
        throw new BadRequestException('IN movement requires a positive quantity');
      }

      return createInventoryMovementDto.quantity;
    }

    return createInventoryMovementDto.quantity;
  }
}
