import { inject, Injectable } from '@angular/core';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';
import {
  Firestore,
  Timestamp,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuditLogService } from '../../core/auth/services/audit-log.service';
import { toTenant } from '../../core/license/license.util';
import { AppUser, isUserRole, Tenant, TenantPlan, TenantStatus, UserRole } from '../../shared/models/user.model';

/** Superadmin'in değiştirebildiği lisans alanları. */
export interface LicensePatch {
  plan?: TenantPlan;
  status?: TenantStatus;
  trialEndsAt?: Date | null;
  licenseExpiresAt?: Date | null;
  maxUsers?: number;
}

function toUser(id: string, data: Record<string, unknown>): AppUser {
  const created = data['createdAt'];
  const last = data['lastLogin'];
  return {
    id,
    tenantId: typeof data['tenantId'] === 'string' ? data['tenantId'] : '',
    email: (data['email'] as string) ?? '',
    displayName: (data['displayName'] as string) ?? '',
    role: isUserRole(data['role']) ? data['role'] : 'staff',
    isActive: data['isActive'] === true,
    createdAt: created instanceof Timestamp ? created.toDate() : new Date(0),
    lastLogin: last instanceof Timestamp ? last.toDate() : undefined,
  };
}

function watch<T>(factory: (next: (v: T) => void, error: (e: unknown) => void) => () => void): Observable<T> {
  return new Observable<T>(sub => factory(v => sub.next(v), e => sub.error(e)));
}

/**
 * Platform yöneticisi (superadmin) işlemleri. Kurallar: tenants list/update ve users list/update
 * yalnız isSuperAdmin(). Her değişiklik auditLogs'a yazılır.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly audit = inject(AuditLogService);

  watchTenants(): Observable<Tenant[]> {
    return watch((next, error) => onSnapshot(
      collection(this.firestore, 'tenants'),
      snap => next(snap.docs.map(d => toTenant(d.id, d.data()))),
      error,
    ));
  }

  watchTenant(id: string): Observable<Tenant | null> {
    return watch((next, error) => onSnapshot(
      doc(this.firestore, 'tenants', id),
      snap => next(snap.exists() ? toTenant(snap.id, snap.data()) : null),
      error,
    ));
  }

  /** Tüm kullanıcılar (sahip e-postası + kullanıcı sayısı için). */
  watchAllUsers(): Observable<AppUser[]> {
    return watch((next, error) => onSnapshot(
      collection(this.firestore, 'users'),
      snap => next(snap.docs.map(d => toUser(d.id, d.data()))),
      error,
    ));
  }

  watchTenantUsers(tenantId: string): Observable<AppUser[]> {
    return watch((next, error) => onSnapshot(
      query(collection(this.firestore, 'users'), where('tenantId', '==', tenantId)),
      snap => next(snap.docs.map(d => toUser(d.id, d.data()))),
      error,
    ));
  }

  async updateLicense(tenant: Tenant, patch: LicensePatch, detail: string): Promise<void> {
    const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.plan !== undefined) data['plan'] = patch.plan;
    if (patch.status !== undefined) data['status'] = patch.status;
    if (patch.maxUsers !== undefined) data['maxUsers'] = Math.max(1, Math.floor(patch.maxUsers));
    if (patch.trialEndsAt !== undefined) data['trialEndsAt'] = patch.trialEndsAt ? Timestamp.fromDate(patch.trialEndsAt) : null;
    if (patch.licenseExpiresAt !== undefined) {
      data['licenseExpiresAt'] = patch.licenseExpiresAt ? Timestamp.fromDate(patch.licenseExpiresAt) : null;
    }
    await updateDoc(doc(this.firestore, 'tenants', tenant.id), data);
    await this.audit.log(tenant.id, 'license_change', detail);
  }

  async setUserRole(user: AppUser, role: UserRole): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', user.id), { role });
    await this.audit.log(user.tenantId, 'user_change', `${user.email}: rol ${user.role} → ${role}`);
  }

  async setUserActive(user: AppUser, isActive: boolean): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', user.id), { isActive });
    await this.audit.log(user.tenantId, 'user_change', `${user.email}: ${isActive ? 'aktifleştirildi' : 'pasife alındı'}`);
  }

  async sendPasswordReset(user: AppUser): Promise<void> {
    await sendPasswordResetEmail(this.auth, user.email);
    await this.audit.log(user.tenantId, 'user_change', `${user.email}: şifre sıfırlama e-postası gönderildi`);
  }
}
