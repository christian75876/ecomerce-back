import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, Response } from 'express';
import { Store, StoreType } from '../stores/entities/store.entity';
import { Product } from '../products/entities/product.entity';
import {
  buildProductPath,
  extractProductId,
  slugify,
} from '../../common/utils/product-url';
import { normalizeTitleCase } from '../../common/utils/text-case';
import {
  applyPublicCategoryVisibility,
  CategoryCollection,
  findPublicCategoryCollection,
  findPublicCategoryCollections,
} from '../categories/category-collections';
import { buildProductOgCard, OG_CARD_HEIGHT, OG_CARD_WIDTH } from '../../common/utils/og-card';
import { computeLineTax } from '../../common/utils/tax';

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
  // Solo cuando se conocen (la tarjeta generada): Facebook/WhatsApp muestran la
  // miniatura grande al primer share en vez de esperar a descargar la imagen.
  imageSize?: { width: number; height: number };
  imageAlt?: string;
  // og:description / twitter:description, si debe diferir de la meta
  // description (p. ej. con el precio al inicio para la previsualización).
  ogDescription?: string;
  // Contenido +18: Google lo excluye de SafeSearch solo si va etiquetado.
  adult?: boolean;
  // p. ej. "noindex, follow" para categorías con muy pocos productos.
  robots?: string;
  // <meta> adicionales, ya escapados (p. ej. product:price:amount).
  extraHead?: string;
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
    return /bot|spider|crawl|whatsapp|facebookexternalhit|twitterbot|slackbot|telegrambot|discordbot|linkedinbot|googlebot|google-inspectiontool|googleother|chatgpt-user|perplexity-user|claude-user|meta-externalagent|mistralai-user|bingpreview|viber|skypeuripreview|iframely|embedly/i.test(
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

  // "<producto> en <tienda> — Merku": el nombre de la tienda capta búsquedas
  // de marca local. Se omite si el título pasaría de ~60 caracteres (Google
  // lo cortaría). Mantener igual a productPageTitle() del frontend.
  private productTitle(productName: string, storeName?: string | null): string {
    const withStore = storeName ? `${productName} en ${storeName} — Merku` : null;
    return withStore && withStore.length <= 60 ? withStore : `${productName} — Merku`;
  }

  private nav(): string {
    const f = this.escapeHtml(this.frontendUrl);
    return `<header><nav aria-label="Principal"><a href="${f}/home">Merku</a> · <a href="${f}/home">Productos</a> · <a href="${f}/categorias">Categorías</a> · <a href="${f}/stores">Tiendas</a> · <a href="${f}/stores/map">Mapa de tiendas</a> · <a href="${f}/bienvenida">Vende en Merku</a> · <a href="${f}/ayuda">Ayuda</a></nav></header>`;
  }

  private footer(): string {
    const f = this.escapeHtml(this.frontendUrl);
    return `<footer><p>Merku — marketplace de tiendas y restaurantes locales en Colombia.</p><p><a href="${f}/bienvenida">Vende en Merku</a> · <a href="${f}/ayuda">Centro de ayuda</a> · <a href="${f}/terminos">Términos y condiciones</a> · <a href="${f}/privacidad">Política de privacidad</a></p></footer>`;
  }

  private buildPage(params: PageParams): string {
    const { title, description, url, image, imageSize, imageAlt, ogDescription, adult, robots, extraHead, ogType, body, jsonLd } =
      params;
    const safeTitle = this.escapeHtml(title);
    const safeDescription = this.escapeHtml(description);
    const safeOgDescription = this.escapeHtml(ogDescription ?? description);
    const safeUrl = this.escapeHtml(url);
    const safeImage = this.escapeHtml(image);
    const safeImageAlt = this.escapeHtml(imageAlt ?? title);
    const imageType = /\/f_jpg[,/]|\.jpe?g$/i.test(image) ? 'image/jpeg' : /\.png$/i.test(image) ? 'image/png' : null;
    const imageMeta = [
      ...(image.startsWith('https://') ? [`<meta property="og:image:secure_url" content="${safeImage}">`] : []),
      ...(imageType ? [`<meta property="og:image:type" content="${imageType}">`] : []),
      ...(imageSize
        ? [
            `<meta property="og:image:width" content="${imageSize.width}">`,
            `<meta property="og:image:height" content="${imageSize.height}">`,
          ]
        : []),
      `<meta property="og:image:alt" content="${safeImageAlt}">`,
    ].join('\n');
    return `<!DOCTYPE html>
<html lang="es-CO">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
${adult ? '<meta name="rating" content="adult">\n' : ''}${robots ? `<meta name="robots" content="${this.escapeHtml(robots)}">\n` : ''}<link rel="canonical" href="${safeUrl}">
<meta property="og:type" content="${this.escapeHtml(ogType)}">
<meta property="og:site_name" content="Merku">
<meta property="og:locale" content="es_CO">
<meta property="og:url" content="${safeUrl}">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeOgDescription}">
<meta property="og:image" content="${safeImage}">
${imageMeta}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeOgDescription}">
<meta name="twitter:image" content="${safeImage}">
<meta name="twitter:image:alt" content="${safeImageAlt}">
${extraHead ?? ''}
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
      // El <h1> sin la marca: "— Merku" solo tiene sentido en el <title>.
      body: `<h1>${this.escapeHtml(title.replace(/ — Merku$/, ''))}</h1>
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

    // Título y descripción: mantener idénticos a STATIC_PAGE_META del Worker y
    // al <Helmet> de HomePage.tsx.
    const html = this.buildListingHtml({
      title: 'Tiendas y restaurantes locales en Medellín — Merku',
      description:
        'Compra en tiendas y restaurantes locales de Medellín desde un solo lugar: pide a domicilio o recoge en tienda y paga por transferencia. Explora Merku.',
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

    // Título y descripción: mantener idénticos a STATIC_PAGE_META del Worker y
    // al <Helmet> de StoresPage.tsx.
    const html = this.buildListingHtml({
      title: 'Directorio de tiendas locales en Medellín — Merku',
      description:
        'Conoce las tiendas y restaurantes locales de Medellín que venden en Merku: revisa su catálogo y ubicación y haz tu pedido a domicilio o para recoger.',
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
    // Sin control de lotes (trackBatches: false) nunca hay movimientos de
    // inventario: el catálogo los trata como disponibles (ver onlyAvailable en
    // ProductsService.findAll) y aquí debe ser igual, o Google los ve agotados.
    const inStock = !product.trackBatches || Number(stockRow?.stock ?? 0) > 0;
    const reviewCount = Number(ratingRow?.reviewCount ?? 0);
    const store = product.store;
    const storeUrl = store ? `${frontendUrl}/stores/${store.slug}` : null;
    const isAdult = !!store?.isAdultContent;
    // Precio final que paga el cliente (con IVA si el producto es "+ IVA"): es
    // el que exige Google y debe coincidir con merchant-feed.controller.ts.
    const finalPrice = computeLineTax(product.price, 1, product.taxMode, product.taxRate).unitPrice;
    const price = this.formatCOP(finalPrice);
    const hasDiscount =
      product.compareAtPrice != null && Number(product.compareAtPrice) > Number(product.price);
    const finalCompareAt = hasDiscount
      ? computeLineTax(product.compareAtPrice!, 1, product.taxMode, product.taxRate).unitPrice
      : null;
    const compareAtPrice = finalCompareAt != null ? this.formatCOP(finalCompareAt) : null;
    const discountPercent = finalCompareAt != null ? Math.round((1 - finalPrice / finalCompareAt) * 100) : null;

    // Tarjeta 1200x630 con foto + precio para WhatsApp/Facebook/X; si la foto no
    // está en Cloudinary se usa tal cual. En tiendas +18 la foto va desenfocada
    // (la previsualización la ve cualquiera en el chat, sin pasar el age gate).
    const ogCard = buildProductOgCard({
      imageUrl: images[0],
      name: product.name,
      storeName: store?.name,
      price,
      compareAtPrice,
      discountPercent,
      inStock,
      blur: isAdult,
    });
    const ogImage = ogCard ?? (isAdult ? null : images[0]) ?? `${frontendUrl}/og-image.png`;
    const e =(v: string) => this.escapeHtml(v);
    // Etiquetas Open Graph de producto: Facebook/Instagram, Pinterest y Slack
    // muestran precio y disponibilidad junto a la miniatura.
    const productMeta = [
      `<meta property="product:price:amount" content="${finalPrice}">`,
      '<meta property="product:price:currency" content="COP">',
      `<meta property="product:availability" content="${inStock ? 'in stock' : 'out of stock'}">`,
      '<meta property="product:condition" content="new">',
      `<meta property="product:retailer_item_id" content="${e(product.sku || product.id)}">`,
      ...(product.brand ? [`<meta property="product:brand" content="${e(product.brand)}">`] : []),
      ...(product.category?.name ? [`<meta property="product:category" content="${e(product.category.name)}">`] : []),
      ...(hasDiscount
        ? [
            `<meta property="product:sale_price:amount" content="${finalPrice}">`,
            '<meta property="product:sale_price:currency" content="COP">',
            `<meta property="product:original_price:amount" content="${finalCompareAt}">`,
            '<meta property="product:original_price:currency" content="COP">',
          ]
        : []),
      '<meta name="twitter:label1" content="Precio">',
      `<meta name="twitter:data1" content="${e(price)}">`,
      ...(store
        ? ['<meta name="twitter:label2" content="Vendido por">', `<meta name="twitter:data2" content="${e(store.name)}">`]
        : []),
    ].join('\n');

    // Ley 1480 art. 47: retracto de 5 días hábiles; no aplica a perecederos ni
    // a comida de restaurante (excepciones del mismo artículo).
    const returnsAllowed = !product.isPerishable && store?.storeType !== StoreType.RESTAURANT;
    const returnPolicyLd = returnsAllowed
      ? {
          '@type': 'MerchantReturnPolicy',
          applicableCountry: 'CO',
          returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
          merchantReturnDays: 5,
          returnMethod: 'https://schema.org/ReturnByMail',
          returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
          merchantReturnLink: `${frontendUrl}/terminos`,
        }
      : {
          '@type': 'MerchantReturnPolicy',
          applicableCountry: 'CO',
          returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
          merchantReturnLink: `${frontendUrl}/terminos`,
        };

    const description = this.metaDescription(
      product.description,
      store
        ? `${product.name} a ${price} en ${store.name}. Pide en línea en Merku.`
        : `${product.name} a ${price}. Pide en línea en Merku.`,
    );
    // Previsualización al compartir: precio primero, como MercadoLibre/Temu.
    const ogDescription = [
      hasDiscount ? `${price} (antes ${compareAtPrice}, -${discountPercent}%)` : price,
      inStock ? null : 'Agotado',
      store ? `Vendido por ${store.name}` : null,
      description,
    ]
      .filter(Boolean)
      .join(' · ');

    // Inicio › Categoría › Producto: la categoría es lo que la gente busca
    // ("impresoras") y Google muestra esta ruta en el resultado. Los productos
    // +18 no aparecen en páginas de categoría, así que conservan la ruta por tienda.
    const categorySlug = product.category?.name && !isAdult ? slugify(product.category.name) : '';
    const categoryUrl = categorySlug ? `${frontendUrl}/categorias/${categorySlug}` : null;
    const breadcrumbs = [
      { name: 'Inicio', url: `${frontendUrl}/home` },
      ...(categoryUrl
        ? [{ name: normalizeTitleCase(product.category!.name), url: categoryUrl }]
        : store && storeUrl
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
<p><strong>Precio:</strong> ${e(price)}${product.taxMode ? ' (IVA incluido)' : ''}${hasDiscount ? ` <s>${e(compareAtPrice ?? '')}</s>` : ''}</p>
<p><strong>Disponibilidad:</strong> ${inStock ? 'Disponible' : 'Agotado'}</p>
${product.brand ? `<p><strong>Marca:</strong> ${e(product.brand)}</p>` : ''}
${product.category?.name ? `<p><strong>Categoría:</strong> ${categoryUrl ? `<a href="${e(categoryUrl)}">${e(product.category.name)}</a>` : e(product.category.name)}</p>` : ''}
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
        price: finalPrice,
        availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        // Google muestra el precio anterior tachado junto al de oferta.
        ...(hasDiscount
          ? {
              priceSpecification: {
                '@type': 'UnitPriceSpecification',
                priceType: 'https://schema.org/StrikethroughPrice',
                price: finalCompareAt,
                priceCurrency: 'COP',
              },
            }
          : {}),
        hasMerchantReturnPolicy: returnPolicyLd,
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
        title: this.productTitle(product.name, store?.name),
        description,
        url,
        image: ogImage,
        ...(ogCard ? { imageSize: { width: OG_CARD_WIDTH, height: OG_CARD_HEIGHT } } : {}),
        imageAlt: `${product.name} — ${price}`,
        ogDescription,
        adult: isAdult,
        extraHead: productMeta,
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
        adult: !!store.isAdultContent,
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

  // "<Categoría> en Medellín — Merku" (búsqueda local) si cabe en 60
  // caracteres. Mantener igual a categoryPageTitle() de pageMeta.ts.
  private categoryTitle(name: string): string {
    const withCity = `${name} en Medellín — Merku`;
    return withCity.length <= 60 ? withCity : `${name} — Merku`;
  }

  // Texto con datos reales (cantidad, tiendas, rango de precios): es lo que
  // diferencia la página de un simple listado y lo que citan los buscadores
  // con IA. Mantener igual a categoryIntro() de pageMeta.ts.
  private categoryIntro(c: CategoryCollection): string {
    const stores = c.storeCount === 1 ? '1 tienda local' : `${c.storeCount} tiendas locales`;
    const products = c.productCount === 1 ? '1 producto' : `${c.productCount} productos`;
    const prices =
      c.minPrice != null && c.maxPrice != null
        ? c.minPrice === c.maxPrice
          ? ` a ${this.formatCOP(c.minPrice)}`
          : `, con precios desde ${this.formatCOP(c.minPrice)} hasta ${this.formatCOP(c.maxPrice)} (IVA incluido)`
        : '';
    return `En Merku encuentras ${products} de ${c.name.toLocaleLowerCase('es-CO')} de ${stores} de Medellín${prices}. Pide a domicilio o recoge en la tienda y paga directamente al vendedor por transferencia.`;
  }

  @Get('og/categories')
  async getCategoriesOg(@Req() req: Request, @Res() res: Response): Promise<void> {
    const ua = (req.headers['user-agent'] ?? '') as string;
    const frontendUrl = this.frontendUrl;
    const url = `${frontendUrl}/categorias`;

    if (!this.isBot(ua)) {
      res.redirect(302, url);
      return;
    }

    const collections = await findPublicCategoryCollections(this.products.manager);

    // Título y descripción: mantener idénticos a PAGE_META['/categorias'].
    const html = this.buildListingHtml({
      title: 'Categorías de productos en tiendas locales — Merku',
      description:
        'Explora por categoría los productos de las tiendas locales de Medellín en Merku y encuentra lo que buscas. Pide a domicilio o recoge en la tienda.',
      url,
      intro: 'Productos de tiendas y restaurantes locales de Medellín organizados por categoría.',
      items: collections.map((c) => ({
        name: c.name,
        subtitle: c.productCount === 1 ? '1 producto' : `${c.productCount} productos`,
        href: `${frontendUrl}/categorias/${c.slug}`,
      })),
    });

    res.type('html').send(html);
  }

  @Get('og/category/:slug')
  async getCategoryOg(@Param('slug') slug: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const ua = (req.headers['user-agent'] ?? '') as string;
    const frontendUrl = this.frontendUrl;
    const url = `${frontendUrl}/categorias/${encodeURIComponent(slug)}`;

    if (!this.isBot(ua)) {
      res.redirect(302, url);
      return;
    }

    const collection = await findPublicCategoryCollection(this.products.manager, slug);
    if (!collection) {
      this.sendNotFound(res);
      return;
    }

    const products = await applyPublicCategoryVisibility(
      this.products
        .createQueryBuilder('product')
        .innerJoin('product.category', 'category')
        .leftJoinAndSelect('product.store', 'store'),
    )
      .andWhere('product.categoryId IN (:...ids)', { ids: collection.categoryIds })
      .orderBy('product.createdAt', 'DESC')
      .take(100)
      .getMany();

    const e = (v: string) => this.escapeHtml(v);
    const title = this.categoryTitle(collection.name);
    const intro = this.categoryIntro(collection);
    const description = this.metaDescription(intro, `${collection.name} en tiendas locales de Medellín. Pide en Merku.`);
    const breadcrumbs = [
      { name: 'Inicio', url: `${frontendUrl}/home` },
      { name: 'Categorías', url: `${frontendUrl}/categorias` },
      { name: collection.name, url },
    ];
    const items = products.map((p) => ({
      name: p.name,
      href: `${frontendUrl}${buildProductPath(p.id, p.name)}`,
      price: this.formatCOP(computeLineTax(p.price, 1, p.taxMode, p.taxRate).unitPrice),
      store: p.store?.name ?? null,
      image: this.absoluteAssetUrl(p.imageUrl),
    }));
    const otherCategories = (await findPublicCategoryCollections(this.products.manager))
      .filter((c) => c.slug !== collection.slug)
      .slice(0, 12);

    const body = `<nav aria-label="Ruta de navegación"><ol>${breadcrumbs
      .map((b) => `<li><a href="${e(b.url)}">${e(b.name)}</a></li>`)
      .join('')}</ol></nav>
<h1>${e(collection.name)}</h1>
<p>${e(intro)}</p>
<ul>
${items
  .map(
    (p) =>
      `<li><a href="${e(p.href)}">${e(p.name)}</a> — ${e(p.price)}${p.store ? ` · ${e(p.store)}` : ''}</li>`,
  )
  .join('\n')}
</ul>
${
  otherCategories.length
    ? `<h2>Otras categorías</h2>\n<ul>\n${otherCategories
        .map((c) => `<li><a href="${e(`${frontendUrl}/categorias/${c.slug}`)}">${e(c.name)}</a></li>`)
        .join('\n')}\n</ul>`
    : ''
}`;

    const firstImage = items.find((i) => i.image)?.image;
    res.type('html').send(
      this.buildPage({
        title,
        description,
        url,
        image: firstImage ?? `${frontendUrl}/og-image.png`,
        robots: collection.indexable ? undefined : 'noindex, follow',
        ogType: 'website',
        body,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: title,
            description,
            url,
            inLanguage: 'es-CO',
            isPartOf: { '@id': `${frontendUrl}/#website` },
            ...(collection.lastModified ? { dateModified: collection.lastModified.toISOString() } : {}),
            mainEntity: {
              '@type': 'ItemList',
              numberOfItems: collection.productCount,
              itemListElement: items.map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: p.name,
                url: p.href,
              })),
            },
          },
          this.breadcrumbLd(breadcrumbs),
        ],
      }),
    );
  }
}
