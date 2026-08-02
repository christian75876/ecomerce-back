import { Module } from '@nestjs/common';
import { TurnstileService } from './turnstile.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { RecoverToken } from './entities/token.entity';
import { Role } from '../users/entities/role.entity';
import { Customer } from '../customers/entities/customer.entity';
import { InvitationsModule } from '../invitations/invitations.module';
import { StoresModule } from '../stores/stores.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, Customer, RecoverToken]),
    ConfigModule.forRoot(),
    InvitationsModule,
    StoresModule,
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('TOKEN_EXPIRATION'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TurnstileService],
  exports: [JwtStrategy, AuthService],
})
export class AuthModule {}
