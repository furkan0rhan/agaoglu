import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProductStore } from '../products/store/product.store';
import { ProductService, ProductStockError } from '../products/services/product.service';
import { NetworkService } from '../../core/offline/network.service';
import { matchesSearch, searchKey } from '../../shared/utils/search.utils';
import { Product, Batch, isDecimalUnit, productUnit } from '../../shared/models/product.model';
import { LangService } from '../../core/i18n/lang.service';
import { firstFEFO, roundQty } from '../../shared/utils/batch.utils';
import { formatQty } from '../../shared/utils/product-form.utils';
import {
  EmptyStateComponent, GlassCardComponent, PageHeaderComponent, StatusBadgeComponent,
} from '../../shared/ui';
import { SumStripComponent, SumStripItem } from '../products/components/sum-strip.component';
import { chipClass, chipCountClass, productIcon } from '../products/inventory-ui';
import { qtyFractionDigits, qtyWithUnit, unitText } from '../products/product-unit';
import { userErrorMessage } from '../../core/error/user-error';
import { findByCode } from '../pos/services/cart-item.utils';
import {
  gtinMatches, Gs1KeysDirective, injectScannerTexts, ScanButtonComponent, ScanFeedback, ScanResult, scanResultFromText,
} from '../../shared/scanner';

interface CountRow {
  product: Product;
  counted: number | null;
}

interface ConfirmItem {
  product: Product;
  delta: number;
  reason: string;
  affectedBatch: Batch | null;
}

interface ApplyError {
  productId: string;
  name: string;
  message: string;
}

