import { Recommendation } from '../../../shared/models/farmer.model';
import { suggestPrescriptionNo } from './rx-suggest';

const rec = (over: Partial<Recommendation>): Recommendation => ({
  id: 'r', tenantId: 't', tenantName: 'T', farmerId: 'f', fieldId: null, seasonId: null, target: 'Süne',
  items: [], prescriptionNo: 'ER-1', windowStart: null, windowEnd: null, notes: null,
  authorUid: 'u', authorName: 'Zir. Müh. Ayşe', authorLicenseNo: 'L', status: 'active', createdAt: new Date(2026, 9, 1),
  ...over,
});
const item = (productId: string) => ({ productId, productName: 'X', dose: '', phiDays: null, requiresPrescription: true });

describe('suggestPrescriptionNo (Y18)', () => {
  const now = new Date(2026, 9, 30, 12);

  it('sepetteki ürünü içeren öneri, daha yeni olana tercih edilir', () => {
    const r = suggestPrescriptionNo([
      rec({ id: 'a', prescriptionNo: 'ER-NEW', createdAt: new Date(2026, 9, 20) }),
      rec({ id: 'b', prescriptionNo: 'ER-MATCH', items: [item('p1')], createdAt: new Date(2026, 9, 5) }),
    ], ['p1'], now);
    expect(r).toEqual({ prescriptionNo: 'ER-MATCH', prescriber: 'Zir. Müh. Ayşe' });
  });

  it('geri çekilmiş, e-reçetesiz ya da penceresi geçmiş öneri önerilmez', () => {
    expect(suggestPrescriptionNo([
      rec({ status: 'withdrawn' }),
      rec({ prescriptionNo: null }),
      rec({ windowEnd: new Date(2026, 9, 29) }),
    ], ['p1'], now)).toBeNull();
    expect(suggestPrescriptionNo([rec({ windowEnd: new Date(2026, 9, 30) })], [], now)?.prescriptionNo).toBe('ER-1');
  });
});
