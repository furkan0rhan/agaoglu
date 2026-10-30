import { Batch, Product } from '../../../shared/models/product.model';
import { cartItemFromProduct, findByCode, sellableStock } from './cart-item.utils';

const ts = (ms: number) => ({ toMillis: () => ms }) as unknown as Batch['expiryDate'];
const batch = (id: string, quantity: number, exp: number | null, gtsNo: string | null = null): Batch =>
  ({ id, quantity, expiryDate: exp == null ? null : ts(exp), gtsNo, addedAt: ts(0) as never, supplierId: null });
const product = (id: string, extra: Partial<Product> = {}): Product =>
  ({ id, name: id, barcode: '', stock: 3, batches: [], purchasePrice: 5, salePrice: 10, category: '', isActive: true, ...extra }) as Product;

describe('findByCode', () => {
  const a = product('A', { barcode: '8690001' });
  const b = product('B', { batches: [batch('b1', 1, null, 'GTS-1'), batch('b2', 0, null, 'GTS-SOLD')] });
  const passive = product('P', { barcode: '777', isActive: false });

  it('önce ürün barkodu, sonra stoktaki GTS', () => {
    expect(findByCode([a, b], '8690001')).toEqual({ product: a, gtsNo: null });
    expect(findByCode([a, b], ' GTS-1 ')).toEqual({ product: b, gtsNo: 'GTS-1' });
  });
  it('satılmış GTS, pasif ürün ve boş kod bulunmaz', () => {
    expect(findByCode([a, b], 'GTS-SOLD')).toBeNull();
    expect(findByCode([passive], '777')).toBeNull();
    expect(findByCode([a, b], '')).toBeNull();
  });
});

describe('sellableStock / cartItemFromProduct', () => {
  const now = 10_000_000_000;
  it('bitki koruma ürününde SKT geçmiş birimler satılabilir stoktan düşer', () => {
    const p = product('I', { productType: 'bitki_koruma', stock: 3, batches: [batch('old', 2, 1000), batch('ok', 1, null)] });
    expect(sellableStock(p, now)).toBe(1);
    const other = product('G', { productType: 'gubre', stock: 3, batches: [batch('old', 2, 1000), batch('ok', 1, null)] });
    expect(sellableStock(other, now)).toBe(3);
  });
  it('okutulan GTS ve reçete bayrağı kaleme yazılır', () => {
    const p = product('I', { productType: 'bitki_koruma', batches: [batch('x', 1, null, 'G9')] });
    const item = cartItemFromProduct(p, 'G9');
    expect(item.gtsNos).toEqual(['G9']);
    expect(item.requiresPrescription).toBe(true);
    expect(cartItemFromProduct(product('X')).gtsNos).toBeUndefined();
  });
});
