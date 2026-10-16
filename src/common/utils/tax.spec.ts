import { computeLineTax, summarizeTax } from './tax';

describe('computeLineTax', () => {
  it('sin IVA deja el precio igual y no discrimina impuesto', () => {
    expect(computeLineTax('2700000.00', 2, null, '19.00')).toEqual({
      unitPrice: 2700000,
      lineTotal: 5400000,
      taxRate: 0,
      taxAmount: 0,
    });
  });

  it('IVA incluido: cobra el precio tal cual y discrimina el IVA hacia atrás', () => {
    const line = computeLineTax(119000, 1, 'INCLUDED', 19);
    expect(line).toEqual({ unitPrice: 119000, lineTotal: 119000, taxRate: 19, taxAmount: 19000 });
  });

  it('+ IVA: suma el IVA al precio cobrado', () => {
    const line = computeLineTax('2700000.00', 2, 'EXCLUDED', '19.00');
    expect(line).toEqual({ unitPrice: 3213000, lineTotal: 6426000, taxRate: 19, taxAmount: 1026000 });
  });

  it('+ IVA redondea el precio unitario a pesos enteros', () => {
    expect(computeLineTax(1001, 3, 'EXCLUDED', 5).unitPrice).toBe(1051);
    expect(computeLineTax(1001, 3, 'EXCLUDED', 5).lineTotal).toBe(3153);
  });
});

describe('summarizeTax', () => {
  it('suma total e IVA de varias líneas', () => {
    const lines = [
      computeLineTax(119000, 1, 'INCLUDED', 19),
      computeLineTax(50000, 2, null, 19),
    ];
    expect(summarizeTax(lines)).toEqual({ total: 219000, taxTotal: 19000 });
  });

  it('prorratea el IVA cuando hay descuento de cupón', () => {
    const lines = [computeLineTax(119000, 2, 'INCLUDED', 19)]; // 238.000, IVA 38.000
    expect(summarizeTax(lines, 23800)).toEqual({ total: 214200, taxTotal: 34200 });
  });

  it('nunca deja el total en negativo', () => {
    const lines = [computeLineTax(10000, 1, 'INCLUDED', 19)];
    expect(summarizeTax(lines, 50000)).toEqual({ total: 0, taxTotal: 0 });
  });
});