@Component({
  selector: 'app-stock-count',
  standalone: true,
  imports: [
    RouterLink, DatePipe, FormsModule, ButtonModule, InputNumberModule, IconFieldModule, InputIconModule, InputTextModule,
    AutoCompleteModule, DialogModule, ToastModule,
    PageHeaderComponent, GlassCardComponent, EmptyStateComponent, StatusBadgeComponent, SumStripComponent, ScanButtonComponent,
    Gs1KeysDirective,
  ],
  providers: [MessageService],
  host: { class: 'block' },
  template: `
    <p-toast />

    <ui-page-header [title]="t().stockCount.title" [subtitle]="t().stockCount.subtitle" icon="pi-barcode" iconTone="info">
      @if (!completed()) {
        <p-button [label]="t().stockCount.complete + (changedCount() ? ' (' + changedCount() + ')' : '')" icon="pi pi-check"
                  [disabled]="changedCount() === 0" (onClick)="openConfirm()" />
      }
    </ui-page-header>

    <div class="page-body">
      @if (completed()) {
        <!-- Tamamlandı -->
        <ui-glass-card padding="lg" class="mx-auto w-full max-w-2xl">
          <div class="flex flex-col items-center gap-5 py-4 text-center">
            <span class="flex h-20 w-20 items-center justify-center rounded-token-2xl bg-success-soft text-success-text" aria-hidden="true">
              <i class="pi pi-check-circle text-4xl"></i>
            </span>
            <div>
              <h2 class="m-0 mb-2 text-xl font-bold text-fg">{{ t().stockCount.completedTitle }}</h2>
              <p class="m-0 text-sm text-fg-secondary">{{ completionSummary() }}</p>
            </div>
            @if (applyErrors().length) {
              <div class="w-full rounded-token-lg border border-danger-line bg-danger-soft px-4 py-3 text-left" role="alert">
                <p class="m-0 mb-1.5 text-sm font-bold text-danger-text">{{ t().stockCount.errorsTitle }} ({{ applyErrors().length }})</p>
                @for (e of applyErrors(); track e.productId) {
                  <p class="m-0 my-0.5 text-xs text-fg"><b>{{ e.name }}</b> — {{ e.message }}</p>
                }
              </div>
            }
            <div class="flex flex-wrap justify-center gap-3">
              @if (applyErrors().length) {
                <p-button [label]="t().stockCount.retryFailed" icon="pi pi-replay" severity="warn" (onClick)="retryFailed()" />
              }
              <p-button [label]="t().stockCount.newCount" icon="pi pi-refresh" severity="secondary" (onClick)="reset()" />
              <p-button [label]="t().stockCount.goToProducts" icon="pi pi-arrow-right" iconPos="right" routerLink="/products" />
            </div>
          </div>
        </ui-glass-card>
      } @else {
        <!-- C özet şeridi -->
        <app-sum-strip [items]="summary()" [ariaLabel]="t().stockCount.title" />

        <div class="ui-card overflow-hidden">
          <header class="card-head">
            <span class="card-head-icon bg-info-soft text-info-text"><i class="pi pi-check-square text-15" aria-hidden="true"></i></span>
            <div class="min-w-0 flex-1">
              <h3 class="truncate">{{ inv().countList }}</h3>
              <p class="m-0 hidden truncate font-sans text-13 font-normal text-fg-muted sm:block">{{ inv().countHint }}</p>
            </div>
          </header>
          <div class="flex flex-col gap-2.5 border-b border-line p-3 sm:px-4 md:flex-row md:items-center">
            <p-iconfield class="block w-full md:w-80">
              <p-inputicon styleClass="pi pi-search" />
              <input #scSearch pInputText appGs1Keys type="search" [value]="q()" (input)="q.set(scSearch.value)"
                     (keydown.enter)="onSearchEnter($event, scSearch)"
                     [placeholder]="t().stockCount.searchPlaceholder" [attr.aria-label]="t().common.search" class="w-full" />
            </p-iconfield>
            @if (!completed()) {
              <ui-scan-button continuous [handler]="onCountScan" [label]="sx().scan + ' (+1)'" [title]="sx().titleContinuous" />
            }
            <div class="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none] md:mx-0 md:px-0" role="toolbar" [attr.aria-label]="t().common.filters">
              <!-- Y27: kör sayım (sistem miktarı sayım bitince görünür) -->
              @if (!completed()) {
                <button type="button" [class]="chip(blind())" [attr.aria-pressed]="blind()" [title]="t().stockCount.blindHint" (click)="toggleBlind()">
                  <i class="pi" [class]="blind() ? 'pi-eye-slash' : 'pi-eye'" aria-hidden="true"></i> {{ t().stockCount.blind }}
                </button>
              }
              @for (f of viewFilters(); track f.key) {
                <button type="button" [class]="chip(view() === f.key, f.key === 'diff')" [attr.aria-pressed]="view() === f.key" (click)="view.set(f.key)">
                  {{ f.label }} <b [class]="chipCount(view() === f.key)">{{ f.count }}</b>
                </button>
              }
            </div>
          </div>

          @if (filteredRows().length === 0) {
            <ui-empty-state compact icon="pi-box" [title]="t().products.noProducts" />
          } @else {
            <ul class="m-0 flex list-none flex-col p-0">
              @for (row of filteredRows(); track row.product.id) {
                <li class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2.5 last:border-b-0 sm:flex-nowrap sm:px-4"
                    [class]="rowEdge(row)">
                  <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-md bg-surface-muted text-fg-secondary" aria-hidden="true">
                    <i class="pi text-base" [class]="icon(row.product)"></i>
                  </span>
                  <div class="min-w-0 flex-1 basis-40">
                    <p class="m-0 truncate text-sm font-semibold text-fg">{{ row.product.name }}</p>
                    <p class="m-0 mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-secondary">
                      @if (row.product.category) {
                        <span>{{ row.product.category }}</span>
                        <span class="text-fg-muted" aria-hidden="true">·</span>
                      }
                      @if (!blind()) {
                        <span>{{ t().stockCount.system }}: <b class="num text-fg">{{ qtyText(row.product.stock, row.product) }}</b></span>
                      } @else {
                        <span>{{ unitName(row.product) }}</span>
                      }
                    </p>
                  </div>

                  <div class="ml-auto flex shrink-0 items-center gap-2">
                    <p-inputNumber [ngModel]="row.counted" (ngModelChange)="setCount(row.product, $event)" [min]="0"
                                   [maxFractionDigits]="digits(row.product)" [locale]="t().products.locale"
                                   [showButtons]="true" buttonLayout="horizontal" incrementButtonIcon="pi pi-plus" decrementButtonIcon="pi pi-minus"
                                   inputStyleClass="w-16 text-center font-bold num" placeholder="—"
                                   [ariaLabel]="t().stockCount.countedLabel + ': ' + row.product.name" />
                    <span class="flex w-24 justify-center">
                      @if (row.counted === null) {
                        <span class="text-sm text-fg-muted" aria-hidden="true">—</span>
                      } @else if (blind()) {
                        <ui-status-badge tone="info" size="sm" icon="pi-check">{{ t().stockCount.countedTick }}</ui-status-badge>
                      } @else if (diff(row) === 0) {
                        <ui-status-badge tone="success" size="sm" icon="pi-check">{{ t().stockCount.matched }}</ui-status-badge>
                      } @else {
                        <ui-status-badge [tone]="diff(row) < 0 ? 'danger' : 'warning'" size="sm">
                          <span class="num">{{ diff(row) > 0 ? '+' : '' }}{{ fmt(diff(row)) }}</span>
                        </ui-status-badge>
                      }
                    </span>
                  </div>
                </li>
              }
            </ul>
          }
        </div>
      }
    </div>

    <!-- Fark nedenleri / onay -->
    <p-dialog [(visible)]="confirmVisible" [header]="t().stockCount.reasonsTitle" [modal]="true" [draggable]="false"
              styleClass="w-[95vw] max-w-[32.5rem]">
      <p class="m-0 mb-4 text-sm text-fg-secondary">{{ confirmItems().length }} {{ t().stockCount.productsLabel }} · {{ t().stockCount.confirmSubtitle }}</p>

      <ul class="m-0 flex max-h-[400px] list-none flex-col gap-2.5 overflow-y-auto p-0">
        @for (item of confirmItems(); track item.product.id) {
          <li class="flex flex-wrap items-center gap-3 rounded-token-lg border border-line bg-surface-muted p-3">
            <div class="min-w-[140px] flex-1">
              <p class="m-0 text-sm font-semibold text-fg">{{ item.product.name }}</p>
              <p class="num m-0 mt-1 text-xs font-medium" [class]="item.delta < 0 ? 'text-danger-text' : 'text-warning-text'">
                <i class="pi mr-1 text-10" [class]="item.delta < 0 ? 'pi-arrow-down' : 'pi-arrow-up'" aria-hidden="true"></i>
                {{ fmt(item.product.stock) }} → {{ qtyText(item.product.stock + item.delta, item.product) }}
                <span class="ml-1 font-bold">({{ item.delta > 0 ? '+' : '' }}{{ fmt(item.delta) }})</span>
              </p>
              @if (item.delta < 0 && item.affectedBatch) {
                <p class="m-0 mt-1 flex flex-wrap items-center gap-1 text-11 text-fg-muted">
                  <i class="pi pi-box text-10" aria-hidden="true"></i>
                  {{ t().stockCount.fefoLabel }} ·
                  @if (item.affectedBatch.expiryDate) {
                    {{ t().stockCount.expiryPrefix }} {{ item.affectedBatch.expiryDate.toDate() | date:'dd.MM.yyyy' }}
                    ({{ qtyText(item.affectedBatch.quantity, item.product) }})
                  } @else {
                    {{ t().stockCount.noExpiry }}
                  }
                  @if (item.affectedBatch.gtsNo) {
                    · GTS: {{ item.affectedBatch.gtsNo }}
                  }
                </p>
              }
            </div>
            <p-autocomplete [(ngModel)]="item.reason" [suggestions]="reasonSuggestions"
                            (completeMethod)="searchReasons($event, item.delta < 0 ? 'shortage' : 'surplus')"
                            [forceSelection]="false" [dropdown]="true" appendTo="body" styleClass="w-full sm:w-56"
                            [placeholder]="t().stockCount.reason" [ariaLabel]="t().stockCount.reason + ': ' + item.product.name" />
          </li>
        }
      </ul>

      @if (progress(); as pg) {
        <div class="mt-3.5">
          <p class="num m-0 mb-1.5 text-xs text-fg-secondary">
            {{ t().stockCount.applying }}: {{ pg.done }} / {{ pg.total }}
            @if (applyErrors().length) { · <span class="text-danger-text">{{ applyErrors().length }} {{ t().common.error }}</span> }
          </p>
          <div class="h-1.5 overflow-hidden rounded-full bg-surface-muted" role="progressbar" [attr.aria-label]="t().stockCount.applying"
               [attr.aria-valuenow]="pg.done" aria-valuemin="0" [attr.aria-valuemax]="pg.total">
            <div class="h-full rounded-full bg-brand transition-[width] duration-200" [style.width.%]="pg.total ? (pg.done / pg.total) * 100 : 0"></div>
          </div>
        </div>
      }

      <ng-template pTemplate="footer">
        <p-button [label]="t().common.cancel" severity="secondary" [disabled]="saving()" (onClick)="confirmVisible = false" />
        <p-button [label]="t().stockCount.apply" icon="pi pi-check" [loading]="saving()" (onClick)="doComplete()" />
      </ng-template>
    </p-dialog>
  `,
})
export class StockCountPage implements OnInit {
  private readonly store = inject(ProductStore);
  private readonly svc = inject(ProductService);
  private readonly network = inject(NetworkService);
  private readonly toast = inject(MessageService);
  private readonly lang = inject(LangService);
  readonly t = this.lang.t;
  readonly sx = injectScannerTexts();
  /** Kamerayla sayılmış birim karekodları (çift sayımı önler) */
  private readonly scannedUnits = new Set<string>();

