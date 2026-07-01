import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';

@Injectable()
export class UserService {
  constructor(
    // @InjectRepository(User) private userRepository
    @InjectRepository(Role) private roleRepository,
  ) {}

  async getRoleIds(): Promise<Role[]> {
    let roles = await this.roleRepository.find();
    if (roles.length == 0)
      throw new NotFoundException('No roles could be found');
    return roles.filter((item) => item.name !== 'admin'); // User cannot register as admin with a regular process
  }
}
