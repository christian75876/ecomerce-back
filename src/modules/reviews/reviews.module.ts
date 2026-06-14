import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/entities/product.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Order } from '../orders/entities/order.entity';
import { Review } from './entities/review.entity';
import { ReviewImage } from './entities/review-image.entity';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Customer, Order, Review, ReviewImage]),
    CloudinaryModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
