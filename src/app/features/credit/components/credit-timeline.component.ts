import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LangService } from '../../../core/i18n/lang.service';
import { CreditTransaction } from '../../../shared/models/credit.model';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import {
  EmptyStateComponent, GlassCardComponent, MoneyComponent, SegmentedComponent, StatusBadgeComponent, TONE_SOFT, UiSegmentOption,
} from '../../../shared/ui';

type EntryKind = 'sale' | 'reversal' | 'payment';
type Filter = 'all' | 'sale' | 'payment';

/** Zaman çizelgesindeki tek hareket (sunum modeli). */
interface TimelineEntry {
  tx: CreditTransaction;
  kind: EntryKind;
  title: string;
  /** Ürünler / iptal nedeni / tahsilat notu. */
  detail: string;
  /** Satış numarası. */
  ref: string;
  /** Borcu artırır mı (+) azaltır mı (-). */
  increases: boolean;
  amount: number;
  icon: string;
  iconClass: string;
  date: Date | null;
  due: Date | null;
}

/**
 * C "Hesap Hareketleri": bakiyeli zaman çizelgesi (satış / iptal / tahsilat), Tümü/Satış/Tahsilat filtresi.
 * `limit` verilirse yalnız en yeni N hareket ve "Tüm hareketler" bağlantısı (`moreLink`) gösterilir.
 */
