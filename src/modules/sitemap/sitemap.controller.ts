import { Controller, Get, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { Store } from '../stores/entities/store.entity';
import { Product } from '../products/entities/product.entity';

interface StaticRoute {
  path: string;
  changefreq: string;
  priority: string;
}

@Controller()
export class SitemapController {
  constructor(
    @InjectRepository(Store) private readonly stores: Repository<Store>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  @Get('sitemap.xml')
  async getSitemap(@Res() res: Response) {
    const base = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');

    const [activeStores, activeProducts] = await Promise.all([
      this.stores.find({ where: { isActive: true } }),
      this.products.find({ where: { isActive: true } }),
    ]);

    const staticRoutes: StaticRoute[] = [
      { path: '/bienvenida', changefreq: 'monthly', priority: '1.0' },
      { path: '/home',       changefreq: 'daily',   priority: '0.9' },
      { path: '/stores',     changefreq: 'daily',   priority: '0.9' },
      { path: '/stores/map', changefreq: 'daily',   priority: '0.7' },
      { path: '/ayuda',      changefreq: 'monthly', priority: '0.5' },
      { path: '/terminos',   changefreq: 'monthly', priority: '0.4' },
      { path: '/privacidad', changefreq: 'monthly', priority: '0.4' },
    ];

    const staticUrls = staticRoutes.map(
      (r) =>
        `  <url><loc>${base}${r.path}</loc><changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>`,
    );

    const storeUrls = activeStores.map(
      (s) => `  <url><loc>${base}/stores/${s.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    );

    const productUrls = activeProducts.map(
      (p) => `  <url><loc>${base}/product/${p.id}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
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
