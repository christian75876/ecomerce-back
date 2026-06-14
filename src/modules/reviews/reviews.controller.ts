import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
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

  @Get('products/:productId/reviews/me')
  @UseGuards(JwtAuthGuard)
  async getMyReviewEligibility(
    @Param('productId') productId: string,
    @Req() req: Request & { user: { userId: number } },
  ) {
    return this.reviewsService.getReviewEligibility(productId, req.user.userId);
  }

  @Post('products/:productId/reviews')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('images', 3, {
      storage: memoryStorage(),
      fileFilter: (_req, file, callback) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
          return callback(new BadRequestException('Invalid image format'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async createReview(
    @Param('productId') productId: string,
    @Body() createReviewDto: CreateReviewDto,
    @Req() req: Request & { user: { userId: number } },
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.reviewsService.createOrUpdateReview(
      productId,
      req.user.userId,
      createReviewDto,
      files,
    );
  }
}
