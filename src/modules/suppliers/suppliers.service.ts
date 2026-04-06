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

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
  ) {}

  async findAll(search?: string) {
    if (!search?.trim()) {
      return this.suppliersRepository.find({ order: { createdAt: 'DESC' } });
    }

    return this.suppliersRepository.find({
      where: [{ name: ILike(`%${search}%`) }, { email: ILike(`%${search}%`) }],
      order: { createdAt: 'DESC' },
    });
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
      where: { name: payload.name.trim() },
    });

    if (existing) {
      throw new ConflictException('Supplier name is already in use');
    }

    const supplier = this.suppliersRepository.create({
      name: payload.name.trim(),
      document: payload.document?.trim() || null,
      phone: payload.phone?.trim() || null,
      email: payload.email?.trim().toLowerCase() || null,
      address: payload.address?.trim() || null,
      notes: payload.notes?.trim() || null,
      isActive: true,
    });

    return this.suppliersRepository.save(supplier);
  }

  async update(id: string, payload: UpdateSupplierDto) {
    const supplier = await this.findOne(id);

    if (payload.name && payload.name.trim() !== supplier.name) {
      const existing = await this.suppliersRepository.findOne({
        where: { name: payload.name.trim() },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Supplier name is already in use');
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
