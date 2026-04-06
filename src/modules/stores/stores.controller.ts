import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  async findAll(@Query('active') active?: string) {
    return this.storesService.findAll(
      typeof active === 'string' ? active.toLowerCase() === 'true' : undefined,
    );
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.storesService.findOneBySlug(slug, true);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() payload: CreateStoreDto) {
    return this.storesService.create(payload);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() payload: UpdateStoreDto) {
    return this.storesService.update(id, payload);
  }
}
