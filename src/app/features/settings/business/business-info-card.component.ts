import { ChangeDetectionStrategy, Component, inject, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { GlassCardComponent } from '../../../shared/ui';
import { ReceiptBusinessService } from '../../sales/receipt/receipt-business.service';
import { injectSettingsTexts } from '../settings.i18n';
import { EMPTY_TENANT_INFO, TenantInfo, TenantInfoService } from './tenant-info.service';

type BusinessForm = Omit<Required<TenantInfo>, 'receiptFooter'>;

/**
 * İşletme bilgileri (tenants/{tenantId}): ad, telefon, vergi dairesi/no, bitki koruma bayi izin no, adres.
 * Fiş alt notu "Fiş & yazıcı" bölümünde. Admin düzenler; diğer roller salt okunur görür.
 * Toast'lar ebeveyn sayfanın MessageService'ine gider.
 */
@Component({
  selector: 'app-business-info-card',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, TextareaModule, GlassCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-glass-card [title]="s().sections.business.title" [subtitle]="s().sections.business.desc" icon="pi-building">
      @if (canEdit() && !loading()) {
        <p-button card-actions [label]="t().common.save" icon="pi pi-check" size="small"
          [loading]="saving()" [disabled]="!form.name.trim()" (onClick)="save()" />
      }
      @if (loading()) {
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden="true">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="h-11 animate-pulse rounded-token-md bg-surface-muted"></div>
          }
        </div>
      } @else {
        <form id="biz-form" class="grid grid-cols-1 gap-4 sm:grid-cols-2" (ngSubmit)="save()">
          <div class="flex flex-col gap-1.5 sm:col-span-2">
            <label for="biz-name" class="text-sm font-semibold text-fg-secondary">{{ t().settings.businessName }}</label>
            <input pInputText id="biz-name" name="name" class="w-full" maxlength="80" autocomplete="organization"
              [(ngModel)]="form.name" [disabled]="!canEdit()" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="biz-phone" class="text-sm font-semibold text-fg-secondary">{{ t().settings.phone }}</label>
            <input pInputText id="biz-phone" name="phone" type="tel" class="w-full" maxlength="30" autocomplete="tel"
              [(ngModel)]="form.phone" [disabled]="!canEdit()" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="biz-dealer" class="text-sm font-semibold text-fg-secondary">{{ s().dealerLicenseNo }}</label>
            <input pInputText id="biz-dealer" name="dealerLicenseNo" class="w-full" maxlength="40"
              aria-describedby="biz-dealer-hint" [(ngModel)]="form.dealerLicenseNo" [disabled]="!canEdit()" />
            <p id="biz-dealer-hint" class="m-0 text-xs text-fg-muted">{{ s().dealerLicenseHint }}</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="biz-tax-office" class="text-sm font-semibold text-fg-secondary">{{ t().settings.taxOffice }}</label>
            <input pInputText id="biz-tax-office" name="taxOffice" class="w-full" maxlength="60"
              [(ngModel)]="form.taxOffice" [disabled]="!canEdit()" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="biz-tax-no" class="text-sm font-semibold text-fg-secondary">{{ t().settings.taxNo }}</label>
            <input pInputText id="biz-tax-no" name="taxNo" class="num w-full" maxlength="20" inputmode="numeric"
              [(ngModel)]="form.taxNo" [disabled]="!canEdit()" />
          </div>
          <div class="flex flex-col gap-1.5 sm:col-span-2">
            <label for="biz-address" class="text-sm font-semibold text-fg-secondary">{{ t().settings.address }}</label>
            <textarea pTextarea id="biz-address" name="address" rows="2" class="w-full" maxlength="200" autocomplete="street-address"
              [(ngModel)]="form.address" [disabled]="!canEdit()"></textarea>
          </div>

          @if (!canEdit()) {
            <p class="m-0 flex items-center gap-2 rounded-token-md bg-info-soft px-3 py-2.5 text-xs text-info-text sm:col-span-2">
              <i class="pi pi-lock" aria-hidden="true"></i>{{ t().settings.businessReadOnly }}
            </p>
          }
        </form>
      }
    </ui-glass-card>
  `,
})
export class BusinessInfoCardComponent implements OnInit {
  private readonly service = inject(TenantInfoService);
  private readonly receiptBusiness = inject(ReceiptBusinessService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(MessageService);
  readonly t = inject(LangService).t;
  readonly s = injectSettingsTexts();

  /** Kayıt başarılı olunca (kurulum kartı yenilensin). */
  readonly saved = output<void>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  form: BusinessForm = { ...EMPTY_TENANT_INFO };

  canEdit(): boolean {
    return this.auth.hasRole('admin');
  }

  async ngOnInit(): Promise<void> {
    try {
      this.form = await this.service.get();
    } catch {
      this.toast.add({ severity: 'error', summary: '', detail: this.t().settings.businessLoadFailed, life: 4000 });
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (!this.canEdit() || !this.form.name.trim() || this.saving()) return;
    this.saving.set(true);
    try {
      const { name, phone, taxOffice, taxNo, address, dealerLicenseNo } = this.form;
      await this.service.savePartial({ name, phone, taxOffice, taxNo, address, dealerLicenseNo });
      this.receiptBusiness.invalidate(); // POS fiş başlığı yeni bilgiyi okusun
      this.toast.add({ severity: 'success', summary: '', detail: this.t().settings.businessSaved, life: 3000 });
      this.saved.emit();
    } catch (err) {
      console.error('[Settings] tenant save error:', err);
      this.toast.add({ severity: 'error', summary: '', detail: this.t().settings.businessSaveFailed, life: 4000 });
    } finally {
      this.saving.set(false);
    }
  }
}
