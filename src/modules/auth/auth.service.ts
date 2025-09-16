import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { RegisterDto } from './dto/register.auth.dto';
import { LoginAuthDto } from './dto/login.auth.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RecoverToken } from './entities/token.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private jwtService: JwtService,
    @InjectRepository(RecoverToken)
    private readonly recoverTokenRepository: Repository<RecoverToken>,
  ) {}

  async checkDoesEmailExist(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (user) {
      throw new NotFoundException('The email has already been used');
    }
    return email;
  }
  async checkDoesEmailExistToToken(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (user) {
      return email;
    }
    throw new NotFoundException("this email doesn't have any account related");
  }

  async checkCredentials(
    email: string,
    password: string,
  ): Promise<User | void> {
    const userData = await this.userRepository.findOne({ where: { email } });
    if (!userData) {
      throw new NotFoundException('The email does not exist.');
    }
    const result = await bcrypt.compare(password, userData.password);
    if (userData.email && result) {
      return userData;
    }
    throw new UnauthorizedException('Your email or password are incorrect.');
  }

  async login({ email, password }: LoginAuthDto) {
    const userData = await this.checkCredentials(email, password);
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now,
      role_id: userData instanceof User && userData.role_id,
      // exp: now + expiresInSeconds,
    };
    return {
      message: 'Here is your token: ',
      token: await this.jwtService.signAsync(payload, { expiresIn: '1h' }),
    };
  }

  async register({ email, password, role_id }: RegisterDto) {
    await this.checkDoesEmailExist(email);
    const hashedPass = await bcrypt.hash(password, bcrypt.genSaltSync(10));
    const user = this.userRepository.create({
      role_id,
      email,
      password: hashedPass,
    });
    await this.userRepository.save(user);
    return user;
  }

  private generateRandomCode(): number {
    return Math.floor(100000 + Math.random() * 900000);
  }

  async createToken(email: string) {
    await this.checkDoesEmailExistToToken(email);
    const code = this.generateRandomCode();
    const token = this.recoverTokenRepository.create({
      email: email,
      code,
    });
    return await this.recoverTokenRepository.save(token);
  }
}
