import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { QueryProductOptionsDto } from './dto/query-product-options.dto';

const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('storeId') storeId?: string,
    @Query('active') active?: string,
    @Query('sortBy') sortBy?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
  ) {
    return this.productsService.findAll({
      search,
      categoryId,
      storeId,
      active: typeof active === 'string' ? active.toLowerCase() === 'true' : undefined,
      sortBy,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
    });
  }

  @Get('favorites/me')
  @UseGuards(JwtAuthGuard)
  async getMyFavorites(@Req() req: Request & { user: { userId: number } }) {
    return this.productsService.getMyFavorites(req.user.userId);
  }

  @Get('favorites/me/ids')
  @UseGuards(JwtAuthGuard)
  async getMyFavoriteIds(@Req() req: Request & { user: { userId: number } }) {
    return this.productsService.getMyFavoriteProductIds(req.user.userId);
  }

  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  async favoriteProduct(
    @Param('id') id: string,
    @Req() req: Request & { user: { userId: number } },
  ) {
    return this.productsService.favoriteProduct(id, req.user.userId);
  }

  @Delete(':id/favorite')
  @UseGuards(JwtAuthGuard)
  async unfavoriteProduct(
    @Param('id') id: string,
    @Req() req: Request & { user: { userId: number } },
  ) {
    return this.productsService.unfavoriteProduct(id, req.user.userId);
  }

  @Get('featured/sections')
  async getFeaturedSections() {
    return this.productsService.getFeaturedSections();
  }

  @Get('options')
  @UseGuards(JwtAuthGuard)
  async getOptions(@Query() query: QueryProductOptionsDto) {
    return this.productsService.getOptions(query);
  }

  @Get(':id/related')
  async findRelated(@Param('id') id: string) {
    return this.productsService.findRelated(id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateProductStatusDto: UpdateProductStatusDto,
  ) {
    return this.productsService.updateStatus(id, updateProductStatusDto);
  }

  @Post(':id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      fileFilter: (_req, file, callback) => {
        if (!allowedImageMimeTypes.has(file.mimetype)) {
          return callback(new BadRequestException('Formato de imagen no válido. Use JPEG, PNG o WebP'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    return this.productsService.uploadImage(id, file);
  }

  @Get(':id/gallery')
  async getGallery(@Param('id') id: string) {
    return this.productsService.getGallery(id);
  }

  @Post(':id/gallery')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      fileFilter: (_req, file, callback) => {
        if (!allowedImageMimeTypes.has(file.mimetype)) {
          return callback(new BadRequestException('Formato no válido. Use JPEG, PNG o WebP'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async addGalleryImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    return this.productsService.addGalleryImage(id, file);
  }

  @Patch(':id/gallery/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async reorderGallery(
    @Param('id') id: string,
    @Body() body: { imageIds: string[] },
  ) {
    return this.productsService.reorderGallery(id, body.imageIds);
  }

  @Delete(':id/gallery/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async removeGalleryImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.productsService.removeGalleryImage(id, imageId);
  }

  @Get(':id/videos')
  async getVideos(@Param('id') id: string) {
    return this.productsService.getVideos(id);
  }

  @Post(':id/videos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async addVideo(
    @Param('id') id: string,
    @Body() body: { videoUrl: string; title?: string },
  ) {
    return this.productsService.addVideo(id, body.videoUrl, body.title);
  }

  @Delete(':id/videos/:videoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async removeVideo(
    @Param('id') id: string,
    @Param('videoId') videoId: string,
  ) {
    return this.productsService.removeVideo(id, videoId);
  }
}
