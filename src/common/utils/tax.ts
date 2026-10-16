/**
 * Cálculo de IVA por línea — única fuente de verdad para pedidos (orders) y
 * ventas POS (sales). El frontend tiene una copia en src/shared/utils/tax.ts
 * solo para mostrar totales antes de confirmar; el valor cobrado sale de aquí.
 *
 * - INCLUDED ("IVA incluido"): el precio ya trae el IVA; se discrimina hacia atrás.
 * - EXCLUDED ("+ IVA"): el IVA se suma al precio; el precio unitario cobrado se
 *   redondea a pesos enteros.
 * - null: el producto no lleva IVA.
 *
 * `unitPrice` y `lineTotal` son siempre lo que paga el cliente (con IVA), así
 * caja, créditos y reportes siguen sumando `total` sin cambios.
 */
export type TaxMode = 'INCLUDED' | 'EXCLUDED';

export interface LineTax {
  unitPrice: number;
  lineTotal: number;
  taxRate: number;
  taxAmount: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function computeLineTax(
  price: number | string,
  quantity: number,
  taxMode: TaxMode | null | undefined,
  taxRate: number | string | null | undefined,
): LineTax {
  const basePrice = Number(price);
  const rate = taxMode ? Number(taxRate ?? 0) : 0;

  if (!taxMode || !(rate > 0)) {
    return { unitPrice: basePrice, lineTotal: round2(basePrice * quantity), taxRate: 0, taxAmount: 0 };
  }

  if (taxMode === 'EXCLUDED') {
    const unitPrice = Math.round(basePrice * (1 + rate / 100));
    const lineTotal = unitPrice * quantity;
    return { unitPrice, lineTotal, taxRate: rate, taxAmount: round2(lineTotal - basePrice * quantity) };
  }

  const lineTotal = round2(basePrice * quantity);
  return {
    unitPrice: basePrice,
    lineTotal,
    taxRate: rate,
    taxAmount: round2(lineTotal - lineTotal / (1 + rate / 100)),
  };
}

/**
 * Total final e IVA del documento. Un descuento (cupón) sobre el total también
 * reduce la base gravable, así que el IVA se prorratea en la misma proporción.
 * La base sin IVA es `total - taxTotal`.
 */
export function summarizeTax(lines: LineTax[], discountAmount = 0): { total: number; taxTotal: number } {
  const gross = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const tax = lines.reduce((sum, line) => sum + line.taxAmount, 0);
  const total = Math.max(0, round2(gross - discountAmount));
  const taxTotal = gross > 0 ? round2((tax * total) / gross) : 0;
  return { total, taxTotal };
}
