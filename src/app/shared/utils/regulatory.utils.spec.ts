import {
  buildPrescriptionRows, checkPrescription, isPlantProtection, isPrescriptionSale, isValidPrescriptionNo,
  normalizePrescriptionNo, productRequiresPrescription, regulatoryFromProduct, regulatoryToChanges, suggestProductType,
} from './regulatory.utils';
import { parseTenantSettings } from '../../core/settings/tenant-settings.model';
import { Sale } from '../models/sale.model';

describe('suggestProductType', () => {
  it('kategoriden tür önerir', () => {
    expect(suggestProductType('Zirai İlaç')).toBe('bitki_koruma');
    expect(suggestProductType('Fungisit')).toBe('bitki_koruma');
    expect(suggestProductType('Gübre')).toBe('gubre');
    expect(suggestProductType('Tohum')).toBe('tohum');
    expect(suggestProductType('Fidan')).toBe('fide');
    expect(suggestProductType('Hırdavat')).toBe('diger');
    expect(suggestProductType('')).toBe('diger');
  });
});

describe('productRequiresPrescription', () => {
  it('açık bayrak her zaman kazanır', () => {
    expect(productRequiresPrescription({ requiresPrescription: false, productType: 'bitki_koruma' })).toBe(false);
    expect(productRequiresPrescription({ requiresPrescription: true, productType: 'gubre' })).toBe(true);
  });
  it('bayrak yoksa yalnızca türü bitki_koruma kayıtlı ürün reçeteli', () => {
    expect(productRequiresPrescription({ productType: 'bitki_koruma' })).toBe(true);
    expect(productRequiresPrescription({})).toBe(false);
  });
  it('bitki koruma tespiti kategoriye de bakar (SKT engeli için)', () => {
    expect(isPlantProtection({ category: 'Zirai İlaç' })).toBe(true);
    expect(isPlantProtection({ category: 'Zirai İlaç', productType: 'diger' })).toBe(false);
  });
});

describe('e-reçete numarası', () => {
  it('normalize eder ve biçimi kontrol eder', () => {
    expect(normalizePrescriptionNo(' ab 12 34 ')).toBe('AB1234');
    expect(isValidPrescriptionNo('2026-000123')).toBe(true);
    expect(isValidPrescriptionNo('12')).toBe(false);
    expect(isValidPrescriptionNo('')).toBe(false);
    expect(isValidPrescriptionNo('ab#12')).toBe(false);
  });
});

describe('checkPrescription (reçete zorunluluğu)', () => {
  const base = { hasPrescriptionItems: true, customerId: null, prescriptionNo: '' };
  it('required: müşteri ve numara eksikse ikisi de engeller', () => {
    const r = checkPrescription({ ...base, mode: 'required' });
    expect(r.needed).toBe(true);
    expect(r.blocking).toEqual(['customer', 'number']);
  });
  it('required: müşteri + geçerli numara ile engel yok', () => {
    const r = checkPrescription({ ...base, mode: 'required', customerId: 'c1', prescriptionNo: 'RX2026001' });
    expect(r.missing).toEqual([]);
    expect(r.blocking).toEqual([]);
  });
  it('warn: eksikler raporlanır ama engellemez', () => {
    const r = checkPrescription({ ...base, mode: 'warn' });
    expect(r.missing).toEqual(['customer', 'number']);
    expect(r.blocking).toEqual([]);
  });
  it('off veya reçeteli ürün yoksa hiçbir şey sorulmaz', () => {
    expect(checkPrescription({ ...base, mode: 'off' }).needed).toBe(false);
    expect(checkPrescription({ ...base, mode: 'required', hasPrescriptionItems: false }).needed).toBe(false);
  });
});

describe('parseTenantSettings', () => {
  it('eksik/bilinmeyen değer varsayılana (required) döner', () => {
    expect(parseTenantSettings(null).prescriptionMode).toBe('required');
    expect(parseTenantSettings({ prescriptionMode: 'xx' }).prescriptionMode).toBe('required');
    expect(parseTenantSettings({ prescriptionMode: 'warn' }).prescriptionMode).toBe('warn');
  });
});

