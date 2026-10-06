import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coupon } from './entities/coupon.entity';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [TypeOrmModule.forFeature([Coupon]), StoresModule],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
