import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Order, OrderStatus, PaymentStatus } from '../orders/entities/order.entity';
import { Store } from '../stores/entities/store.entity';
import { Review } from './entities/review.entity';
import { ReviewImage } from './entities/review-image.entity';
import { StoreReview } from './entities/store-review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateStoreReviewDto } from './dto/create-store-review.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
    @InjectRepository(ReviewImage)
    private readonly reviewImagesRepository: Repository<ReviewImage>,
    @InjectRepository(StoreReview)
    private readonly storeReviewsRepository: Repository<StoreReview>,
    private readonly cloudinaryService: CloudinaryService,
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
          comment: createReviewDto.comment?.trim() || null,
          isVisible: true,
        })
      : this.reviewsRepository.create({
          customerId: customer.id,
          productId,
          orderId: validOrder.id,
          rating: createReviewDto.rating,
          comment: createReviewDto.comment?.trim() || null,
          isVisible: true,
        });

    const savedReview = await this.reviewsRepository.save(review);

    if (files.length > 0) {
      await this.reviewImagesRepository.delete({ reviewId: savedReview.id });

      const urls = await Promise.all(
        files.map((file) => this.cloudinaryService.uploadImage(file.buffer, 'reviews')),
      );
      const images = urls.map((url) =>
        this.reviewImagesRepository.create({ reviewId: savedReview.id, url }),
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
      relations: { items: true },
      order: {
        createdAt: 'DESC',
      },
    });

    return orders.find(
      (order) =>
        order.status !== OrderStatus.CANCELLED &&
        order.paymentStatus === PaymentStatus.CONFIRMED &&
        order.items.some((item) => item.productId === productId),
    );
  }

  // ── Store reviews ────────────────────────────────────────────────────────────
  // Rates the seller/service experience (was the delivery good, did it arrive,
  // etc.) rather than any one product — so eligibility requires the order to
  // have actually been DELIVERED, not just placed (see product reviews above,
  // which only require a non-cancelled purchase).

  async getStoreReviews(storeId: string) {
    await this.ensureStoreExists(storeId);

    const reviews = await this.storeReviewsRepository.find({
      where: { storeId, isVisible: true },
      order: { createdAt: 'DESC' },
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

  async getStoreReviewEligibility(storeId: string, userId: number) {
    await this.ensureStoreExists(storeId);

    const customer = await this.customersRepository.findOne({ where: { userId } });
    if (!customer) {
      return { canReview: false, hasDelivered: false, review: null };
    }

    const review = await this.storeReviewsRepository.findOne({
      where: { customerId: customer.id, storeId },
    });

    const validOrder = await this.findValidOrderForStoreReview(customer.id, storeId);

    return {
      canReview: Boolean(validOrder),
      hasDelivered: Boolean(validOrder),
      review,
    };
  }

  async createOrUpdateStoreReview(
    storeId: string,
    userId: number,
    dto: CreateStoreReviewDto,
  ) {
    await this.ensureStoreExists(storeId);

    const customer = await this.customersRepository.findOne({ where: { userId } });
    if (!customer) {
      throw new NotFoundException('Customer profile not found for this user');
    }

    const validOrder = await this.findValidOrderForStoreReview(customer.id, storeId);
    if (!validOrder) {
      throw new BadRequestException(
        'Customer must have a delivered order from this store before reviewing it',
      );
    }

    const existingReview = await this.storeReviewsRepository.findOne({
      where: { customerId: customer.id, storeId },
    });

    const review = existingReview
      ? Object.assign(existingReview, {
          orderId: validOrder.id,
          rating: dto.rating,
          comment: dto.comment?.trim() || null,
          isVisible: true,
        })
      : this.storeReviewsRepository.create({
          customerId: customer.id,
          storeId,
          orderId: validOrder.id,
          rating: dto.rating,
          comment: dto.comment?.trim() || null,
          isVisible: true,
        });

    const saved = await this.storeReviewsRepository.save(review);
    return this.storeReviewsRepository.findOne({ where: { id: saved.id } });
  }

  private async ensureStoreExists(storeId: string) {
    const store = await this.storesRepository.findOne({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
  }

  private async findValidOrderForStoreReview(customerId: string, storeId: string) {
    const orders = await this.ordersRepository.find({
      where: { customerId },
      relations: { items: { product: true } },
      order: { createdAt: 'DESC' },
    });

    return orders.find(
      (order) =>
        order.status === OrderStatus.DELIVERED &&
        order.items.some((item) => item.product?.storeId === storeId),
    );
  }
}
