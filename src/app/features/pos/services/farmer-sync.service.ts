import { inject, Injectable, Injector } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { NetworkService } from '../../../core/offline/network.service';
import { DEALER_FARMER_REPOSITORY } from '../../farmer/data/repositories';

/**
 * Satış / iptal sonrası çiftçi ambarı senkronu (8.7): müşteri bir çiftçiye bağlıysa (customers.farmerId)
 * aktif bağlantı bulunur ve `syncCustomerToFarmer` çağrılır. Asla fırlatmaz — satış akışını bozmaz.
 */
@Injectable({ providedIn: 'root' })
export class FarmerSyncService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly logger = inject(LoggerService);
  private readonly network = inject(NetworkService);
  private readonly injector = inject(Injector);
  private tenantName: { tenantId: string; name: string } | null = null;

  /** Beklemeden çağrılabilir; hata yalnız loglanır. `farmerId` biliniyorsa müşteri okuması atlanır. */
  async syncCustomer(customerId: string | null | undefined, farmerId?: string | null): Promise<number> {
    if (!customerId) return 0;
    try {
      if (!this.network.isOnline()) return 0;
      const tenantId = this.auth.currentTenantId();
      let fid = farmerId;
      if (fid === undefined) {
        const snap = await getDoc(doc(this.firestore, 'customers', customerId));
        const v = snap.exists() ? snap.data()['farmerId'] : null;
        fid = typeof v === 'string' && v ? v : null;
      }
      if (!fid) return 0;
      // Depo yalnız gerektiğinde oluşturulur (çiftçi modülü kullanılmayan işletmede yük yok)
      const repo = this.injector.get(DEALER_FARMER_REPOSITORY);
      const link = await repo.findLinkForCustomer(tenantId, customerId);
      if (!link || link.status !== 'active') return 0;
      if (this.tenantName?.tenantId !== tenantId) {
        this.tenantName = { tenantId, name: await repo.getTenantName(tenantId) };
      }
      return await repo.syncCustomerToFarmer(link, this.tenantName.name);
    } catch (err) {
      this.logger.warn('Farmer barn sync failed (sale is unaffected)', customerId, err);
      return 0;
    }
  }
}
