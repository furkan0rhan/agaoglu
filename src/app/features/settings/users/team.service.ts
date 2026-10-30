import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LicenseService } from '../../../core/license/license.service';
import { AppUser, Invite, isUserRole, UserRole } from '../../../shared/models/user.model';

export interface InviteRow extends Invite {
  id: string;
}

/** Aynı işletmedeki (tenant) kullanıcılar ve bekleyen davetler. Yalnızca admin. */
@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly license = inject(LicenseService);

  watchMembers(): Observable<AppUser[]> {
    const tenantId = this.auth.currentTenantId();
    return new Observable<AppUser[]>(sub => {
      const q = query(collection(this.firestore, 'users'), where('tenantId', '==', tenantId));
      return onSnapshot(
        q,
        snap => sub.next(snap.docs.map(d => {
          const data = d.data();
          const created = data['createdAt'];
          const last = data['lastLogin'];
          return {
            id: d.id,
            tenantId: data['tenantId'],
            email: data['email'] ?? '',
            displayName: data['displayName'] ?? '',
            role: isUserRole(data['role']) ? data['role'] : 'staff',
            isActive: data['isActive'] === true,
            createdAt: created instanceof Timestamp ? created.toDate() : new Date(),
            lastLogin: last instanceof Timestamp ? last.toDate() : undefined,
          } as AppUser;
        })),
        err => sub.error(err),
      );
    });
  }

  watchInvites(): Observable<InviteRow[]> {
    const tenantId = this.auth.currentTenantId();
    return new Observable<InviteRow[]>(sub => {
      const q = query(collection(this.firestore, 'invites'), where('tenantId', '==', tenantId));
      return onSnapshot(
        q,
        snap => sub.next(snap.docs.map(d => ({ id: d.id, ...(d.data() as Invite) }))),
        err => sub.error(err),
      );
    });
  }

  /** Davet oluşturur. Aynı e-postaya zaten davet varsa kurallar reddeder (permission-denied). */
  async createInvite(email: string, role: UserRole): Promise<void> {
    // Lisans: salt okunur modda veya maxUsers dolduysa LicenseError ('license/read-only' | 'license/max-users')
    await this.license.assertCanAddUser();
    const key = email.trim().toLocaleLowerCase('en');
    const invite: Invite & { createdAt: unknown } = {
      email: key,
      tenantId: this.auth.currentTenantId(),
      role,
      createdBy: this.auth.currentUserId(),
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(this.firestore, 'invites', key), invite);
  }

  async deleteInvite(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'invites', id));
  }

  async setRole(uid: string, role: UserRole): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', uid), { role });
  }

  async setActive(uid: string, isActive: boolean): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', uid), { isActive });
  }
}
