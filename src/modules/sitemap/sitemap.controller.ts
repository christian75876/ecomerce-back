import { Controller, Get, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { Store } from '../stores/entities/store.entity';
import { Product } from '../products/entities/product.entity';
import { buildProductPath } from '../../common/utils/product-url';

// Google ignora <changefreq> y <priority>; lo que sí usa es <lastmod> (cuando
// es preciso) para decidir qué volver a rastrear.
const toLastmod = (date: Date | null | undefined): string =>
  date ? `<lastmod>${new Date(date).toISOString()}</lastmod>` : '';

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const STATIC_PATHS = ['/bienvenida', '/home', '/stores', '/stores/map', '/ayuda', '/terminos', '/privacidad'];

@Controller()
export class SitemapController {
  constructor(
    @InjectRepository(Store) private readonly stores: Repository<Store>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  @Get('sitemap.xml')
  async getSitemap(@Res() res: Response) {
    const base = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');

    // Productos de tiendas desactivadas responden 404 (ver og-preview): no
    // deben estar en el sitemap. Productos sin tienda (storeId null) sí.
    const [activeStores, activeProducts] = await Promise.all([
      this.stores.find({ where: { isActive: true } }),
      this.products
        .createQueryBuilder('product')
        .leftJoin('product.store', 'store')
        .where('product.isActive = true')
        .andWhere('(store.id IS NULL OR store.isActive = true)')
        .select(['product.id', 'product.name', 'product.updatedAt'])
        .getMany(),
    ]);

    const staticUrls = STATIC_PATHS.map((path) => `  <url><loc>${base}${path}</loc></url>`);

    const storeUrls = activeStores.map(
      (s) => `  <url><loc>${escapeXml(`${base}/stores/${s.slug}`)}</loc>${toLastmod(s.updatedAt)}</url>`,
    );

    const productUrls = activeProducts.map(
      (p) =>
        `  <url><loc>${escapeXml(`${base}${buildProductPath(p.id, p.name)}`)}</loc>${toLastmod(p.updatedAt)}</url>`,
    );

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...staticUrls,
      ...storeUrls,
      ...productUrls,
      '</urlset>',
    ].join('\n');

    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  }
}
