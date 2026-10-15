import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, Response } from 'express';
import { Store } from '../stores/entities/store.entity';
import { Product } from '../products/entities/product.entity';

@Controller()
export class OgPreviewController {
  constructor(
    @InjectRepository(Store) private readonly stores: Repository<Store>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  private get frontendUrl(): string {
    return (process.env.FRONTEND_URL ?? 'https://merku.co').replace(/\/$/, '');
  }

  private isBot(ua: string): boolean {
    return /bot|spider|crawl|whatsapp|facebookexternalhit|twitterbot|slackbot|telegrambot|discordbot|linkedinbot|googlebot/i.test(
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

  // A diferencia de buildHtml() (pensado para que redes sociales lean solo las
  // etiquetas OG y sigan el meta-refresh), esto es para Googlebot en /home y
  // /stores: el <body> de la SPA está vacío hasta que corre el JS
  // (`<div id="root"></div>`), y Search Console marcó esas rutas como "Soft
  // 404" — el algoritmo evalúa el contenido visible, no solo los metadatos.
  // Esto le da contenido real (productos/tiendas de verdad) desde el primer
  // byte. No es cloaking: es la misma información que vería un usuario real
  // una vez carga la SPA, servida como "dynamic rendering" (lo que Google
  // mismo recomienda para sitios con mucho JS), no contenido distinto u oculto.
  private buildListingHtml(params: {
    title: string;
    description: string;
    url: string;
    intro: string;
    items: { name: string; subtitle?: string; href: string }[];
  }): string {
    const { title, description, url, intro, items } = params;
    const frontendUrl = this.frontendUrl;
    const safeTitle = this.escapeHtml(title);
    const safeDescription = this.escapeHtml(description);
    const safeUrl = this.escapeHtml(url);
    const safeIntro = this.escapeHtml(intro);
    // href se construye acá mismo con frontendUrl + un id (uuid) o slug
    // (restringido a [a-z0-9-] por @Matches en create-store.dto.ts) — no hay
    // texto libre en esa parte, pero se escapa de todas formas por si ese
    // contrato cambia más adelante.
    const itemsHtml = items
      .map((i) => {
        const name = this.escapeHtml(i.name);
        const href = this.escapeHtml(i.href);
        const subtitle = i.subtitle ? ` — ${this.escapeHtml(i.subtitle)}` : '';
        return `<li><a href="${href}">${name}</a>${subtitle}</li>`;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<link rel="canonical" href="${safeUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Merku">
<meta property="og:url" content="${safeUrl}">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:image" content="${this.escapeHtml(frontendUrl)}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
</head>
<body>
<h1>${safeTitle}</h1>
<p>${safeIntro}</p>
<ul>
${itemsHtml}
</ul>
</body>
</html>`;
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

    const products = await this.products.find({
      where: { isActive: true },
      relations: { store: true },
      order: { createdAt: 'DESC' },
      take: 24,
    });

    const html = this.buildListingHtml({
      title: 'Merku — Encuentra lo que buscas',
      description:
        'Merku: explora cientos de productos de tiendas locales. Encuentra lo que necesitas al mejor precio.',
      url: spaUrl,
      intro: 'Explora productos de tiendas locales en Merku.',
      items: products.map((p) => ({
        name: p.name,
        subtitle: p.store?.name ? `${this.formatCOP(p.price)} · ${p.store.name}` : this.formatCOP(p.price),
        href: `${frontendUrl}/product/${p.id}`,
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
      intro: 'Tiendas y restaurantes disponibles en Merku.',
      items: stores.map((s) => ({
        name: s.name,
        subtitle: s.description ? s.description.slice(0, 120) : undefined,
        href: `${frontendUrl}/stores/${s.slug}`,
      })),
    });

    res.type('html').send(html);
  }

  private buildHtml(params: {
    title: string;
    description: string;
    image: string;
    type: string;
    url: string;
    spaUrl: string;
  }): string {
    // title/description vienen de texto libre que el vendedor escribe para su
    // producto/tienda (sin restricción de caracteres) — sin escapar, un nombre
    // o descripción con comillas/"<script>" podía romper fuera del atributo e
    // inyectar HTML/JS en una página que sirve este backend a cualquier bot o
    // persona que fuerce un user-agent de bot.
    const { title, description, image, type, url, spaUrl } = params;
    const safeTitle = this.escapeHtml(title);
    const safeDescription = this.escapeHtml(description);
    const safeImage = this.escapeHtml(image);
    const safeType = this.escapeHtml(type);
    const safeUrl = this.escapeHtml(url);
    const safeSpaUrl = this.escapeHtml(spaUrl);
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<meta property="og:type" content="${safeType}">
<meta property="og:site_name" content="Merku">
<meta property="og:url" content="${safeUrl}">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:image" content="${safeImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${safeImage}">
<meta http-equiv="refresh" content="0;url=${safeSpaUrl}">
</head>
<body><a href="${safeSpaUrl}">Ver en Merku</a></body>
</html>`;
  }

  @Get('og/product/:id')
  async getProductOg(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const ua = (req.headers['user-agent'] ?? '') as string;
    const frontendUrl = this.frontendUrl;
    const spaUrl = `${frontendUrl}/product/${id}`;

    if (!this.isBot(ua)) {
      res.redirect(302, spaUrl);
      return;
    }

    const product = await this.products.findOne({ where: { id } });
    if (!product) {
      res.redirect(302, frontendUrl);
      return;
    }

    const description = product.description
      ? product.description.slice(0, 155)
      : `Disponible en Merku por ${this.formatCOP(product.price)}`;

    const html = this.buildHtml({
      title: `${product.name} — Merku`,
      description,
      image: product.imageUrl || `${frontendUrl}/og-image.png`,
      type: 'product',
      url: spaUrl,
      spaUrl,
    });

    res.type('html').send(html);
  }

  @Get('og/store/:slug')
  async getStoreOg(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const ua = (req.headers['user-agent'] ?? '') as string;
    const frontendUrl = this.frontendUrl;
    const spaUrl = `${frontendUrl}/stores/${slug}`;

    if (!this.isBot(ua)) {
      res.redirect(302, spaUrl);
      return;
    }

    const store = await this.stores.findOne({ where: { slug } });
    if (!store) {
      res.redirect(302, frontendUrl);
      return;
    }

    const description =
      store.description || `Explora los productos de ${store.name} en Merku.`;
    const image =
      store.bannerUrl || store.logoUrl || `${frontendUrl}/og-image.png`;

    const html = this.buildHtml({
      title: `${store.name} — Merku`,
      description,
      image,
      type: 'website',
      url: spaUrl,
      spaUrl,
    });

    res.type('html').send(html);
  }
}
