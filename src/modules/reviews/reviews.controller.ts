import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('products/:productId/reviews')
  async getProductReviews(@Param('productId') productId: string) {
    return this.reviewsService.getProductReviews(productId);
  }

  @Post('products/:productId/reviews')
  @UseInterceptors(
    FilesInterceptor('images', 3, {
      storage: diskStorage({
        destination: './uploads/reviews',
        filename: (_req, file, callback) => {
          const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `${suffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, callback) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
          return callback(
            new BadRequestException('Invalid image format'),
            false,
          );
        }

        callback(null, true);
      },
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
    }),
  )
  async createReview(
    @Param('productId') productId: string,
    @Body() createReviewDto: CreateReviewDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.reviewsService.createReview(productId, createReviewDto, files);
  }
}
