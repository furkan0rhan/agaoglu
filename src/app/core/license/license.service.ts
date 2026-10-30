import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getCountFromServer,
  onSnapshot,
  query,
  where,
} from '@angular/fire/firestore';
import { AuthService } from '../auth/services/auth.service';
import { LoggerService } from '../logging/logger.service';
import { DEFAULT_MAX_USERS, Tenant } from '../../shared/models/user.model';
import { computeLicense, isReadOnlyState, LicenseInfo, toTenant } from './license.util';

export class LicenseError extends Error {
  constructor(readonly code: 'license/read-only' | 'license/max-users') { super(code); }
}

/**
 * Geçerli işletmenin lisansı (tenants/{tenantId}). Doküman canlı dinlenir; superadmin lisansı
 * değiştirince anında yansır. Asıl zorlama Firestore kurallarındadır (licenseOk); buradaki kontroller
 * kullanıcıya anlamlı mesaj göstermek içindir.
 */
@Injectable({ providedIn: 'root' })
export class LicenseService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly logger = inject(LoggerService);

  readonly tenant = signal<Tenant | null>(null);
  /** Saat ilerledikçe (uzun açık kalan oturum) yeniden hesaplansın. */
  private readonly now = signal(new Date());

  readonly info = computed<LicenseInfo>(() => computeLicense(this.tenant(), this.now()));
  readonly state = computed(() => this.info().state);
  /** Süresi dolmuş / askıya alınmış: yazma yok. Superadmin (destek modu) hariç. */
  readonly readOnly = computed(() => isReadOnlyState(this.state()) && !this.auth.isSuperAdmin());
  readonly showWarning = computed(() => this.state() === 'warning');

  private unsub: (() => void) | null = null;
  private watching = '';

  constructor() {
    effect(() => {
      const tenantId = this.auth.currentTenantId();
      if (tenantId === this.watching) return;
      this.unsub?.();
      this.unsub = null;
      this.watching = tenantId;
      this.tenant.set(null);
      if (!tenantId) return;
      this.unsub = onSnapshot(
        doc(this.firestore, 'tenants', tenantId),
        snap => this.tenant.set(snap.exists() ? toTenant(snap.id, snap.data()) : null),
        err => this.logger.warn('Lisans bilgisi okunamadı', err),
      );
    });
    setInterval(() => this.now.set(new Date()), 60 * 60 * 1000);
  }

  /** Yazma öncesi basit kontrol (servis seviyesi). */
  assertWritable(): void {
    if (this.readOnly()) throw new LicenseError('license/read-only');
  }

  maxUsers(): number {
    const t = this.tenant();
    if (!t?.plan) return Number.POSITIVE_INFINITY; // eski işletme: sınırsız
    return t.maxUsers ?? DEFAULT_MAX_USERS[t.plan];
  }

  /**
   * Ekip daveti öncesi: aktif kullanıcı + bekleyen davet sayısı maxUsers'ı aşmasın.
   * Not: kurallar sayım yapamaz (Spark, Functions yok); bu sınır yalnız istemcide zorlanır.
   */
  async assertCanAddUser(): Promise<void> {
    this.assertWritable();
    const max = this.maxUsers();
    if (!Number.isFinite(max)) return;
    const tenantId = this.auth.currentTenantId();
    const [users, invites] = await Promise.all([
      getCountFromServer(query(collection(this.firestore, 'users'),
        where('tenantId', '==', tenantId), where('isActive', '==', true))),
      getCountFromServer(query(collection(this.firestore, 'invites'), where('tenantId', '==', tenantId))),
    ]);
    if (users.data().count + invites.data().count >= max) throw new LicenseError('license/max-users');
  }
}
