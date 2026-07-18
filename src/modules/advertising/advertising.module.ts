import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdvertisingService } from './advertising.service';
import { AdvertisingController } from './advertising.controller';
import { StoreAdvertisement } from './entities/store-advertisement.entity';
import { Store } from '../stores/entities/store.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StoreAdvertisement, Store])],
  controllers: [AdvertisingController],
  providers: [AdvertisingService],
})
export class AdvertisingModule {}
