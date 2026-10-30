import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { TenantInfo, TenantInfoService } from '../../settings/business/tenant-info.service';

/** Fiş başlığı = Ayarlar → İşletme bilgileri (tenants/{tenantId}). */
export type ReceiptBusiness = TenantInfo;

export const RECEIPT_FALLBACK_NAME = 'Tarım Market Pro';

/**
 * TenantInfoService üstünde ince katman: tenant başına önbellek (POS'ta her fişte okuma yok)
 * ve ad boşsa / okunamazsa "Tarım Market Pro".
 */
@Injectable({ providedIn: 'root' })
export class ReceiptBusinessService {
  private readonly tenantInfo = inject(TenantInfoService);
  private readonly auth = inject(AuthService);
  private readonly logger = inject(LoggerService);
  private cache: { tenantId: string; value: ReceiptBusiness } | null = null;

  async get(): Promise<ReceiptBusiness> {
    const tenantId = this.auth.currentTenantId();
    if (this.cache?.tenantId === tenantId) return this.cache.value;
    const fallback: ReceiptBusiness = {
      name: RECEIPT_FALLBACK_NAME, address: '', phone: '', taxOffice: '', taxNo: '', receiptFooter: '',
    };
    if (!tenantId) return fallback;
    try {
      const info = await this.tenantInfo.get();
      const value = { ...info, name: info.name.trim() || RECEIPT_FALLBACK_NAME };
      this.cache = { tenantId, value };
      return value;
    } catch (err) {
      this.logger.warn('Receipt: tenant info could not be read', err);
      return fallback;
    }
  }

  /** Ayarlar'da işletme bilgisi değişince çağrılabilir. */
  invalidate(): void { this.cache = null; }
}