  private readonly STORAGE_KEY_SHORTAGE = 'sc-reasons-shortage';
  private readonly STORAGE_KEY_SURPLUS  = 'sc-reasons-surplus';

  reasonSuggestions: string[] = [];

  private savedReasons(type: 'shortage' | 'surplus'): string[] {
    const key = type === 'shortage' ? this.STORAGE_KEY_SHORTAGE : this.STORAGE_KEY_SURPLUS;
    try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
  }

  private saveReason(type: 'shortage' | 'surplus', reason: string): void {
    if (!reason.trim()) return;
    const key = type === 'shortage' ? this.STORAGE_KEY_SHORTAGE : this.STORAGE_KEY_SURPLUS;
    const saved = this.savedReasons(type);
    if (!saved.includes(reason)) {
      saved.unshift(reason);
      try { localStorage.setItem(key, JSON.stringify(saved.slice(0, 20))); } catch { /* depolama yok */ }
    }
  }

  searchReasons(event: { query: string }, type: 'shortage' | 'surplus'): void {
    const q = searchKey(event.query);
    const saved = this.savedReasons(type);
    this.reasonSuggestions = q ? saved.filter(r => searchKey(r).includes(q)) : saved;
  }

  readonly q = signal('');
  readonly saving = signal(false);
  readonly completed = signal(false);
  readonly completionSummary = signal('');
  confirmVisible = false;
  readonly confirmItems = signal<ConfirmItem[]>([]);
  readonly progress = signal<{ done: number; total: number } | null>(null);
  readonly applyErrors = signal<ApplyError[]>([]);

