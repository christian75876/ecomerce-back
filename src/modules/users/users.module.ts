import { Module } from '@nestjs/common';
import { User } from './entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Store } from '../stores/entities/store.entity';
import { RoleSeederService } from './initializer/role.insert';
import { InsertUserService } from './initializer/user.insert';
import { UserController } from './user.controller';
import { AdminUsersController } from './admin-users.controller';
import { UserService } from './users.service';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Store])],
  providers: [RoleSeederService, InsertUserService, UserService, RolesGuard],
  controllers: [UserController, AdminUsersController],
})
export class UserModule {}
