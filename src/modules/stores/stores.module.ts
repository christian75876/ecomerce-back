import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Store } from './entities/store.entity';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { StoreSeederService } from './initializer/store.insert';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [TypeOrmModule.forFeature([Store]), CloudinaryModule],
  controllers: [StoresController],
  providers: [StoresService, StoreSeederService, RolesGuard],
  exports: [StoresService, StoreSeederService],
})
export class StoresModule {}
