import { effect, inject, Injectable, Injector, untracked } from '@angular/core';
import { AuthService } from '../../core/auth/services/auth.service';
import { LoggerService } from '../../core/logging/logger.service';
import { FarmerLink } from '../../shared/models/farmer.model';
import { roundKurus } from '../credit/services/credit.utils';
import { CustomerLinkInfo, DEALER_FARMER_REPOSITORY } from '../farmer/data/repositories';
import { FarmerSyncService } from '../pos/services/farmer-sync.service';

/** Bu kadar bağlı çiftçiden fazlası için müşteri dinleyicisi açılmaz (POS / panel senkronu yine çalışır). */
export const LINK_WATCH_MAX = 200;

export type LinkSyncReason = 'initial' | 'balance' | 'upgrade';

/**
 * Bağlantı neden senkron istiyor? (saf; test edilir)
 *  - initial: çiftçi davetle yeni bağlandı / yeniden bağlandı, bayi hiç senkronlamadı (rapor Y6)
 *  - balance: müşteri kartındaki bakiye bağlantıdakinden farklı (tahsilat, başka terminaldeki satış, iptal)
 *  - upgrade: bağlantı vade/taksit alanları eklenmeden önce senkronlanmış (rapor #2)
 */
export function linkSyncReason(link: FarmerLink, customer: CustomerLinkInfo | null): LinkSyncReason | null {
  if (link.status !== 'active' || !customer) return null;
  if (!link.balanceUpdatedAt) return 'initial';
  if (roundKurus(link.balance ?? 0) !== roundKurus(customer.balance ?? 0)) return 'balance';
  if (link.overdueAmount === null) return 'upgrade';
  return null;
}

/**
 * Bayi oturumunda çiftçi bağlantılarını izler ve çiftçinin Borcum/Ambar ekranını kendiliğinden güncel tutar:
 * yeni bağlanan çiftçiye bağlantı öncesi satışlar + borç aktarılır, bakiye değişince yeniden senkronlanır,
 * müşteri kartına `farmerId` işareti yazılır (koparılınca silinir). Döngüye girmemesi için her bağlantı için
 * aynı durumda en fazla bir deneme yapılır.
 */
@Injectable({ providedIn: 'root' })
export class FarmerLinkWatcher {
  private readonly injector = inject(Injector);
  private readonly logger = inject(LoggerService);
  private readonly sync = inject(FarmerSyncService);
  private readonly auth = inject(AuthService);

  private tenantId: string | null = null;
  private unsubLinks: (() => void) | null = null;
  private readonly customers = new Map<string, { unsub: () => void; info: CustomerLinkInfo | null; link: FarmerLink }>();
  private readonly attempted = new Map<string, string>();
  private readonly marked = new Set<string>();

  /**
   * Bayi kabuğu açıkken oturumdaki işletmeyi izler (admin / kasiyer; çiftçi ve işletmesiz superadmin hariç).
   * Döner: izlemeyi bitiren fonksiyon (kabuk kapanınca çağrılır).
   */
  attachToSession(): () => void {
    const ref = effect(() => {
      const u = this.auth.currentUser();
      const ok = !!u && !!u.tenantId && u.accountType !== 'farmer' && (u.role === 'admin' || u.role === 'cashier');
      untracked(() => (ok ? this.start(u.tenantId) : this.stop()));
    }, { injector: this.injector });
    return () => { ref.destroy(); this.stop(); };
  }

  /** Aynı işletme için tekrar çağrılırsa bir şey yapmaz. */
  start(tenantId: string): void {
    if (!tenantId || this.tenantId === tenantId) return;
    this.stop();
    this.tenantId = tenantId;
    try {
      this.unsubLinks = this.repo().watchTenantLinks(tenantId, links => this.onLinks(links),
        err => this.logger.warn('Farmer link watcher stopped', err));
    } catch (err) {
      this.logger.warn('Farmer link watcher could not start', err);
    }
  }

  stop(): void {
    this.unsubLinks?.();
    this.unsubLinks = null;
    for (const c of this.customers.values()) c.unsub();
    this.customers.clear();
    this.attempted.clear();
    this.marked.clear();
    this.tenantId = null;
  }

  private repo() {
    return this.injector.get(DEALER_FARMER_REPOSITORY);
  }

  private onLinks(links: FarmerLink[]): void {
    const active = links.filter(l => l.status === 'active').slice(0, LINK_WATCH_MAX);
    const activeIds = new Set(active.map(l => l.customerId));
    for (const [cid, c] of this.customers) {
      if (activeIds.has(cid)) continue;
      c.unsub();
      this.customers.delete(cid);
      // Koparıldı: müşteri kartındaki işareti temizle
      const revoked = links.find(l => l.customerId === cid && l.status === 'revoked');
      if (revoked && c.info?.farmerId === revoked.farmerId) this.mark(revoked, null);
    }
    for (const link of active) {
      const cur = this.customers.get(link.customerId);
      if (cur) { cur.link = link; this.evaluate(link.customerId); continue; }
      const entry: { unsub: () => void; info: CustomerLinkInfo | null; link: FarmerLink } = { unsub: () => undefined, info: null, link };
      this.customers.set(link.customerId, entry);
      try {
        entry.unsub = this.repo().watchCustomer(link.customerId, info => {
          entry.info = info;
          this.evaluate(link.customerId);
        }, err => this.logger.warn('Farmer link watcher: customer listener failed', link.customerId, err));
      } catch (err) {
        this.logger.warn('Farmer link watcher: customer listener failed', link.customerId, err);
      }
    }
  }

  private evaluate(customerId: string): void {
    const c = this.customers.get(customerId);
    if (!c?.info) return;
    const { link, info } = c;
    if (info.farmerId !== link.farmerId) this.mark(link, link.farmerId);
    const reason = linkSyncReason(link, info);
    if (!reason) return;
    const sig = reason === 'upgrade' ? 'upgrade' : `${reason}|${info.balance}|${link.balance}`;
    if (this.attempted.get(link.id) === sig) return;
    this.attempted.set(link.id, sig);
    void this.sync.syncLink(link).catch(err => this.logger.warn('Farmer link watcher: sync failed', link.id, err));
  }

  private mark(link: FarmerLink, farmerId: string | null): void {
    const key = `${link.customerId}|${farmerId}`;
    if (this.marked.has(key)) return;
    this.marked.add(key);
    void this.repo().setCustomerFarmerId(link.customerId, farmerId)
      .catch(err => this.logger.warn('customers.farmerId could not be written', link.customerId, err));
  }
}