@Component({
  selector: 'app-credit-timeline',
  standalone: true,
  imports: [
    DatePipe, RouterLink, CurrencyTrPipe, GlassCardComponent, EmptyStateComponent, MoneyComponent, SegmentedComponent,
    StatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-glass-card [title]="a().movements" icon="pi-history" tone="accent" padding="none" clip
      [subtitle]="transactions().length + ' ' + t().credit.records">
      <ui-segmented card-actions class="hidden sm:inline-flex" size="sm" [options]="filters()" [(value)]="filter" [ariaLabel]="t().common.filters" />
      <div class="border-b border-line px-3 py-2 sm:hidden">
        <ui-segmented class="w-full" [block]="true" size="sm" [options]="filters()" [(value)]="filter" [ariaLabel]="t().common.filters" />
      </div>

      @if (loading()) {
        <div class="flex flex-col gap-4 p-4" aria-hidden="true">
          @for (i of [1, 2, 3]; track i) {
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 animate-pulse rounded-token-lg bg-surface-muted"></div>
              <div class="h-4 flex-1 animate-pulse rounded bg-surface-muted"></div>
            </div>
          }
        </div>
      } @else if (visible().length === 0) {
        <ui-empty-state compact icon="pi-list" [title]="t().credit.noTransactions" />
      } @else {
        <ol class="m-0 list-none px-4 py-2">
          @for (e of visible(); track e.tx.id; let last = $last) {
            <li class="relative grid grid-cols-[40px_minmax(0,1fr)_auto] gap-3 py-2.5">
              @if (!last) {
                <span class="absolute -bottom-2.5 left-[19px] top-[52px] w-0.5 bg-line" aria-hidden="true"></span>
              }
              <span class="relative z-[1] grid h-10 w-10 place-items-center rounded-token-lg" [class]="e.iconClass" aria-hidden="true">
                <i class="pi text-16" [class]="e.icon"></i>
              </span>
              <div class="min-w-0">
                <p class="m-0 text-14.5 font-semibold text-fg">{{ e.title }}</p>
                @if (e.ref) { <p class="num m-0 truncate text-12 text-fg-muted" [title]="e.ref">{{ e.ref }}</p> }
                <p class="num m-0 text-12.5 text-fg-muted">
                  @if (e.date) { {{ e.date | date:'d MMM y · HH:mm':'':locale() }} } @else { {{ t().credit.pending }} }
                  @if (e.due) { · {{ t().credit.dueDate }} {{ e.due | date:'dd.MM.yyyy' }} }
                </p>
                @if (e.detail) {
                  <p class="m-0 mt-1 break-words text-13 text-fg-secondary" [class.italic]="e.kind !== 'sale'">{{ e.detail }}</p>
                }
                @if (e.kind === 'sale' && e.tx.installmentCount && e.tx.installmentCount > 1) {
                  <div class="mt-1.5 flex flex-wrap gap-1.5">
                    <ui-status-badge tone="accent" icon="pi-calendar" size="sm">
                      {{ e.tx.installmentCount }} {{ t().pos.perInstallment }} · {{ e.tx.installmentAmount | currencyTr }}
                    </ui-status-badge>
                    @if (e.tx.downPayment) {
                      <ui-status-badge tone="success" icon="pi-wallet" size="sm">{{ t().credit.downPayment }} · {{ e.tx.downPayment | currencyTr }}</ui-status-badge>
                    }
                    @if (e.tx.interestRate) {
                      <ui-status-badge tone="warning" icon="pi-percentage" size="sm">{{ t().pos.interestAmount }} %{{ e.tx.interestRate }}</ui-status-badge>
                    }
                  </div>
                }
              </div>
              <div class="text-right">
                <p class="font-display m-0 whitespace-nowrap text-16 font-extrabold" [class]="e.increases ? 'text-fg' : 'text-brand-text'">
                  {{ e.increases ? '+' : '−' }}<ui-money [value]="e.amount" [symbol]="false" />
                </p>
                @if (e.kind === 'sale' && e.tx.originalAmount && e.tx.originalAmount !== e.amount) {
                  <p class="num m-0 text-11 text-fg-muted line-through">{{ e.tx.originalAmount | currencyTr }}</p>
                }
                @if (e.tx.balance !== null && e.tx.balance !== undefined) {
                  <p class="num m-0 whitespace-nowrap text-12 text-fg-muted">{{ a().balance(money(e.tx.balance)) }}</p>
                }
              </div>
            </li>
          }
        </ol>
        @if (moreLink() && hidden() > 0) {
          <a [routerLink]="moreLink()"
            class="flex min-h-[44px] items-center justify-center gap-1 border-t border-line text-13.5 font-semibold text-brand-text no-underline hover:bg-surface-hover">
            {{ a().allMovements }} ({{ entries().length }})<i class="pi pi-chevron-right text-10" aria-hidden="true"></i>
          </a>
        }
      }
    </ui-glass-card>
  `,
})
export class CreditTimelineComponent {
  private readonly lang = inject(LangService);
  private readonly cur = new CurrencyTrPipe();
  readonly t = this.lang.t;
  readonly a = computed(() => this.t().acc);
  readonly locale = computed(() => (this.lang.lang() === 'tr' ? 'tr' : 'en-US'));

  readonly transactions = input<CreditTransaction[]>([]);
  readonly loading = input(false);
  /** En fazla gösterilecek hareket (null = hepsi). */
  readonly limit = input<number | null>(null);
  readonly moreLink = input<unknown[] | string | null>(null);

  readonly filter = signal<Filter>('all');
  readonly filters = computed<UiSegmentOption<Filter>[]>(() => [
    { value: 'all', label: this.a().filterAll },
    { value: 'sale', label: this.a().filterSale },
    { value: 'payment', label: this.a().filterPayment },
  ]);

  readonly entries = computed(() => this.transactions().map(tx => this.toEntry(tx)));
  private readonly filtered = computed(() => {
    const f = this.filter();
    const list = this.entries();
    if (f === 'payment') return list.filter(e => e.kind === 'payment');
    if (f === 'sale') return list.filter(e => e.kind !== 'payment');
    return list;
  });
  readonly visible = computed(() => {
    const n = this.limit();
    return n ? this.filtered().slice(0, n) : this.filtered();
  });
  readonly hidden = computed(() => this.filtered().length - this.visible().length);

  money(v: number): string { return this.cur.transform(v); }

  private toEntry(tx: CreditTransaction): TimelineEntry {
    const cr = this.t().credit;
    const date = tx.createdAt?.toDate() ?? null;
    const isReversal = tx.type === 'debt' && (tx.isReversal === true || tx.amount < 0);
    const amount = Math.abs(tx.amount);

    if (tx.type === 'payment') {
      const isDefaultDesc = !tx.description || tx.description === cr.cashPayDesc || tx.description === cr.cardPayDesc;
      return {
        tx, kind: 'payment', date, due: null, amount, increases: false,
        title: `${cr.collection} · ${tx.paymentMethod === 'card' ? cr.card : cr.cash}`,
        detail: isDefaultDesc ? '' : tx.description,
        ref: '',
        icon: tx.paymentMethod === 'card' ? 'pi-credit-card' : 'pi-wallet',
        iconClass: TONE_SOFT.success,
      };
    }
    if (isReversal) {
      const parts = (tx.description ?? '').split(' · ');
      return {
        tx, kind: 'reversal', date, due: null, amount, increases: false,
        title: cr.saleReversal,
        detail: parts.slice(1).join(' · '),
        ref: parseSaleRef(tx.description),
        icon: 'pi-replay',
        iconClass: TONE_SOFT.neutral,
      };
    }
    const products = parseProducts(tx.description);
    return {
      tx, kind: 'sale', date, due: toDate(tx.dueDate), amount, increases: true,
      title: cr.creditSale,
      detail: products === '-' ? '' : products,
      ref: parseSaleRef(tx.description),
      icon: 'pi-shopping-cart',
      iconClass: TONE_SOFT.accent,
    };
  }
}

function toDate(d: unknown): Date | null {
  if (!d) return null;
  if (d instanceof Date) return d;
  return (d as { toDate?: () => Date }).toDate?.() ?? null;
}

/** "Satış: S-123 · ürünler" → "S-123". */
export function parseSaleRef(description: string): string {
  const part = (description ?? '').split(' · ')[0];
  return part.replace(/^[^:]*:\s*/, '').trim();
}

export function parseProducts(description: string): string {
  const parts = (description ?? '').split(' · ');
  return parts.length > 1 ? parts.slice(1).join(', ') : '-';
}
