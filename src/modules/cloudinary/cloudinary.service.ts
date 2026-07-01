import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiOptions } from 'cloudinary';
import { Readable } from 'stream';

// Auto-crop transforms applied per folder at upload time
const FOLDER_TRANSFORMS: Record<string, Partial<UploadApiOptions>> = {
  products: { width: 800, height: 800, crop: 'auto', gravity: 'auto' },
  'products/gallery': { width: 1200, height: 1200, crop: 'limit' },
  'stores/logos': { width: 400, height: 400, crop: 'auto', gravity: 'auto' },
  'stores/banners': { width: 1200, height: 400, crop: 'fill', gravity: 'auto' },
  'purchase-payments': { width: 1200, crop: 'limit' },
  reviews: { width: 1200, crop: 'limit' },
};

@Injectable()
export class CloudinaryService {
  uploadImage(buffer: Buffer, folder: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const transforms = FOLDER_TRANSFORMS[folder] ?? {};
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: `marketplace/${folder}`,
          quality: 'auto',
          fetch_format: 'auto',
          resource_type: 'image',
          ...transforms,
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
          resolve(result.secure_url);
        },
      );
      Readable.from(buffer).pipe(upload);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  getOptimizedUrl(publicId: string, options?: { width?: number; height?: number; crop?: string }): string {
    return cloudinary.url(publicId, {
      fetch_format: 'auto',
      quality: 'auto',
      ...(options ?? {}),
    });
  }
}
