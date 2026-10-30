import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { LangService } from '../../../core/i18n/lang.service';
import {
  DEFAULT_RECEIPT_SETTINGS, ReceiptPaperWidth, ReceiptSettings, SETTINGS_LIMITS, TenantSettingsService,
} from '../../../core/settings/tenant-settings.service';
import { GlassCardComponent, SegmentedComponent, SettingsRowComponent, StatusBadgeComponent, UiSegmentOption } from '../../../shared/ui';
import { ReceiptBusinessService } from '../../sales/receipt/receipt-business.service';
import { ReceiptPrinterService } from '../../sales/receipt/receipt-printer.service';
import { ReceiptComponent } from '../../sales/receipt/receipt.component';
import { sampleReceipt } from '../../sales/receipt/receipt.utils';
import { EMPTY_TENANT_INFO, TenantInfo, TenantInfoService } from '../business/tenant-info.service';
import { injectSettingsTexts } from '../settings.i18n';

/** Görseli fiş için küçültür (en fazla 384×160 px) ve data URL döner. Çok büyükse JPEG'e düşer. */
export async function shrinkLogo(file: File, maxChars: number): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, 384 / img.naturalWidth, 160 / img.naturalHeight);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = 'white'; // şeffaf alanlar termal kâğıtta beyaz
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const png = canvas.toDataURL('image/png');
    if (png.length <= maxChars) return png;
    for (const q of [0.85, 0.7, 0.55]) {
      const jpg = canvas.toDataURL('image/jpeg', q);
      if (jpg.length <= maxChars) return jpg;
    }
    return '';
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Fiş & yazıcı: kâğıt genişliği, başlık notu, alt not, logo, bayi izin no / ruhsat no / GTS gösterimi,
 * canlı önizleme ve test yazdırma. Ayarlar `tenants.settings.receipt.*`; alt not mevcut `tenants.receiptFooter`.
 */
