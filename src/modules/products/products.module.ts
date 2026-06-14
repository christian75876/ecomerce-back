import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductFavorite } from './entities/product-favorite.entity';
import { ProductVideo } from './entities/product-video.entity';
import { ProductImage } from './entities/product-image.entity';
import { Category } from '../categories/entities/category.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Store } from '../stores/entities/store.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Customer } from '../customers/entities/customer.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { MenuCategory } from '../menu-categories/entities/menu-category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductFavorite,
      ProductVideo,
      ProductImage,
      Category,
      Store,
      Supplier,
      Customer,
      SaleItem,
      MenuCategory,
    ]),
    InventoryModule,
    CloudinaryModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, RolesGuard],
  exports: [ProductsService],
})
export class ProductsModule {}
