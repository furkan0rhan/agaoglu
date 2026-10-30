import {
  allocateFEFO, generateSaleNumber, isDecimalUnit, lineAmounts, normalizeQty, productUnit, resolveProduct, restoreBatches,
  round2, splitInstallments, takenGtsNos, takenLotNos, toSaleItem,
} from './sale.utils';
import { Batch, Product } from '../../../shared/models/product.model';

const ts = (ms: number) => ({ toMillis: () => ms }) as unknown as Batch['expiryDate'];
const batch = (id: string, quantity: number, exp: number | null, gtsNo: string | null = null): Batch =>
  ({ id, quantity, expiryDate: exp == null ? null : ts(exp), gtsNo, addedAt: ts(0) as never, supplierId: null });
const product = (id: string, barcode: string, extra: Partial<Product> = {}): Product =>
  ({ id, barcode, name: id, stock: 10, batches: [], purchasePrice: 5, salePrice: 10, ...extra }) as Product;

describe('resolveProduct (1.2)', () => {
  const a = product('A', '');
  const b = product('B', '');
  const c = product('C', '869000');

  it('barkodsuz iki üründe productId ile doğru ürünü bulur', () => {
    expect(resolveProduct({ productId: 'B', barcode: '' }, [a, b, c])?.id).toBe('B');
    expect(resolveProduct({ productId: 'A', barcode: '' }, [a, b, c])?.id).toBe('A');
  });

  it('productId yoksa boş barkodla eşleştirmez', () => {
    expect(resolveProduct({ productId: 'X', barcode: '' }, [a, b])).toBeNull();
    expect(resolveProduct({ productId: 'X', barcode: '   ' }, [a, b])).toBeNull();
  });

  it('productId yoksa dolu barkoda düşer', () => {
    expect(resolveProduct({ productId: 'X', barcode: '869000' }, [a, b, c])?.id).toBe('C');
  });
});

describe('allocateFEFO', () => {
  it('en yakın SKT önce düşülür, alınan partiler raporlanır', () => {
    const r = allocateFEFO([batch('late', 5, 2000), batch('none', 5, null), batch('early', 2, 1000, 'G1')], 4);
    expect(r.taken).toEqual([
      { batchId: 'early', quantity: 2, gtsNo: 'G1', expiryDate: expect.anything() },
      { batchId: 'late', quantity: 2, gtsNo: null, expiryDate: expect.anything() },
    ]);
    expect(r.remaining.map(b => [b.id, b.quantity])).toEqual([['late', 3], ['none', 5]]);
  });

  it('süresi geçmiş kullanım ve parti yetersizliği raporlanır', () => {
    const now = 10_000_000_000;
    const r = allocateFEFO([batch('old', 2, 1000), batch('none', 1, null)], 5, now);
    expect(r.expiredUsed).toBe(2);
    expect(r.shortfall).toBe(2);
    expect(r.remaining).toEqual([]);
  });
});

describe('restoreBatches (iptal)', () => {
  it('satılan partileri geri koyar, eksik kalanı GTS siz yeni parti yapar', () => {
    const current = [batch('late', 3, 2000)];
    const out = restoreBatches(current, {
      quantity: 5,
      batches: [
        { batchId: 'late', quantity: 2, gtsNo: null, expiryDate: null },
        { batchId: 'early', quantity: 2, gtsNo: 'G1', expiryDate: null },
      ],
    }, ts(0) as never, () => 'new');
    expect(out.find(b => b.id === 'late')?.quantity).toBe(5);
    expect(out.find(b => b.id === 'early')).toMatchObject({ quantity: 2, gtsNo: 'G1' });
    expect(out.find(b => b.id === 'new')).toMatchObject({ quantity: 1, gtsNo: null });
    expect(current[0].quantity).toBe(3); // girdi değişmez
  });
});

describe('generateSaleNumber (2.4)', () => {
  it('biçim S-YYYYMMDD-HHMMSS-UID4-RND', () => {
    expect(generateSaleNumber(new Date(2026, 9, 27, 9, 5, 7), 'abCdef123', 'XYZ')).toBe('S-20261027-090507-ABCD-XYZ');
  });
  it('aynı saniyede farklı numara üretir', () => {
    const d = new Date();
    const set = new Set(Array.from({ length: 50 }, () => generateSaleNumber(d, 'uid1')));
    expect(set.size).toBeGreaterThan(45);
  });
});

