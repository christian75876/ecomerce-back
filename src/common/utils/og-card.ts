// Tarjeta para compartir (og:image) de un producto, estilo MercadoLibre/Temu:
// 1200x630 con la foto a la izquierda y tienda, nombre, precio y descuento a
// la derecha. La arma Cloudinary al vuelo con transformaciones sobre la foto
// ya subida (sin generar ni guardar archivos) y la cachea en su CDN.
//
// Siempre en JPG: WhatsApp y algunos clientes no muestran la miniatura si la
// imagen llega en WebP/AVIF (lo que entregaría f_auto).

const CLOUDINARY_UPLOAD_MARKER = '/upload/';

export const OG_CARD_WIDTH = 1200;
export const OG_CARD_HEIGHT = 630;

interface ProductOgCardParams {
  imageUrl: string | null | undefined;
  name: string;
  storeName?: string | null;
  price: string;
  compareAtPrice?: string | null;
  discountPercent?: number | null;
  inStock: boolean;
  blur?: boolean;
}

const isCloudinaryUrl = (url: string): boolean =>
  /^https?:\/\/res\.cloudinary\.com\//.test(url) && url.includes(CLOUDINARY_UPLOAD_MARKER);

// Texto para l_text: Cloudinary exige la coma y la barra codificadas dos veces
// (si no, las interpreta como separadores de la transformación).
const layerText = (text: string): string =>
  encodeURIComponent(text.replace(/ /g, ' '))
    .replace(/%2C/g, '%252C')
    .replace(/%2F/g, '%252F');

const truncate = (text: string, max: number): string => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s-]+$/, '')}…`;
};

/**
 * URL de la tarjeta de 1200x630 para og:image, o null si la foto no está en
 * Cloudinary (rutas locales /uploads no admiten transformaciones).
 */
export function buildProductOgCard(params: ProductOgCardParams): string | null {
  const { imageUrl, name, storeName, price, compareAtPrice, discountPercent, inStock, blur } = params;
  if (!imageUrl || !isCloudinaryUrl(imageUrl)) return null;

  // Hasta ~4 líneas de nombre caben antes del precio; con nombres largos se
  // baja el tamaño de letra en vez de recortar tanto.
  const title = truncate(name, 70);
  const titleSize = title.length > 40 ? 38 : 44;
  const x = 690;
  const steps = [
    ...(blur ? ['e_blur:2000'] : []),
    'c_pad,w_560,h_560,b_white',
    'c_lpad,w_640,h_630,b_white',
    `c_lpad,w_${OG_CARD_WIDTH},h_${OG_CARD_HEIGHT},g_west,b_rgb:FFF4EE`,
    ...(storeName
      ? [`l_text:Arial_26_bold:${layerText(truncate(storeName, 32).toUpperCase())},co_rgb:6B7280,g_north_west,x_${x},y_70`]
      : []),
    `l_text:Arial_${titleSize}_bold:${layerText(title)},co_rgb:111827,w_470,c_fit,g_north_west,x_${x},y_115`,
  ];

  if (!inStock) {
    steps.push(`l_text:Arial_28_bold:${layerText(' AGOTADO ')},co_white,b_rgb:6B7280,g_north_west,x_${x},y_332`);
  } else if (compareAtPrice && discountPercent) {
    steps.push(
      `l_text:Arial_28_bold:${layerText(` -${discountPercent}% `)},co_white,b_rgb:E11D48,g_north_west,x_${x},y_332`,
      `l_text:Arial_30_strikethrough:${layerText(compareAtPrice)},co_rgb:9CA3AF,g_north_west,x_${x + 110},y_330`,
    );
  }

  steps.push(
    `l_text:Arial_72_bold:${layerText(price)},co_rgb:FF6B35,g_north_west,x_${x},y_370`,
    `l_text:Arial_30_bold:${layerText('Pide en merku.co')},co_rgb:FF6B35,g_south_west,x_${x},y_60`,
    'f_jpg,q_auto:good',
  );

  return imageUrl.replace(CLOUDINARY_UPLOAD_MARKER, `${CLOUDINARY_UPLOAD_MARKER}${steps.join('/')}/`);
}
