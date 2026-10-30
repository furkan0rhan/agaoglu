import { inject, Injectable, Injector } from '@angular/core';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { NetworkService } from '../../../core/offline/network.service';
import { FarmerLink } from '../../../shared/models/farmer.model';
import { DEALER_FARMER_REPOSITORY } from '../../farmer/data/repositories';

/**
 * Satış / iptal / tahsilat sonrası çiftçi ambarı + borç senkronu (8.7). Bağlantı HER ZAMAN `farmerLinks`'ten bulunur
 * (`findLinkForCustomer`): gerçek davetle bağlanan çiftçide `customers.farmerId` olmayabilir (rapor #1).
 * Asla fırlatmaz — satış akışını bozmaz. Aynı müşteri için eşzamanlı istekler tek senkrona indirilir.
 */
@Injectable({ providedIn: 'root' })
export class FarmerSyncService {
  private readonly auth = inject(AuthService);
  private readonly logger = inject(LoggerService);
  private readonly network = inject(NetworkService);
  private readonly injector = inject(Injector);
  private tenantName: { tenantId: string; name: string } | null = null;
  /** customerId → sürmekte olan senkron; `again` = bu arada yeni istek geldi, bitince bir kez daha çalış. */
  private readonly inFlight = new Map<string, { promise: Promise<number>; again: boolean }>();

  /**
   * Beklemeden çağrılabilir; hata yalnız loglanır. İkinci parametre geriye dönük uyumluluk için kabul edilir
   * (eski çağıranlar müşteri kartındaki `farmerId`'yi geçirir) ama karar için kullanılmaz.
   */
  async syncCustomer(customerId: string | null | undefined, _farmerIdHint?: string | null): Promise<number> {
    if (!customerId) return 0;
    try {
      if (!this.network.isOnline()) return 0;
      const tenantId = this.auth.currentTenantId();
      if (!tenantId) return 0;
      const link = await this.repo().findLinkForCustomer(tenantId, customerId);
      if (!link || link.status !== 'active') return 0;
      return await this.syncLink(link);
    } catch (err) {
      this.logger.warn('Farmer barn sync failed (sale is unaffected)', customerId, err);
      return 0;
    }
  }

  /** Bilinen (aktif) bağlantı için senkron. Bağlantı izleyicisi (FarmerLinkWatcher) de bunu kullanır. */
  syncLink(link: FarmerLink): Promise<number> {
    if (link.status !== 'active') return Promise.resolve(0);
    const cur = this.inFlight.get(link.customerId);
    if (cur) { cur.again = true; return cur.promise; }
    const entry = { promise: Promise.resolve(0), again: false };
    entry.promise = (async () => {
      let n = 0;
      try {
        do {
          entry.again = false;
          n += await this.run(link);
        } while (entry.again);
        return n;
      } finally {
        this.inFlight.delete(link.customerId);
      }
    })();
    this.inFlight.set(link.customerId, entry);
    return entry.promise;
  }

  private async run(link: FarmerLink): Promise<number> {
    const repo = this.repo();
    if (this.tenantName?.tenantId !== link.tenantId) {
      this.tenantName = { tenantId: link.tenantId, name: await repo.getTenantName(link.tenantId) };
    }
    return repo.syncCustomerToFarmer(link, this.tenantName.name || link.tenantName);
  }

  /** Depo yalnız gerektiğinde oluşturulur (çiftçi modülü kullanılmayan işletmede yük yok). */
  private repo() {
    return this.injector.get(DEALER_FARMER_REPOSITORY);
  }
}
