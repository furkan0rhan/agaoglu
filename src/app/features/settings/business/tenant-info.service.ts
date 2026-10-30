import { inject, Injectable } from '@angular/core';
import { Firestore, doc, getDoc, serverTimestamp, updateDoc } from '@angular/fire/firestore';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LoggerService } from '../../../core/logging/logger.service';

/**
 * tenants/{tenantId} dokümanındaki işletme (fiş başlığı) bilgileri.
 * Alan adları POS/fiş tarafıyla ortaktır: name, address, phone, taxOffice, taxNo, receiptFooter, dealerLicenseNo.
 * Okuma: işletmedeki herkes (kurallar: get → inTenant). Yazma: yalnızca admin (update → isTenantAdmin, ownerId değişmez;
 * izinli alanlar firestore.rules tenant `hasOnly` listesinde).
 */
export interface TenantInfo {
  name: string;
  address: string;
  phone: string;
  taxOffice: string;
  taxNo: string;
  receiptFooter: string;
  /** Bitki koruma ürünleri bayi izin (ruhsat) no — fişte ve reçeteli satış kayıtlarında. Eski kayıtlarda yok. */
  dealerLicenseNo?: string;
}

export const TENANT_INFO_FIELDS = ['name', 'address', 'phone', 'taxOffice', 'taxNo', 'receiptFooter', 'dealerLicenseNo'] as const;
export type TenantInfoField = (typeof TENANT_INFO_FIELDS)[number];

export const EMPTY_TENANT_INFO: Required<TenantInfo> = {
  name: '', address: '', phone: '', taxOffice: '', taxNo: '', receiptFooter: '', dealerLicenseNo: '',
};

@Injectable({ providedIn: 'root' })
export class TenantInfoService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly logger = inject(LoggerService);

  /**
   * Best-effort: okunamazsa (eski kurallarda `tenants` yok → permission-denied, çevrimdışı) boş bilgi döner;
   * fiş / ekstre / hatırlatma işletme bilgisi olmadan çalışmaya devam eder.
   */
  async get(): Promise<Required<TenantInfo>> {
    let data: Record<string, unknown> = {};
    try {
      const snap = await getDoc(doc(this.firestore, 'tenants', this.auth.currentTenantId()));
      data = snap.exists() ? snap.data() : {};
    } catch (err) {
      this.logger.warn('İşletme bilgisi okunamadı, boş kullanılıyor', err);
    }
    const out = { ...EMPTY_TENANT_INFO };
    for (const f of TENANT_INFO_FIELDS) {
      const v = data[f];
      out[f] = typeof v === 'string' ? v : '';
    }
    return out;
  }

  /** Yalnızca TenantInfo alanlarını (kırpılmış) yazar; ownerId/createdAt'e dokunmaz. */
  async save(info: TenantInfo): Promise<void> {
    await this.savePartial(info);
  }

  /** Verilen TenantInfo alanlarını (kırpılmış) yazar; verilmeyenlere dokunmaz. */
  async savePartial(info: Partial<TenantInfo>): Promise<void> {
    const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
    for (const f of TENANT_INFO_FIELDS) {
      if (info[f] !== undefined) patch[f] = (info[f] ?? '').trim();
    }
    await updateDoc(doc(this.firestore, 'tenants', this.auth.currentTenantId()), patch);
  }

  /** Destek ekibinin (superadmin) bu işletmenin verisine erişimi açık mı? Alan yoksa true. */
  async getSupportAccess(): Promise<boolean> {
    try {
      const snap = await getDoc(doc(this.firestore, 'tenants', this.auth.currentTenantId()));
      return !snap.exists() || snap.data()['supportAccess'] !== false;
    } catch (err) {
      this.logger.warn('Destek erişimi okunamadı, varsayılan (açık) kullanılıyor', err);
      return true;
    }
  }

  /**
   * KVKK/şeffaflık: işletme admini destek erişimini açar/kapatır. Kapalıyken superadmin destek moduna
   * giremez ve kurallar işletme verisine erişimini reddeder (lisans alanları hariç).
   */
  async setSupportAccess(enabled: boolean): Promise<void> {
    await updateDoc(doc(this.firestore, 'tenants', this.auth.currentTenantId()), {
      supportAccess: enabled,
      updatedAt: serverTimestamp(),
    });
  }
}