@Component({
  selector: 'app-receipt-section',
  standalone: true,
  imports: [
    FormsModule, ButtonModule, InputTextModule, ToggleSwitchModule,
    GlassCardComponent, SettingsRowComponent, SegmentedComponent, StatusBadgeComponent, ReceiptComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  styles: `
    /* Termal kâğıt önizlemesi: her iki temada beyaz kâğıt + siyah yazı (gerçek baskı gibi) */
    .paper { background: #fff; color: #111; flex: none;
      box-shadow: 0 1px 0 rgba(0,0,0,.06), 0 8px 24px -12px rgba(0,0,0,.35); }
  `,
  template: `
    @if (!loaded()) {
      <div class="ui-card flex flex-col gap-3 p-4" aria-hidden="true">
        @for (i of [1, 2, 3, 4]; track i) { <div class="h-11 animate-pulse rounded-token-md bg-surface-muted"></div> }
      </div>
    } @else {
    <div class="grid grid-cols-1 items-start gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <ui-glass-card [title]="s().sections.receipt.title" [subtitle]="s().sections.receipt.desc" icon="pi-print" padding="none">
        <div card-actions class="flex items-center gap-2">
          @if (dirty()) {
            <ui-status-badge tone="warning" size="sm" dot class="hidden sm:inline-flex">{{ s().unsaved }}</ui-status-badge>
          }
          <p-button [label]="t().common.save" icon="pi pi-check" size="small" [severity]="dirty() ? 'success' : 'secondary'"
            [loading]="saving()" [disabled]="!dirty()" (onClick)="save()" />
        </div>

        <ui-settings-row [title]="s().paperWidth" [description]="s().paperWidthDesc">
          <ui-segmented [options]="widthOptions" [value]="draft().paperWidth" (valueChange)="patch({ paperWidth: $event! })"
            [ariaLabel]="s().paperWidth" />
        </ui-settings-row>

        <ui-settings-row [title]="s().logo" [description]="s().logoDesc">
          @if (draft().logo) {
            <img [src]="draft().logo" alt="" class="h-10 max-w-[140px] rounded-token-sm border border-line bg-surface object-contain p-1" />
          } @else {
            <ui-status-badge tone="accent" size="sm" icon="pi-exclamation-circle">{{ s().logoMissing }}</ui-status-badge>
          }
          <label for="rc-logo" class="tap inline-flex cursor-pointer items-center gap-2 rounded-token-md border border-line-strong bg-surface px-3 text-sm font-semibold text-fg hover:bg-surface-hover">
            <i class="pi pi-upload" aria-hidden="true"></i>{{ draft().logo ? s().logoChange : s().logoUpload }}
          </label>
          <input id="rc-logo" type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" (change)="onLogo($event)" />
          @if (draft().logo) {
            <p-button [label]="s().logoRemove" icon="pi pi-trash" severity="danger" [text]="true" size="small" (onClick)="patch({ logo: '' })" />
          }
        </ui-settings-row>

        <ui-settings-row [title]="s().headerNote" [description]="s().headerNoteDesc" labelFor="rc-header">
          <input pInputText id="rc-header" class="w-full sm:w-[300px]" [maxlength]="limits.headerNote"
            [ngModel]="draft().headerNote" (ngModelChange)="patch({ headerNote: $event })" />
        </ui-settings-row>

        <ui-settings-row [title]="s().footerNote" [description]="s().footerNoteDesc" labelFor="rc-footer">
          <input pInputText id="rc-footer" class="w-full sm:w-[300px]" maxlength="160" [placeholder]="t().sales.thankYou"
            [ngModel]="footer()" (ngModelChange)="footer.set($event)" />
        </ui-settings-row>

        <ui-settings-row [title]="s().showDealerLicense" [description]="dealerDesc()" labelFor="rc-dealer" inline>
          <p-toggleswitch inputId="rc-dealer" [ngModel]="draft().showDealerLicense" (ngModelChange)="patch({ showDealerLicense: $event })" />
        </ui-settings-row>
        <ui-settings-row [title]="s().showLicenseNo" [description]="s().showLicenseNoDesc" labelFor="rc-lic" inline>
          <p-toggleswitch inputId="rc-lic" [ngModel]="draft().showLicenseNo" (ngModelChange)="patch({ showLicenseNo: $event })" />
        </ui-settings-row>
        <ui-settings-row [title]="s().showGts" [description]="s().showGtsDesc" labelFor="rc-gts" inline>
          <p-toggleswitch inputId="rc-gts" [ngModel]="draft().showGts" (ngModelChange)="patch({ showGts: $event })" />
        </ui-settings-row>
      </ui-glass-card>

      <!-- Canlı önizleme -->
      <ui-glass-card [title]="s().preview" [subtitle]="s().previewDesc" icon="pi-eye" tone="info" class="xl:sticky xl:top-4">
        <!-- Gerçek fiş bileşeni (POS'un yazdırdığı): önizleme = test fişi = gerçek fiş -->
        <div class="flex justify-center overflow-x-auto rounded-token-md bg-surface-muted px-2 py-4" role="img" [attr.aria-label]="s().preview">
          <div class="paper"><app-receipt [receipt]="sample()" [business]="previewBusiness()" [options]="draft()" /></div>
        </div>
        <div card-footer class="flex justify-end">
          <p-button [label]="s().testPrint" icon="pi pi-print" severity="secondary" size="small" (onClick)="testPrint()" />
        </div>
      </ui-glass-card>
    </div>
    }
  `,
})
export class ReceiptSectionComponent implements OnInit {
  private readonly settings = inject(TenantSettingsService);
  private readonly tenantInfo = inject(TenantInfoService);
  private readonly receiptBusiness = inject(ReceiptBusinessService);
  private readonly printer = inject(ReceiptPrinterService);
  private readonly toast = inject(MessageService);
  private readonly lang = inject(LangService);
  readonly t = this.lang.t;
  readonly s = injectSettingsTexts();
  readonly limits = SETTINGS_LIMITS;

  readonly saved = output<void>();

  readonly widthOptions: UiSegmentOption<ReceiptPaperWidth>[] = [
    { value: 58, label: '58 mm' },
    { value: 80, label: '80 mm' },
  ];

  readonly business = signal<Required<TenantInfo>>({ ...EMPTY_TENANT_INFO });
  readonly draft = signal<ReceiptSettings>(DEFAULT_RECEIPT_SETTINGS);
  readonly footer = signal('');
  private readonly savedFooter = signal('');
  readonly saving = signal(false);
  readonly loaded = this.settings.loaded;
  private touched = false;

  readonly sample = computed(() => sampleReceipt(this.s().sampleCustomer, this.s().sampleItems));
  /** Önizleme ve test fişi: kaydedilmemiş alt not da görünsün. */
  readonly previewBusiness = computed(() => ({ ...this.business(), receiptFooter: this.footer().trim() }));

  readonly dirty = computed(() =>
    JSON.stringify(this.draft()) !== JSON.stringify(this.settings.receipt()) || this.footer() !== this.savedFooter());

  readonly dealerDesc = computed(() =>
    this.business().dealerLicenseNo ? `${this.s().showDealerLicenseDesc}: ${this.business().dealerLicenseNo}` : this.s().showDealerLicenseDesc);

  constructor() {
    // Kaydedilmiş ayar gelince (ilk yükleme / başka cihazdan değişiklik) taslak dokunulmamışsa güncellensin
    effect(() => {
      const saved = this.settings.receipt();
      if (!untracked(() => this.touched)) this.draft.set(saved);
    });
  }

  async ngOnInit(): Promise<void> {
    this.settings.ensureLoaded();
    try {
      const info = await this.tenantInfo.get();
      this.business.set(info);
      this.footer.set(info.receiptFooter);
      this.savedFooter.set(info.receiptFooter);
    } catch {
      this.toast.add({ severity: 'error', summary: '', detail: this.t().settings.businessLoadFailed, life: 4000 });
    }
  }

  patch(p: Partial<ReceiptSettings>): void {
    this.touched = true;
    this.draft.update(d => ({ ...d, ...p }));
  }

  async onLogo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const data = await shrinkLogo(file, SETTINGS_LIMITS.logoChars);
      if (data === null) throw new Error('canvas');
      if (!data) {
        this.toast.add({ severity: 'warn', summary: '', detail: this.s().logoTooBig, life: 5000 });
        return;
      }
      this.patch({ logo: data });
    } catch {
      this.toast.add({ severity: 'error', summary: '', detail: this.s().logoInvalid, life: 4000 });
    }
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const d = this.draft();
      await this.settings.update({ receipt: { ...d, headerNote: d.headerNote.trim() } });
      if (this.footer() !== this.savedFooter()) {
        await this.tenantInfo.savePartial({ receiptFooter: this.footer() });
        this.savedFooter.set(this.footer().trim());
        this.footer.set(this.footer().trim());
      }
      this.touched = false;
      this.receiptBusiness.invalidate();
      this.toast.add({ severity: 'success', summary: '', detail: this.s().receiptSaved, life: 3000 });
      this.saved.emit();
    } catch (err) {
      console.error('[Settings] receipt save error:', err);
      this.toast.add({ severity: 'error', summary: '', detail: this.s().saveFailed, life: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  /** Gerçek fiş bileşeniyle (POS'un yazdırdığı) önizlemedeki fişi taslak ayarlarla basar. */
  testPrint(): void {
    void this.printer.print(this.sample(), this.draft(), this.previewBusiness());
  }
}
