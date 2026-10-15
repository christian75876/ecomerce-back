// URLs de producto descriptivas: /product/<slug-del-nombre>-<uuid>.
// El uuid al final sigue siendo el identificador real (el slug es decorativo y
// puede cambiar si se renombra el producto); /product/<uuid> a secas sigue
// resolviendo y se redirige 301 a la versión con slug.
// Mantener en sync con ecomerce/src/shared/utils/productUrl.ts.

const UUID_AT_END =
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export function buildProductPath(id: string, name?: string | null): string {
  const slug = name ? slugify(name) : '';
  return slug ? `/product/${slug}-${id}` : `/product/${id}`;
}

export function extractProductId(param: string): string | null {
  const match = param.match(UUID_AT_END);
  return match ? match[1].toLowerCase() : null;
}
