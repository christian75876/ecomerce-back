import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserService } from './users.service';
import { Role } from './entities/role.entity';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  // Solo admin: la lista de roles (incluidos sus UUID) no debe ser enumerable
  // anónimamente, ya que el registro público nunca debe decidir su propio rol.
  @Get('roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getRoles(): Promise<Role[]> {
    return this.userService.getRoleIds();
  }
}
