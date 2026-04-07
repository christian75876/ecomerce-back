import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductFavorite } from './entities/product-favorite.entity';
import { Category } from '../categories/entities/category.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Store } from '../stores/entities/store.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Customer } from '../customers/entities/customer.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductFavorite,
      Category,
      Store,
      Supplier,
      Customer,
      SaleItem,
    ]),
    InventoryModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
