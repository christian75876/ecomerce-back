import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { Product } from '../products/entities/product.entity';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { Customer } from '../customers/entities/customer.entity';
import { CustomersModule } from '../customers/customers.module';
import { CashModule } from '../cash/cash.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Sale, SaleItem, Customer]),
    InventoryModule,
    CustomersModule,
    CashModule,
    AuditModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
