import { Controller, Get, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { StoreType } from '../stores/entities/store.entity';
import { Product } from '../products/entities/product.entity';
import { buildProductPath } from '../../common/utils/product-url';
import { computeLineTax } from '../../common/utils/tax';
import { normalizeSentenceCase, normalizeTitleCase } from '../../common/utils/text-case';

// Feed de productos para Google Merchant Center (fichas gratuitas en la pestaña
// Shopping y, si algún día se activan, anuncios de Shopping). Formato RSS 2.0
// con el espacio de nombres g: — https://support.google.com/merchants/answer/7052112
//
// El Worker lo publica en https://merku.co/merchant-feed.xml (Merchant Center
// lo descarga una vez al día desde ahí; api.merku.co bloquea todo en robots.txt).
//
// Debe coincidir con la ficha que Google rastrea (og-preview.controller.ts):
// mismo precio con IVA, misma disponibilidad y misma URL canónica, o Google
// rechaza el artículo por "precio/disponibilidad no coinciden".

// Restaurantes: comida preparada a domicilio no encaja en Shopping (y no es un
// producto con envío). Tiendas +18: Shopping restringe el contenido para
// adultos según país; se dejan fuera hasta revisarlo caso por caso.
const EXCLUDED_STORE_TYPES = [StoreType.RESTAURANT];

const escapeXml = (value: string): string =>
  value
    // Caracteres de control que XML 1.0 no admite (texto pegado por vendedores).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const tag = (name: string, value: string | number | null | undefined): string =>
  value === null || value === undefined || value === '' ? '' : `<g:${name}>${escapeXml(String(value))}</g:${name}>`;

const formatPrice = (value: number): string => `${value.toFixed(2)} COP`;

@Controller()
export class MerchantFeedController {
  constructor(@InjectRepository(Product) private readonly products: Repository<Product>) {}

  private get frontendUrl(): string {
    return (process.env.FRONTEND_URL ?? 'https://merku.co').replace(/\/$/, '');
  }

  private get apiPublicUrl(): string {
    return (process.env.API_PUBLIC_URL ?? 'https://api.merku.co').replace(/\/$/, '');
  }

  private absoluteAssetUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.apiPublicUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  @Get('merchant-feed.xml')
  async getFeed(@Res() res: Response): Promise<void> {
    const frontendUrl = this.frontendUrl;
    const manager = this.products.manager;

    const products = await this.products
      .createQueryBuilder('product')
      .innerJoinAndSelect('product.store', 'store')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.isActive = true')
      .andWhere('store.isActive = true')
      .andWhere('store.isAdultContent = false')
      .andWhere('store.storeType NOT IN (:...excluded)', { excluded: EXCLUDED_STORE_TYPES })
      // Sin foto Google rechaza el artículo (image_link es obligatorio).
      .andWhere("product.imageUrl IS NOT NULL AND product.imageUrl <> ''")
      .getMany();

    const ids = products.map((p) => p.id);
    const [imageRows, stockRows] = ids.length
      ? await Promise.all([
          manager
            .createQueryBuilder()
            .select('img.product_id', 'productId')
            .addSelect('img.image_url', 'imageUrl')
            .from('product_images', 'img')
            .where('img.product_id IN (:...ids)', { ids })
            .orderBy('img.product_id')
            .addOrderBy('"img"."order"', 'ASC')
            .getRawMany<{ productId: string; imageUrl: string }>(),
          // Misma fuente de stock que og-preview (la ficha que Google rastrea).
          manager
            .createQueryBuilder()
            .select('batch.product_id', 'productId')
            .addSelect('COALESCE(SUM(batch.available_quantity), 0)', 'stock')
            .from('inventory_batches', 'batch')
            .where('batch.product_id IN (:...ids)', { ids })
            .groupBy('batch.product_id')
            .getRawMany<{ productId: string; stock: string }>(),
        ])
      : [[], []];

    const galleryByProduct = new Map<string, string[]>();
    for (const row of imageRows) {
      const list = galleryByProduct.get(row.productId) ?? [];
      list.push(row.imageUrl);
      galleryByProduct.set(row.productId, list);
    }
    const stockByProduct = new Map(stockRows.map((r) => [r.productId, Number(r.stock)]));

    const items = products.map((product) => {
      const store = product.store!;
      const link = `${frontendUrl}${buildProductPath(product.id, product.name)}`;
      const images = [product.imageUrl, ...(galleryByProduct.get(product.id) ?? [])]
        .map((p) => this.absoluteAssetUrl(p))
        .filter((p, i, all): p is string => !!p && all.indexOf(p) === i);

      // Precio final con IVA (en Colombia Merchant Center lo exige así).
      const salePrice = computeLineTax(product.price, 1, product.taxMode, product.taxRate).unitPrice;
      const listPrice =
        product.compareAtPrice != null && Number(product.compareAtPrice) > Number(product.price)
          ? computeLineTax(product.compareAtPrice, 1, product.taxMode, product.taxRate).unitPrice
          : null;

      const title = normalizeTitleCase(product.name).slice(0, 150);
      const rawDescription = (product.description ?? '').trim();
      const description = (
        rawDescription
          ? normalizeSentenceCase(rawDescription)
          : `${title} en ${store.name}. Pide en línea en Merku con domicilio o recogida en tienda.`
      ).slice(0, 5000);
      // Sin control de lotes = siempre disponible (igual que el catálogo y og-preview).
      const inStock = !product.trackBatches || (stockByProduct.get(product.id) ?? 0) > 0;

      return [
        '<item>',
        tag('id', product.id),
        tag('title', title),
        tag('description', description),
        tag('link', link),
        tag('image_link', images[0]),
        // Fotos tal cual (sin la tarjeta con precio de og:image): Google
        // rechaza image_link con texto o marcas promocionales superpuestas.
        ...images.slice(1, 11).map((src) => tag('additional_image_link', src)),
        tag('availability', inStock ? 'in_stock' : 'out_of_stock'),
        // Con descuento: price = precio anterior, sale_price = precio actual.
        tag('price', formatPrice(listPrice ?? salePrice)),
        listPrice ? tag('sale_price', formatPrice(salePrice)) : '',
        tag('condition', 'new'),
        tag('brand', product.brand ? normalizeTitleCase(product.brand).slice(0, 70) : null),
        // No hay GTIN (código de barras) en el modelo todavía.
        tag('identifier_exists', 'no'),
        tag('product_type', product.category?.name),
        // Obligatorio en cuentas de marketplace: identifica al vendedor real.
        tag('external_seller_id', store.slug.slice(0, 50)),
        tag('custom_label_0', store.name.slice(0, 100)),
        '</item>',
      ]
        .filter(Boolean)
        .join('');
    });

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
      '<channel>',
      '<title>Merku</title>',
      `<link>${escapeXml(frontendUrl)}</link>`,
      '<description>Productos de tiendas locales en Merku</description>',
      ...items,
      '</channel>',
      '</rss>',
    ].join('\n');

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  }
}
