import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Store } from '../stores/entities/store.entity';
import { Product } from '../products/entities/product.entity';
import { SitemapController } from './sitemap.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Store, Product])],
  controllers: [SitemapController],
})
export class SitemapModule {}