  /**
   * 2.17: Sayılan değerler ürün snapshot'larından bağımsız tutulur —
   * Firestore'dan yeni snapshot gelince (rows yeniden hesaplanınca) girilen değerler kaybolmaz.
   */
  readonly counted = signal<Map<string, number>>(new Map());

  readonly rows = computed<CountRow[]>(() => {
    const counted = this.counted();
    return this.store.products().map(p => ({ product: p, counted: counted.get(p.id) ?? null }));
  });

  /** Liste görünümü: tümü / yalnız farklar / sayılmayanlar */
  readonly view = signal<'all' | 'diff' | 'uncounted'>('all');

  readonly filteredRows = computed(() => {
    const search = searchKey(this.q());
    const v = this.view();
    let rows = this.rows();
    if (v === 'diff') rows = rows.filter(r => r.counted !== null && r.counted !== r.product.stock);
    else if (v === 'uncounted') rows = rows.filter(r => r.counted === null);
    if (!search) return rows;
    return rows.filter(r => matchesSearch(search, r.product.name, r.product.barcode, r.product.category));
  });

  readonly changedCount = computed(() => this.rows().filter(r => r.counted !== null && r.counted !== r.product.stock).length);
  readonly shortageCount = computed(() => this.rows().filter(r => r.counted !== null && r.counted < r.product.stock).length);
  readonly surplusCount = computed(() => this.rows().filter(r => r.counted !== null && r.counted > r.product.stock).length);


