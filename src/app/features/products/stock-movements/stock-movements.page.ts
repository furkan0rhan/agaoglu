import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Firestore, collection, documentId, getDocs, query, where } from '@angular/fire/firestore';
import { DatePipe } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';
import { ProductService } from '../services/product.service';
import { ProductStore } from '../store/product.store';
import { StockMovement } from '../../../shared/models/product.model';
import { LangService } from '../../../core/i18n/lang.service';
import { roundQty } from '../../../shared/utils/batch.utils';
import { formatQty } from '../../../shared/utils/product-form.utils';
import { EmptyStateComponent, GlassCardComponent, PageHeaderComponent, SegmentedComponent } from '../../../shared/ui';
import { SumStripComponent, SumStripItem } from '../components/sum-strip.component';
import { qtyWithUnit } from '../product-unit';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LoggerService } from '../../../core/logging/logger.service';

/** Hareketin referans verdiği belge (alış / satış) — ham kimlik yerine belge no + bağlantı. */
interface MovementRef { kind: 'purchase' | 'sale'; no: string; link: string[] }

/** Firestore `in` sorgusu en fazla 30 değer alır. */
const IN_CHUNK = 30;

type Filter = 'all' | 'in' | 'out';

/** Sayfada gösterilecek en fazla hareket sayısı (3.5) */
const MOVEMENT_LIMIT = 200;

