import { computed, inject, Injectable, signal } from '@angular/core';
import { Firestore, doc, onSnapshot, serverTimestamp, updateDoc } from '@angular/fire/firestore';
import { AuthService } from '../auth/services/auth.service';
import { LoggerService } from '../logging/logger.service';
import {
  CreditSettings, DEFAULT_TENANT_SETTINGS, parseTenantSettings, ReceiptSettings, TenantSettings,
} from './tenant-settings.model';

export * from './tenant-settings.model';

/**
 * `tenants/{tenantId}.settings` okuyucu. İlk `ensureLoaded()` çağrısında tenant dokümanına canlı abone olur
 * (tek doküman, değişince anında güncellenir). Okunamazsa / alan yoksa varsayılanlar (mevzuat gereği
 * en sıkı seçenek: `prescriptionMode: 'required'`) kullanılır.
 *
 * Alanlar (tam liste ve varsayılanlar: tenant-settings.model.ts):
 * - `prescriptionMode()`                       → POS e-reçete
 * - `expiryWarnDays()` / `expiryCriticalDays()` → SKT "yakın" / "kritik" eşikleri (ürün listesi, dashboard)
 * - `receipt()`                                → fiş: kâğıt genişliği, başlık notu, logo, GTS/ruhsat gösterimi
 * - `credit()`                                 → veresiye: varsayılan vade, yeni müşteri limiti, hatırlatma şablonu
 * Okuyan bileşen önce `ensureLoaded()` çağırmalı (idempotent).
 */
@Injectable({ providedIn: 'root' })
export class TenantSettingsService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly logger = inject(LoggerService);

  private readonly _settings = signal<TenantSettings>(DEFAULT_TENANT_SETTINGS);
  private readonly _loaded = signal(false);
  private subscribedTenant: string | null = null;
  private unsub: (() => void) | null = null;

  readonly settings = this._settings.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly prescriptionMode = computed(() => this._settings().prescriptionMode);
  readonly expiryWarnDays = computed(() => this._settings().expiryWarnDays);
  readonly expiryCriticalDays = computed(() => this._settings().expiryCriticalDays);
  readonly receipt = computed(() => this._settings().receipt);
  readonly credit = computed(() => this._settings().credit);

  /** Geçerli işletmenin ayarlarına (bir kez) abone olur; işletme değiştiyse yeniden abone olur. */
  ensureLoaded(): void {
    const tenantId = this.auth.currentTenantId();
    if (!tenantId || tenantId === this.subscribedTenant) return;
    this.unsub?.();
    this.subscribedTenant = tenantId;
    this._settings.set(DEFAULT_TENANT_SETTINGS);
    this._loaded.set(false);
    this.unsub = onSnapshot(
      doc(this.firestore, 'tenants', tenantId),
      snap => {
        this._settings.set(parseTenantSettings(snap.exists() ? snap.data()['settings'] : null));
        this._loaded.set(true);
      },
      err => {
        this.logger.warn('Tenant settings could not be read, using defaults', err);
        this._settings.set(DEFAULT_TENANT_SETTINGS);
        this._loaded.set(true);
        this.unsub = null;
        // permission-denied (ör. eski kurallarda `tenants` yok): bu işletme için tekrar deneme, varsayılanlarla devam.
        // Geçici hatada bir sonraki ensureLoaded() yeniden abone olur.
        if ((err as { code?: string })?.code !== 'permission-denied') this.subscribedTenant = null;
      },
    );
  }

  /**
   * Ayarları kısmen günceller (yalnızca admin; kurallar `settings` alanına izin verir).
   * Alt haritalar (`receipt`, `credit`) alan alan yazılır (`settings.receipt.showGts`), diğer alanlar korunur.
   */
  async update(patch: Partial<Omit<TenantSettings, 'receipt' | 'credit'>> & {
    receipt?: Partial<ReceiptSettings>;
    credit?: Partial<CreditSettings>;
  }): Promise<void> {
    const tenantId = this.auth.currentTenantId();
    if (!tenantId) throw new Error('No tenant');
    const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
    for (const [k, v] of Object.entries(patch)) {
      if ((k === 'receipt' || k === 'credit') && v && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) data[`settings.${k}.${sk}`] = sv;
      } else {
        data[`settings.${k}`] = v;
      }
    }
    await updateDoc(doc(this.firestore, 'tenants', tenantId), data);
  }
}
