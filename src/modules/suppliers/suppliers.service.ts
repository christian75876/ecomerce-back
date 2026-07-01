import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { QuerySupplierOptionsDto } from './dto/query-supplier-options.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
  ) {}

  async findAll(search?: string, allowedStoreIds?: string[], page = 1, limit = 15) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const builder = this.suppliersRepository
      .createQueryBuilder('supplier')
      .orderBy('supplier.createdAt', 'DESC')
      .take(take)
      .skip(skip);

    if (allowedStoreIds?.length) {
      builder.where('supplier.storeId IN (:...storeIds)', { storeIds: allowedStoreIds });
    }

    if (search?.trim()) {
      const like = `%${search.trim()}%`;
      const method = allowedStoreIds?.length ? 'andWhere' : 'where';
      builder[method](
        '(supplier.name ILIKE :like OR supplier.email ILIKE :like OR supplier.document ILIKE :like OR supplier.phone ILIKE :like)',
        { like },
      );
    }

    const [items, total] = await builder.getManyAndCount();
    return { items, total, page: Math.max(page, 1), limit: take, totalPages: Math.ceil(total / take) || 1 };
  }

  async getOptions(query: QuerySupplierOptionsDto, allowedStoreIds?: string[]) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.suppliersRepository
      .createQueryBuilder('supplier')
      .where('supplier.isActive = :isActive', { isActive: true })
      .orderBy('supplier.name', 'ASC');

    if (allowedStoreIds?.length) {
      builder.andWhere('supplier.storeId IN (:...storeIds)', { storeIds: allowedStoreIds });
    }

    if (query.search?.trim()) {
      builder.andWhere(
        '(supplier.name ILIKE :search OR supplier.email ILIKE :search OR supplier.document ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }

    const [suppliers, totalItems] = await builder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: suppliers.map((supplier) => ({
        id: supplier.id,
        label: supplier.name,
        secondary: supplier.document ?? null,
        helper: supplier.email ?? supplier.phone ?? 'Sin contacto',
      })),
      pagination: {
        totalItems,
        itemCount: suppliers.length,
        itemsPerPage: limit,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
      },
    };
  }

  async findOne(id: string) {
    const supplier = await this.suppliersRepository.findOne({ where: { id } });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async create(payload: CreateSupplierDto) {
    const existing = await this.suppliersRepository.findOne({
      where: { name: payload.name.trim(), storeId: payload.storeId ?? null },
    });

    if (existing) {
      throw new ConflictException('Supplier name is already in use for this store');
    }

    const supplier = this.suppliersRepository.create({
      name: payload.name.trim(),
      document: payload.document?.trim() || null,
      phone: payload.phone?.trim() || null,
      email: payload.email?.trim().toLowerCase() || null,
      address: payload.address?.trim() || null,
      notes: payload.notes?.trim() || null,
      isActive: true,
      storeId: payload.storeId ?? null,
    });

    return this.suppliersRepository.save(supplier);
  }

  async update(id: string, payload: UpdateSupplierDto) {
    const supplier = await this.findOne(id);

    if (payload.name && payload.name.trim() !== supplier.name) {
      const existing = await this.suppliersRepository.findOne({
        where: { name: payload.name.trim(), storeId: supplier.storeId },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Supplier name is already in use for this store');
      }
    }

    Object.assign(supplier, {
      name: payload.name?.trim() ?? supplier.name,
      document:
        typeof payload.document === 'string'
          ? payload.document.trim() || null
          : supplier.document,
      phone:
        typeof payload.phone === 'string'
          ? payload.phone.trim() || null
          : supplier.phone,
      email:
        typeof payload.email === 'string'
          ? payload.email.trim().toLowerCase() || null
          : supplier.email,
      address:
        typeof payload.address === 'string'
          ? payload.address.trim() || null
          : supplier.address,
      notes:
        typeof payload.notes === 'string'
          ? payload.notes.trim() || null
          : supplier.notes,
      isActive:
        typeof payload.isActive === 'boolean'
          ? payload.isActive
          : supplier.isActive,
    });

    return this.suppliersRepository.save(supplier);
  }
}
