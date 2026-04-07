import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Review } from './entities/review.entity';
import { ReviewImage } from './entities/review-image.entity';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
    @InjectRepository(ReviewImage)
    private readonly reviewImagesRepository: Repository<ReviewImage>,
  ) {}

  async getProductReviews(productId: string) {
    await this.ensureProductExists(productId);

    const reviews = await this.reviewsRepository.find({
      where: {
        productId,
        isVisible: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    const averageRating =
      reviews.length > 0
        ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length
        : 0;

    return {
      reviews,
      summary: {
        totalReviews: reviews.length,
        averageRating: Number(averageRating.toFixed(1)),
      },
    };
  }

  async getReviewEligibility(productId: string, userId: number) {
    await this.ensureProductExists(productId);

    const customer = await this.customersRepository.findOne({
      where: { userId },
    });

    if (!customer) {
      return {
        canReview: false,
        hasPurchased: false,
        review: null,
      };
    }

    const review = await this.reviewsRepository.findOne({
      where: {
        customerId: customer.id,
        productId,
      },
    });

    const validOrder = await this.findValidOrderForReview(customer.id, productId);

    return {
      canReview: Boolean(validOrder),
      hasPurchased: Boolean(validOrder),
      review,
    };
  }

  async createOrUpdateReview(
    productId: string,
    userId: number,
    createReviewDto: CreateReviewDto,
    files: Express.Multer.File[] = [],
  ) {
    await this.ensureProductExists(productId);

    const customer = await this.customersRepository.findOne({
      where: { userId },
    });

    if (!customer) {
      throw new NotFoundException('Customer profile not found for this user');
    }

    const existingReview = await this.reviewsRepository.findOne({
      where: {
        customerId: customer.id,
        productId,
      },
    });

    const validOrder = await this.findValidOrderForReview(customer.id, productId);

    if (!validOrder) {
      throw new BadRequestException(
        'Customer must have a valid purchase of this product before reviewing',
      );
    }

    if (files.length > 3) {
      throw new BadRequestException('A review supports up to 3 images');
    }

    const review = existingReview
      ? Object.assign(existingReview, {
          orderId: validOrder.id,
          rating: createReviewDto.rating,
          comment: createReviewDto.comment.trim(),
          isVisible: true,
        })
      : this.reviewsRepository.create({
          customerId: customer.id,
          productId,
          orderId: validOrder.id,
          rating: createReviewDto.rating,
          comment: createReviewDto.comment.trim(),
          isVisible: true,
        });

    const savedReview = await this.reviewsRepository.save(review);

    if (files.length > 0) {
      await this.reviewImagesRepository.delete({ reviewId: savedReview.id });

      const images = files.map((file) =>
        this.reviewImagesRepository.create({
          reviewId: savedReview.id,
          url: `/uploads/reviews/${file.filename}`,
        }),
      );
      await this.reviewImagesRepository.save(images);
    }

    return this.reviewsRepository.findOne({
      where: { id: savedReview.id },
    });
  }

  private async ensureProductExists(productId: string) {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  private async findValidOrderForReview(customerId: string, productId: string) {
    const orders = await this.ordersRepository.find({
      where: {
        customerId,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return orders.find(
      (order) =>
        order.status !== OrderStatus.CANCELLED &&
        order.items.some((item) => item.productId === productId),
    );
  }
}
