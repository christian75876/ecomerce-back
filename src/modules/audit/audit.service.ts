import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { QueryAuditDto } from './dto/query-audit.dto';
import { PaginatedResultDto } from '../../common/dtos/paginated-result.dto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async log(params: {
    userId?: number | null;
    action: string;
    entity: string;
    referenceId?: string | null;
    detail?: string | null;
  }) {
    const record = this.auditRepository.create({
      userId: params.userId ?? null,
      action: params.action,
      entity: params.entity,
      referenceId: params.referenceId ?? null,
      detail: params.detail ?? null,
    });

    return this.auditRepository.save(record);
  }

  async findAll(query: QueryAuditDto): Promise<PaginatedResultDto<AuditLog>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.auditRepository.createQueryBuilder('audit');

    if (query.action) {
      qb.andWhere('audit.action = :action', { action: query.action });
    }
    if (query.entity) {
      qb.andWhere('audit.entity = :entity', { entity: query.entity });
    }
    if (query.userId) {
      qb.andWhere('audit.userId = :userId', { userId: Number(query.userId) });
    }

    const [items, totalItems] = await qb
      .orderBy('audit.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return {
      items,
      pagination: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    };
  }
}
