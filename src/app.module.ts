import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { AppInitializer } from './app.initializer';
import { RoleSeederService } from './modules/users/initializer/role.insert';
import { InsertUserService } from './modules/users/initializer/user.insert';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AuthModule,
  ],
  providers: [
    AppInitializer,
    RoleSeederService,
    InsertUserService,
  ],
})
export class AppModule {}
