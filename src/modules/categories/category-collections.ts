import { EntityManager, SelectQueryBuilder } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { slugify } from '../../common/utils/product-url';
import { normalizeTitleCase } from '../../common/utils/text-case';

// Páginas públicas de categoría (/categorias/:slug). Las categorías son por
// tienda (dos tiendas pueden tener cada una su "Impresoras"), así que la
// página agrupa todas las categorías cuyo nombre da el mismo slug.
//
// Fuente única para la API (categories.controller.ts), el HTML para bots
// (og-preview.controller.ts) y el sitemap: si cada uno contara a su manera,
// el sitemap podría listar categorías que la página marca como noindex.

// Con menos productos la página es "contenido escaso": Google la ve como de
// baja calidad y eso pesa sobre todo el sitio. Se sirve con noindex y queda
// fuera del sitemap hasta llegar a este mínimo.
export const MIN_INDEXABLE_PRODUCTS = 3;

export interface CategoryCollection {
  slug: string;
  name: string;
  productCount: number;
  storeCount: number;
  categoryIds: string[];
  /** Precio final con IVA (lo que ve y paga el comprador). */
  minPrice: number | null;
  maxPrice: number | null;
  lastModified: Date | null;
  indexable: boolean;
}

// Precio final en SQL, igual que computeLineTax() (common/utils/tax.ts):
// "+ IVA" suma el impuesto y redondea a pesos enteros.
const FINAL_PRICE_SQL =
  "CASE WHEN product.taxMode = 'EXCLUDED' AND product.taxRate > 0 THEN ROUND(product.price * (1 + product.taxRate / 100)) ELSE product.price END";

/**
 * Mismas reglas que el catálogo público (ProductsService.findAll con
 * active=true): producto, tienda y categoría activos y suscripción vigente.
 * Además excluye tiendas +18: no se mezclan en páginas pensadas para buscadores.
 * Espera los alias "product", "store" (left join) y "category".
 */
export function applyPublicCategoryVisibility<T extends object>(qb: SelectQueryBuilder<T>): SelectQueryBuilder<T> {
  return qb
    .andWhere('product.isActive = true')
    .andWhere('category.isActive = true')
    .andWhere('(store.id IS NULL OR store.isActive = true)')
    .andWhere('(store.id IS NULL OR store.subscriptionExpiresAt IS NULL OR store.subscriptionExpiresAt > NOW())')
    .andWhere('(store.id IS NULL OR store.isAdultContent = false)');
}

export async function findPublicCategoryCollections(manager: EntityManager): Promise<CategoryCollection[]> {
  const rows = await applyPublicCategoryVisibility(
    manager
      .createQueryBuilder(Product, 'product')
      .innerJoin('product.category', 'category')
      .leftJoin('product.store', 'store'),
  )
    .select('category.id', 'id')
    .addSelect('category.name', 'name')
    .addSelect('COUNT(product.id)::int', 'productCount')
    .addSelect('ARRAY_REMOVE(ARRAY_AGG(DISTINCT product.storeId), NULL)', 'storeIds')
    .addSelect(`MIN(${FINAL_PRICE_SQL})`, 'minPrice')
    .addSelect(`MAX(${FINAL_PRICE_SQL})`, 'maxPrice')
    .addSelect('MAX(product.updatedAt)', 'lastModified')
    .groupBy('category.id')
    .addGroupBy('category.name')
    .getRawMany<{
      id: string;
      name: string;
      productCount: number;
      storeIds: string[] | null;
      minPrice: string | null;
      maxPrice: string | null;
      lastModified: Date | null;
    }>();

  const bySlug = new Map<string, { rows: typeof rows; storeIds: Set<string> }>();
  for (const row of rows) {
    const slug = slugify(row.name);
    if (!slug) continue;
    const group = bySlug.get(slug) ?? { rows: [], storeIds: new Set<string>() };
    group.rows.push(row);
    for (const id of row.storeIds ?? []) group.storeIds.add(id);
    bySlug.set(slug, group);
  }

  const collections = [...bySlug.entries()].map(([slug, group]): CategoryCollection => {
    // Nombre visible: el de la categoría con más productos.
    const main = [...group.rows].sort((a, b) => b.productCount - a.productCount)[0];
    const productCount = group.rows.reduce((sum, r) => sum + r.productCount, 0);
    const prices = group.rows.flatMap((r) => [r.minPrice, r.maxPrice]).filter((p): p is string => p != null).map(Number);
    const dates = group.rows.map((r) => r.lastModified).filter((d): d is Date => !!d).map((d) => new Date(d).getTime());
    return {
      slug,
      name: normalizeTitleCase(main.name),
      productCount,
      storeCount: group.storeIds.size,
      categoryIds: group.rows.map((r) => r.id),
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      lastModified: dates.length ? new Date(Math.max(...dates)) : null,
      indexable: productCount >= MIN_INDEXABLE_PRODUCTS,
    };
  });

  return collections.sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name, 'es'));
}

export async function findPublicCategoryCollection(
  manager: EntityManager,
  slug: string,
): Promise<CategoryCollection | null> {
  const collections = await findPublicCategoryCollections(manager);
  return collections.find((c) => c.slug === slug) ?? null;
}
