import { InjectRepository } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import {
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
// import { User } from './entities/user.entity';

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
