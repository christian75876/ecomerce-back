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

  private buildHtml(params: {
    title: string;
    description: string;
    image: string;
    type: string;
    url: string;
    spaUrl: string;
  }): string {
    const { title, description, image, type, url, spaUrl } = params;
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="Merku">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
<meta http-equiv="refresh" content="0;url=${spaUrl}">
</head>
<body><a href="${spaUrl}">Ver en Merku</a></body>
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
      image: product.imageUrl || `${frontendUrl}/og-image.svg`,
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
      store.bannerUrl || store.logoUrl || `${frontendUrl}/og-image.svg`;

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
