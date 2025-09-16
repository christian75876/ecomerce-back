import { Injectable, OnModuleInit } from '@nestjs/common';
import { RoleSeederService } from './modules/users/initializer/role.insert';
import { InsertUserService } from './modules/users/initializer/user.insert';

@Injectable()
export class AppInitializer implements OnModuleInit {
  constructor(
    private readonly roleService: RoleSeederService,
    private readonly userService: InsertUserService,
  ) {}

  async onModuleInit() {
    await this.roleService.insertRoles();
    await this.userService.insertAdminUser();
  }
}