  readonly inv = computed(() => this.t().inventory);

  /** C özet şeridi: sayılan / fark var / eksik / fazla */
  readonly summary = computed<SumStripItem[]>(() => {
    const sc = this.t().stockCount;
    const counted = this.rows().filter(r => r.counted !== null).length;
    const sh = this.shortageCount();
    const su = this.surplusCount();
    const first = { icon: 'pi-check-square', tone: 'brand', label: this.inv().counted, value: `${counted} / ${this.rows().length}` } as SumStripItem;
    // Y27: kör sayımda farklar sayım bitene kadar gizli
    if (this.blind() && !this.completed()) return [first];
    return [
      first,
      { icon: 'pi-sliders-h', tone: 'info', label: sc.changesLabel, value: this.changedCount() },
      { icon: 'pi-arrow-down', tone: 'danger', label: sc.shortage, value: sh, valueTone: sh ? 'danger' : null },
      { icon: 'pi-arrow-up', tone: 'warning', label: sc.surplus, value: su, valueTone: su ? 'warning' : null },
    ];
  });

  readonly viewFilters = computed(() => {
    const i = this.inv();
    const uncounted = this.rows().filter(r => r.counted === null).length;
    const all = [
      { key: 'all' as const, label: this.t().common.all, count: this.rows().length },
      { key: 'diff' as const, label: i.onlyDiff, count: this.changedCount() },
      { key: 'uncounted' as const, label: i.uncounted, count: uncounted },
    ];
    return this.blind() && !this.completed() ? all.filter(f => f.key !== 'diff') : all;
  });

  chip(active: boolean, danger = false): string { return chipClass(active, danger); }
  chipCount(active: boolean): string { return chipCountClass(active); }
  icon(p: Product): string { return productIcon(p); }

  ngOnInit(): void {
    this.store.ensureLoaded();
  }

  /** Y27: kör sayım tercihi (bu cihazda hatırlanır). */
  readonly blind = signal(StockCountPage.readBlind());

  private static readBlind(): boolean {
    try { return localStorage.getItem('sc-blind') === '1'; } catch { return false; }
  }

  toggleBlind(): void {
    const v = !this.blind();
    this.blind.set(v);
    if (v && this.view() === 'diff') this.view.set('all');
    try { localStorage.setItem('sc-blind', v ? '1' : '0'); } catch { /* depolama yok */ }
  }

  unitName(p: Product): string {
    return unitText(productUnit(p), this.t().products);
  }

