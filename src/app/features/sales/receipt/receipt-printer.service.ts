import {
  ApplicationRef, ComponentRef, createComponent, DOCUMENT, EnvironmentInjector, inject, Injectable,
} from '@angular/core';
import { SaleReceipt } from '../../../shared/models/sale.model';
import { ReceiptSettings, TenantSettingsService } from '../../../core/settings/tenant-settings.service';
import { ReceiptComponent } from './receipt.component';
import { ReceiptBusiness, ReceiptBusinessService } from './receipt-business.service';

/**
 * Fişi body'nin doğrudan çocuğu olarak çizer ve `window.print()` çağırır. Yazdırma
 * sırasında `html.tm-printing-receipt` sınıfı sayfanın geri kalanını gizler
 * (bkz. ReceiptComponent stilleri). `afterprint` ile (ya da bir sonraki yazdırmada) temizlenir.
 */
@Injectable({ providedIn: 'root' })
export class ReceiptPrinterService {
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private readonly business = inject(ReceiptBusinessService);
  private readonly settings = inject(TenantSettingsService);
  private readonly document = inject(DOCUMENT);

  private host: HTMLElement | null = null;
  private ref: ComponentRef<ReceiptComponent> | null = null;

  /**
   * @param options Fiş ayarları; verilmezse kayıtlı `settings.receipt` (Ayarlar → Fiş). Test fişi taslağı verir.
   * @param businessOverride Fiş başlığı; verilmezse kayıtlı işletme bilgileri (test fişi önizlemedeki taslağı verir).
   */
  async print(receipt: SaleReceipt, options?: ReceiptSettings, businessOverride?: ReceiptBusiness): Promise<void> {
    const [business, saved] = await Promise.all([
      businessOverride ?? this.business.get(),
      options ? null : this.loadedSettings(),
    ]);
    const opts = options ?? saved ?? this.settings.receipt();
    this.cleanup();

    const doc = this.document;
    const host = doc.createElement('div');
    host.className = 'tm-receipt-host';
    doc.body.appendChild(host);

    const ref = createComponent(ReceiptComponent, { environmentInjector: this.injector, hostElement: host });
    ref.setInput('receipt', receipt);
    ref.setInput('business', business);
    ref.setInput('options', opts);
    this.appRef.attachView(ref.hostView);
    ref.changeDetectorRef.detectChanges();
    this.host = host;
    this.ref = ref;

    const view = doc.defaultView;
    doc.documentElement.classList.add('tm-printing-receipt');
    const done = () => {
      view?.removeEventListener('afterprint', done);
      this.cleanup();
    };
    view?.addEventListener('afterprint', done);
    view?.print();
  }

  /** Ayarlar henüz gelmediyse (ilk fiş) en fazla ~2 sn bekler; gelmezse varsayılanlar. */
  private async loadedSettings(): Promise<ReceiptSettings> {
    this.settings.ensureLoaded();
    for (let i = 0; i < 20 && !this.settings.loaded(); i++) await new Promise(r => setTimeout(r, 100));
    return this.settings.receipt();
  }

  private cleanup(): void {
    this.document.documentElement.classList.remove('tm-printing-receipt');
    if (this.ref) {
      this.appRef.detachView(this.ref.hostView);
      this.ref.destroy();
      this.ref = null;
    }
    this.host?.remove();
    this.host = null;
  }
}
