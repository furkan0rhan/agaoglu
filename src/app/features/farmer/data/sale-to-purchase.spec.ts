import { saleToPurchase } from './firestore-dealer.repository';
import type { FarmerLink } from '../../../shared/models/farmer.model';

const link = { farmerId: 'f1', tenantId: 't1' } as FarmerLink;

describe('saleToPurchase (satış → çiftçi ambarı)', () => {
  const sale = {
    saleNumber: 'S-1', status: 'completed', totalAmount: 6430, creditAmount: 6430, prescriptionNo: 'RX2026103001',
    items: [
      { productId: 'p1', productName: 'Amonyum Sülfat', quantity: 10, unit: 'cuval', unitPrice: 610, totalPrice: 6100 },
      { productId: 'p2', productName: 'Mankozeb', quantity: 1, unit: 'kg', unitPrice: 330, totalPrice: 330 },
    ],
  };
  const products = new Map<string, Record<string, unknown>>([
    ['p1', { name: 'Amonyum Sülfat', productType: 'gubre', category: 'Gübre' }],
    ['p2', { name: 'Mankozeb', productType: 'bitki_koruma', category: 'İlaç', requiresPrescription: true }],
  ]);

  it('satış düzeyindeki e-reçete no yalnız reçeteli kaleme düşer (gübreye düşmez — rapor #6)', () => {
    const p = saleToPurchase('s1', sale, link, 'Bayi', products as never);
    const items = p['items'] as { productName: string; prescriptionNo: string | null; unitPrice: number }[];
    expect(items[0].prescriptionNo).toBeNull();
    expect(items[1].prescriptionNo).toBe('RX2026103001');
    // Bitki koruma ürününde fiyat aktarılmaz
    expect(items[1].unitPrice).toBe(0);
    expect(items[0].unitPrice).toBe(610);
  });

  it('kalemin kendi e-reçete numarası her zaman korunur', () => {
    const s = { ...sale, items: [{ ...sale.items[1], prescriptionNo: 'RX-OWN' }] };
    const items = saleToPurchase('s1', s, link, 'Bayi', products as never)['items'] as { prescriptionNo: string | null }[];
    expect(items[0].prescriptionNo).toBe('RX-OWN');
  });
});
