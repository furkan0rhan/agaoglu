import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Product } from '../../../shared/models/product.model';
import { expiryInfo, StockReconciliation } from '../../../shared/utils/batch.utils';
import { ProductStore } from '../store/product.store';
import { LangService } from '../../../core/i18n/lang.service';
import { GlassCardComponent, StatusBadgeComponent, UiTone } from '../../../shared/ui';
import { qtyWithUnit, unitText } from '../product-unit';
import { productUnit } from '../../../shared/models/product.model';
import { formatQty } from '../../../shared/utils/product-form.utils';
import { stockBarClass, stockPct, stockTone } from '../inventory-ui';

export type ReconcileMode = 'stockToBatches' | 'addMissingBatch';

/**
 * Ürün detayı: C "Stok" kartı — büyük stok rakamı + stok çubuğu, kritik eşik, stok değeri, en yakın SKT;
 * (2.12) stok ↔ parti toplamı uyuşmazlık notu. Stok ekle/çıkar düğmeleri içerik olarak (`[stock-actions]`) gelir.
 * Sadece gösterim; uzlaştırma isteği `reconcile` çıkışıyla sayfaya iletilir.
 */
@Component({
  selector: 'app-product-stock-banner',
  standalone: true,
  imports: [ButtonModule, GlassCardComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-glass-card [title]="t().inventory.stockCard" icon="pi-box" [tone]="tone()" padding="none">
      @if (product().stock <= 0) {
        <ui-status-badge card-actions tone="danger" icon="pi-times-circle">{{ t().products.outOfStock }}</ui-status-badge>
      } @else if (product().stock <= product().minStock) {
        <ui-status-badge card-actions tone="danger" icon="pi-exclamation-triangle">{{ t().inventory.critical }}</ui-status-badge>
      }

      <div class="grid grid-cols-2 sm:grid-cols-4">
        <div class="col-span-2 flex flex-col justify-center gap-2 border-b border-line px-4 py-3.5 sm:col-span-1 sm:border-b-0 sm:border-r">
          <span class="text-12.5 font-semibold text-fg-muted">{{ t().products.currentStock }}</span>
          <b class="num-xl text-[1.875rem] leading-none" [class]="valueClass()">{{ qty(product().stock) }}
            <small class="font-sans text-sm font-medium text-fg-muted">{{ unitName() }}</small></b>
          <div class="h-2 overflow-hidden rounded-full bg-surface-strong" aria-hidden="true">
            <div class="h-full rounded-full" [class]="barClass()" [style.width.%]="barPct()"></div>
          </div>
        </div>
        <div class="flex flex-col gap-1 border-r border-line px-4 py-3.5">
          <span class="text-12.5 font-semibold text-fg-muted">{{ t().inventory.threshold }}</span>
          <b class="num text-lg font-extrabold text-fg">{{ withUnit(product().minStock) }}</b>
        </div>
        <div class="flex flex-col gap-1 px-4 py-3.5 sm:border-r sm:border-line">
          <span class="text-12.5 font-semibold text-fg-muted">{{ t().inventory.stockValue }}</span>
          <b class="num text-lg font-extrabold text-fg">{{ stockValue() }}</b>
        </div>
        <div class="col-span-2 flex flex-col gap-1 border-t border-line px-4 py-3.5 sm:col-span-1 sm:border-t-0">
          <span class="text-12.5 font-semibold text-fg-muted">{{ t().inventory.nearestExpiry }}</span>
          @if (nearestText(); as n) {
            <b class="num text-lg font-extrabold" [class]="nearestDays() !== null && nearestDays()! <= warnDays() ? 'text-warning-text' : 'text-fg'">{{ n }}</b>
            @if (nearestDays() !== null) {
              <span class="num text-xs text-fg-muted">{{ nearestDays() }} {{ t().inventory.days }}</span>
            }
          } @else {
            <b class="text-lg font-extrabold text-fg-muted">—</b>
          }
          @if (expiredQty() > 0) {
            <span class="text-xs font-semibold text-danger-text">
              <i class="pi pi-calendar-times mr-1 text-11" aria-hidden="true"></i><span class="num">{{ qty(expiredQty()) }}</span> {{ t().products.expiredUnits }}
            </span>
          }
        </div>
      </div>

      @if (!reconcileState().ok) {
        <div class="mx-3 mb-3 flex flex-wrap items-center gap-3 rounded-token-lg border border-warning-line bg-warning-soft p-3 sm:mx-4" role="alert">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-md bg-warning text-fg-inverse" aria-hidden="true">
            <i class="pi pi-exclamation-triangle"></i>
          </span>
          <div class="min-w-48 flex-1">
            <p class="m-0 text-sm font-semibold text-warning-text">{{ t().products.mismatchTitle }}</p>
            <p class="num m-0 text-xs text-fg-secondary">
              {{ t().products.mismatchStock }}: {{ reconcileState().stock }} · {{ t().products.mismatchBatchTotal }}: {{ reconcileState().batchTotal }}
            </p>
            <p class="m-0 mt-0.5 text-xs text-fg-secondary">{{ t().products.reconcileHint }}</p>
          </div>
          <div class="flex w-full flex-wrap gap-2 sm:w-auto">
            <p-button [label]="t().products.reconcileBtn" icon="pi pi-sync" severity="warn" size="small"
                      [loading]="saving()" (onClick)="reconcile.emit('stockToBatches')" />
            @if (reconcileState().diff > 0) {
              <p-button [label]="t().products.addMissingBatchBtn" icon="pi pi-plus" severity="secondary" size="small"
                        [loading]="saving()" (onClick)="reconcile.emit('addMissingBatch')" />
            }
          </div>
        </div>
      }

      <div card-footer class="flex flex-wrap items-center gap-2 border-t border-line px-3 py-3 sm:px-4">
        <ng-content select="[stock-actions]" />
      </div>
    </ui-glass-card>
  `,
})
export class ProductStockBannerComponent {
  readonly t = inject(LangService).t;
  /** SKT uyarı eşiği (Ayarlar → Satış) */
  readonly warnDays = inject(ProductStore).expiryWarnDays;

  readonly product = input.required<Product>();
  readonly reconcileState = input.required<StockReconciliation>();
  readonly expiredQty = input(0);
  readonly saving = input(false);
  readonly reconcile = output<ReconcileMode>();

  readonly tone = computed<UiTone>(() => {
    const t = stockTone(this.product());
    return t === 'brand' ? 'success' : t;
  });

  readonly valueClass = computed(() => this.tone() === 'danger' ? 'text-danger-text' : 'text-fg');
  readonly barClass = computed(() => stockBarClass(this.product()));
  readonly barPct = computed(() => stockPct(this.product()));
  readonly unitName = computed(() => unitText(productUnit(this.product()), this.t().products));

  readonly stockValue = computed(() => {
    const p = this.product();
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format((p.purchasePrice ?? 0) * Math.max(0, p.stock ?? 0)) + ' ₺';
  });

  private readonly nearest = computed(() => {
    const p = this.product();
    return p.batches?.length ? expiryInfo(p.batches).nearestValid : p.expiryDate;
  });

  readonly nearestText = computed(() => {
    const n = this.nearest();
    return n?.toDate ? n.toDate().toLocaleDateString(this.t().products.locale) : null;
  });

  readonly nearestDays = computed(() => {
    const n = this.nearest();
    if (!n?.toDate) return null;
    return Math.max(0, Math.ceil((n.toDate().getTime() - Date.now()) / 86_400_000));
  });

  qty(n: number): string { return formatQty(n, this.t().products.locale); }
  withUnit(n: number): string { return qtyWithUnit(n, this.product(), this.t().products); }
}
