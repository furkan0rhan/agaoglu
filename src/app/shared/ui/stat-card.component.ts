import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TONE_BORDER, TONE_SOFT, TONE_TEXT, TONE_TINT, UiTone } from './tone';

/**
 * C "durum bloğu" (KPI): üstte 40px başlık şeridi (ikon + etiket), altta büyük Manrope rakam,
 * alt metin, isteğe bağlı trend. Değeri biçimlenmiş metin olarak verin (ör. `currencyTr`).
 *
 * - `highlight`: kenarlık + başlık şeridi tonlu, değer ton renginde (ör. veresiye alacağı).
 * - `tinted`: bütün blok tonlu zemin (ör. "Dikkat gerekenler", gecikme).
 *
 * ```html
 * <ui-stat-card icon="pi-wallet" tone="success" [label]="t().dashboard.todaySales"
 *   [value]="store.dailySales() | currencyTr" [hint]="count + ' işlem'"
 *   [loading]="store.loading()" [trend]="12.5" trendLabel="düne göre" link="/reports" />
 * <ui-stat-card icon="pi-exclamation-triangle" tone="danger" tinted label="Dikkat" [value]="11">
 *   <ui-status-badge tone="danger">7 kritik stok</ui-status-badge>   <!-- gövdenin altına -->
 * </ui-stat-card>
 * ```
 */
@Component({
  selector: 'ui-stat-card',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    <ng-template #body>
      <div class="flex h-10 shrink-0 items-center gap-2 border-b px-3.5 text-13.5 font-semibold"
           [class]="headClass()">
        <i class="pi text-15" [class]="icon() + ' ' + iconColor()" aria-hidden="true"></i>
        <span class="min-w-0 flex-1 truncate">{{ label() }}</span>
        <ng-content select="[stat-badge]" />
      </div>
      <div class="flex flex-1 flex-col gap-1.5 px-3.5 pb-3.5 pt-3">
        @if (loading()) {
          <div class="h-8 w-3/4 animate-pulse rounded-token-sm bg-surface-strong" aria-hidden="true"></div>
          <div class="h-3.5 w-1/2 animate-pulse rounded-token-sm bg-surface-strong" aria-hidden="true"></div>
        } @else {
          <p class="num-xl m-0 truncate text-20 min-[400px]:text-[1.4375rem] sm:text-28" [class]="valueClass()">{{ value() }}</p>
          @if (hint() || trend() !== null) {
            <p class="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-13 text-fg-secondary">
              @if (trend() !== null) {
                <span class="num inline-flex h-6 items-center gap-1 rounded-token-sm px-2 text-12.5 font-bold" [class]="trendClass()">
                  <i class="pi text-10" [class]="trend()! >= 0 ? 'pi-arrow-up-right' : 'pi-arrow-down-right'" aria-hidden="true"></i>
                  {{ trendText() }}
                </span>
                @if (trendLabel()) { <span>{{ trendLabel() }}</span> }
              }
              @if (hint()) { <span class="min-w-0 truncate">{{ hint() }}</span> }
            </p>
          }
        }
        <div class="mt-auto flex flex-wrap gap-1.5 pt-0.5 empty:hidden">
          <ng-content />
        </div>
      </div>
    </ng-template>

    @if (link()) {
      <a [routerLink]="link()" [class]="cardClass()" class="no-underline transition-colors duration-150 hover:border-brand">
        <ng-container [ngTemplateOutlet]="body" />
      </a>
    } @else {
      <div [class]="cardClass()">
        <ng-container [ngTemplateOutlet]="body" />
      </div>
    }
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input<string | number | null>('');
  readonly hint = input<string>('');
  /** PrimeIcons sınıfı, ör. `pi-wallet`. */
  readonly icon = input<string>('pi-chart-line');
  readonly tone = input<UiTone>('brand');
  /** true: kenarlık + başlık şeridi + değer tonla vurgulanır (ör. kritik stok > 0). */
  readonly highlight = input(false);
  /** true: bütün blok tonlu zemin (durum bloğu). */
  readonly tinted = input(false, { transform: booleanAttribute });
  readonly loading = input(false);
  /** Yüzde değişim; pozitif yeşil, negatif kırmızı. null → gösterilmez. */
  readonly trend = input<number | null>(null);
  /** Trend yanındaki açıklama, ör. "düne göre". */
  readonly trendLabel = input<string>('');
  readonly link = input<string | unknown[] | null>(null);

  private readonly toned = computed(() => this.highlight() || this.tinted());

  readonly iconColor = computed(() => (this.toned() ? '' : TONE_TEXT[this.tone() === 'neutral' ? 'brand' : this.tone()]));

  readonly valueClass = computed(() => (this.toned() ? TONE_TEXT[this.tone()] : 'text-fg'));

  readonly headClass = computed(() => {
    if (this.tinted()) return `bg-transparent ${TONE_TEXT[this.tone()]} ${TONE_BORDER[this.tone()]}`;
    if (this.highlight()) return `${TONE_SOFT[this.tone()]} border-line`;
    return 'bg-surface-muted bg-furrow text-fg-secondary border-line';
  });

  readonly cardClass = computed(() => {
    const base = 'flex h-full min-h-[132px] flex-col overflow-hidden rounded-token-lg border';
    if (this.tinted()) return `${base} ${TONE_TINT[this.tone()]}`;
    if (this.highlight()) return `${base} bg-surface ${TONE_BORDER[this.tone()]}`;
    return `${base} bg-surface border-line`;
  });

  readonly trendClass = computed(() => {
    const t = this.trend() ?? 0;
    return t >= 0 ? TONE_SOFT.success : TONE_SOFT.danger;
  });

  readonly trendText = computed(() => {
    const t = this.trend() ?? 0;
    return `%${Math.abs(t).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
  });
}
