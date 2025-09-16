import { Controller, Get } from '@nestjs/common';
import { UserService } from './users.service';
import { Role } from './entities/role.entity';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('roles')
  async getRoles(): Promise<Role[]> {
    return this.userService.getRoleIds();
  }
}
