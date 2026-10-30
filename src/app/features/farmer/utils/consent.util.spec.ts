import { FarmerConsent, RecommendationItem } from '../../../shared/models/farmer.model';
import { qrMatrix } from './qr';
import { computeShareTargets, defaultConsent, needsReconsent, sameTenantSet, validateRecommendation } from './consent.util';
import { sprayHints, sprayLevel } from '../services/weather.service';

const c = (fields: boolean, logs: boolean): FarmerConsent => ({ ...defaultConsent(), fields, logs });
const item = (over: Partial<RecommendationItem> = {}): RecommendationItem => ({
  productId: 'p', productName: 'Ürün', dose: '50 ml/100 lt', phiDays: 7, requiresPrescription: false, ...over,
});

describe('consent.util (KVKK paylaşım + yetki kontrolleri)', () => {
  it('varsayılan izin: yalnız zorunlu alışveriş/borç açık', () => {
    const d = defaultConsent();
    expect(d.purchases).toBe(true);
    expect(d.fields || d.logs || d.notifications).toBe(false);
    expect(needsReconsent(d)).toBe(false);
    expect(needsReconsent({ textVersion: 'v0' })).toBe(true);
  });

  it('paylaşım hedefleri yalnız aktif bağlantı + ilgili izinle', () => {
    const t = computeShareTargets([
      { tenantId: 'A', status: 'active', consent: c(true, false) },
      { tenantId: 'B', status: 'active', consent: c(true, true) },
      { tenantId: 'C', status: 'revoked', consent: c(true, true) },
    ]);
    expect(t.fields).toEqual(['A', 'B']);
    expect(t.logs).toEqual(['B']);
    expect(sameTenantSet(['A', 'B'], ['B', 'A'])).toBe(true);
    expect(sameTenantSet(['A'], ['A', 'B'])).toBe(false);
  });

  it('öneriyi yalnız yetkili (canPrescribe + yetki no) yazar', () => {
    const base = { canPrescribe: true, licenseNo: 'LIC-1', linkActive: true, target: 'Külleme', items: [item()], prescriptionNo: null };
    expect(validateRecommendation(base)).toEqual([]);
    expect(validateRecommendation({ ...base, canPrescribe: false })).toContain('not-prescriber');
    expect(validateRecommendation({ ...base, licenseNo: '' })).toContain('no-license');
    expect(validateRecommendation({ ...base, linkActive: false })).toContain('link-inactive');
  });

  it('reçeteli ürün varsa e-reçete no zorunlu', () => {
    const base = { canPrescribe: true, licenseNo: 'LIC-1', linkActive: true, target: 'Kırmızı örümcek', prescriptionNo: '' };
    expect(validateRecommendation({ ...base, items: [item({ requiresPrescription: true })] })).toContain('prescription-required');
    expect(validateRecommendation({ ...base, items: [item({ requiresPrescription: true })], prescriptionNo: 'ER-2026-1' })).toEqual([]);
  });

  it('eksik içerik reddedilir (konu, ürün, doz, en fazla 5 kalem)', () => {
    const base = { canPrescribe: true, licenseNo: 'LIC-1', linkActive: true, prescriptionNo: null };
    expect(validateRecommendation({ ...base, target: '', items: [item()] })).toContain('no-target');
    expect(validateRecommendation({ ...base, target: 'x', items: [] })).toContain('no-items');
    expect(validateRecommendation({ ...base, target: 'x', items: [item({ dose: ' ' })] })).toContain('item-incomplete');
    expect(validateRecommendation({ ...base, target: 'x', items: Array.from({ length: 6 }, () => item()) })).toContain('too-many-items');
  });
});

describe('qr + hava eşikleri', () => {
  it('QR boyutu sürüme göre (21 + 4·(v−1))', () => {
    expect(qrMatrix('A').length).toBe(21);
    expect(qrMatrix('https://stok-takip-2031b.web.app/ciftci/davet/ABCDEFGHJK').length).toBe(33);
    expect(() => qrMatrix('x'.repeat(300))).toThrow();
  });

  it('ilaçlama şeridi "uygun" demez; rüzgar/yağış/sıcaklık için dikkat notu üretir', () => {
    const h = (windKmh: number, rainMm = 0, tempC = 20) => ({ time: new Date(), windKmh, rainMm, tempC });
    expect(sprayLevel(h(5))).toBe('ok');
    expect(sprayLevel(h(12))).toBe('caution');
    expect(sprayLevel(h(20))).toBe('bad');
    expect(sprayLevel(h(1))).toBe('caution');
    expect(sprayHints([h(20)]).map(x => x.key)).toEqual(['windHigh']);
    expect(sprayHints([h(5, 0, 32), h(5, 1)]).map(x => x.key)).toEqual(['rainSoon', 'hot']);
  });
});
