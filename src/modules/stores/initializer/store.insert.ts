import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '../entities/store.entity';

@Injectable()
export class StoreSeederService {
  constructor(
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
  ) {}

  async ensureDefaultStore() {
    const existing = await this.storesRepository.findOne({
      where: { slug: 'hot-default' },
    });

    if (existing) {
      return;
    }

    const store = this.storesRepository.create({
      name: 'Hot Default',
      slug: 'hot-default',
      description: 'Tienda base para la operación inicial de la plataforma.',
      isActive: true,
    });

    await this.storesRepository.save(store);
  }
}
