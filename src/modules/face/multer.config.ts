// src/modules/face/multer.config.ts
import { diskStorage } from 'multer';
import { extname, join, isAbsolute } from 'path';
import { existsSync, mkdirSync } from 'fs';

function getUploadDir() {
  const env = process.env.UPLOAD_DIR;
  return env && env.trim().length > 0 ? env : join(process.cwd(), 'uploads');
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function safeDestination(): string {
  const preferred = getUploadDir();
  try {
    ensureDir(preferred);
    return preferred;
  } catch (e) {
    const fallback = join(process.cwd(), 'uploads');
    ensureDir(fallback);
    return fallback;
  }
}

function randomName(originalname: string) {
  const ts = Date.now();
  const rnd = Math.random().toString(36).slice(2, 8);
  const ext = (extname(originalname) || '.jpg').toLowerCase();
  return `${ts}_${rnd}${ext}`;
}

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png']);

export function multerDiskOptions() {
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        try {
          const dest = safeDestination();
          cb(null, dest);
        } catch (err) {
          cb(err, '');
        }
      },
      filename: (_req, file, cb) => cb(null, randomName(file.originalname)),
    }),
    fileFilter: (_req: any, file: Express.Multer.File, cb: Function) => {
      if (!ALLOWED_MIMES.has(file.mimetype)) {
        return cb(new Error('Tipo de archivo no permitido (JPG/PNG)'), false);
      }
      cb(null, true);
    },
    limits: {
      fileSize: (Number(process.env.MAX_IMAGE_MB) || 5) * 1024 * 1024,
      files: 3,
    },
  };
}
