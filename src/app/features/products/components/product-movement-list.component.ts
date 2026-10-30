import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Product, StockMovement } from '../../../shared/models/product.model';
import { LangService } from '../../../core/i18n/lang.service';
import { EmptyStateComponent, GlassCardComponent } from '../../../shared/ui';
import { formatQty } from '../../../shared/utils/product-form.utils';
import { qtyWithUnit } from '../product-unit';

/** Ürün detayı: son stok hareketleri kartı (en fazla `limit` satır) + "Tümünü gör" bağlantısı. */
@Component({
  selector: 'app-product-movement-list',
  standalone: true,
  imports: [DatePipe, RouterLink, GlassCardComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-glass-card [title]="t().inventory.lastMovements" icon="pi-history" tone="info" padding="none">
      <a card-actions [routerLink]="['/products', productId(), 'movements']"
         class="inline-flex min-h-[36px] items-center gap-1 text-13.5 font-semibold text-brand-text no-underline hover:underline">
        {{ t().products.viewAll }} <i class="pi pi-chevron-right text-10" aria-hidden="true"></i>
      </a>

      @if (movements().length === 0) {
        <ui-empty-state compact icon="pi-history" [title]="t().products.noMovements" />
      } @else {
        <ul class="m-0 flex list-none flex-col p-0">
          @for (m of movements().slice(0, limit()); track m.id) {
            <li class="list-row flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-token-md"
                    [class]="m.type === 'in' ? 'bg-success-soft text-success-text' : 'bg-accent-soft text-accent-text'" aria-hidden="true">
                <i class="pi text-sm" [class]="m.type === 'in' ? 'pi-arrow-down' : 'pi-arrow-up'"></i>
              </span>
              <div class="min-w-0 flex-1">
                <p class="m-0 truncate text-sm font-semibold text-fg">{{ m.reason || '—' }}</p>
                <p class="num m-0 mt-0.5 text-xs text-fg-muted">{{ m.createdAt?.toDate() | date:'dd.MM.yyyy HH:mm' }}</p>
              </div>
              <div class="shrink-0 text-right">
                <p class="num m-0 text-sm font-extrabold" [class]="m.type === 'in' ? 'text-success-text' : 'text-accent-text'">
                  {{ m.type === 'in' ? '+' : '−' }}{{ fmt(m.quantity) }}
                </p>
                <p class="num m-0 text-xs text-fg-muted">{{ withUnit(m.newStock) }}</p>
              </div>
            </li>
          }
        </ul>
      }
    </ui-glass-card>
  `,
})
export class ProductMovementListComponent {
  readonly t = inject(LangService).t;

  readonly movements = input.required<StockMovement[]>();
  readonly productId = input.required<string>();
  readonly product = input<Pick<Product, 'unit'> | null>(null);
  readonly limit = input(8);

  fmt(n: number): string {
    return formatQty(n, this.t().products.locale);
  }

  withUnit(n: number): string {
    return qtyWithUnit(n, this.product(), this.t().products);
  }
}
