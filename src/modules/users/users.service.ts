import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { Store } from '../stores/entities/store.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    @InjectRepository(Store) private readonly storeRepository: Repository<Store>,
  ) {}

  async getRoleIds(): Promise<Role[]> {
    let roles = await this.roleRepository.find();
    if (roles.length == 0)
      throw new NotFoundException('No roles could be found');
    return roles.filter((item) => item.name !== 'admin'); // User cannot register as admin with a regular process
  }

  private toAdminView(user: User) {
    return {
      id: user.id,
      email: user.email,
      role: user.role?.name ?? null,
      roleId: user.role_id,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };
  }

  async findAllRolesAdmin(): Promise<Role[]> {
    return this.roleRepository.find();
  }

  async findAllAdmin(page = 1, limit = 20) {
    const [users, totalItems] = await this.userRepository.findAndCount({
      relations: { role: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: users.map((u) => this.toAdminView(u)),
      pagination: {
        totalItems,
        itemCount: users.length,
        itemsPerPage: limit,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
      },
    };
  }

  async create(dto: CreateUserDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.userRepository.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      throw new BadRequestException('El correo ya está registrado.');
    }

    const role = await this.roleRepository.findOne({ where: { id: dto.roleId } });
    if (!role) {
      throw new NotFoundException('Rol no encontrado.');
    }

    const hashedPass = await bcrypt.hash(dto.password, bcrypt.genSaltSync(10));
    const user = this.userRepository.create({
      role_id: role.id,
      email: normalizedEmail,
      password: hashedPass,
      isEmailVerified: true,
    });
    await this.userRepository.save(user);

    return this.toAdminView({ ...user, role });
  }

  async update(id: number, dto: UpdateUserDto, requestingUserId: number) {
    const user = await this.userRepository.findOne({ where: { id }, relations: { role: true } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (dto.roleId) {
      const role = await this.roleRepository.findOne({ where: { id: dto.roleId } });
      if (!role) {
        throw new NotFoundException('Rol no encontrado.');
      }
      if (id === requestingUserId && user.role?.name === 'admin' && role.name !== 'admin') {
        throw new BadRequestException('No puedes quitarte tu propio rol de administrador.');
      }
      user.role_id = role.id;
    }

    if (typeof dto.isEmailVerified === 'boolean') {
      user.isEmailVerified = dto.isEmailVerified;
    }

    await this.userRepository.save(user);

    const updated = await this.userRepository.findOne({ where: { id }, relations: { role: true } });
    return this.toAdminView(updated!);
  }

  async remove(id: number, requestingUserId: number): Promise<{ message: string }> {
    if (id === requestingUserId) {
      throw new BadRequestException('No puedes eliminar tu propio usuario.');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const storeCount = await this.storeRepository.count({ where: { userId: id } });
    if (storeCount > 0) {
      throw new BadRequestException(
        'Este usuario tiene tiendas asociadas y no se puede eliminar — reasigna o elimina sus tiendas primero.',
      );
    }

    const [{ count }] = await this.userRepository.manager.query(
      `SELECT COUNT(*)::int AS count
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE c.user_id = $1`,
      [id],
    );
    if (Number(count) > 0) {
      throw new BadRequestException(
        'Este usuario tiene pedidos asociados y no se puede eliminar.',
      );
    }

    await this.userRepository.remove(user);
    return { message: 'Usuario eliminado correctamente' };
  }
}