@Component({
  selector: 'app-stock-movements',
  standalone: true,
  imports: [DatePipe, RouterLink, SkeletonModule, PageHeaderComponent, GlassCardComponent, EmptyStateComponent, SegmentedComponent, SumStripComponent],
  host: { class: 'block' },
  template: `
    <ui-page-header [title]="t().products.viewMovements" [subtitle]="productName()" icon="pi-history" iconTone="info"
                    [backLink]="['/products', productId]" [backLabel]="t().common.back" />

    <div class="page-body">
      <app-sum-strip [items]="summary()" [ariaLabel]="t().products.viewMovements" />

      <ui-glass-card [title]="t().inventory.movementsTitle" icon="pi-history" tone="info" padding="none"
                     [subtitle]="!loading() && movements().length >= limit ? t().products.movementsLimitNote.replace('{n}', '' + limit) : ''">
        <ui-segmented card-actions size="sm" [options]="filters()" [value]="activeFilter()" (valueChange)="setFilter($event)"
                      [ariaLabel]="t().common.filters" />
        @if (loading()) {
          <div class="flex flex-col gap-3 p-4" aria-hidden="true">
            @for (i of [1,2,3,4,5]; track i) {
              <div class="flex items-center gap-3">
                <p-skeleton size="40px" />
                <div class="flex-1">
                  <p-skeleton height="14px" styleClass="mb-2" />
                  <p-skeleton height="12px" width="60%" />
                </div>
                <p-skeleton height="20px" width="50px" />
              </div>
            }
          </div>
        } @else if (filtered().length === 0) {
          <ui-empty-state compact icon="pi-history" [title]="t().products.noMovements" />
        } @else {
          <!-- Masaüstü: tablo -->
          <table class="hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr class="h-10 border-b border-line bg-surface-muted text-left text-12.5 uppercase tracking-wide text-fg-muted">
                <th class="px-4 font-bold">{{ t().inventory.colDate }}</th>
                <th class="px-4 font-bold">{{ t().inventory.colReason }}</th>
                <th class="px-4 text-right font-bold">{{ t().inventory.colChange }}</th>
                <th class="px-4 text-right font-bold">{{ t().inventory.colStockAfter }}</th>
              </tr>
            </thead>
            <tbody>
              @for (m of filtered(); track m.id) {
                <tr class="list-row h-[52px] border-b border-line last:border-b-0">
                  <td class="num whitespace-nowrap px-4 text-fg-secondary">{{ m.createdAt?.toDate() | date:'dd.MM.yyyy HH:mm' }}</td>
                  <td class="px-4">
                    <span class="inline-flex items-center gap-2.5">
                      <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-token-md"
                            [class]="m.type === 'in' ? 'bg-success-soft text-success-text' : 'bg-accent-soft text-accent-text'" aria-hidden="true">
                        <i class="pi text-13" [class]="m.type === 'in' ? 'pi-arrow-down' : 'pi-arrow-up'"></i>
                      </span>
                      <span class="font-semibold text-fg">{{ m.reason || '—' }}</span>
                      @if (refOf(m); as r) {
                        <a [routerLink]="r.link" class="num text-xs font-semibold text-brand-text no-underline hover:underline">{{ refLabel(r) }}</a>
                      }
                    </span>
                  </td>
                  <td class="num px-4 text-right text-15 font-extrabold" [class]="m.type === 'in' ? 'text-success-text' : 'text-accent-text'">
                    {{ m.type === 'in' ? '+' : '−' }}{{ fmt(m.quantity) }}
                  </td>
                  <td class="num whitespace-nowrap px-4 text-right text-fg-secondary">
                    <span class="text-fg-muted">{{ fmt(m.previousStock) }} →</span> <b class="font-bold text-fg">{{ withUnit(m.newStock) }}</b>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <!-- Telefon: liste -->
          <ul class="m-0 flex list-none flex-col p-0 md:hidden">
            @for (m of filtered(); track m.id) {
              <li class="flex items-center gap-3 border-b border-line px-3 py-3 last:border-b-0">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-md"
                      [class]="m.type === 'in' ? 'bg-success-soft text-success-text' : 'bg-accent-soft text-accent-text'" aria-hidden="true">
                  <i class="pi text-15" [class]="m.type === 'in' ? 'pi-arrow-down' : 'pi-arrow-up'"></i>
                </span>
                <div class="min-w-0 flex-1">
                  <p class="m-0 truncate text-sm font-semibold text-fg">{{ m.reason || '—' }}</p>
                  <p class="num m-0 mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
                    <span>{{ m.createdAt?.toDate() | date:'dd.MM.yyyy HH:mm' }}</span>
                    <span aria-hidden="true">·</span>
                    <span class="text-fg-secondary">{{ fmt(m.previousStock) }} → {{ withUnit(m.newStock) }}</span>
                    @if (refOf(m); as r) {
                      <span aria-hidden="true">·</span>
                      <a [routerLink]="r.link" class="font-semibold text-brand-text no-underline hover:underline">{{ refLabel(r) }}</a>
                    }
                  </p>
                </div>
                <span class="num shrink-0 text-15 font-extrabold" [class]="m.type === 'in' ? 'text-success-text' : 'text-accent-text'">
                  {{ m.type === 'in' ? '+' : '−' }}{{ fmt(m.quantity) }}
                </span>
              </li>
            }
          </ul>
        }
      </ui-glass-card>
    </div>
  `,
})
export class StockMovementsPage implements OnInit {
  private readonly svc = inject(ProductService);
  private readonly store = inject(ProductStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly logger = inject(LoggerService);
  readonly t = inject(LangService).t;

  /** reference (belge kimliği) → çözümlenmiş belge. Yalnız yeni görülen kimlikler sorgulanır. */
  private readonly refs = signal<ReadonlyMap<string, MovementRef>>(new Map());
  private readonly requestedRefs = new Set<string>();

  readonly movements = signal<StockMovement[]>([]);
  readonly loading = signal(true);
  readonly activeFilter = signal<Filter>('all');
  readonly limit = MOVEMENT_LIMIT;

  productId = '';

  readonly filters = computed<{ value: Filter; label: string }[]>(() => [
    { value: 'all', label: this.t().common.all },
    { value: 'in',  label: this.t().products.movementsIn },
    { value: 'out', label: this.t().products.movementsOut },
  ]);

  setFilter(v: unknown): void {
    if (v === 'all' || v === 'in' || v === 'out') this.activeFilter.set(v);
  }

  readonly summary = computed<SumStripItem[]>(() => {
    const pr = this.t().products;
    const p = this.product();
    return [
      { icon: 'pi-list', tone: 'neutral', label: pr.totalMovements, value: this.loading() ? '…' : this.movements().length },
      { icon: 'pi-arrow-down', tone: 'success', label: pr.movementsIn, value: '+' + this.fmt(this.totalIn()), valueTone: 'success' },
      { icon: 'pi-arrow-up', tone: 'accent', label: pr.movementsOut, value: '−' + this.fmt(this.totalOut()), valueTone: 'accent' },
      { icon: 'pi-box', tone: 'brand', label: pr.currentStock, value: p ? this.withUnit(p.stock) : '—' },
    ];
  });

  readonly filtered = computed(() => {
    const f = this.activeFilter();
    const list = this.movements();
    return f === 'all' ? list : list.filter(m => m.type === f);
  });

  readonly totalIn = computed(() =>
    roundQty(this.movements().filter(m => m.type === 'in').reduce((s, m) => s + m.quantity, 0))
  );

  readonly totalOut = computed(() =>
    roundQty(this.movements().filter(m => m.type === 'out').reduce((s, m) => s + m.quantity, 0))
  );

  private readonly product = computed(() => this.store.products().find(p => p.id === this.productId) ?? null);

  productName(): string {
    return this.product()?.name ?? this.movements()[0]?.productName ?? '';
  }

  ngOnInit(): void {
    this.store.ensureLoaded();
    this.productId = this.route.snapshot.paramMap.get('id') ?? '';
    this.svc.getMovements$(this.productId, this.limit)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: m => {
          this.movements.set(m);
          this.loading.set(false);
          void this.resolveRefs(m);
        },
        error: () => this.loading.set(false),
      });
  }

  fmt(n: number): string {
    return formatQty(n, this.t().products.locale);
  }

  withUnit(n: number): string {
    return qtyWithUnit(n, this.product(), this.t().products);
  }

  refOf(m: StockMovement): MovementRef | null {
    return m.reference ? this.refs().get(m.reference) ?? null : null;
  }

  refLabel(r: MovementRef): string {
    const inv = this.t().inventory;
    return `${r.kind === 'purchase' ? inv.refPurchase : inv.refSale}: ${r.no}`;
  }

  /**
   * Hareketlerdeki belge kimliklerini alış/satış belge numarasına çevirir: kimlik başına okuma (N+1) yerine
   * 30'arlı `documentId() in` sorguları (tenantId filtresi kurallar için şart). Okunamazsa referans gizlenir.
   */
  private async resolveRefs(list: StockMovement[]): Promise<void> {
    const tenantId = this.auth.currentTenantId();
    const ids = [...new Set(list.map(m => m.reference).filter((r): r is string => !!r && !this.requestedRefs.has(r)))];
    if (!tenantId || !ids.length) return;
    ids.forEach(id => this.requestedRefs.add(id));
    const found = new Map<string, MovementRef>();
    const lookup = async (col: 'purchases' | 'sales', chunk: string[]) => {
      const snap = await getDocs(query(collection(this.firestore, col), where('tenantId', '==', tenantId), where(documentId(), 'in', chunk)));
      for (const d of snap.docs) {
        const data = d.data();
        const no = String((col === 'purchases' ? data['documentNo'] : data['saleNumber']) || d.id.slice(0, 8));
        found.set(d.id, { kind: col === 'purchases' ? 'purchase' : 'sale', no, link: ['/' + col, d.id] });
      }
    };
    try {
      for (let i = 0; i < ids.length; i += IN_CHUNK) {
        const chunk = ids.slice(i, i + IN_CHUNK);
        await lookup('purchases', chunk);
        const rest = chunk.filter(id => !found.has(id));
        if (rest.length) await lookup('sales', rest);
      }
    } catch (err) {
      this.logger.warn('Stok hareketi referansları çözümlenemedi', err);
      ids.forEach(id => this.requestedRefs.delete(id));
    }
    if (found.size) this.refs.update(cur => new Map([...cur, ...found]));
  }
}
