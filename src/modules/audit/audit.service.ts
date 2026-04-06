import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { QueryAuditDto } from './dto/query-audit.dto';

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

  async findAll(query: QueryAuditDto) {
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

    return qb.orderBy('audit.createdAt', 'DESC').getMany();
  }
}
