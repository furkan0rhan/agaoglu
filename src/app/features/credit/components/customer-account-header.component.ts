import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenuItem, MessageService } from 'primeng/api';
import { LangService } from '../../../core/i18n/lang.service';
import { Customer } from '../../../shared/models/customer.model';
import { CreditTransaction } from '../../../shared/models/credit.model';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { StatusBadgeComponent, initialsOf } from '../../../shared/ui';
import { TenantInfoService } from '../../settings/business/tenant-info.service';
import { TenantSettingsService } from '../../../core/settings/tenant-settings.service';
import {
  ScheduleItem, checkCreditLimit, reminderMessage, creditStatus, smsLink, startOfDay, toIntlPhone, whatsappLink,
} from '../services/credit.utils';
import { StatementDialogComponent } from './statement-dialog.component';

const DAY_MS = 86_400_000;

/**
 * C "müşteri başlığı" (custhead) + 4'lü borç şeridi: toplam borç, vadesi geçen (kırmızı),
 * sonraki vade, kredi limiti (yoksa toplam ödenen). Ekstre PDF ve Hatırlat (WhatsApp/SMS) yerleşik;
 * Satış Yap / Tahsilat Al gibi birincil aksiyonlar içerik olarak verilir.
 * Toast için üst sayfanın MessageService'ini kullanır.
 */
