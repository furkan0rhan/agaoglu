import { Sale } from '../../../shared/models/sale.model';
import { buildCancellationRows, reasonFromDetail } from './cancellations';

const ts = (d: Date) => ({ toDate: () => d });

describe('buildCancellationRows (İptaller raporu)', () => {
  const names = new Map([['u-kasiyer', 'Ayşe Kasiyer'], ['u-admin', 'Mehmet Ağaoğlu']]);

  it('denetim kaydı + satış birleşir; eski (kayıtsız) iptal de listelenir; en yeni önce', () => {
    const logs = [{
      id: 'sale_cancel_s1', action: 'sale_cancel', saleId: 's1', saleNumber: 'S-1', amount: 1450, actorUid: 'u-admin',
      actorName: 'Mehmet Ağaoğlu', saleCreatedBy: 'u-kasiyer', detail: 'S-1 · 1450 ₺ · Müşteri vazgeçti · iade',
      createdAt: ts(new Date(2026, 9, 30, 14)),
    }, { id: 'x', action: 'support_start', createdAt: ts(new Date(2026, 9, 30, 15)) }];
    const sales = [
      { id: 's1', saleNumber: 'S-1', status: 'cancelled', totalAmount: 1450, createdBy: 'u-kasiyer', cancelReason: 'Müşteri vazgeçti · iade' },
      { id: 's0', saleNumber: 'S-0', status: 'cancelled', totalAmount: 99.5, createdBy: 'u-kasiyer', cancelledBy: 'u-kasiyer',
        cancelledAt: ts(new Date(2026, 9, 29, 10)), cancelReason: null },
    ] as unknown as Sale[];
    const rows = buildCancellationRows(logs, sales, names);
    expect(rows.map(r => r.saleNumber)).toEqual(['S-1', 'S-0']);
    expect(rows[0]).toMatchObject({
      soldBy: 'Ayşe Kasiyer', cancelledBy: 'Mehmet Ağaoğlu', amount: 1450, reason: 'Müşteri vazgeçti · iade', legacy: false,
    });
    expect(rows[1]).toMatchObject({ soldBy: 'Ayşe Kasiyer', cancelledBy: 'Ayşe Kasiyer', amount: 99.5, reason: '—', legacy: true });
  });

  it('satış dönemde değilse neden denetim detayından', () => {
    expect(reasonFromDetail('S-9 · 10 ₺ · Yanlış ürün')).toBe('Yanlış ürün');
    const rows = buildCancellationRows(
      [{ id: 'l', action: 'sale_cancel', saleId: 's9', detail: 'S-9 · 10 ₺ · Yanlış ürün', actorUid: 'zz' }], [], names);
    expect(rows[0]).toMatchObject({ saleNumber: 's9', reason: 'Yanlış ürün', cancelledBy: '—', soldBy: '—' });
  });
});
