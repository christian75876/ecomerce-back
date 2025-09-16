import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/modules/users/entities/user.entity';
import { Repository } from 'typeorm';
import { FaceEnrollment } from './entities/face-enrollments.entity';
import { euclidean, l2Normalize, meanVector } from './utility/vector.util';

@Injectable()
export class FaceService {
  constructor(
    @InjectRepository(FaceEnrollment)
    private readonly faceEnrollmentRepository: Repository<FaceEnrollment>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async enrollByUserId(
    userId: number,
    descriptors: number[][],
    imagePaths?: string[],
  ) {
    if (!descriptors?.length) throw new BadRequestException('No descriptors');
    const dim = descriptors[0].length;
    if (descriptors.some((d) => d.length !== dim))
      throw new BadRequestException('Dimensión inconsistente');

    const norm = descriptors.map(l2Normalize);
    const mean = l2Normalize(meanVector(norm));

    const existing = await this.faceEnrollmentRepository.findOne({
      where: { userId },
    });

    if (existing) {
      existing.descriptor = mean;
      if (imagePaths?.length)
        existing.images = Array.from(
          new Set([...(existing.images ?? []), ...imagePaths]),
        );
      await this.faceEnrollmentRepository.save(existing);
      return { enrollmentId: existing.id, updated: true };
    }

    const created = this.faceEnrollmentRepository.create({
      userId,
      descriptor: mean,
      images: imagePaths ?? [],
    });
    const saved = await this.faceEnrollmentRepository.save(created);
    return { enrollmentId: saved.id, updated: false };
  }

  async identify(probeDescriptor: number[], threshold = 0.55, k = 3) {
    const probe = l2Normalize(probeDescriptor);

    const all = await this.faceEnrollmentRepository.find({
      select: ['userId', 'descriptor'],
    });
    if (!all.length)
      return { match: false, reason: 'No hay usuarios enrolados' };

    const scored = all
      .map((row) => ({
        userId: row.userId,
        dist: euclidean(probe, row.descriptor),
      }))
      .sort((a, b) => a.dist - b.dist);

    const best = scored[0];
    const match = best.dist <= threshold;

    const user = match
      ? await this.userRepository.findOne({ where: { id: best.userId } })
      : null;

    return {
      match,
      score: best.dist,
      user: match
        ? { id: user!.id, email: user!.email, role_id: user!.role_id }
        : null,
      topK: scored.slice(0, k),
    };
  }
}
