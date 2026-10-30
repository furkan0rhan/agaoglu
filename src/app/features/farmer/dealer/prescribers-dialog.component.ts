import { ChangeDetectionStrategy, Component, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { LangService } from '../../../core/i18n/lang.service';
import { PrescriberInfo } from '../../../shared/models/farmer.model';
import { DEALER_FARMER_REPOSITORY } from '../data/repositories';

/** İşletme yöneticisi: personelden kimlerin öneri/reçete yazabileceğini (canPrescribe + yetki belge no) belirler. */
@Component({
  selector: 'app-prescribers-dialog',
  standalone: true,
  imports: [FormsModule, ButtonModule, DialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [header]="t().farmer.dealer.prescribers" [(visible)]="visible" [modal]="true" [style]="{ width: 'min(560px, 96vw)' }" [draggable]="false" (onShow)="load()">
      <p class="mt-0 rounded-token-lg border border-line bg-surface-muted p-3 text-13.5 leading-snug text-fg-secondary">{{ t().farmer.dealer.prescribersInfo }}</p>
      <ul class="m-0 list-none p-0">
        @for (s of staff(); track s.uid) {
          <li class="flex flex-col gap-2 border-b border-line py-3 last:border-b-0">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="min-w-0 font-semibold text-fg">{{ s.displayName }} <small class="font-normal text-fg-muted">({{ s.role }})</small></span>
              <label class="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-semibold text-fg">
                <input type="checkbox" class="h-5 w-5 accent-[var(--brand)]" [(ngModel)]="s.canPrescribe" [name]="'cp' + s.uid" /> {{ t().farmer.dealer.canPrescribe }}</label>
            </div>
            @if (s.canPrescribe) {
              <input class="p-inputtext num w-full" [name]="'lic' + s.uid" [(ngModel)]="s.prescriberLicenseNo" [placeholder]="t().farmer.dealer.licenseNo"
                     [attr.aria-label]="t().farmer.dealer.licenseNo" maxlength="40" />
            }
            <div class="flex justify-end">
              <p-button size="small" icon="pi pi-check" [label]="t().common.save" [loading]="busy() === s.uid" (onClick)="save(s)" />
            </div>
          </li>
        }
      </ul>
      @if (message()) { <p class="m-0 mt-2 rounded-token-md bg-surface-muted px-3 py-2 text-sm font-semibold text-fg" role="status">{{ message() }}</p> }
    </p-dialog>
  `,
})
export class PrescribersDialogComponent {
  readonly t = inject(LangService).t;
  private readonly repo = inject(DEALER_FARMER_REPOSITORY);
  readonly visible = model(false);
  readonly tenantId = input.required<string>();
  readonly changed = output<void>();
  readonly staff = signal<PrescriberInfo[]>([]);
  readonly busy = signal<string | null>(null);
  readonly message = signal('');

  async load(): Promise<void> {
    this.message.set('');
    try { this.staff.set(await this.repo.listTenantStaff(this.tenantId())); } catch { this.message.set(this.t().farmer.dealer.loadFailed); }
  }

  async save(s: PrescriberInfo): Promise<void> {
    if (s.canPrescribe && !s.prescriberLicenseNo?.trim()) { this.message.set(this.t().farmer.dealer.licenseRequired); return; }
    this.busy.set(s.uid);
    try {
      await this.repo.setPrescriber(s.uid, s.canPrescribe, s.prescriberLicenseNo);
      this.message.set(this.t().farmer.dealer.savedPrescriber);
      this.changed.emit();
    } catch {
      this.message.set(this.t().farmer.common.saveFailed);
    } finally {
      this.busy.set(null);
    }
  }
}