  /**
   * Arama kutusuna USB okuyucuyla barkod / karekod okutulup Enter gelirse: kamera okutmasıyla aynı (+1 sayım).
   * Ürün adı yazılıp Enter'a basıldıysa (kod değilse) yalnız filtre kalır.
   */
  onSearchEnter(event: Event, input: HTMLInputElement): void {
    const raw = this.q().trim();
    if (!raw || this.completed()) return;
    const r = scanResultFromText(raw);
    if (!r.gs1 && !findByCode(this.store.products(), r.code)) return;
    event.preventDefault();
    const fb = this.onCountScan(r);
    this.q.set('');
    input.value = '';
    this.toast.add({ severity: fb.tone === 'success' ? 'success' : fb.tone === 'warn' ? 'warn' : 'error', summary: '', detail: fb.message, life: 2500 });
  }

  /** Kamerayla sürekli sayım: her okutma ilgili ürünün sayımını +1 yapar (GTS bir kez sayılır). */
  readonly onCountScan = (r: ScanResult): ScanFeedback => {
    const sx = this.sx();
    const products = this.store.products();
    let hit = findByCode(products, r.code);
    const gtin = r.gs1?.gtin;
    if (!hit && gtin) {
      const p = products.find(x => x.isActive !== false && gtinMatches(x.barcode, gtin));
      if (p) hit = { product: p, gtsNo: null };
    }
    if (!hit) return { tone: 'error', message: sx.notFound(r.code) };
    // Aynı birim karekodu (GTS ya da GTIN+seri) iki kez sayılmasın
    const unitKey = hit.gtsNo ?? (r.gs1?.serial ? r.code : null);
    if (unitKey) {
      if (this.scannedUnits.has(unitKey)) return { tone: 'warn', message: `${hit.product.name}: ${sx.alreadyAdded}` };
      this.scannedUnits.add(unitKey);
    }
    const next = (this.counted().get(hit.product.id) ?? 0) + 1;
    this.setCount(hit.product, next);
    return { tone: 'success', message: sx.counted(hit.product.name, this.qtyText(next, hit.product)) };
  };

  /** Sayılan değer: adet birimde tam sayı, kg / lt / metre'de en fazla 3 ondalık. `null` → sayım silinir. */
  setCount(product: Pick<Product, 'id' | 'unit'> | string, value: number | null | undefined): void {
    const id = typeof product === 'string' ? product : product.id;
    const decimal = typeof product !== 'string' && isDecimalUnit(productUnit(product));
    this.counted.update(prev => {
      const next = new Map(prev);
      if (value == null || !Number.isFinite(value)) next.delete(id);
      else next.set(id, decimal ? roundQty(Math.max(0, value)) : Math.max(0, Math.floor(value)));
      return next;
    });
  }

  diff(row: CountRow): number {
    return roundQty((row.counted ?? 0) - row.product.stock);
  }

  /** Satır sol kenarı (C): eksik kırmızı, fazla sarı, tutan yeşil; zemin opak kalır (koyu temada okunur) */
  rowEdge(row: CountRow): string {
    if (row.counted === null) return '';
    const d = this.diff(row);
    if (d === 0) return 'shadow-[inset_3px_0_0_var(--success)]';
    return d < 0 ? 'shadow-[inset_3px_0_0_var(--danger)]' : 'shadow-[inset_3px_0_0_var(--warning)]';
  }

  digits(product: Product): number {
    return qtyFractionDigits(product);
  }

  fmt(n: number): string {
    return formatQty(n, this.t().products.locale);
  }

  qtyText(n: number, product: Product): string {
    return qtyWithUnit(n, product, this.t().products);
  }

  openConfirm(onlyIds?: Set<string>): void {
    const items = this.rows()
      .filter(r => r.counted !== null && r.counted !== r.product.stock)
      .filter(r => !onlyIds || onlyIds.has(r.product.id))
      .map(r => {
        const delta = roundQty((r.counted ?? 0) - r.product.stock);
        return {
          product: r.product,
          delta,
          reason: '',
          affectedBatch: delta < 0 ? firstFEFO(r.product.batches ?? []) : null,
        };
      });
    this.confirmItems.set(items);
    this.progress.set(null);
    this.applyErrors.set([]);
    this.confirmVisible = true;
  }

