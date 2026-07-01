import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuCategory } from './entities/menu-category.entity';
import { Store } from '../stores/entities/store.entity';
import { MenuCategoriesController } from './menu-categories.controller';
import { MenuCategoriesService } from './menu-categories.service';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([MenuCategory, Store])],
  controllers: [MenuCategoriesController],
  providers: [MenuCategoriesService, RolesGuard],
  exports: [MenuCategoriesService],
})
export class MenuCategoriesModule {}
