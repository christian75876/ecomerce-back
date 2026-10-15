import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';

// Admin-only: el log de auditoría cruza TODAS las tiendas (incluye montos
// de ventas de cualquiera vía referenceId → sale), y la UI que lo consume
// ya es solo de admin — 'seller' no debía estar en esta lista.
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(@Query() query: QueryAuditDto) {
    return this.auditService.findAll(query);
  }
}