describe('lineAmounts / round2', () => {
  it('yüzde indirim kuruşa yuvarlanır', () => {
    expect(lineAmounts({ unitPrice: 10.1, quantity: 3, discount: 10, discountType: 'percent' }))
      .toEqual({ gross: 30.3, discount: 3.03, total: 27.27 });
  });
  it('tutar indirimi brütü aşmaz', () => {
    expect(lineAmounts({ unitPrice: 5, quantity: 1, discount: 9, discountType: 'amount' }).total).toBe(0);
  });
  it('round2', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
  });
});

describe('splitInstallments', () => {
  it('kuruş farkını son taksite yazar, toplam korunur (3 x 575,67 hatası)', () => {
    const plan = splitInstallments(1727, 3);
    expect(plan).toEqual([575.66, 575.66, 575.68]);
    expect(round2(plan.reduce((a, b) => a + b, 0))).toBe(1727);
  });

  it('tam bölünende eşit taksit', () => {
    expect(splitInstallments(1200, 12)).toEqual(Array(12).fill(100));
  });

  it('küçük tutarda negatif taksit oluşmaz', () => {
    const plan = splitInstallments(0.1, 12);
    expect(plan.every(x => x >= 0)).toBe(true);
    expect(round2(plan.reduce((a, b) => a + b, 0))).toBe(0.1);
  });

  it('taksit sayısı 1 veya geçersizse tek parça', () => {
    expect(splitInstallments(99.99, 1)).toEqual([99.99]);
    expect(splitInstallments(50, 0)).toEqual([50]);
  });
});

describe('birim / ondalıklı miktar', () => {
  it('kg / lt / metre ondalıklı, diğerleri tam sayı', () => {
    expect(isDecimalUnit('kg')).toBe(true);
    expect(isDecimalUnit('metre')).toBe(true);
    expect(isDecimalUnit('cuval')).toBe(false);
    expect(isDecimalUnit(null)).toBe(false);
  });

  it('normalizeQty birime göre yuvarlar', () => {
    expect(normalizeQty(12.456, 'kg')).toBe(12.46);
    expect(normalizeQty(0.1 + 0.2, 'lt')).toBe(0.3);
    expect(normalizeQty(12.9, 'adet')).toBe(12);
    expect(normalizeQty(3.5, null)).toBe(3);
    expect(normalizeQty(-2, 'kg')).toBe(0);
    expect(normalizeQty(Number.NaN, 'kg')).toBe(0);
  });

  it('productUnit tanınmayan birimi yok sayar', () => {
    expect(productUnit(product('A', '', { unit: 'kg' } as Partial<Product>))).toBe('kg');
    expect(productUnit(product('A', '', { unit: 'ton' } as unknown as Partial<Product>))).toBeNull();
    expect(productUnit(product('A', ''))).toBeNull();
  });

  it('ondalıklı miktarda satır tutarı kuruşa yuvarlı', () => {
    expect(lineAmounts({ unitPrice: 18.4, quantity: 12.5, discount: 0, discountType: 'percent' }).total).toBe(230);
    expect(lineAmounts({ unitPrice: 9.99, quantity: 0.33, discount: 0, discountType: 'percent' }).total).toBe(3.3);
  });
});

describe('allocateFEFO — GTS seçimi (2.11)', () => {
  it('okutulan GTS, FEFO sırası beklenmeden düşülür; kalan FEFO ile tamamlanır', () => {
    const batches = [batch('early', 1, 1000, 'G-EARLY'), batch('late', 1, 5000, 'G-LATE'), batch('bulk', 3, null)];
    const r = allocateFEFO(batches, 2, 0, { preferredGts: ['G-LATE'] });
    expect(r.taken.map(t => t.batchId).sort()).toEqual(['early', 'late']);
    expect(takenGtsNos(r.taken).sort()).toEqual(['G-EARLY', 'G-LATE']);
    expect(r.missingGts).toEqual([]);
    expect(r.remaining.map(b => b.id)).toEqual(['bulk']);
  });

  it('stokta olmayan GTS raporlanır', () => {
    const r = allocateFEFO([batch('a', 1, null, 'G1')], 1, 0, { preferredGts: ['YOK'] });
    expect(r.missingGts).toEqual(['YOK']);
    expect(r.taken.map(t => t.gtsNo)).toEqual(['G1']);
  });

  it('skipExpired: süresi geçmiş parti kullanılmaz, eksik kısım expiredBlocked olur', () => {
    const now = 10_000_000_000;
    const r = allocateFEFO([batch('old', 2, 1000, null), batch('ok', 1, null)], 2, now, { skipExpired: true });
    expect(r.expiredUsed).toBe(0);
    expect(r.taken.map(t => t.batchId)).toEqual(['ok']);
    expect(r.shortfall).toBe(1);
    expect(r.expiredBlocked).toBe(1);
  });

  it('skipExpired: okutulan GTS süresi geçmişse expiredGts', () => {
    const now = 10_000_000_000;
    const r = allocateFEFO([batch('old', 1, 1000, 'G-OLD'), batch('ok', 1, null, 'G-OK')], 1, now,
      { preferredGts: ['G-OLD'], skipExpired: true });
    expect(r.expiredGts).toEqual(['G-OLD']);
    expect(r.taken.map(t => t.gtsNo)).toEqual(['G-OK']);
  });
});