  /**
   * Düzeltmeleri sırayla uygular. Ürünler arası atomik değildir; her ürün ayrı yazma grubudur
   * (ürün + hareket kendi içinde atomik). Her üründen sonra ilerleme ve hata listesi güncellenir.
   */
  async doComplete(): Promise<void> {
    const items = this.confirmItems();
    if (!items.length || this.saving()) return;
    // 3.8: sayım transaction ister — çevrimdışında beklemeden anlaşılır uyarı
    if (!this.network.isOnline()) {
      this.toast.add({ severity: 'warn', summary: this.t().common.error, detail: this.t().inventory.stockNeedsOnline, life: 6000 });
      return;
    }
    this.saving.set(true);
    this.applyErrors.set([]);
    this.progress.set({ done: 0, total: items.length });
    const sc = this.t().stockCount;
    let ok = 0;
    let shortage = 0;
    let surplus = 0;
    for (const item of items) {
      // Sayılan değer mutlak hedeftir; fark ProductService.applyCount içinde (transaction) SUNUCUDAKİ güncel
      // stoka göre hesaplanır — onay ekranı açıkken başka kasada yapılan satış ezilmez (2.2).
      const latest = this.store.products().find(p => p.id === item.product.id) ?? item.product;
      const target = this.counted().get(latest.id) ?? roundQty(item.product.stock + item.delta);
      try {
        const res = await this.svc.applyCount(latest, target, delta =>
          // Hareket listesinde başlık boş kalmasın: "Stok sayımı (neden)"
          `${sc.movementReason} (${item.reason?.trim() || (delta < 0 ? sc.shortage : sc.surplus)})`);
        if (res.delta !== 0) {
          if (item.reason?.trim()) this.saveReason(res.delta < 0 ? 'shortage' : 'surplus', item.reason.trim());
          if (res.delta < 0) shortage++; else surplus++;
        }
        ok++;
        this.setCount(latest.id, null);
      } catch (e: unknown) {
        const message = e instanceof ProductStockError && e.code === 'offline'
          ? this.t().inventory.stockNeedsOnline
          : e instanceof ProductStockError ? sc.failed : userErrorMessage(e, sc.failed, this.lang.lang());
        this.applyErrors.update(list => [...list, { productId: latest.id, name: latest.name, message }]);
      }
      this.progress.update(p => (p ? { ...p, done: p.done + 1 } : p));
    }
    this.saving.set(false);
    this.confirmVisible = false;
    const errCount = this.applyErrors().length;
    if (errCount > 0) {
      this.toast.add({ severity: 'warn', summary: sc.partialError, detail: `${ok} ${sc.updated}, ${errCount} ${this.t().common.error}` });
    }
    this.completionSummary.set(
      `${ok} ${sc.productsLabel} ${sc.updated}.${shortage ? ` ${shortage} ${sc.shortage.toLowerCase()}` : ''}${surplus ? ` ${surplus} ${sc.surplus.toLowerCase()}` : ''} ${sc.corrected}.`
    );
    this.completed.set(true);
  }

  /** Hata alan ürünleri (sayılan değerleri korunmuştur) yeniden onaya getir */
  retryFailed(): void {
    const ids = new Set(this.applyErrors().map(e => e.productId));
    this.completed.set(false);
    this.openConfirm(ids);
  }

  reset(): void {
    this.completed.set(false);
    this.q.set('');
    this.view.set('all');
    this.confirmItems.set([]);
    this.counted.set(new Map());
    this.scannedUnits.clear();
    this.progress.set(null);
    this.applyErrors.set([]);
  }
}
