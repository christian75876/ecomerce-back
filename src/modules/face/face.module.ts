import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaceEnrollment } from './entities/face-enrollments.entity';
import { User } from '../users/entities/user.entity';
import { FaceController } from './face.controller';
import { FaceService } from './face.service';

@Module({
  imports: [TypeOrmModule.forFeature([FaceEnrollment, User])],
  controllers: [FaceController],
  providers: [FaceService],
  exports: [FaceService],
})
export class FaceModule {}
