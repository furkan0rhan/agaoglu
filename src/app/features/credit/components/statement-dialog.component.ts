import { ChangeDetectionStrategy, Component, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { LangService } from '../../../core/i18n/lang.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { Customer } from '../../../shared/models/customer.model';
import { CreditTransaction } from '../../../shared/models/credit.model';
import { TenantInfoService } from '../../settings/business/tenant-info.service';
import { buildStatement } from '../services/credit.utils';
import { DateFieldComponent } from '../../../shared/ui';

/** Tarih aralığı seçip müşteri hesap ekstresini PDF olarak indirir. Toast'u üst bileşenin MessageService'i gösterir. */
@Component({
  selector: 'app-statement-dialog',
  standalone: true,
  imports: [FormsModule, ButtonModule, DialogModule, DateFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [header]="t().credit.statement" [visible]="visible()" (visibleChange)="visible.set($event)"
      [modal]="true" [draggable]="false" [focusOnShow]="false" appendTo="body" styleClass="w-[420px] max-w-[95vw]">
      <!-- focusOnShow kapalı: dialog ilk odaklanabilir öğeye (tarih alanı) odaklanınca takvim kendiliğinden açılıyordu -->
      <div class="grid grid-cols-1 gap-4 py-1 sm:grid-cols-2">
        <ui-date-field inputId="st-from" [label]="t().credit.statementFrom" [(ngModel)]="from" [clearable]="false" />
        <ui-date-field inputId="st-to" [label]="t().credit.statementTo" [(ngModel)]="to" [clearable]="false" />
      </div>
      <ng-template #footer>
        <p-button [label]="t().common.cancel" severity="secondary" [outlined]="true" (onClick)="visible.set(false)" />
        <p-button [label]="t().credit.statementCreate" icon="pi pi-file-pdf" [loading]="busy()"
          [disabled]="!from || !to || from > to" (onClick)="create()" />
      </ng-template>
    </p-dialog>
  `,
})
export class StatementDialogComponent {
  readonly t = inject(LangService).t;
  private readonly tenantInfo = inject(TenantInfoService);
  private readonly toast = inject(MessageService);
  private readonly logger = inject(LoggerService);

  readonly visible = model(false);
  readonly customer = input<Customer | null>(null);
  readonly transactions = input<CreditTransaction[]>([]);
  readonly overdueAmount = input(0);
  readonly busy = signal(false);

  from: Date = new Date(new Date().getFullYear(), 0, 1);
  to: Date = new Date();

  async create(): Promise<void> {
    const c = this.customer();
    if (!c || this.busy()) return;
    this.busy.set(true);
    try {
      const [{ downloadStatementPdf }, info] = await Promise.all([
        import('../services/statement-pdf'),
        this.tenantInfo.get().catch(() => null),
      ]);
      const cr = this.t().credit;
      const name = `${c.firstName} ${c.lastName}`;
      await downloadStatementPdf({
        businessName: info?.name ?? '',
        businessAddress: info?.address,
        businessPhone: info?.phone,
        customerName: name,
        customerPhone: c.phone,
        from: this.from,
        to: this.to,
        statement: buildStatement(this.transactions(), this.from, this.to),
        overdueAmount: this.overdueAmount(),
        labels: {
          title: cr.stTitle, period: cr.stPeriod, customer: cr.stCustomer, date: cr.stDate,
          description: cr.stDescription, debit: cr.stDebit, credit: cr.stCredit, balance: cr.stBalance,
          opening: cr.stOpening, closing: cr.stClosing, total: cr.stTotal, overdue: cr.stOverdue,
          printedAt: cr.stPrintedAt, pending: cr.pending,
        },
      }, `ekstre-${name.replace(/\s+/g, '-')}-${this.to.toISOString().slice(0, 10)}`);
      this.visible.set(false);
    } catch (err) {
      this.logger.error('statement pdf failed', err);
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().credit.statementFailed });
    } finally {
      this.busy.set(false);
    }
  }
}
