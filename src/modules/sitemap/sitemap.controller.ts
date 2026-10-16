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

// Fecha del último cambio de contenido de las páginas estáticas. Actualizarla
// cuando cambie el texto de la página en el frontend; /terminos y /privacidad
// deben coincidir con LAST_UPDATED de TermsPage.tsx / PrivacyPage.tsx.
const STATIC_CONTENT_DATES: Record<string, string> = {
  '/bienvenida': '2026-10-15',
  '/ayuda': '2026-10-15',
  '/terminos': '2026-08-25',
  '/privacidad': '2026-08-25',
};

const latest = (dates: (Date | null | undefined)[]): Date | null =>
  dates.reduce<Date | null>((max, d) => (d && (!max || new Date(d) > max) ? new Date(d) : max), null);

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

    // /home y /stores (y el mapa) listan productos y tiendas: cambian cuando
    // cambia el último producto o tienda.
    const lastProductChange = latest(activeProducts.map((p) => p.updatedAt));
    const lastStoreChange = latest(activeStores.map((s) => s.updatedAt));
    const staticPages: [string, Date | null][] = [
      ['/bienvenida', new Date(STATIC_CONTENT_DATES['/bienvenida'])],
      ['/home', lastProductChange],
      ['/stores', lastStoreChange],
      ['/stores/map', lastStoreChange],
      ['/ayuda', new Date(STATIC_CONTENT_DATES['/ayuda'])],
      ['/terminos', new Date(STATIC_CONTENT_DATES['/terminos'])],
      ['/privacidad', new Date(STATIC_CONTENT_DATES['/privacidad'])],
    ];
    const staticUrls = staticPages.map(([path, date]) => `  <url><loc>${base}${path}</loc>${toLastmod(date)}</url>`);

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
