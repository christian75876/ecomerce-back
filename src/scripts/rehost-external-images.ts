// Copia a Cloudinary las imágenes de productos que apuntan a otros sitios
// (hotlinking) y actualiza la URL en la base de datos. Desde que
// ProductsService.rehostExternalImage() existe, las imágenes nuevas ya se
// copian al guardar — este script es para las que se crearon antes.
//
// Por defecto solo lista lo que haría (dry run). Para aplicar los cambios:
//   docker compose -f docker-compose.prod.yml run --rm app node dist/scripts/rehost-external-images.js --apply
import { v2 as cloudinary } from 'cloudinary';
import dataSource from '../database/data-source';

const TABLES = [
  { table: 'products', folder: 'products', transforms: { width: 800, height: 800, crop: 'auto', gravity: 'auto' } },
  { table: 'product_variants', folder: 'products', transforms: { width: 800, height: 800, crop: 'auto', gravity: 'auto' } },
  { table: 'product_images', folder: 'products/gallery', transforms: { width: 1200, height: 1200, crop: 'limit' } },
] as const;

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  await dataSource.initialize();

  let copied = 0;
  let failed = 0;
  for (const { table, folder, transforms } of TABLES) {
    const rows = await dataSource.query<{ id: string; image_url: string }[]>(
      `SELECT id, image_url FROM ${table}
       WHERE image_url ~* '^https?://' AND image_url !~* '^https?://res\\.cloudinary\\.com/'`,
    );
    for (const row of rows) {
      if (!apply) {
        console.log(`[dry-run] ${table} ${row.id}: ${row.image_url}`);
        continue;
      }
      try {
        const result = await cloudinary.uploader.upload(row.image_url, {
          folder: `marketplace/${folder}`,
          quality: 'auto',
          fetch_format: 'auto',
          resource_type: 'image',
          ...transforms,
        });
        await dataSource.query(`UPDATE ${table} SET image_url = $1 WHERE id = $2`, [result.secure_url, row.id]);
        console.log(`[ok] ${table} ${row.id}: ${row.image_url} -> ${result.secure_url}`);
        copied++;
      } catch (error) {
        console.error(`[error] ${table} ${row.id}: ${row.image_url} (${(error as Error).message})`);
        failed++;
      }
    }
  }

  console.log(apply ? `Copiadas: ${copied}, fallidas: ${failed}` : 'Dry run: no se cambió nada. Usa --apply para aplicar.');
  await dataSource.destroy();
  if (failed > 0) process.exitCode = 1;
}

void main();
