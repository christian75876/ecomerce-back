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
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuthedRequest, AuthedUser } from 'src/common/types/authed-request';
import { isValidImageBuffer } from 'src/common/utils/validate-image-magic-bytes';
import { StoresService } from '../stores/stores.service';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { QueryProductOptionsDto } from './dto/query-product-options.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';

const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly storesService: StoresService,
  ) {}

  /** undefined = sin restricción (admin); array = solo esas tiendas (seller). */
  private async resolveAllowedStoreIds(user: AuthedUser): Promise<string[] | undefined> {
    if (user.role !== 'seller') {
      return undefined;
    }
    const stores = await this.storesService.findMine(user.userId);
    return stores.map((s) => s.id);
  }

  // Público y de solo lectura: cada visita a la tienda dispara varias llamadas
  // en simultáneo (catálogo, destacados, relacionados), así que el default
  // global de 100/min (pensado para endpoints de auth) se agotaba con tráfico
  // normal y hacía fallar el catálogo con "error de red" — lo que Google
  // interpretaba como Soft 404 al rastrear la home.
  @Get()
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async findAll(@Query() query: QueryProductsDto) {
    return this.productsService.findAll(query, undefined, true);
  }

  // Panel de gestión (seller/admin): a diferencia de GET /products (catálogo
  // público), esta SIEMPRE restringe a las tiendas del usuario autenticado,
  // sin depender de que el frontend se acuerde de mandar storeId.
  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async findMine(@Query() query: QueryProductsDto, @Req() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.productsService.findAll(query, allowedStoreIds);
  }

  @Get('favorites/me')
  @UseGuards(JwtAuthGuard)
  async getMyFavorites(@Req() req: AuthedRequest) {
    return this.productsService.getMyFavorites(req.user.userId);
  }

  @Get('favorites/me/ids')
  @UseGuards(JwtAuthGuard)
  async getMyFavoriteIds(@Req() req: AuthedRequest) {
    return this.productsService.getMyFavoriteProductIds(req.user.userId);
  }

  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  async favoriteProduct(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.productsService.favoriteProduct(id, req.user.userId);
  }

  @Delete(':id/favorite')
  @UseGuards(JwtAuthGuard)
  async unfavoriteProduct(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.productsService.unfavoriteProduct(id, req.user.userId);
  }

  @Get('featured/sections')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async getFeaturedSections() {
    return this.productsService.getFeaturedSections();
  }

  @Get('options')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async getOptions(@Query() query: QueryProductOptionsDto, @Req() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.productsService.getOptions(query, allowedStoreIds);
  }

  @Get(':id/related')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async findRelated(@Param('id') id: string) {
    return this.productsService.findRelated(id);
  }

  @Get(':id')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async create(@Body() createProductDto: CreateProductDto, @Req() req: AuthedRequest) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.productsService.create(createProductDto, allowedStoreIds);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Req() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.productsService.update(id, updateProductDto, req.user.userId, req.user.role, allowedStoreIds);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.productsService.remove(id, req.user.userId, req.user.role);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateProductStatusDto: UpdateProductStatusDto,
    @Req() req: AuthedRequest,
  ) {
    return this.productsService.updateStatus(id, updateProductStatusDto, req.user.userId, req.user.role);
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
    @Req() req: AuthedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    if (!isValidImageBuffer(file.buffer)) {
      throw new BadRequestException('El archivo no es una imagen JPEG, PNG o WebP válida');
    }
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.productsService.uploadImage(id, file, allowedStoreIds);
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
    @Req() req: AuthedRequest,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    if (!isValidImageBuffer(file.buffer)) {
      throw new BadRequestException('El archivo no es una imagen JPEG, PNG o WebP válida');
    }
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.productsService.addGalleryImage(id, file, allowedStoreIds);
  }

  @Patch(':id/gallery/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async reorderGallery(
    @Param('id') id: string,
    @Body() body: { imageIds: string[] },
    @Req() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.productsService.reorderGallery(id, body.imageIds, allowedStoreIds);
  }

  @Delete(':id/gallery/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async removeGalleryImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Req() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.productsService.removeGalleryImage(id, imageId, allowedStoreIds);
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
    @Req() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.productsService.addVideo(id, body.videoUrl, body.title, allowedStoreIds);
  }

  @Delete(':id/videos/:videoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async removeVideo(
    @Param('id') id: string,
    @Param('videoId') videoId: string,
    @Req() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.productsService.removeVideo(id, videoId, allowedStoreIds);
  }

  // ── Variants ───────────────────────────────────────────────────────────────

  @Get(':id/variants')
  async getVariants(@Param('id') id: string) {
    return this.productsService.getVariants(id);
  }

  @Post(':id/variants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async createVariant(
    @Param('id') id: string,
    @Body() dto: CreateProductVariantDto,
    @Req() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.productsService.createVariant(id, dto, allowedStoreIds);
  }

  @Patch(':id/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateProductVariantDto,
    @Req() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.productsService.updateVariant(id, variantId, dto, allowedStoreIds);
  }

  @Delete(':id/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async deleteVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Req() req: AuthedRequest,
  ) {
    const allowedStoreIds = await this.resolveAllowedStoreIds(req.user);
    return this.productsService.deleteVariant(id, variantId, allowedStoreIds);
  }
}
