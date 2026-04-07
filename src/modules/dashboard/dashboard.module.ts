import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/entities/product.entity';
import { Order } from '../orders/entities/order.entity';
import { Sale } from '../sales/entities/sale.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { InventoryBatch } from '../inventory/entities/inventory-batch.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Purchase } from '../purchases/entities/purchase.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CustomerLedgerEntry } from '../customers/entities/customer-ledger-entry.entity';
import { CashSession } from '../cash/entities/cash-session.entity';
import { CashMovement } from '../cash/entities/cash-movement.entity';
import { Store } from '../stores/entities/store.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Order,
      Sale,
      InventoryMovement,
      InventoryBatch,
      Purchase,
      Customer,
      CustomerLedgerEntry,
      CashSession,
      CashMovement,
      Store,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
