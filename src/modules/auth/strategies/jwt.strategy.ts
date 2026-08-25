import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/modules/users/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      // Fail fast at boot rather than silently running with an undefined
      // secret (which previously typechecked only because this file had no
      // strict null checks).
      throw new Error('JWT_SECRET environment variable must be set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const userId = payload?.sub ?? payload?.userId;
    if (!payload || !userId) {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { role: true },
    });
    if (!user || !user.isEmailVerified) {
      throw new UnauthorizedException('User is not allowed to access');
    }

    return {
      userId: user.id,
      role_id: user.role_id,
      role: user.role?.name ?? null,
      email: user.email,
    };
  }
}
