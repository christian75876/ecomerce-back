import { isMostlyUppercase, normalizeSentenceCase, normalizeTitleCase } from './text-case';
import { buildProductOgCard } from './og-card';

describe('normalizeTitleCase', () => {
  it('pasa un nombre en mayúsculas a título y respeta modelos con dígitos', () => {
    expect(normalizeTitleCase('IMPRESORA EPSON L3210 DE TINTA CONTINUA')).toBe('Impresora Epson L3210 de Tinta Continua');
  });

  it('mantiene siglas y tallas en mayúsculas', () => {
    expect(normalizeTitleCase('TV LED 4K 55 PULGADAS')).toBe('TV LED 4K 55 Pulgadas');
    expect(normalizeTitleCase('CAMISETA POLO TALLA XL')).toBe('Camiseta Polo Talla XL');
  });

  it('respeta acentos, eñes y signos al inicio de palabra', () => {
    expect(normalizeTitleCase('ZAPATOS (NIÑO) ÚLTIMA TALLA')).toBe('Zapatos (Niño) Última Talla');
  });

  it('no toca nombres que ya vienen bien escritos', () => {
    expect(normalizeTitleCase('iPhone 15 Pro')).toBe('iPhone 15 Pro');
    expect(normalizeTitleCase('Camiseta Polo para Hombre')).toBe('Camiseta Polo para Hombre');
  });
});

describe('normalizeSentenceCase', () => {
  it('pasa una descripción en mayúsculas a frases', () => {
    expect(normalizeSentenceCase('IMPRIME Y COPIA. INCLUYE LA PRIMERA RECARGA')).toBe('Imprime y copia. Incluye la primera recarga');
  });

  it('no toca descripciones con mayúsculas normales', () => {
    expect(normalizeSentenceCase('Impresora EPSON con tinta continua.')).toBe('Impresora EPSON con tinta continua.');
  });
});

describe('isMostlyUppercase', () => {
  it('ignora textos muy cortos', () => {
    expect(isMostlyUppercase('TV')).toBe(false);
  });
});

describe('buildProductOgCard', () => {
  const imageUrl = 'https://res.cloudinary.com/demo/image/upload/v1/marketplace/products/abc.jpg';

  it('inserta la transformación tras /upload/ y entrega JPG de 1200x630', () => {
    const url = buildProductOgCard({ imageUrl, name: 'Impresora', price: '$ 764.900', inStock: true })!;
    expect(url).toContain('/upload/c_pad,w_560,h_560,b_white/');
    expect(url).toContain('w_1200,h_630');
    expect(url).toContain('/f_jpg,q_auto:good/v1/marketplace/products/abc.jpg');
  });

  it('codifica dos veces comas y barras del texto (si no, rompen la transformación)', () => {
    const url = buildProductOgCard({ imageUrl, name: 'Tinta, negra / color', price: '1', inStock: true })!;
    expect(url).toContain('Tinta%252C%20negra%20%252F%20color');
  });

  it('devuelve null si la imagen no está en Cloudinary', () => {
    expect(buildProductOgCard({ imageUrl: '/uploads/x.jpg', name: 'x', price: '1', inStock: true })).toBeNull();
  });
});
