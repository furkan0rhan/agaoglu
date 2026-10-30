import { computeLicense, LicenseInfo } from '../../core/license/license.util';
import { AppUser, LicenseState, Tenant, TenantPlan } from '../../shared/models/user.model';

export interface TenantRow {
  tenant: Tenant;
  license: LicenseInfo;
  ownerEmail: string;
  userCount: number;
  lastActive: Date | null;
}

export type PlanFilter = 'all' | TenantPlan | 'legacy';
export type StateFilter = 'all' | LicenseState;

export interface AdminStats {
  total: number;
  activePaid: number;
  trial: number;
  expired: number;
  suspended: number;
  activeLast7: number;
}

/** İşletme + kullanıcı listesinden tablo satırları (son aktivite: tenant.lastActiveAt ve kullanıcıların lastLogin'i). */
export function buildTenantRows(tenants: Tenant[], users: AppUser[], now = new Date()): TenantRow[] {
  const byTenant = new Map<string, AppUser[]>();
  for (const u of users) {
    if (!u.tenantId) continue;
    const list = byTenant.get(u.tenantId) ?? [];
    list.push(u);
    byTenant.set(u.tenantId, list);
  }
  return tenants.map(t => {
    const members = byTenant.get(t.id) ?? [];
    const owner = members.find(u => u.id === t.ownerId);
    let last = t.lastActiveAt ?? null;
    for (const m of members) {
      if (m.lastLogin && (!last || m.lastLogin > last)) last = m.lastLogin;
    }
    return {
      tenant: t,
      license: computeLicense(t, now),
      ownerEmail: owner?.email ?? '',
      userCount: members.filter(m => m.isActive).length,
      lastActive: last,
    };
  });
}

export function computeStats(rows: TenantRow[], now = new Date()): AdminStats {
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const live = (s: LicenseState) => s === 'ok' || s === 'warning';
  return {
    total: rows.length,
    activePaid: rows.filter(r => (r.license.plan === 'basic' || r.license.plan === 'pro') && live(r.license.state)).length,
    trial: rows.filter(r => r.license.plan === 'trial' && live(r.license.state)).length,
    expired: rows.filter(r => r.license.state === 'expired').length,
    suspended: rows.filter(r => r.license.state === 'suspended').length,
    activeLast7: rows.filter(r => r.lastActive && r.lastActive.getTime() >= weekAgo).length,
  };
}

export function filterTenantRows(rows: TenantRow[], search: string, plan: PlanFilter, state: StateFilter): TenantRow[] {
  const q = search.trim().toLocaleLowerCase('tr');
  return rows.filter(r => {
    if (plan !== 'all' && (plan === 'legacy' ? r.license.plan !== null : r.license.plan !== plan)) return false;
    if (state !== 'all' && r.license.state !== state) return false;
    if (!q) return true;
    return r.tenant.name.toLocaleLowerCase('tr').includes(q)
      || r.ownerEmail.toLocaleLowerCase('tr').includes(q)
      || r.tenant.id.toLocaleLowerCase('tr').includes(q);
  });
}

/** Bitiş tarihi vurgusu: geçmiş / ≤7 gün kırmızı, ≤30 gün sarı, diğer / süresiz yok. */
export function expiryTone(daysLeft: number | null): 'danger' | 'warning' | null {
  if (daysLeft === null) return null;
  if (daysLeft <= 7) return 'danger';
  if (daysLeft <= 30) return 'warning';
  return null;
}
