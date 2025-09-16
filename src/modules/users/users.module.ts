import { Module } from '@nestjs/common';
import { User } from './entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { RoleSeederService } from './initializer/role.insert';
import { InsertUserService } from './initializer/user.insert';
import { UserController } from './user.controller';
import { UserService } from './users.service';
import { FaceEnrollment } from '../face/entities/face-enrollments.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, FaceEnrollment])],
  providers: [RoleSeederService, InsertUserService, UserService],
  controllers: [UserController],
})
export class UserModule {}
