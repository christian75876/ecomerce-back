import {
  BadRequestException,
  Body,
  Controller,
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
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { UpdateStoreNotificationsDto } from './dto/update-store-notifications.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  async findAll(@Query('active') active?: string) {
    return this.storesService.findAll(
      typeof active === 'string' ? active.toLowerCase() === 'true' : undefined,
    );
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async findMine(@Req() req: any) {
    return this.storesService.findMine(req.user.userId as number);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.storesService.findOneBySlug(slug, true);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() payload: CreateStoreDto) {
    return this.storesService.create(payload);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() payload: UpdateStoreDto) {
    return this.storesService.update(id, payload);
  }

  @Patch(':id/notifications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'seller')
  async updateNotifications(
    @Param('id') id: string,
    @Body() payload: UpdateStoreNotificationsDto,
    @Req() req: any,
  ) {
    const isAdmin = req.user.role === 'admin';
    return this.storesService.updateNotifications(id, payload, req.user.userId as number, isAdmin);
  }

  @Post(':id/logo')
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
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    const isAdmin = req.user.role === 'admin';
    return this.storesService.uploadLogo(id, file, req.user.userId as number, isAdmin);
  }

  @Post(':id/banner')
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
  async uploadBanner(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    const isAdmin = req.user.role === 'admin';
    return this.storesService.uploadBanner(id, file, req.user.userId as number, isAdmin);
  }
}
