import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('storeId') storeId?: string,
    @Query('active') active?: string,
  ) {
    return this.productsService.findAll({
      search,
      categoryId,
      storeId,
      active:
        typeof active === 'string'
          ? active.toLowerCase() === 'true'
          : undefined,
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

  @Get(':id/related')
  async findRelated(@Param('id') id: string) {
    return this.productsService.findRelated(id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateProductStatusDto: UpdateProductStatusDto,
  ) {
    return this.productsService.updateStatus(id, updateProductStatusDto);
  }
}
