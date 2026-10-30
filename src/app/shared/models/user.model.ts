export type UserRole = 'admin' | 'cashier' | 'staff';

export const USER_ROLES: readonly UserRole[] = ['admin', 'cashier', 'staff'];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

/** users/{uid} */
export interface AppUser {
  id: string;
  /** Verinin ait olduğu işletme. İşletme sahibi için kendi uid'si. */
  tenantId: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date;
  /** Çiftçi modülü: 'farmer' hesabı yalnız /ciftci alanını görür (yoksa 'dealer'). */
  accountType?: 'dealer' | 'farmer';
}

/** tenants/{tenantId} */
export interface Tenant {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  // --- Lisans / abonelik (yalnız superadmin değiştirir; kurallar zorlar) ---
  /** Yoksa eski (lisans öncesi) işletme: sınırsız kabul edilir. */
  plan?: TenantPlan;
  status?: TenantStatus;
  trialEndsAt?: Date | null;
  /** Ücretli planlarda bitiş; null = süresiz. */
  licenseExpiresAt?: Date | null;
  maxUsers?: number;
  // --- İşletme adminin değiştirebildikleri ---
  /** Destek ekibinin (superadmin) işletme verisine erişimi. Varsayılan true. */
  supportAccess?: boolean;
  phone?: string;
  /** Herhangi bir kullanıcının son girişi (girişte yazılır). */
  lastActiveAt?: Date | null;
}

export type TenantPlan = 'trial' | 'basic' | 'pro';
export type TenantStatus = 'active' | 'suspended';
export const TENANT_PLANS: readonly TenantPlan[] = ['trial', 'basic', 'pro'];

/** Yeni kayıtta deneme süresi (gün) ve kullanıcı sınırı. */
export const TRIAL_DAYS = 30;
export const DEFAULT_MAX_USERS: Record<TenantPlan, number> = { trial: 3, basic: 3, pro: 10 };

/** Lisansın etkin durumu (uygulama tarafı hesap). */
export type LicenseState = 'legacy' | 'ok' | 'warning' | 'expired' | 'suspended';

/** platformAdmins/{uid} — yalnız Firebase Console'dan eklenir. */
export interface PlatformAdmin {
  email?: string;
  note?: string;
}

export type AuditAction = 'support_start' | 'support_end' | 'license_change' | 'user_change';

/** auditLogs/{autoId} — değiştirilemez denetim kaydı. */
export interface AuditLog {
  id: string;
  tenantId: string;
  actorUid: string;
  actorEmail: string;
  action: AuditAction;
  detail: string;
  createdAt: Date | null;
}

/** invites/{emailLowercase} — personel daveti */
export interface Invite {
  email: string;
  tenantId: string;
  role: UserRole;
  createdBy: string;
  createdAt?: unknown;
}
