import { Injectable, OnModuleInit } from '@nestjs/common';
import { RoleSeederService } from './modules/users/initializer/role.insert';
import { InsertUserService } from './modules/users/initializer/user.insert';
import { StoreSeederService } from './modules/stores/initializer/store.insert';

@Injectable()
export class AppInitializer implements OnModuleInit {
  constructor(
    private readonly roleService: RoleSeederService,
    private readonly userService: InsertUserService,
    private readonly storeSeederService: StoreSeederService,
  ) {}

  async onModuleInit() {
    await this.roleService.insertRoles();
    await this.userService.insertAdminUser();
    await this.storeSeederService.ensureDefaultStore();
  }
}
