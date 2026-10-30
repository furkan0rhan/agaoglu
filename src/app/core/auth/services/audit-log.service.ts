import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  Firestore,
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuditAction, AuditLog } from '../../../shared/models/user.model';

/**
 * auditLogs koleksiyonu: superadmin işlemlerinin değiştirilemez kaydı.
 * Kurallar: create yalnız superadmin (actorUid == kendi uid), read superadmin + o işletmenin admini,
 * update/delete yok. AuthService'e bağımlı değildir (döngüsel bağımlılık olmasın diye Auth'tan okur).
 */
@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  async log(tenantId: string, action: AuditAction, detail: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || !tenantId) return;
    await addDoc(collection(this.firestore, 'auditLogs'), {
      tenantId,
      actorUid: user.uid,
      actorEmail: user.email ?? '',
      action,
      detail: detail.slice(0, 500),
      createdAt: serverTimestamp(),
    });
  }

  /** Bir işletmenin son kayıtları (yeniden eskiye). İndeks: auditLogs (tenantId ASC, createdAt DESC). */
  watchForTenant(tenantId: string, max = 50): Observable<AuditLog[]> {
    return new Observable<AuditLog[]>(sub => {
      const q = query(
        collection(this.firestore, 'auditLogs'),
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc'),
        limit(max),
      );
      return onSnapshot(
        q,
        snap => sub.next(snap.docs.map(d => toAuditLog(d.id, d.data()))),
        err => sub.error(err),
      );
    });
  }

  /** Tüm işletmelerin son kayıtları (yalnız superadmin). */
  watchRecent(max = 30): Observable<AuditLog[]> {
    return new Observable<AuditLog[]>(sub => {
      const q = query(collection(this.firestore, 'auditLogs'), orderBy('createdAt', 'desc'), limit(max));
      return onSnapshot(
        q,
        snap => sub.next(snap.docs.map(d => toAuditLog(d.id, d.data()))),
        err => sub.error(err),
      );
    });
  }
}

export function toAuditLog(id: string, data: Record<string, unknown>): AuditLog {
  const created = data['createdAt'];
  return {
    id,
    tenantId: String(data['tenantId'] ?? ''),
    actorUid: String(data['actorUid'] ?? ''),
    actorEmail: String(data['actorEmail'] ?? ''),
    action: data['action'] as AuditAction,
    detail: String(data['detail'] ?? ''),
    createdAt: created instanceof Timestamp ? created.toDate() : null,
  };
}