describe('regulatory form', () => {
  it('eski üründe tür kategoriden, reçete türün varsayılanından gelir', () => {
    const f = regulatoryFromProduct({ category: 'Zirai İlaç' });
    expect(f.productType).toBe('bitki_koruma');
    expect(f.requiresPrescription).toBe(true);
  });
  it('boş metinler null, PHI tam sayı', () => {
    const c = regulatoryToChanges({
      productType: 'bitki_koruma', requiresPrescription: true, licenseNo: ' ', activeIngredient: 'Abamectin',
      phiDays: 7.6, toxicityClass: '',
    });
    expect(c).toEqual({
      productType: 'bitki_koruma', requiresPrescription: true, licenseNo: null, activeIngredient: 'Abamectin',
      phiDays: 7, toxicityClass: null,
    });
  });
});

describe('buildPrescriptionRows (denetim kaydı)', () => {
  const ts = { toDate: () => new Date(2026, 9, 27, 10, 0) } as unknown as Sale['createdAt'];
  const sale = (extra: Partial<Sale>): Sale => ({
    id: 's', tenantId: 't', saleNumber: 'S-1', customerId: 'c1', customerName: 'Ali Veli', items: [],
    subtotal: 0, totalDiscount: 0, totalAmount: 0, paymentMethod: 'cash', cashPaid: 0, cardPaid: 0, creditAmount: 0,
    change: 0, status: 'completed', notes: null, interestRate: null, installmentCount: null, installmentAmount: null,
    totalWithInterest: null, createdAt: ts, createdBy: 'u', cancelledAt: null, ...extra,
  });

  it('yalnızca reçeteli kalemleri, GTS ve ruhsat no ile yazar; TC satış kopyasından, ÇKS müşteriden', () => {
    const s = sale({
      hasPrescriptionItems: true, prescriptionNo: 'RX1', prescriberName: 'Müh. A', customerTcNo: '11111111110',
      items: [
        { productId: 'p1', productName: 'İlaç A', barcode: '', quantity: 2, unitPrice: 1, discount: 0, discountType: 'percent',
          totalPrice: 2, requiresPrescription: true, prescriptionNo: 'RX1', licenseNo: 'L-55', gtsNos: ['G1', 'G2'] },
        { productId: 'p2', productName: 'Gübre', barcode: '', quantity: 1, unitPrice: 1, discount: 0, discountType: 'percent', totalPrice: 1 },
      ],
    });
    const rows = buildPrescriptionRows([s, sale({ id: 'x', saleNumber: 'S-2' })], new Map([['c1', { tcNo: '999', cksNo: 'CKS-7' }]]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      saleNumber: 'S-1', customerName: 'Ali Veli', tcNo: '11111111110', cksNo: 'CKS-7', productName: 'İlaç A',
      licenseNo: 'L-55', quantity: 2, gtsNos: 'G1, G2', prescriptionNo: 'RX1', prescriberName: 'Müh. A',
    });
  });

  it('parti no sütunu: lotNos, yoksa kalem partilerinden', () => {
    const item = { productId: 'p1', productName: 'İlaç A', barcode: '', quantity: 1, unitPrice: 1, discount: 0,
      discountType: 'percent' as const, totalPrice: 1, requiresPrescription: true, prescriptionNo: 'RX1' };
    const a = sale({ items: [{ ...item, lotNos: ['L1', 'L2'] }] });
    const b = sale({ items: [{ ...item, batches: [{ batchId: 'x', quantity: 1, gtsNo: null, lotNo: 'L7', expiryDate: null }] }] });
    const c = sale({ items: [item] });
    expect(buildPrescriptionRows([a, b, c]).map(r => r.lotNos)).toEqual(['L1, L2', 'L7', '']);
  });

  it('eski satışta bayrak yoksa kalemlere bakılır', () => {
    expect(isPrescriptionSale({ items: [{ requiresPrescription: true } as Sale['items'][number]] })).toBe(true);
    expect(isPrescriptionSale({ items: [] })).toBe(false);
  });
});
