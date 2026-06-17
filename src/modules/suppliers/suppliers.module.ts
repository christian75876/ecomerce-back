import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [TypeOrmModule.forFeature([Supplier]), StoresModule],
  controllers: [SuppliersController],
  providers: [SuppliersService, RolesGuard],
  exports: [SuppliersService],
})
export class SuppliersModule {}
