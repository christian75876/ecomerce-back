import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, Response } from 'express';
import { Store, StoreType } from '../stores/entities/store.entity';
import { Product } from '../products/entities/product.entity';
import {
  buildProductPath,
  extractProductId,
} from '../../common/utils/product-url';

// HTML que el Worker de Cloudflare (ecomerce/worker/index.js) sirve a bots que
// no ejecutan JS: Googlebot, Bingbot, rastreadores de IA (GPTBot, ClaudeBot,
// PerplexityBot…) y previsualizadores de redes sociales. Es "dynamic
// rendering": la misma información que ve un usuario una vez carga la SPA
// (nombre, precio, descripción, tienda, productos), no contenido distinto u
// oculto — solo que desde el primer byte y con datos estructurados.

interface ListingItem {
  name: string;
  subtitle?: string;
  href: string;
}

interface PageParams {
  title: string;
  description: string;
  url: string;
  image: string;
  ogType: string;
  body: string;
  jsonLd: object[];
}

@Controller()
export class OgPreviewController {
  constructor(
    @InjectRepository(Store) private readonly stores: Repository<Store>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  private get frontendUrl(): string {
    return (process.env.FRONTEND_URL ?? 'https://merku.co').replace(/\/$/, '');
  }

  private get apiPublicUrl(): string {
    return (process.env.API_PUBLIC_URL ?? 'https://api.merku.co').replace(/\/$/, '');
  }

  private isBot(ua: string): boolean {
    return /bot|spider|crawl|whatsapp|facebookexternalhit|twitterbot|slackbot|telegrambot|discordbot|linkedinbot|googlebot|google-inspectiontool|chatgpt-user|perplexity-user|claude-user/i.test(
      ua,
    );
  }

  private formatCOP(price: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(Number(price));
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // JSON-LD va dentro de <script>: un "</script>" en un nombre o descripción
  // escrito por el vendedor cerraría el bloque e inyectaría HTML.
  private jsonLd(data: object): string {
    return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
  }

  // Las imágenes subidas localmente se guardan como rutas relativas
  // (/uploads/...) servidas por la API; OG y schema.org exigen URL absoluta.
  private absoluteAssetUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.apiPublicUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  // Descripción para <meta>: corta en el último espacio antes de 155
  // caracteres en vez de partir una palabra a la mitad.
  private metaDescription(text: string | null | undefined, fallback: string): string {
    const clean = (text ?? '').replace(/\s+/g, ' ').trim();
    if (!clean) return fallback;
    if (clean.length <= 155) return clean;
    const cut = clean.slice(0, 155);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 100 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`;
  }

  private nav(): string {
    const f = this.escapeHtml(this.frontendUrl);
    return `<header><nav aria-label="Principal"><a href="${f}/home">Merku</a> · <a href="${f}/home">Productos</a> · <a href="${f}/stores">Tiendas</a> · <a href="${f}/stores/map">Mapa de tiendas</a> · <a href="${f}/bienvenida">Vende en Merku</a> · <a href="${f}/ayuda">Ayuda</a></nav></header>`;
  }

  private footer(): string {
    const f = this.escapeHtml(this.frontendUrl);
    return `<footer><p>Merku — marketplace de tiendas y restaurantes locales en Colombia.</p><p><a href="${f}/bienvenida">Vende en Merku</a> · <a href="${f}/ayuda">Centro de ayuda</a> · <a href="${f}/terminos">Términos y condiciones</a> · <a href="${f}/privacidad">Política de privacidad</a></p></footer>`;
  }

  private buildPage(params: PageParams): string {
    const { title, description, url, image, ogType, body, jsonLd } = params;
    const safeTitle = this.escapeHtml(title);
    const safeDescription = this.escapeHtml(description);
    const safeUrl = this.escapeHtml(url);
    const safeImage = this.escapeHtml(image);
    return `<!DOCTYPE html>
<html lang="es-CO">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<link rel="canonical" href="${safeUrl}">
<meta property="og:type" content="${this.escapeHtml(ogType)}">
<meta property="og:site_name" content="Merku">
<meta property="og:locale" content="es_CO">
<meta property="og:url" content="${safeUrl}">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:image" content="${safeImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${safeImage}">
${jsonLd.map((d) => this.jsonLd(d)).join('\n')}
</head>
<body>
${this.nav()}
<main>
${body}
</main>
${this.footer()}
</body>
</html>`;
  }

  private notFoundHtml(): string {
    const f = this.escapeHtml(this.frontendUrl);
    return `<!DOCTYPE html>
<html lang="es-CO">
<head>
<meta charset="UTF-8">
<title>Página no encontrada — Merku</title>
<meta name="robots" content="noindex, follow">
</head>
<body>
<h1>Página no encontrada</h1>
<p>Este producto o tienda ya no está disponible en Merku.</p>
<p><a href="${f}/home">Ver productos</a> · <a href="${f}/stores">Ver tiendas</a></p>
</body>
</html>`;
  }

  private sendNotFound(res: Response): void {
    res.status(404).type('html').send(this.notFoundHtml());
  }

  private breadcrumbLd(items: { name: string; url: string }[]): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: item.url,
      })),
    };
  }

  private buildListingHtml(params: {
    title: string;
    description: string;
    url: string;
    intro: string;
    items: ListingItem[];
  }): string {
    const { title, description, url, intro, items } = params;
    // href se construye acá mismo con frontendUrl + uuid/slug (los slugs de
    // tienda están restringidos a [a-z0-9-] por @Matches en create-store.dto.ts
    // y los de producto salen de slugify()), pero se escapa por si eso cambia.
    const itemsHtml = items
      .map((i) => {
        const name = this.escapeHtml(i.name);
        const href = this.escapeHtml(i.href);
        const subtitle = i.subtitle ? ` — ${this.escapeHtml(i.subtitle)}` : '';
        return `<li><a href="${href}">${name}</a>${subtitle}</li>`;
      })
      .join('\n');

    return this.buildPage({
      title,
      description,
      url,
      image: `${this.frontendUrl}/og-image.png`,
      ogType: 'website',
      body: `<h1>${this.escapeHtml(title)}</h1>
<p>${this.escapeHtml(intro)}</p>
<ul>
${itemsHtml}
</ul>`,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: title,
          url,
          numberOfItems: items.length,
          itemListElement: items.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.name,
            url: item.href,
          })),
        },
      ],
    });
  }

  @Get('og/home')
  async getHomeOg(@Req() req: Request, @Res() res: Response): Promise<void> {
    const ua = (req.headers['user-agent'] ?? '') as string;
    const frontendUrl = this.frontendUrl;
    const spaUrl = `${frontendUrl}/home`;

    if (!this.isBot(ua)) {
      res.redirect(302, spaUrl);
      return;
    }

    const products = await this.products
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.store', 'store')
      .where('product.isActive = true')
      .andWhere('(store.id IS NULL OR store.isActive = true)')
      .orderBy('product.createdAt', 'DESC')
      .take(48)
      .getMany();

    const html = this.buildListingHtml({
      title: 'Merku — Encuentra lo que buscas',
      description:
        'Merku: explora cientos de productos de tiendas locales. Encuentra lo que necesitas al mejor precio.',
      url: spaUrl,
      intro:
        'Merku es un marketplace colombiano donde tiendas y restaurantes locales publican su catálogo, reciben pedidos y venden en línea. Estos son los productos más recientes:',
      items: products.map((p) => ({
        name: p.name,
        subtitle: p.store?.name ? `${this.formatCOP(p.price)} · ${p.store.name}` : this.formatCOP(p.price),
        href: `${frontendUrl}${buildProductPath(p.id, p.name)}`,
      })),
    });

    res.type('html').send(html);
  }

  @Get('og/stores')
  async getStoresOg(@Req() req: Request, @Res() res: Response): Promise<void> {
    const ua = (req.headers['user-agent'] ?? '') as string;
    const frontendUrl = this.frontendUrl;
    const spaUrl = `${frontendUrl}/stores`;

    if (!this.isBot(ua)) {
      res.redirect(302, spaUrl);
      return;
    }

    const stores = await this.stores.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });

    const html = this.buildListingHtml({
      title: 'Tiendas disponibles — Merku',
      description:
        'Explora todas las tiendas y restaurantes disponibles en Merku. Encuentra productos locales y realiza tu pedido.',
      url: spaUrl,
      intro: 'Tiendas y restaurantes locales que venden en Merku. Entra a cada una para ver su catálogo y hacer tu pedido.',
      items: stores.map((s) => ({
        name: s.name,
        subtitle: s.description ? s.description.slice(0, 120) : undefined,
        href: `${frontendUrl}/stores/${s.slug}`,
      })),
    });

    res.type('html').send(html);
  }

  @Get('og/product/:id')
  async getProductOg(
    @Param('id') param: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const ua = (req.headers['user-agent'] ?? '') as string;
    const frontendUrl = this.frontendUrl;

    if (!this.isBot(ua)) {
      res.redirect(302, `${frontendUrl}/product/${encodeURIComponent(param)}`);
      return;
    }

    const id = extractProductId(param);
    const product = id
      ? await this.products.findOne({
          where: { id },
          relations: { store: true, category: true },
        })
      : null;

    if (!product || !product.isActive || (product.store && !product.store.isActive)) {
      this.sendNotFound(res);
      return;
    }

    const canonicalPath = buildProductPath(product.id, product.name);
    if (`/product/${param}` !== canonicalPath) {
      res.redirect(301, `${frontendUrl}${canonicalPath}`);
      return;
    }

    const url = `${frontendUrl}${canonicalPath}`;
    const manager = this.products.manager;
    const [extraImages, stockRow, ratingRow] = await Promise.all([
      manager
        .createQueryBuilder()
        .select('img.image_url', 'imageUrl')
        .from('product_images', 'img')
        .where('img.product_id = :id', { id: product.id })
        // "order" es palabra reservada en SQL: va entre comillas.
        .orderBy('"img"."order"', 'ASC')
        .limit(8)
        .getRawMany<{ imageUrl: string }>(),
      manager
        .createQueryBuilder()
        .select('COALESCE(SUM(batch.available_quantity), 0)', 'stock')
        .from('inventory_batches', 'batch')
        .where('batch.product_id = :id', { id: product.id })
        .getRawOne<{ stock: string }>(),
      manager
        .createQueryBuilder()
        .select('ROUND(AVG(review.rating)::numeric, 1)', 'averageRating')
        .addSelect('COUNT(review.id)::int', 'reviewCount')
        .from('reviews', 'review')
        .where('review.product_id = :id', { id: product.id })
        .andWhere('review.is_visible = :visible', { visible: true })
        .getRawOne<{ averageRating: string | null; reviewCount: string }>(),
    ]);

    const images = [product.imageUrl, ...extraImages.map((i) => i.imageUrl)]
      .map((p) => this.absoluteAssetUrl(p))
      .filter((p, i, all): p is string => !!p && all.indexOf(p) === i);
    const ogImage = images[0] ?? `${frontendUrl}/og-image.png`;
    const inStock = Number(stockRow?.stock ?? 0) > 0;
    const reviewCount = Number(ratingRow?.reviewCount ?? 0);
    const store = product.store;
    const storeUrl = store ? `${frontendUrl}/stores/${store.slug}` : null;
    const price = this.formatCOP(product.price);
    const hasDiscount =
      product.compareAtPrice != null && Number(product.compareAtPrice) > Number(product.price);

    const description = this.metaDescription(
      product.description,
      store
        ? `${product.name} a ${price} en ${store.name}. Pide en línea en Merku.`
        : `${product.name} a ${price}. Pide en línea en Merku.`,
    );

    const e = (v: string) => this.escapeHtml(v);
    const breadcrumbs = [
      { name: 'Inicio', url: `${frontendUrl}/home` },
      ...(store && storeUrl
        ? [
            { name: 'Tiendas', url: `${frontendUrl}/stores` },
            { name: store.name, url: storeUrl },
          ]
        : []),
      { name: product.name, url },
    ];

    const body = `<nav aria-label="Ruta de navegación"><ol>${breadcrumbs
      .map((b) => `<li><a href="${e(b.url)}">${e(b.name)}</a></li>`)
      .join('')}</ol></nav>
<article>
<h1>${e(product.name)}</h1>
${images.map((src) => `<img src="${e(src)}" alt="${e(product.name)}" loading="lazy">`).join('\n')}
<p><strong>Precio:</strong> ${e(price)}${hasDiscount ? ` <s>${e(this.formatCOP(Number(product.compareAtPrice)))}</s>` : ''}</p>
<p><strong>Disponibilidad:</strong> ${inStock ? 'Disponible' : 'Agotado'}</p>
${product.brand ? `<p><strong>Marca:</strong> ${e(product.brand)}</p>` : ''}
${product.category?.name ? `<p><strong>Categoría:</strong> ${e(product.category.name)}</p>` : ''}
${store && storeUrl ? `<p><strong>Vendido por:</strong> <a href="${e(storeUrl)}">${e(store.name)}</a>${store.addressText && !store.hideLocation ? ` — ${e(store.addressText)}` : ''}</p>` : ''}
${reviewCount > 0 ? `<p><strong>Calificación:</strong> ${e(String(ratingRow?.averageRating))} de 5 (${reviewCount} reseñas)</p>` : ''}
${product.description ? `<h2>Descripción</h2>\n<p>${e(product.description).replace(/\n/g, '<br>')}</p>` : ''}
</article>`;

    const productLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description ? product.description.slice(0, 5000) : description,
      url,
      ...(images.length ? { image: images } : {}),
      ...(product.sku ? { sku: product.sku } : {}),
      ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
      ...(product.category?.name ? { category: product.category.name } : {}),
      offers: {
        '@type': 'Offer',
        url,
        priceCurrency: 'COP',
        price: Number(product.price),
        availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        ...(store && storeUrl
          ? { seller: { '@type': 'Organization', name: store.name, url: storeUrl } }
          : {}),
      },
      ...(reviewCount > 0
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: Number(ratingRow?.averageRating),
              reviewCount,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
    };

    res.type('html').send(
      this.buildPage({
        title: `${product.name} — Merku`,
        description,
        url,
        image: ogImage,
        ogType: 'product',
        body,
        jsonLd: [productLd, this.breadcrumbLd(breadcrumbs)],
      }),
    );
  }

  @Get('og/store/:slug')
  async getStoreOg(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const ua = (req.headers['user-agent'] ?? '') as string;
    const frontendUrl = this.frontendUrl;
    const url = `${frontendUrl}/stores/${slug}`;

    if (!this.isBot(ua)) {
      res.redirect(302, url);
      return;
    }

    const store = await this.stores.findOne({ where: { slug, isActive: true } });
    if (!store) {
      this.sendNotFound(res);
      return;
    }

    const products = await this.products.find({
      where: { storeId: store.id, isActive: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    const isRestaurant = store.storeType === StoreType.RESTAURANT;
    const description = this.metaDescription(
      store.description,
      `Explora los productos de ${store.name} y haz tu pedido en línea en Merku.`,
    );
    const image =
      this.absoluteAssetUrl(store.bannerUrl) ??
      this.absoluteAssetUrl(store.logoUrl) ??
      `${frontendUrl}/og-image.png`;
    const showLocation = !store.hideLocation;
    const e = (v: string) => this.escapeHtml(v);
    const breadcrumbs = [
      { name: 'Inicio', url: `${frontendUrl}/home` },
      { name: 'Tiendas', url: `${frontendUrl}/stores` },
      { name: store.name, url },
    ];
    const productItems = products.map((p) => ({
      name: p.name,
      price: this.formatCOP(p.price),
      href: `${frontendUrl}${buildProductPath(p.id, p.name)}`,
    }));

    const body = `<nav aria-label="Ruta de navegación"><ol>${breadcrumbs
      .map((b) => `<li><a href="${e(b.url)}">${e(b.name)}</a></li>`)
      .join('')}</ol></nav>
<h1>${e(store.name)}</h1>
<p>${isRestaurant ? 'Restaurante' : 'Tienda'} en Merku.${store.description ? ` ${e(store.description)}` : ''}</p>
${showLocation && store.addressText ? `<p><strong>Dirección:</strong> ${e(store.addressText)}</p>` : ''}
<h2>${isRestaurant ? 'Menú' : 'Productos'} de ${e(store.name)}</h2>
<ul>
${productItems.map((p) => `<li><a href="${e(p.href)}">${e(p.name)}</a> — ${e(p.price)}</li>`).join('\n')}
</ul>`;

    const storeLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': isRestaurant ? 'Restaurant' : 'Store',
      name: store.name,
      url,
      description,
      image,
      ...(store.logoUrl ? { logo: this.absoluteAssetUrl(store.logoUrl) } : {}),
      ...(showLocation && store.addressText
        ? {
            address: {
              '@type': 'PostalAddress',
              streetAddress: store.addressText,
              addressCountry: 'CO',
            },
          }
        : {}),
      ...(showLocation && store.lat != null && store.lng != null
        ? { geo: { '@type': 'GeoCoordinates', latitude: store.lat, longitude: store.lng } }
        : {}),
      ...(isRestaurant && store.menuPdfUrl ? { hasMenu: this.absoluteAssetUrl(store.menuPdfUrl) } : {}),
      currenciesAccepted: 'COP',
    };

    res.type('html').send(
      this.buildPage({
        title: `${store.name} — Merku`,
        description,
        url,
        image,
        ogType: 'website',
        body,
        jsonLd: [
          storeLd,
          this.breadcrumbLd(breadcrumbs),
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: `${isRestaurant ? 'Menú' : 'Productos'} de ${store.name}`,
            numberOfItems: productItems.length,
            itemListElement: productItems.map((p, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: p.name,
              url: p.href,
            })),
          },
        ],
      }),
    );
  }
}
