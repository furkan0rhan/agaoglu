import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Firestore, collection, doc, getDocs, limit, onSnapshot, query, where } from '@angular/fire/firestore';
import { AuthService } from '../../core/auth/services/auth.service';
import { LoggerService } from '../../core/logging/logger.service';
import type { SettingsSectionKey } from './settings-sections';
import { tenantSetupFlags } from './setup-flags';

export type SetupItemKey = 'business' | 'receipt' | 'product' | 'customer' | 'team' | 'backup';

export interface SetupItem {
  key: SetupItemKey;
  done: boolean;
  /** Ayarlar içi bölüm ya da uygulama rotası. */
  section?: SettingsSectionKey;
  route?: string;
}

/**
 * Ayarlar → kurulum ilerleme kartı. Gerçek verilerden: işletme bilgisi (ad, telefon, adres, vergi no),
 * logo / fiş başlığı, ilk ürün, ilk müşteri, ekip (ikinci kullanıcı ya da bekleyen davet), ilk yedek.
 * Sayfa düzeyinde sağlanır (`providers`); bölümler kayıttan sonra `refresh()` çağırabilir.
 */
@Injectable()
export class SetupProgressService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly logger = inject(LoggerService);

  private readonly tenantFlags = signal({ business: false, receipt: false, backup: false });
  private readonly counts = signal({ product: false, customer: false, team: false });
  private readonly tenantLoaded = signal(false);
  private readonly countsLoaded = signal(false);
  /** Hem işletme dokümanı hem sayımlar geldi (yarım veriyle "%0" gösterilmesin). */
  readonly loaded = computed(() => this.tenantLoaded() && this.countsLoaded());
  private unsub: (() => void) | null = null;

  readonly items = computed<SetupItem[]>(() => {
    const t = this.tenantFlags(), c = this.counts();
    return [
      { key: 'business', done: t.business, section: 'business' },
      { key: 'receipt', done: t.receipt, section: 'receipt' },
      { key: 'product', done: c.product, route: '/products/new' },
      { key: 'customer', done: c.customer, route: '/customers/new' },
      { key: 'team', done: c.team, section: 'team' },
      { key: 'backup', done: t.backup, section: 'backup' },
    ];
  });
  readonly percent = computed(() => {
    const list = this.items();
    return Math.round((list.filter(i => i.done).length / list.length) * 100);
  });
  readonly missing = computed(() => this.items().filter(i => !i.done));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.unsub?.());
  }

  /** Yalnız admin çağırır (kurallar: kullanıcı/davet listesi admin'e açık). */
  start(): void {
    const tenantId = this.auth.currentTenantId();
    if (!tenantId || this.unsub) return;
    this.unsub = onSnapshot(
      doc(this.firestore, 'tenants', tenantId),
      snap => {
        this.tenantFlags.set(tenantSetupFlags(snap.exists() ? snap.data() : null));
        this.tenantLoaded.set(true);
      },
      err => this.logger.warn('Setup: tenant could not be read', err),
    );
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const tenantId = this.auth.currentTenantId();
    if (!tenantId) return;
    const one = (name: string, n = 1) =>
      getDocs(query(collection(this.firestore, name), where('tenantId', '==', tenantId), limit(n)))
        .then(s => s.size)
        .catch(err => { this.logger.warn(`Setup: ${name} count failed`, err); return -1; });
    const [products, customers, users, invites] = await Promise.all([
      one('products'), one('customers'), one('users', 2), one('invites'),
    ]);
    // Okunamadıysa (-1, ör. çevrimdışı) kartı gösterme: yanlış "eksik" uyarısı vermesin
    if ([products, customers, users, invites].includes(-1)) return;
    this.counts.set({ product: products > 0, customer: customers > 0, team: users > 1 || invites > 0 });
    this.countsLoaded.set(true);
  }
}
