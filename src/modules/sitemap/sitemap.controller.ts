import { Controller, Get, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { Store } from '../stores/entities/store.entity';
import { Product } from '../products/entities/product.entity';

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

    const staticRoutes = ['/', '/stores', '/stores/map', '/help'];

    const storeUrls = activeStores.map(
      (s) => `  <url><loc>${base}/stores/${s.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    );

    const productUrls = activeProducts.map(
      (p) => `  <url><loc>${base}/products/${p.id}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    );

    const staticUrls = staticRoutes.map(
      (r) => `  <url><loc>${base}${r}</loc><changefreq>daily</changefreq><priority>${r === '/' ? '1.0' : '0.6'}</priority></url>`,
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
