import type { ApplicationLog, FarmerLink, FarmField, Season } from '../../shared/models/farmer.model';
import { buildFarmerRows, CustomerBrief, inviteDaysLeft, phiWarningFieldCount } from './farmers-calc';

const D = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const consent = (fields: boolean, logs: boolean) => ({
  purchases: true as const, fields, logs, notifications: false, textVersion: 'v1', grantedAt: null, updatedAt: null,
});
const link = (id: string, over: Partial<FarmerLink> = {}): FarmerLink => ({
  id: 'T_' + id, tenantId: 'T', farmerId: id, customerId: 'c-' + id, inviteCode: 'X', status: 'active', consent: consent(true, true),
  tenantName: 'Bayi', farmerName: 'F ' + id, balance: null, balanceUpdatedAt: null, nextDue: null, overdueAmount: null, schedule: [], createdAt: D(2026, 9, 1), ...over,
});
const field = (id: string, farmerId: string, area: number, over: Partial<FarmField> = {}): FarmField => ({
  id, farmerId, name: id, areaDecare: area, city: null, district: null, village: null, ada: null, parsel: null, location: null,
  irrigation: 'dry', sharedTenantIds: ['T'], isActive: true, createdAt: D(2026, 9, 2), updatedAt: null, ...over,
});
const log = (fieldId: string, farmerId: string, date: Date, over: Partial<ApplicationLog> = {}): ApplicationLog => ({
  id: fieldId + date.getTime(), farmerId, fieldId, seasonId: null, type: 'pesticide', date, purchaseId: null, purchaseItemIndex: null,
  productName: 'X', quantity: 1, unit: 'lt', areaDecare: 1, dosePerDecare: 1, appliedBy: null, notes: null, phiDays: null, phiSource: null,
  earliestHarvestDate: null, recommendationId: null, sharedTenantIds: ['T'], createdAt: null, updatedAt: null, ...over,
});

describe('buildFarmerRows', () => {
  const customers = new Map<string, CustomerBrief>([['c-a', { id: 'c-a', name: 'Ali Yılmaz', phone: '05551234567', village: 'Ağaçlı' }]]);

  it('paylaşılan tarlaları sayar, alanı toplar; son aktiviteyi defter/tarla/bağlantıdan alır', () => {
    const rows = buildFarmerRows(
      [link('a')],
      [field('f1', 'a', 12.5), field('f2', 'a', 20), field('f3', 'a', 5, { isActive: false }), field('fx', 'b', 99)],
      [log('f1', 'a', D(2026, 10, 20)), log('f2', 'a', D(2026, 10, 25))],
      customers,
    );
    expect(rows[0]).toMatchObject({ name: 'Ali Yılmaz', phone: '05551234567', village: 'Ağaçlı', fieldCount: 2, areaDecare: 32.5 });
    expect(rows[0].lastActivity).toEqual(D(2026, 10, 25));
  });

  it('tarla izni yoksa sayı/alan null ("paylaşmıyor"); müşteri kaydı yoksa bağlantıdaki ad', () => {
    const rows = buildFarmerRows([link('b', { consent: consent(false, false) })], [], [], customers);
    expect(rows[0]).toMatchObject({ name: 'F b', fieldCount: null, areaDecare: null, phone: null });
    expect(rows[0].lastActivity).toEqual(D(2026, 9, 1));
  });

  it('aktif bağlantılar önce, sonra ada göre', () => {
    const rows = buildFarmerRows([link('z', { status: 'revoked', farmerName: 'Aaa' }), link('y', { farmerName: 'Zeki' })], [], [], new Map());
    expect(rows.map(r => r.name)).toEqual(['Zeki', 'Aaa']);
  });
});

describe('inviteDaysLeft', () => {
  it('kalan gün; süresi geçmişse -1', () => {
    expect(inviteDaysLeft({ expiresAt: new Date(2026, 9, 30, 23) }, new Date(2026, 9, 30, 10))).toBe(0);
    expect(inviteDaysLeft({ expiresAt: D(2026, 11, 6) }, D(2026, 10, 30))).toBe(7);
    expect(inviteDaysLeft({ expiresAt: D(2026, 10, 29) }, D(2026, 10, 30))).toBe(-1);
  });
});

describe('phiWarningFieldCount', () => {
  const today = D(2026, 10, 30);
  const season = (id: string, fieldId: string, harvest: Date | null): Season => ({
    id, farmerId: 'a', fieldId, crop: 'tomato', variety: null, sowingDate: null, expectedHarvestDate: harvest, harvestDate: null,
    status: 'active', sharedTenantIds: ['T'], createdAt: null, updatedAt: null,
  });

  it('7 gün içinde biten veya beklenen hasatla çakışan bekleme sayılır; tarla başına bir kez', () => {
    const logs = [
      log('f1', 'a', D(2026, 10, 28), { phiDays: 7, earliestHarvestDate: D(2026, 11, 4) }), // 5 gün → sayılır
      log('f1', 'a', D(2026, 10, 29), { phiDays: 7, earliestHarvestDate: D(2026, 11, 5) }), // aynı tarla
      log('f2', 'a', D(2026, 10, 29), { phiDays: 30, earliestHarvestDate: D(2026, 11, 28) }), // 29 gün, çakışma yok
      log('f3', 'a', D(2026, 10, 29), { seasonId: 's3', phiDays: 30, earliestHarvestDate: D(2026, 11, 28) }), // hasat 10.11 → çakışma
      log('f4', 'a', D(2026, 10, 1), { phiDays: 7, earliestHarvestDate: D(2026, 10, 8) }), // bitmiş
      log('f5', 'a', D(2026, 10, 29)), // PHI verisi yok → hesap yok
    ];
    expect(phiWarningFieldCount(logs, [season('s3', 'f3', D(2026, 11, 10))], today)).toBe(2);
  });

  it('veri yoksa 0', () => {
    expect(phiWarningFieldCount([], [], today)).toBe(0);
  });
});
