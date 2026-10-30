import { LicenseState, Tenant, TENANT_PLANS, TenantPlan, TenantStatus } from '../../shared/models/user.model';

/** Bitime bu kadar gün kala uyarı şeridi gösterilir. */
export const LICENSE_WARN_DAYS = 7;
const DAY_MS = 86_400_000;

export interface LicenseInfo {
  state: LicenseState;
  plan: TenantPlan | null;
  /** Deneme için trialEndsAt, ücretli plan için licenseExpiresAt; null = süresiz. */
  expiresAt: Date | null;
  /** Bitişe kalan tam gün (geçmişse negatif); süresizse null. */
  daysLeft: number | null;
}

/** Firestore Timestamp (duck typing: firebase'i bu saf modüle bağlamamak için) veya Date → Date. */
function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: unknown }).toDate === 'function') return (v as { toDate(): Date }).toDate();
  return null;
}

/** tenants/{id} ham verisini Tenant modeline çevirir (bilinmeyen değerler güvenli varsayılana döner). */
export function toTenant(id: string, d: Record<string, unknown>): Tenant {
  const plan = d['plan'];
  const status = d['status'];
  return {
    id,
    name: typeof d['name'] === 'string' ? d['name'] : '',
    ownerId: typeof d['ownerId'] === 'string' ? d['ownerId'] : id,
    createdAt: toDate(d['createdAt']) ?? new Date(0),
    plan: typeof plan === 'string' && (TENANT_PLANS as readonly string[]).includes(plan) ? (plan as TenantPlan) : undefined,
    status: status === 'suspended' ? 'suspended' : (status === 'active' ? 'active' : undefined) as TenantStatus | undefined,
    trialEndsAt: toDate(d['trialEndsAt']),
    licenseExpiresAt: toDate(d['licenseExpiresAt']),
    maxUsers: typeof d['maxUsers'] === 'number' ? d['maxUsers'] : undefined,
    supportAccess: d['supportAccess'] !== false,
    phone: typeof d['phone'] === 'string' ? d['phone'] : '',
    lastActiveAt: toDate(d['lastActiveAt']),
  };
}

/**
 * Lisans durumunu hesaplar (firestore.rules `licenseOk()` ile aynı mantık):
 * - plan yok → 'legacy' (lisans öncesi işletme, kısıtsız)
 * - status 'suspended' → 'suspended'
 * - deneme: trialEndsAt; ücretli: licenseExpiresAt (null = süresiz)
 */
export function computeLicense(t: Pick<Tenant, 'plan' | 'status' | 'trialEndsAt' | 'licenseExpiresAt'> | null, now = new Date()): LicenseInfo {
  if (!t || !t.plan) return { state: 'legacy', plan: null, expiresAt: null, daysLeft: null };
  const expiresAt = t.plan === 'trial' ? (t.trialEndsAt ?? new Date(0)) : (t.licenseExpiresAt ?? null);
  const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS) : null;
  let state: LicenseState;
  if (t.status === 'suspended') state = 'suspended';
  else if (expiresAt && expiresAt.getTime() <= now.getTime()) state = 'expired';
  else if (daysLeft !== null && daysLeft <= LICENSE_WARN_DAYS) state = 'warning';
  else state = 'ok';
  return { state, plan: t.plan, expiresAt, daysLeft };
}

/** Uzatma: bitiş geçmişteyse bugünden, değilse mevcut bitişten itibaren `days` gün. */
export function extendFrom(current: Date | null | undefined, days: number, now = new Date()): Date {
  const base = current && current.getTime() > now.getTime() ? current : now;
  return new Date(base.getTime() + days * DAY_MS);
}

export function isReadOnlyState(s: LicenseState): boolean {
  return s === 'expired' || s === 'suspended';
}
