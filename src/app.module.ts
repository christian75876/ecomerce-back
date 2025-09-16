import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './modules/database/database.module';
import { JwtStrategy } from './modules/auth/strategies/jwt.strategy';
import { AuthModule } from './modules/auth/auth.module';
import { AppInitializer } from './app.initializer';
import { RoleSeederService } from './modules/users/initializer/role.insert';
import { InsertUserService } from './modules/users/initializer/user.insert';
import { FaceModule } from './modules/face/face.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AuthModule,
    FaceModule,
  ],
  providers: [
    JwtStrategy,
    AppInitializer,
    RoleSeederService,
    InsertUserService,
  ],
})
export class AppModule {}
