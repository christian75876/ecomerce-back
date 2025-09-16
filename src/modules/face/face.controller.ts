import {
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FaceService } from './face.service';
import { EnrollByIdDto } from './dtos/enroll-by-id.dto';
import { IdentifyDto } from './dtos/identify.dto';
import { multerDiskOptions } from './multer.config';

@Controller('face')
export class FaceController {
  constructor(private readonly face: FaceService) {}

  @Post('enroll-by-id')
  @UseInterceptors(FilesInterceptor('images', 3, multerDiskOptions()))
  async enrollById(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: EnrollByIdDto,
  ) {
    const imagePaths = files?.map((f) => f.path) ?? [];
    return this.face.enrollByUserId(body.userId, body.descriptors, imagePaths);
  }

  @Post('identify')
  async identify(@Body() body: IdentifyDto) {
    if (!Array.isArray(body.descriptor))
      throw new BadRequestException('descriptor requerido');
    const threshold = body.threshold ?? 0.55;
    const k = body.k ?? 3;
    return this.face.identify(body.descriptor, threshold, k);
  }
}
