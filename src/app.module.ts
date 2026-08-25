import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
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
import { StoresModule } from './modules/stores/stores.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { CashModule } from './modules/cash/cash.module';
import { AuditModule } from './modules/audit/audit.module';
import { EmailModule } from './modules/email/email.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MenuCategoriesModule } from './modules/menu-categories/menu-categories.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { AppConfigModule } from './modules/app-config/app-config.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { AdvertisingModule } from './modules/advertising/advertising.module';
import { PushModule } from './modules/push/push.module';
import { SitemapModule } from './modules/sitemap/sitemap.module';
import { OgPreviewModule } from './modules/og-preview/og-preview.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    EmailModule,
    AuthModule,
    InvitationsModule,
    CategoriesModule,
    ProductsModule,
    InventoryModule,
    CustomersModule,
    SalesModule,
    OrdersModule,
    ReviewsModule,
    DashboardModule,
    StoresModule,
    SuppliersModule,
    PurchasesModule,
    CashModule,
    AuditModule,
    NotificationsModule,
    MenuCategoriesModule,
    CouponsModule,
    AppConfigModule,
    SubscriptionsModule,
    AdvertisingModule,
    PushModule,
    SitemapModule,
    OgPreviewModule,
  ],
  controllers: [AppController],
  providers: [
    AppInitializer,
    RoleSeederService,
    InsertUserService,
    // Global rate limit (100 req/min/IP by default) — previously ThrottlerGuard
    // was only wired manually onto 6 auth endpoints, leaving the rest of the
    // API (products, orders, register, refresh, etc.) with no rate limiting.
    // Per-route @Throttle(...) overrides still apply on top of this default.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
