import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Store } from '../stores/entities/store.entity';
import { Product } from '../products/entities/product.entity';
import { OgPreviewController } from './og-preview.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Store, Product])],
  controllers: [OgPreviewController],
})
export class OgPreviewModule {}