describe('toSaleItem — mevzuat alanları', () => {
  const cartItem = { productId: 'A', productName: 'A', barcode: '', quantity: 1, unitPrice: 10, discount: 0,
    discountType: 'percent' as const, totalPrice: 10, _tempId: 't', stock: 5 };
  it('reçeteli kalemde reçete no ve ruhsat no, GTS listesi yazılır', () => {
    const p = product('A', '', { licenseNo: 'R-1' });
    const out = toSaleItem(cartItem, p, [{ batchId: 'b', quantity: 1, gtsNo: 'G1', expiryDate: null }],
      { requiresPrescription: true, prescriptionNo: 'RX9' });
    expect(out).toMatchObject({ requiresPrescription: true, prescriptionNo: 'RX9', licenseNo: 'R-1', gtsNos: ['G1'] });
  });
  it('reçetesiz ve GTS siz kalemde undefined alan yok (Firestore)', () => {
    const out = toSaleItem(cartItem, product('A', ''), []);
    expect(Object.values(out).some(v => v === undefined)).toBe(false);
    expect('gtsNos' in out).toBe(false);
  });
  it('KDV oranı ve net (KDV hariç) maliyet satış anında kaydedilir', () => {
    const p = product('A', '', { purchasePrice: 96, vatRate: 20, purchasePriceIncludesVat: true });
    expect(toSaleItem(cartItem, p, [])).toMatchObject({ vatRate: 20, costPrice: 80 });
    const q = product('A', '', { purchasePrice: 80, vatRate: null });
    expect(toSaleItem(cartItem, q, [])).toMatchObject({ vatRate: null, costPrice: 80 });
  });
});

describe('parti no (lotNo) satışta taşınır', () => {
  const withLot = (b: Batch, lotNo: string): Batch => ({ ...b, lotNo });
  const cartItem = { productId: 'A', productName: 'A', barcode: '', quantity: 2, unitPrice: 10, discount: 0,
    discountType: 'percent' as const, totalPrice: 20, _tempId: 't', stock: 5 };

  it('allocateFEFO düşülen partinin lotNo bilgisini taken içine yazar; olmayanlarda alan yok', () => {
    const r = allocateFEFO([withLot(batch('a', 1, 1000, 'G1'), 'L1'), batch('b', 5, 2000)], 3);
    expect(r.taken[0]).toMatchObject({ batchId: 'a', lotNo: 'L1' });
    expect('lotNo' in r.taken[1]).toBe(false);
  });

  it('toSaleItem lotNos (tekrarsız) yazar, yoksa alan eklemez', () => {
    const taken = [
      { batchId: 'a', quantity: 1, gtsNo: 'G1', lotNo: 'L1', expiryDate: null },
      { batchId: 'b', quantity: 1, gtsNo: 'G2', lotNo: 'L1', expiryDate: null },
      { batchId: 'c', quantity: 1, gtsNo: null, expiryDate: null },
    ];
    expect(takenLotNos(taken)).toEqual(['L1']);
    expect(toSaleItem(cartItem, product('A', ''), taken).lotNos).toEqual(['L1']);
    expect('lotNos' in toSaleItem(cartItem, product('A', ''), [])).toBe(false);
  });

  it('restoreBatches iptalde lotNo bilgisini geri koyar', () => {
    const out = restoreBatches([], { quantity: 1, batches: [{ batchId: 'a', quantity: 1, gtsNo: 'G1', lotNo: 'L1', expiryDate: null }] },
      ts(0) as never, () => 'n');
    expect(out[0]).toMatchObject({ id: 'a', gtsNo: 'G1', lotNo: 'L1' });
  });
});
