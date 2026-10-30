import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LangService } from '../../../core/i18n/lang.service';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { EmptyStateComponent, GlassCardComponent, MoneyComponent, StatusBadgeComponent, UiTone } from '../../../shared/ui';
import { CreditStatus, ScheduleItem, daysOverdue, startOfDay } from '../services/credit.utils';

const DAY_MS = 86_400_000;
/** Varsayılan olarak gösterilen en yeni ödenmiş vade sayısı. */
const PAID_PREVIEW = 2;

interface Row {
  item: ScheduleItem;
  key: string;
  paid: boolean;
  late: number;
  left: number;
  hint: string;
  badge: string;
  badgeTone: UiTone;
  badgeIcon: string;
}

/**
 * C "Taksit Planı": vadeli taksitler kronolojik (ödendi / gecikti / kısmi / kalan gün), vadesiz eski borç
 * alt satırda, isteğe bağlı müşteri notu (C "note"). Tahsilatlar en eski vadeden dağıtılmış hâli (buildSchedule).
 */
@Component({
  selector: 'app-installment-schedule',
  standalone: true,
  imports: [DatePipe, GlassCardComponent, EmptyStateComponent, MoneyComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-glass-card [title]="a().planTitle" icon="pi-calendar" padding="none" clip
      [subtitle]="rows().length ? a().planMeta(openCount(), dated().length) : ''">
      @if (maxLate() > 0) {
        <ui-status-badge card-actions tone="danger" icon="pi-exclamation-triangle" size="sm">{{ maxLate() }} {{ t().credit.daysLate }}</ui-status-badge>
      }

      @if (paidCount() > previewCount()) {
          <button type="button" (click)="showAllPaid.set(!showAllPaid())"
            class="flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-1.5 border-0 border-b border-line bg-surface-muted px-4 text-13 font-semibold text-brand-text hover:bg-surface-hover">
            <i class="pi text-11" [class]="showAllPaid() ? 'pi-chevron-up' : 'pi-chevron-down'" aria-hidden="true"></i>
            {{ showAllPaid() ? a().hidePaid : a().showPaid(hiddenPaid()) }}
          </button>
      }

      @if (rows().length === 0 && undated() === 0) {
        <ui-empty-state compact icon="pi-calendar" [title]="a().noPlan" />
      } @else {
        <ol class="m-0 list-none p-0">
          @for (r of rows(); track r.key) {
            <li class="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[40px_minmax(0,1fr)_auto_auto]"
              [class.bg-danger-soft]="r.late > 0">
              <span class="font-display grid h-10 w-10 place-items-center rounded-[9px] text-14 font-extrabold" [class]="noClass(r)" aria-hidden="true">
                @if (r.paid) { <i class="pi pi-check text-13"></i> } @else { {{ r.item.no }} }
              </span>
              <div class="min-w-0">
                <p class="m-0 text-14.5 font-semibold text-fg">
                  @if (r.item.dueDate) { {{ r.item.dueDate | date:'d MMMM y':'':locale() }} }
                </p>
                <p class="num m-0 mt-0.5 text-12.5" [class]="r.late > 0 ? 'text-danger-text' : 'text-fg-muted'">{{ r.hint }}</p>
                <ui-status-badge class="mt-1 inline-flex sm:hidden" size="sm" [tone]="r.badgeTone" [icon]="r.badgeIcon">{{ r.badge }}</ui-status-badge>
              </div>
              <ui-status-badge class="hidden sm:inline-flex" [tone]="r.badgeTone" [icon]="r.badgeIcon">{{ r.badge }}</ui-status-badge>
              <ui-money class="font-display shrink-0 text-right text-16 font-extrabold"
                [class]="r.late > 0 ? 'text-danger-text' : r.paid ? 'text-fg-muted' : 'text-fg'"
                [value]="r.paid ? r.item.amount : r.item.remaining" [symbol]="false" />
            </li>
          }
        </ol>
        @if (undated() > 0) {
          <p class="m-0 flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-13 text-fg-secondary">
            <span class="inline-flex items-center gap-2"><i class="pi pi-inbox text-13 text-fg-muted" aria-hidden="true"></i>{{ t().credit.undatedDebt }}</span>
            <ui-money class="font-display text-15 font-extrabold text-fg" [value]="undated()" />
          </p>
        }
      }

      @if (note()) {
        <div class="m-4 mt-1 flex gap-2.5 rounded-token-md bg-warning-soft px-3.5 py-3 text-13.5 text-warning-text">
          <i class="pi pi-info-circle mt-0.5 text-14" aria-hidden="true"></i>
          <p class="m-0 min-w-0 whitespace-pre-line break-words"><b>{{ t().customers.notes }}:</b> {{ note() }}</p>
        </div>
      }
    </ui-glass-card>
  `,
})
export class InstallmentScheduleComponent {
  private readonly lang = inject(LangService);
  readonly t = this.lang.t;
  readonly a = computed(() => this.t().acc);
  readonly locale = computed(() => (this.lang.lang() === 'tr' ? 'tr' : 'en-US'));
  private readonly cur = new CurrencyTrPipe();

  readonly schedule = input<ScheduleItem[]>([]);
  readonly status = input<CreditStatus | null>(null);
  /** Müşteri notu (C "note" kutusu). */
  readonly note = input<string | null | undefined>(null);

  readonly showAllPaid = signal(false);
  readonly maxLate = computed(() => ((this.status()?.overdueAmount ?? 0) > 0 ? this.status()!.maxDaysOverdue : 0));
  private readonly today = new Date();

  /** Vadeli taksitler (ödenmişler dahil), en eski vade üstte. */
  readonly dated = computed(() => this.schedule().filter(i => !!i.dueDate));
  readonly openCount = computed(() => this.dated().filter(i => i.remaining > 0).length);
  readonly paidCount = computed(() => this.dated().filter(i => i.remaining <= 0).length);
  readonly previewCount = computed(() => Math.min(PAID_PREVIEW, this.paidCount()));
  readonly hiddenPaid = computed(() => (this.showAllPaid() ? 0 : this.paidCount() - this.previewCount()));

  /** Vadesiz (eski) borçların kalan toplamı. */
  readonly undated = computed(() =>
    Math.round(this.schedule().filter(i => i.remaining > 0 && !i.dueDate).reduce((s, i) => s + i.remaining, 0) * 100) / 100);

  readonly rows = computed<Row[]>(() => {
    const a = this.a();
    const paid = this.dated().filter(i => i.remaining <= 0);
    const visiblePaid = new Set(this.showAllPaid() ? paid : paid.slice(paid.length - this.previewCount()));
    const t0 = startOfDay(this.today).getTime();
    return this.dated()
      .filter(i => i.remaining > 0 || visiblePaid.has(i))
      .map(i => {
        const isPaid = i.remaining <= 0;
        const late = isPaid ? 0 : daysOverdue(i.dueDate, this.today);
        const left = i.dueDate ? Math.round((i.dueDate.getTime() - t0) / DAY_MS) : 0;
        const parts = [i.count > 1 ? a.instNo(i.no, i.count) : a.harvestDue];
        if (isPaid) parts.push(a.paidHint);
        else if (i.paidAmount > 0) parts.push(`${this.cur.transform(i.amount)} · ${a.partial(this.cur.transform(i.paidAmount))}`);
        let badge: string; let badgeTone: UiTone; let badgeIcon = '';
        if (isPaid) { badge = a.paid; badgeTone = 'success'; badgeIcon = 'pi-check'; }
        else if (late > 0) { badge = a.lateDays(late); badgeTone = 'danger'; badgeIcon = 'pi-clock'; }
        else if (left <= 30) { badge = a.daysLeft(left); badgeTone = 'warning'; }
        else { badge = a.daysLeft(left); badgeTone = 'neutral'; }
        return {
          item: i, key: `${i.txId}-${i.no}`, paid: isPaid, late, left,
          hint: parts.join(' · '), badge, badgeTone, badgeIcon,
        };
      });
  });

  noClass(r: Row): string {
    if (r.paid) return 'bg-brand-soft text-brand-text';
    if (r.late > 0) return 'bg-danger text-fg-inverse';
    return 'bg-surface-muted text-fg-secondary';
  }
}