@Component({
  selector: 'app-customer-account-header',
  standalone: true,
  imports: [DatePipe, CurrencyTrPipe, ButtonModule, MenuModule, StatusBadgeComponent, StatementDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <app-statement-dialog [(visible)]="showStatement" [customer]="customer()" [transactions]="transactions()"
      [overdueAmount]="status().overdueAmount" />
    <p-menu #remindMenu [popup]="true" [model]="remindItems()" appendTo="body" />

    <section class="ui-card overflow-hidden" [attr.aria-label]="t().customers.accountSummary">
      <div class="flex flex-wrap items-center gap-4 p-4">
        <span class="font-display grid h-[60px] w-[60px] shrink-0 place-items-center rounded-token-2xl bg-accent-soft text-20 font-extrabold text-accent-text"
          aria-hidden="true">{{ initials() }}</span>
        <div class="min-w-0 flex-[1_1_220px]">
          <h2 class="font-display m-0 flex flex-wrap items-center gap-2 text-22 font-extrabold leading-tight text-fg">
            <span class="min-w-0 break-words">{{ customer().firstName }} {{ customer().lastName }}</span>
            @if (customer().anonymizedAt) {
              <ui-status-badge tone="neutral" size="sm">{{ t().customers.anonymizedBadge }}</ui-status-badge>
            } @else if (!customer().isActive) {
              <ui-status-badge tone="neutral" size="sm">{{ t().customers.archivedBadge }}</ui-status-badge>
            }
          </h2>
          <div class="mt-1 flex flex-wrap gap-x-3.5 gap-y-1 text-13.5 text-fg-secondary">
            @if (customer().village) {
              <span class="inline-flex items-center gap-1.5"><i class="pi pi-map-marker text-13 text-fg-muted" aria-hidden="true"></i>{{ customer().village }}</span>
            }
            @if (customer().phone) {
              <a class="num inline-flex items-center gap-1.5 text-fg-secondary no-underline hover:text-brand-text hover:underline"
                [href]="'tel:' + phoneHref()"><i class="pi pi-phone text-13 text-fg-muted" aria-hidden="true"></i>{{ customer().phone }}</a>
            }
            @if (customer().cksNo) {
              <span class="inline-flex items-center gap-1.5"><i class="pi pi-verified text-13 text-fg-muted" aria-hidden="true"></i>{{ a().cks }} <span class="num">{{ customer().cksNo }}</span></span>
            }
          </div>
        </div>
        <div class="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
          <ng-content />
          <p-button [label]="a().statement" icon="pi pi-download" severity="secondary" styleClass="w-full"
            (onClick)="showStatement.set(true)" />
          @if (customer().isActive && hasDebt()) {
            <p-button [label]="a().remind" icon="pi pi-comment" severity="secondary" styleClass="w-full"
              aria-haspopup="true" (onClick)="openRemind($event, remindMenu)" />
          }
        </div>
      </div>

      <!-- Borç şeridi -->
      <dl class="m-0 grid grid-cols-2 border-t border-line lg:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
        <div class="min-w-0 border-b border-r border-line px-4 py-3.5 lg:border-b-0">
          <dt class="flex items-center gap-1.5 text-12.5 font-semibold text-fg-muted">
            <i class="pi pi-book text-12" aria-hidden="true"></i>{{ a().totalDebt }}</dt>
          <dd class="m-0">
            <span class="num-xl mt-1 block truncate text-24 leading-tight sm:text-[2rem]"
              [class]="hasDebt() ? 'text-fg' : 'text-success-text'">{{ customer().balance | currencyTr }}</span>
            <span class="mt-0.5 block text-12.5 text-fg-muted">{{ !hasDebt() ? a().noDebt : openCount() ? a().openInstallments(openCount()) : a().undatedSale }}</span>
          </dd>
        </div>
        <div class="min-w-0 border-b border-line px-4 py-3.5 lg:border-b-0 lg:border-r"
          [class]="status().overdueAmount > 0 ? 'bg-danger-soft text-danger-text' : ''">
          <dt class="flex items-center gap-1.5 text-12.5 font-semibold"
            [class]="status().overdueAmount > 0 ? 'text-danger-text' : 'text-fg-muted'">
            <i class="pi pi-exclamation-triangle text-12" aria-hidden="true"></i>{{ a().overdue }}</dt>
          <dd class="m-0">
            <span class="num-xl mt-1 block truncate text-22 leading-tight sm:text-26"
              [class]="status().overdueAmount > 0 ? 'text-danger-text' : 'text-fg'">{{ status().overdueAmount | currencyTr }}</span>
            <span class="mt-0.5 block text-12.5" [class]="status().overdueAmount > 0 ? 'text-danger-text' : 'text-fg-muted'">
              {{ status().overdueAmount > 0 ? a().lateFor(status().overdueCount, status().maxDaysOverdue) : a().noOverdue }}</span>
          </dd>
        </div>
        <div class="min-w-0 border-r border-line px-4 py-3.5">
          <dt class="flex items-center gap-1.5 text-12.5 font-semibold text-fg-muted">
            <i class="pi pi-calendar text-12" aria-hidden="true"></i>{{ a().nextDue }}</dt>
          <dd class="m-0">
            @if (status().nextDue; as n) {
              <span class="num-xl mt-1 block truncate text-22 leading-tight sm:text-26">{{ n.amount | currencyTr }}</span>
              <span class="num mt-0.5 block text-12.5 text-fg-muted">{{ n.date | date:'dd.MM.yyyy' }} · {{ a().inDays(daysUntil(n.date)) }}</span>
            } @else {
              <span class="num-xl mt-1 block text-22 leading-tight text-fg-muted sm:text-26">–</span>
              <span class="mt-0.5 block text-12.5 text-fg-muted">{{ a().noNextDue }}</span>
            }
          </dd>
        </div>
        <div class="min-w-0 px-4 py-3.5">
          @if (limit(); as l) {
            <dt class="flex items-center gap-1.5 text-12.5 font-semibold text-fg-muted">
              <i class="pi pi-shield text-12" aria-hidden="true"></i>{{ a().creditLimit }}</dt>
            <dd class="m-0">
              <span class="num-xl mt-1 block truncate text-22 leading-tight sm:text-26">{{ l.limit | currencyTr }}</span>
              <span class="mt-2 block h-2 overflow-hidden rounded-full bg-surface-strong" aria-hidden="true">
                <span class="block h-full rounded-full" [class]="l.barClass" [style.width.%]="l.pct"></span>
              </span>
              <span class="mt-1 block text-12.5" [class]="l.exceeded ? 'font-semibold text-danger-text' : 'text-fg-muted'">{{ l.hint }}</span>
            </dd>
          } @else {
            <dt class="flex items-center gap-1.5 text-12.5 font-semibold text-fg-muted">
              <i class="pi pi-check-circle text-12" aria-hidden="true"></i>{{ a().totalPaid }}</dt>
            <dd class="m-0">
              <span class="num-xl mt-1 block truncate text-22 leading-tight text-success-text sm:text-26">{{ customer().totalPaid | currencyTr }}</span>
              <span class="num mt-0.5 block text-12.5 text-fg-muted">{{ a().totalBorrowed(money(customer().totalDebt)) }}</span>
            </dd>
          }
        </div>
      </dl>
    </section>
  `,
})
export class CustomerAccountHeaderComponent {
  private readonly lang = inject(LangService);
  private readonly toast = inject(MessageService);
  private readonly tenantInfo = inject(TenantInfoService);
  private readonly settings = inject(TenantSettingsService);
  private readonly cur = new CurrencyTrPipe();
  readonly t = this.lang.t;
  readonly a = computed(() => this.t().acc);

  readonly customer = input.required<Customer>();
  readonly schedule = input<ScheduleItem[]>([]);
  readonly transactions = input<CreditTransaction[]>([]);

  readonly showStatement = signal(false);
  private businessName = '';
  private businessPhone = '';

  constructor() {
    this.settings.ensureLoaded();
    this.tenantInfo.get().then(i => { this.businessName = i.name; this.businessPhone = i.phone; }).catch(() => undefined);
  }

  readonly status = computed(() => creditStatus(this.schedule()));
  readonly hasDebt = computed(() => (this.customer().balance ?? 0) > 0.004);
  readonly openCount = computed(() => this.schedule().filter(i => i.remaining > 0 && i.dueDate).length);
  readonly initials = computed(() => initialsOf(`${this.customer().firstName} ${this.customer().lastName}`));
  readonly phoneHref = computed(() => (this.customer().phone ?? '').replace(/\s+/g, ''));

  readonly limit = computed(() => {
    const c = this.customer();
    if (!c.creditLimit) return null;
    const chk = checkCreditLimit(c.balance ?? 0, c.creditLimit, 0);
    const pct = Math.max(0, Math.min(100, Math.round(((c.balance ?? 0) / c.creditLimit) * 100)));
    const barClass = chk.exceeded || pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-warning' : 'bg-brand';
    const hint = chk.exceeded ? this.a().limitOver(this.money(chk.overBy)) : this.a().limitUsed(pct, this.money(chk.available ?? 0));
    return { limit: c.creditLimit, pct, barClass, hint, exceeded: chk.exceeded };
  });

  readonly canRemind = computed(() => !!this.customer().consents?.contact && !!toIntlPhone(this.customer().phone));

  readonly remindItems = computed<MenuItem[]>(() => {
    const cu = this.t().customers;
    return [
      { label: cu.whatsapp, icon: 'pi pi-whatsapp', command: () => this.remind('wa') },
      { label: cu.sms, icon: 'pi pi-comment', command: () => this.remind('sms') },
    ];
  });

  money(v: number | null | undefined): string { return this.cur.transform(v ?? 0); }

  daysUntil(d: Date): number {
    return Math.max(0, Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / DAY_MS));
  }

  /** Rıza/telefon yoksa menü yerine nedeni gösterir (KVKK: iletişim onayı olmadan mesaj yok). */
  openRemind(event: Event, menu: { toggle: (e: Event) => void }): void {
    const c = this.customer();
    if (!c.consents?.contact) {
      this.toast.add({ severity: 'warn', summary: '', detail: this.t().customers.noContactConsent, life: 4000 });
      return;
    }
    if (!toIntlPhone(c.phone)) {
      this.toast.add({ severity: 'warn', summary: '', detail: this.t().customers.noPhone, life: 4000 });
      return;
    }
    menu.toggle(event);
  }

  remind(kind: 'wa' | 'sms'): void {
    const c = this.customer();
    if (!this.canRemind()) return;
    const st = this.status();
    const text = reminderMessage(this.settings.credit().reminderTemplate, {
      customerName: `${c.firstName} ${c.lastName}`,
      balance: c.balance,
      businessName: this.businessName,
      businessPhone: this.businessPhone,
      overdueAmount: st.overdueAmount,
      dueDate: st.overdueAmount > 0 ? st.oldestDue?.date ?? null : st.nextDue?.date ?? null,
    });
    const url = kind === 'wa' ? whatsappLink(c.phone, text) : smsLink(c.phone, text);
    window.open(url, '_blank', 'noopener');
  }
}
