import type { Timestamp } from '@angular/fire/firestore';
import type { Batch, Product } from '../../../shared/models/product.model';
import { diffBatches } from '../../../shared/utils/batch.utils';
import { planSaleStock } from './sale-stock';

const NOW = Date.UTC(2026, 9, 30);
const ts = (ms: number) => ({ toMillis: () => ms, seconds: Math.floor(ms / 1000), nanoseconds: 0 }) as unknown as Timestamp;
const b = (id: string, quantity: number, expDays: number | null, gtsNo: string | null = null): Batch =>
  ({ id, quantity, expiryDate: expDays == null ? null : ts(NOW + expDays * 86_400_000), gtsNo, addedAt: ts(0), supplierId: null });
const prod = (batches: Batch[], extra: Partial<Product> = {}): Product =>
  ({ id: 'p1', name: 'Ürün', stock: batches.reduce((s, x) => s + x.quantity, 0), batches, productType: 'gubre', ...extra }) as Product;

describe('planSaleStock (2.2)', () => {
  it('FEFO: SKT en yakın birim önce düşülür, okutulan GTS önceliklidir', () => {
    const p = prod([b('late', 1, 90, 'G-LATE'), b('soon', 1, 5, 'G-SOON'), b('mid', 1, 30, 'G-MID')]);
    const fefo = planSaleStock([{ item: { quantity: 1 }, product: p }], NOW);
    expect(fefo.plan!.allocations[0].taken.map(t => t.gtsNo)).toEqual(['G-SOON']);
    const scanned = planSaleStock([{ item: { quantity: 1, gtsNos: ['G-LATE'] }, product: p }], NOW);
    expect(scanned.plan!.allocations[0].taken.map(t => t.gtsNo)).toEqual(['G-LATE']);
    expect(scanned.plan!.products.get('p1')!.batches.map(x => x.id).sort()).toEqual(['mid', 'soon']);
  });

  it('aynı ürün iki kalemde: kalemler aynı partiden iki kez düşmez, stok toplamı denetlenir', () => {
    const p = prod([b('u1', 1, 5, 'G1'), b('u2', 1, 10, 'G2')]);
    const r = planSaleStock([{ item: { quantity: 1 }, product: p }, { item: { quantity: 1 }, product: p }], NOW);
    expect(r.plan!.allocations.map(a => a.taken[0].gtsNo)).toEqual(['G1', 'G2']);
    expect(r.plan!.products.get('p1')).toMatchObject({ quantity: 2, batches: [] });
    expect(r.plan!.movements).toEqual([{ previousStock: 2, newStock: 1 }, { previousStock: 1, newStock: 0 }]);
    const over = planSaleStock([{ item: { quantity: 2 }, product: p }, { item: { quantity: 1 }, product: p }], NOW);
    expect(over.problem).toEqual({ kind: 'insufficient', productName: 'Ürün', missing: 1 });
  });

  it('başka kasa birimi sattıysa (sunucudaki güncel ürün) okutulan GTS bulunamaz', () => {
    const fresh = prod([b('u2', 1, 10, 'G2')]);
    expect(planSaleStock([{ item: { quantity: 1, gtsNos: ['G1'] }, product: fresh }], NOW).problem)
      .toEqual({ kind: 'gts-missing', productName: 'Ürün', gtsNos: ['G1'] });
  });

  it('bitki koruma: SKT geçmiş birim engel; gübre: onay uyarısı', () => {
    const old = [b('o', 1, -3, 'G-OLD')];
    expect(planSaleStock([{ item: { quantity: 1 }, product: prod(old, { productType: 'bitki_koruma' }) }], NOW).problem?.kind).toBe('expired-blocked');
    const w = planSaleStock([{ item: { quantity: 1 }, product: prod(old) }], NOW);
    expect(w.plan!.warnings.expired).toEqual([{ productName: 'Ürün', quantity: 1 }]);
  });
});

describe('diffBatches (çevrimdışı arrayRemove / arrayUnion)', () => {
  it('GTS birimi satışı: yalnız satılan birim kaldırılır, eklenen yok', () => {
    const before = [b('u1', 1, 5, 'G1'), b('u2', 1, 10, 'G2'), b('u3', 1, 15, 'G3')];
    const r = planSaleStock([{ item: { quantity: 1, gtsNos: ['G2'] }, product: prod(before) }], NOW);
    const d = diffBatches(before, r.plan!.products.get('p1')!.batches);
    expect(d.removed.map(x => x.gtsNo)).toEqual(['G2']);
    expect(d.added).toEqual([]);
    // Kaldırılan nesne önbellekteki ile alan alan aynı (arrayRemove tam eşleşme ister)
    expect(d.removed[0]).toBe(before[1]);
  });

  it('toplu partide kısmi düşüm: eski hâl kaldırılır, yeni hâl eklenir', () => {
    const before = [b('bulk', 10, null)];
    const r = planSaleStock([{ item: { quantity: 3 }, product: prod(before) }], NOW);
    const d = diffBatches(before, r.plan!.products.get('p1')!.batches);
    expect(d.removed.map(x => [x.id, x.quantity])).toEqual([['bulk', 10]]);
    expect(d.added.map(x => [x.id, x.quantity])).toEqual([['bulk', 7]]);
  });

  it('Timestamp eşitliği saniye/nanosaniye ile; tanımsız alanlar yok sayılır', () => {
    const a = b('x', 1, 5);
    const copy = { ...a, expiryDate: ts(a.expiryDate!.toMillis()), lotNo: undefined };
    expect(diffBatches([a], [copy])).toEqual({ removed: [], added: [] });
    expect(diffBatches([a], [{ ...a, lotNo: 'L1' }]).added).toHaveLength(1);
  });
});
