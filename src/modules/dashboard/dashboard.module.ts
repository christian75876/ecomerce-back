import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/entities/product.entity';
import { Order } from '../orders/entities/order.entity';
import { Sale } from '../sales/entities/sale.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Order, Sale, InventoryMovement]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
