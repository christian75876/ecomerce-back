import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/entities/product.entity';
import { MerchantFeedController } from './merchant-feed.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [MerchantFeedController],
})
export class MerchantFeedModule {}
