import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal, computed, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { AutoComplete, AutoCompleteModule } from 'primeng/autocomplete';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService, ConfirmEventType } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ExpenseService } from './services/expense.service';
import { Expense, EXPENSE_CATEGORIES } from '../../shared/models/expense.model';
import { getPeriodRange, isInRange } from '../../shared/utils/date-range.util';
import { CurrencyTrPipe } from '../../shared/pipes/currency-tr.pipe';
import { LangService } from '../../core/i18n/lang.service';
import {
  DateFieldComponent, EmptyStateComponent, GlassCardComponent, IconButtonComponent, MoneyComponent, PageHeaderComponent, SegmentedComponent,
  StatCardComponent, StatusBadgeComponent, TONE_SOFT, UiSegmentOption, UiTone,
} from '../../shared/ui';

type ExpensePeriod = 'month' | 'week' | 'all';

/** Gider kategorisi → ikon + ton (renkler token sınıflarından, bkz. shared/ui/tone.ts). */
const CATEGORY_STYLE: Record<string, { icon: string; tone: UiTone }> = {
  'Kira': { icon: 'pi-home', tone: 'brand' },
  'Elektrik': { icon: 'pi-bolt', tone: 'warning' },
  'Su': { icon: 'pi-cloud', tone: 'info' },
  'Doğalgaz': { icon: 'pi-sun', tone: 'accent' },
  'İnternet': { icon: 'pi-wifi', tone: 'info' },
  'Personel': { icon: 'pi-users', tone: 'brand' },
  'Nakliye': { icon: 'pi-truck', tone: 'success' },
  'Bakım & Onarım': { icon: 'pi-wrench', tone: 'danger' },
  'Vergi': { icon: 'pi-file', tone: 'neutral' },
  'Diğer': { icon: 'pi-ellipsis-h', tone: 'neutral' },
};
const DEFAULT_CATEGORY_STYLE: { icon: string; tone: UiTone } = { icon: 'pi-money-bill', tone: 'accent' };

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    FormsModule, DatePipe, CurrencyTrPipe,
    ButtonModule, DialogModule, InputTextModule, InputNumberModule,
    AutoCompleteModule, DateFieldComponent, ToastModule, ConfirmDialogModule, ToggleSwitchModule,
    PageHeaderComponent, StatCardComponent, EmptyStateComponent, StatusBadgeComponent, IconButtonComponent, MoneyComponent,
    GlassCardComponent, SegmentedComponent,
  ],
  providers: [MessageService, ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast position="top-right" />
    <p-confirmDialog />

    <ui-page-header [title]="t().expenses.title" [subtitle]="t().expenses.subtitle" icon="pi-wallet" iconTone="accent">
      <p-button [label]="t().expenses.addExpense" icon="pi pi-plus" (onClick)="openDialog()" />
    </ui-page-header>

    <div class="page-body">
      <!-- Dönem -->
      <ui-segmented [options]="periods()" [value]="period()" (valueChange)="period.set($event ?? 'month')"
        [ariaLabel]="t().common.filters" />

      <!-- Özet -->
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <ui-stat-card icon="pi-wallet" tone="accent" [highlight]="true" [label]="a().periodTotal" [hint]="periodLabel()"
          [value]="totalFiltered() | currencyTr" [loading]="loading()" />
        <ui-stat-card icon="pi-list" tone="neutral" [label]="t().expenses.recordCount" [value]="filtered().length"
          [hint]="recurringCount() + ' ' + t().expenses.recurringBadge" [loading]="loading()" />
        <ui-stat-card [icon]="topCategory() ? catIcon(topCategory()!.name) : 'pi-tag'" [tone]="topCategory() ? catTone(topCategory()!.name) : 'neutral'"
          [label]="a().topCategory" [value]="topCategory()?.name ?? '–'"
          [hint]="topCategory() ? (topCategory()!.amount | currencyTr) + ' · %' + topCategory()!.pct : ''" [loading]="loading()" />
        <ui-stat-card icon="pi-chart-bar" tone="info" [label]="a().avgPerRecord" [value]="avgAmount() | currencyTr" [loading]="loading()" />
      </div>

      <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-4">
        <!-- Kayıtlar -->
        <ui-glass-card [title]="a().expensesTitle" icon="pi-receipt" tone="accent" padding="none" clip
          [subtitle]="loading() ? '' : filtered().length + ' ' + t().credit.records">
          @if (loading()) {
            <div class="flex flex-col gap-3 p-4" aria-hidden="true">
              @for (i of [1, 2, 3, 4]; track i) { <div class="h-10 animate-pulse rounded-token-md bg-surface-muted"></div> }
            </div>
          } @else if (filtered().length === 0) {
            <ui-empty-state compact icon="pi-wallet" tone="accent" [title]="t().expenses.noExpenses" [description]="t().expenses.subtitle">
              <p-button [label]="t().expenses.addExpense" icon="pi pi-plus" severity="secondary" (onClick)="openDialog()" />
            </ui-empty-state>
          } @else {
            <!-- Masaüstü tablo -->
            <div class="hidden overflow-x-auto md:block">
              <table class="w-full border-collapse text-14.5">
                <thead>
                  <tr class="bg-surface-muted text-left text-12 font-semibold uppercase tracking-[0.03em] text-fg-muted">
                    <th class="h-10 whitespace-nowrap border-b border-line px-4">{{ a().colDate }}</th>
                    <th class="h-10 border-b border-line px-3">{{ a().colExpense }}</th>
                    <th class="h-10 border-b border-line px-3">{{ a().colCategory }}</th>
                    <th class="h-10 border-b border-line px-3 text-right">{{ a().colAmount }}</th>
                    <th class="h-10 w-14 border-b border-line px-2"><span class="sr-only">{{ t().common.delete }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of filtered(); track e.id) {
                    <tr class="list-row border-b border-line last:border-b-0">
                      <td class="num h-[56px] whitespace-nowrap px-4 text-fg-secondary">{{ expenseDate(e) | date:'dd.MM.yyyy' }}</td>
                      <td class="max-w-[320px] px-3">
                        <span class="block truncate font-semibold text-fg">{{ e.title }}</span>
                        @if (e.note) { <span class="block truncate text-12.5 text-fg-muted">{{ e.note }}</span> }
                      </td>
                      <td class="px-3">
                        <span class="flex flex-wrap items-center gap-1.5">
                          <ui-status-badge [tone]="catTone(e.category)" [icon]="catIcon(e.category)">{{ e.category }}</ui-status-badge>
                          @if (e.recurringId) {
                            <ui-status-badge tone="info" icon="pi-sync">{{ t().expenses.recurringBadge }}@if (seriesPos(e); as sp) { · {{ sp }} }</ui-status-badge>
                          }
                        </span>
                      </td>
                      <td class="num whitespace-nowrap px-3 text-right font-extrabold text-fg">{{ e.amount | currencyTr }}</td>
                      <td class="px-2 text-right">
                        <ui-icon-button icon="pi-trash" tone="danger" size="sm" [ariaLabel]="t().expenses.deleteTitle + ': ' + e.title"
                          (click)="confirmDelete(e)" />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Mobil satırlar -->
            <ul class="m-0 list-none p-0 md:hidden">
              @for (e of filtered(); track e.id) {
                <li class="flex min-h-[64px] items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0">
                  <span class="grid h-10 w-10 shrink-0 place-items-center rounded-token-md" [class]="catClass(e.category)" aria-hidden="true">
                    <i class="pi text-base" [class]="catIcon(e.category)"></i>
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="m-0 truncate text-15 font-semibold text-fg">{{ e.title }}</p>
                    <p class="num m-0 mt-0.5 truncate text-12.5 text-fg-muted">
                      {{ expenseDate(e) | date:'dd.MM.yyyy' }} · {{ e.category }}@if (e.recurringId) { · <i class="pi pi-sync text-10" aria-hidden="true"></i> {{ seriesPos(e) }} }
                    </p>
                  </div>
                  <ui-money class="font-display shrink-0 text-15 font-extrabold text-fg" [value]="e.amount" />
                  <ui-icon-button icon="pi-trash" tone="danger" [ariaLabel]="t().expenses.deleteTitle + ': ' + e.title"
                    (click)="confirmDelete(e)" />
                </li>
              }
            </ul>
          }
        </ui-glass-card>

        <!-- Kategoriye göre -->
        <ui-glass-card [title]="a().byCategory" icon="pi-chart-pie" tone="info" padding="none" clip>
          @if (byCategory().length === 0) {
            <ui-empty-state compact icon="pi-chart-pie" [title]="t().expenses.noExpenses" />
          } @else {
            <ul class="m-0 list-none p-0">
              @for (c of byCategory(); track c.name) {
                <li class="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  <span class="grid h-9 w-9 shrink-0 place-items-center rounded-token-md" [class]="catClass(c.name)" aria-hidden="true">
                    <i class="pi text-14" [class]="catIcon(c.name)"></i>
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-baseline justify-between gap-2">
                      <span class="truncate text-14 font-semibold text-fg">{{ c.name }}</span>
                      <span class="num shrink-0 text-14 font-extrabold text-fg">{{ c.amount | currencyTr }}</span>
                    </div>
                    <div class="mt-1.5 flex items-center gap-2">
                      <span class="block h-1.5 flex-1 overflow-hidden rounded-full bg-surface-strong" aria-hidden="true">
                        <span class="block h-full rounded-full bg-accent" [style.width.%]="c.pct"></span>
                      </span>
                      <span class="num w-10 shrink-0 text-right text-12 text-fg-muted">%{{ c.pct }}</span>
                    </div>
                  </div>
                </li>
              }
            </ul>
          }
        </ui-glass-card>
      </div>
    </div>

    <!-- Gider ekleme -->
    <p-dialog
      [visible]="dialogVisible()"
      (visibleChange)="setDialogVisible($event)"
      [header]="t().expenses.addExpenseTitle"
      [modal]="true"
      [draggable]="false"
      appendTo="body"
      styleClass="w-[440px] max-w-[95vw]"
    >
      <form class="flex flex-col gap-4 py-1" (ngSubmit)="save()" novalidate>
        <div class="flex flex-col gap-1.5">
          <label for="ex-title" class="text-sm font-semibold text-fg-secondary">{{ t().expenses.expenseName }}</label>
          <input pInputText id="ex-title" name="title" class="w-full" [(ngModel)]="form.title"
            [placeholder]="t().expenses.expenseNamePlaceholder"
            [attr.aria-invalid]="tried() && !form.title.trim()" [attr.aria-describedby]="tried() && !form.title.trim() ? 'ex-title-err' : null" />
          @if (tried() && !form.title.trim()) {
            <p id="ex-title-err" class="m-0 text-xs font-medium text-danger-text">{{ t().expenses.titleRequired }}</p>
          }
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="ex-category" class="text-sm font-semibold text-fg-secondary">{{ t().expenses.category }}</label>
          <p-autocomplete
            #categoryAc
            inputId="ex-category"
            name="category"
            [(ngModel)]="form.category"
            [suggestions]="categorySuggestions"
            (completeMethod)="searchCategory($event)"
            [forceSelection]="false"
            [dropdown]="true"
            appendTo="body"
            [placeholder]="t().expenses.category"
            styleClass="w-full"
            inputStyleClass="w-full"
          />
          @if (tried() && !categoryValue()) {
            <p class="m-0 text-xs font-medium text-danger-text">{{ t().expenses.categoryRequired }}</p>
          }
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="flex min-w-0 flex-col gap-1.5">
            <label for="ex-amount" class="text-sm font-semibold text-fg-secondary">{{ t().expenses.amount }}</label>
            <p-inputNumber inputId="ex-amount" name="amount" [(ngModel)]="form.amount" [min]="0" [minFractionDigits]="2"
              [maxFractionDigits]="2" mode="decimal" [locale]="numberLocale()" styleClass="w-full" inputStyleClass="num w-full" />
            @if (tried() && !(form.amount > 0)) {
              <p class="m-0 text-xs font-medium text-danger-text">{{ t().expenses.amountRequired }}</p>
            }
          </div>
          <ui-date-field inputId="ex-date" name="date" [label]="t().expenses.date" [(ngModel)]="form.date" [clearable]="false" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="ex-note" class="text-sm font-semibold text-fg-secondary">
            {{ t().expenses.note }} <span class="font-normal text-fg-muted">({{ t().common.optional }})</span>
          </label>
          <input pInputText id="ex-note" name="note" class="w-full" [(ngModel)]="form.note" [placeholder]="t().expenses.notePlaceholder" />
        </div>

        <div class="flex items-center justify-between gap-3 rounded-token-lg border border-line bg-surface-muted px-4 py-3">
          <label for="ex-recurring" class="min-w-0 cursor-pointer">
            <span class="block text-sm font-semibold text-fg">{{ t().expenses.recurring }}</span>
            <span class="block text-xs text-fg-muted">{{ t().expenses.recurringDesc }}</span>
          </label>
          <p-toggleswitch inputId="ex-recurring" name="recurring" [(ngModel)]="form.recurring" />
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button [label]="t().common.cancel" severity="secondary" (onClick)="setDialogVisible(false)" />
        <p-button
          [label]="t().common.save"
          icon="pi pi-check"
          [loading]="saving()"
          (onClick)="save()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class ExpensesPage implements OnInit {
  private readonly svc = inject(ExpenseService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lang = inject(LangService);
  readonly t = this.lang.t;
  readonly a = computed(() => this.t().acc);
  readonly numberLocale = computed(() => this.lang.lang() === 'tr' ? 'tr-TR' : 'en-US');

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly expenses = signal<Expense[]>([]);
  readonly period = signal<ExpensePeriod>('month');

  readonly dialogVisible = signal(false);
  private readonly categoryAc = viewChild<AutoComplete>('categoryAc');

  /**
   * Dialog kapanırken (Esc dahil) kategori önerileri panelini de kapat: panel body'ye ekli (appendTo) olduğundan
   * dialog içeriği yok edilince açık kalıp ekranda asılı kalıyordu.
   */
  setDialogVisible(v: boolean): void {
    if (!v) this.categoryAc()?.hide();
    this.dialogVisible.set(v);
  }
  /** Kaydet'e basıldı mı (doğrulama mesajlarını göstermek için). */
  readonly tried = signal(false);
  form = { title: '', category: '', amount: 0, date: new Date(), note: '', recurring: false };

  categorySuggestions: string[] = [];

  /** Varsayılan kategoriler + kullanıcının daha önce girdiği kategoriler. */
  private get allCategories(): string[] {
    return [...new Set([...EXPENSE_CATEGORIES, ...this.expenses().map(e => e.category).filter(Boolean)])]
      .sort((a, b) => a.localeCompare(b, 'tr'));
  }

  searchCategory(event: { query: string }): void {
    const q = event.query.trim().toLocaleLowerCase('tr');
    const all = this.allCategories;
    if (!q) {
      this.categorySuggestions = all;
    } else {
      const filtered = all.filter(v => v.toLocaleLowerCase('tr').includes(q));
      if (!filtered.some(v => v.toLocaleLowerCase('tr') === q) && event.query.trim()) {
        filtered.push(event.query.trim());
      }
      this.categorySuggestions = filtered;
    }
  }

  readonly periods = computed<UiSegmentOption<ExpensePeriod>[]>(() => {
    const e = this.t().expenses;
    return [
      { value: 'month' as ExpensePeriod, label: e.month },
      { value: 'week' as ExpensePeriod, label: e.week },
      { value: 'all' as ExpensePeriod, label: e.all },
    ];
  });

  readonly filtered = computed(() => {
    const list = this.expenses();
    const p = this.period();
    if (p === 'all') return list;
    const range = getPeriodRange(p, new Date());
    return list.filter(e => !!e.date && isInRange(e.date.toDate(), range));
  });

  readonly periodLabel = computed(() => this.periods().find(p => p.value === this.period())?.label ?? '');

  readonly recurringCount = computed(() => this.filtered().filter(e => !!e.recurringId).length);

  /** recurringId → tarihe göre sıralı gider kimlikleri (seri içindeki sıra için). */
  private readonly seriesIndex = computed(() => {
    const m = new Map<string, string[]>();
    for (const e of this.expenses()) {
      if (!e.recurringId) continue;
      const arr = m.get(e.recurringId) ?? [];
      arr.push(e.id);
      m.set(e.recurringId, arr);
    }
    const byId = new Map(this.expenses().map(e => [e.id, e.date?.toMillis?.() ?? 0]));
    for (const arr of m.values()) arr.sort((a, b) => (byId.get(a) ?? 0) - (byId.get(b) ?? 0));
    return m;
  });

  /** Tekrarlayan giderde "3/12" gibi sıra; tekil ya da tek kayıtlı seride boş. */
  seriesPos(e: Expense): string {
    const arr = e.recurringId ? this.seriesIndex().get(e.recurringId) : undefined;
    if (!arr || arr.length < 2) return '';
    return `${arr.indexOf(e.id) + 1}/${arr.length}`;
  }

  categoryValue(): string {
    return (this.form.category ?? '').toString().trim();
  }

  readonly totalFiltered = computed(() => Math.round(this.filtered().reduce((s, e) => s + (e.amount || 0), 0) * 100) / 100);

  readonly avgAmount = computed(() => {
    const n = this.filtered().length;
    return n ? Math.round((this.totalFiltered() / n) * 100) / 100 : 0;
  });

  /** Dönemdeki giderlerin kategori dağılımı (büyükten küçüğe). */
  readonly byCategory = computed(() => {
    const total = this.totalFiltered();
    const m = new Map<string, number>();
    for (const e of this.filtered()) {
      const k = e.category || '—';
      m.set(k, (m.get(k) ?? 0) + (e.amount || 0));
    }
    return [...m.entries()]
      .map(([name, amount]) => ({
        name, amount: Math.round(amount * 100) / 100, pct: total > 0 ? Math.round((amount / total) * 100) : 0,
      }))
      .sort((x, y) => y.amount - x.amount);
  });

  readonly topCategory = computed<{ name: string; amount: number; pct: number } | null>(() => this.byCategory()[0] ?? null);

  ngOnInit(): void {
    this.svc.getAll$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => { this.expenses.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openDialog(): void {
    this.form = { title: '', category: '', amount: 0, date: new Date(), note: '', recurring: false };
    this.tried.set(false);
    this.dialogVisible.set(true);
  }

  async save(): Promise<void> {
    this.tried.set(true);
    const category = (this.form.category ?? '').toString().trim();
    if (!this.form.title.trim() || !this.form.amount || !category || this.saving()) return;
    this.saving.set(true);
    try {
      const base = {
        title: this.form.title.trim(),
        amount: Math.round(this.form.amount * 100) / 100,
        category,
        note: this.form.note.trim(),
        date: new Date(this.form.date ?? new Date()),
      };

      if (this.form.recurring) {
        // 12 aylık seri tek writeBatch ile atomik; ortak recurringId; ay sonu taşması yok.
        await this.svc.createRecurring(base, 12);
        this.toast.add({ severity: 'success', summary: '', detail: this.t().expenses.added, life: 3000 });
      } else {
        await this.svc.create(base);
        this.toast.add({ severity: 'success', summary: '', detail: this.t().expenses.added, life: 2500 });
      }

      this.setDialogVisible(false);
    } catch {
      this.toast.add({ severity: 'error', summary: '', detail: this.t().common.error, life: 3000 });
    } finally {
      this.saving.set(false);
    }
  }

  confirmDelete(e: Expense): void {
    const series = e.recurringId ? this.expenses().filter(x => x.recurringId === e.recurringId) : [];
    if (series.length > 1) {
      // Tekrarlayan gider: "Tüm seri" (accept) veya "Sadece bu" (reject). Kapat (X/Esc) hiçbir şey yapmaz.
      this.confirm.confirm({
        message: `"${e.title}" - ${this.t().expenses.deleteSeriesConfirm} (${series.length})`,
        header: this.t().expenses.deleteTitle,
        icon: 'pi pi-trash',
        acceptLabel: this.t().expenses.deleteSeries,
        rejectLabel: this.t().expenses.deleteOnlyThis,
        acceptButtonStyleClass: 'p-button-danger',
        rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
        closable: true,
        closeOnEscape: true,
        accept: () => this.deleteSeries(series.map(x => x.id)),
        reject: (type?: ConfirmEventType) => { if (type === ConfirmEventType.REJECT) this.delete(e.id); },
      });
      return;
    }
    this.confirm.confirm({
      message: `"${e.title}" ${this.t().expenses.deleteConfirm}`,
      header: this.t().expenses.deleteTitle,
      icon: 'pi pi-trash',
      acceptLabel: this.t().expenses.deleteYes,
      rejectLabel: this.t().expenses.deleteNo,
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.delete(e.id),
    });
  }

  private async delete(id: string): Promise<void> {
    try {
      await this.svc.delete(id);
      this.toast.add({ severity: 'success', summary: '', detail: this.t().expenses.deleted, life: 2500 });
    } catch {
      this.toast.add({ severity: 'error', summary: '', detail: this.t().common.error, life: 3000 });
    }
  }

  private async deleteSeries(ids: string[]): Promise<void> {
    try {
      await this.svc.deleteMany(ids);
      this.toast.add({ severity: 'success', summary: '', detail: this.t().expenses.seriesDeleted, life: 2500 });
    } catch {
      this.toast.add({ severity: 'error', summary: '', detail: this.t().common.error, life: 3000 });
    }
  }

  /** Bekleyen serverTimestamp/eksik tarih için güvenli dönüşüm. */
  expenseDate(e: Expense): Date | null {
    return e.date ? e.date.toDate() : null;
  }

  catTone(cat: string): UiTone {
    return (CATEGORY_STYLE[cat] ?? DEFAULT_CATEGORY_STYLE).tone;
  }

  catClass(cat: string): string {
    return TONE_SOFT[this.catTone(cat)];
  }

  catIcon(cat: string): string {
    return (CATEGORY_STYLE[cat] ?? DEFAULT_CATEGORY_STYLE).icon;
  }
}
