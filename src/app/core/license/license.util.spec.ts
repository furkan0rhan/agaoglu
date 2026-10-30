import { computeLicense, extendFrom, isReadOnlyState } from './license.util';
import { buildTenantRows, computeStats, filterTenantRows } from '../../features/admin/admin.util';
import { AppUser, Tenant } from '../../shared/models/user.model';

const NOW = new Date('2026-10-27T12:00:00Z');
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe('computeLicense', () => {
  it('plan yoksa eski işletme (kısıtsız)', () => {
    expect(computeLicense({}, NOW).state).toBe('legacy');
    expect(computeLicense(null, NOW).state).toBe('legacy');
  });

  it('deneme: trialEndsAt, 7 gün kala uyarı, geçince expired', () => {
    expect(computeLicense({ plan: 'trial', trialEndsAt: days(20) }, NOW).state).toBe('ok');
    const w = computeLicense({ plan: 'trial', trialEndsAt: days(5) }, NOW);
    expect(w.state).toBe('warning');
    expect(w.daysLeft).toBe(5);
    expect(computeLicense({ plan: 'trial', trialEndsAt: days(-1) }, NOW).state).toBe('expired');
    expect(computeLicense({ plan: 'trial', trialEndsAt: null }, NOW).state).toBe('expired');
  });

  it('ücretli plan: licenseExpiresAt null ise süresiz', () => {
    const r = computeLicense({ plan: 'pro', licenseExpiresAt: null }, NOW);
    expect(r.state).toBe('ok');
    expect(r.expiresAt).toBeNull();
    expect(computeLicense({ plan: 'basic', licenseExpiresAt: days(-3) }, NOW).state).toBe('expired');
  });

  it('askıya alınmış her zaman suspended', () => {
    expect(computeLicense({ plan: 'pro', status: 'suspended', licenseExpiresAt: days(100) }, NOW).state).toBe('suspended');
  });

  it('salt okunur: yalnız expired / suspended', () => {
    expect(isReadOnlyState('expired')).toBe(true);
    expect(isReadOnlyState('suspended')).toBe(true);
    expect(isReadOnlyState('warning')).toBe(false);
    expect(isReadOnlyState('legacy')).toBe(false);
  });
});

describe('extendFrom', () => {
  it('bitiş gelecekteyse ondan, geçmişteyse bugünden uzatır', () => {
    expect(extendFrom(days(10), 30, NOW).getTime()).toBe(days(40).getTime());
    expect(extendFrom(days(-10), 30, NOW).getTime()).toBe(days(30).getTime());
    expect(extendFrom(null, 365, NOW).getTime()).toBe(days(365).getTime());
  });
});

describe('admin tablo yardımcıları', () => {
  const tenants: Tenant[] = [
    { id: 'A', name: 'Ali Tarım', ownerId: 'A', createdAt: NOW, plan: 'pro', licenseExpiresAt: days(100), lastActiveAt: days(-2) },
    { id: 'B', name: 'Bereket', ownerId: 'B', createdAt: NOW, plan: 'trial', trialEndsAt: days(-1) },
    { id: 'C', name: 'Çiftçi Market', ownerId: 'C', createdAt: NOW },
  ];
  const users: AppUser[] = [
    { id: 'A', tenantId: 'A', email: 'ali@x.com', displayName: 'Ali', role: 'admin', isActive: true, createdAt: NOW },
    { id: 'A2', tenantId: 'A', email: 'k@x.com', displayName: 'K', role: 'cashier', isActive: false, createdAt: NOW },
    { id: 'B', tenantId: 'B', email: 'b@x.com', displayName: 'B', role: 'admin', isActive: true, createdAt: NOW, lastLogin: days(-20) },
  ];

  it('sahip e-postası, aktif kullanıcı sayısı ve son aktivite', () => {
    const rows = buildTenantRows(tenants, users, NOW);
    const a = rows.find(r => r.tenant.id === 'A')!;
    expect(a.ownerEmail).toBe('ali@x.com');
    expect(a.userCount).toBe(1);
    expect(a.lastActive?.getTime()).toBe(days(-2).getTime());
    expect(rows.find(r => r.tenant.id === 'B')!.lastActive?.getTime()).toBe(days(-20).getTime());
  });

  it('istatistikler ve filtre', () => {
    const rows = buildTenantRows(tenants, users, NOW);
    const s = computeStats(rows, NOW);
    expect(s).toEqual({ total: 3, activePaid: 1, trial: 0, expired: 1, suspended: 0, activeLast7: 1 });
    expect(filterTenantRows(rows, 'çiftçi', 'all', 'all').map(r => r.tenant.id)).toEqual(['C']);
    expect(filterTenantRows(rows, '', 'legacy', 'all').map(r => r.tenant.id)).toEqual(['C']);
    expect(filterTenantRows(rows, 'b@x', 'all', 'expired').map(r => r.tenant.id)).toEqual(['B']);
  });
});
