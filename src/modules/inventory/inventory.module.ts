import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { Product } from '../products/entities/product.entity';
import { InventoryBatch } from './entities/inventory-batch.entity';
import { InventoryBatchAllocation } from './entities/inventory-batch-allocation.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryMovement,
      Product,
      InventoryBatch,
      InventoryBatchAllocation,
      Supplier,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
