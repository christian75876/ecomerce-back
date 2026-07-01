import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from './entities/app-config.entity';
import { UpdateAppConfigDto } from './dto/update-app-config.dto';

const CONFIG_ID = 1;

@Injectable()
export class AppConfigService {
  constructor(
    @InjectRepository(AppConfig)
    private readonly repo: Repository<AppConfig>,
  ) {}

  async getConfig(): Promise<AppConfig> {
    let config = await this.repo.findOne({ where: { id: CONFIG_ID } });
    if (!config) {
      config = this.repo.create({ id: CONFIG_ID, isAccessBlocked: false, blockedMessage: null });
      await this.repo.save(config);
    }
    return config;
  }

  async updateConfig(dto: UpdateAppConfigDto): Promise<AppConfig> {
    let config = await this.repo.findOne({ where: { id: CONFIG_ID } });
    if (!config) {
      config = this.repo.create({ id: CONFIG_ID, isAccessBlocked: false, blockedMessage: null });
    }
    if (typeof dto.isAccessBlocked === 'boolean') config.isAccessBlocked = dto.isAccessBlocked;
    if (dto.blockedMessage !== undefined) config.blockedMessage = dto.blockedMessage?.trim() || null;
    return this.repo.save(config);
  }
}
