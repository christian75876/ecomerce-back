import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { AppInitializer } from './app.initializer';
import { RoleSeederService } from './modules/users/initializer/role.insert';
import { InsertUserService } from './modules/users/initializer/user.insert';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SalesModule } from './modules/sales/sales.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    InventoryModule,
    CustomersModule,
    SalesModule,
    OrdersModule,
    ReviewsModule,
    DashboardModule,
  ],
  providers: [
    AppInitializer,
    RoleSeederService,
    InsertUserService,
  ],
})
export class AppModule {}
