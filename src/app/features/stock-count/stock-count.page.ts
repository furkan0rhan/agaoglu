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
import { ProductService } from '../products/services/product.service';
import { Product, Batch } from '../../shared/models/product.model';
import { LangService } from '../../core/i18n/lang.service';

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

@Component({
  selector: 'app-stock-count',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule, ButtonModule, InputNumberModule, IconFieldModule, InputIconModule, InputTextModule, AutoCompleteModule, DialogModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>

    <div style="display:flex; flex-direction:column; height:100%; background:var(--bg-page); overflow:hidden;">

      <!-- Header -->
      <div style="background:var(--bg-surface); border-bottom:1px solid var(--border); padding:16px 24px; display:flex; align-items:center; gap:12px; flex-shrink:0;">
        <div style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,#8b5cf6,#6d28d9); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <i class="pi pi-barcode" style="color:white; font-size:16px;"></i>
        </div>
        <div style="flex:1;">
          <h1 style="font-size:18px; font-weight:700; color:var(--text-primary); margin:0;">{{ t().stockCount.title }}</h1>
          <p style="font-size:12px; color:var(--text-secondary); margin:0;">{{ t().stockCount.subtitle }}</p>
        </div>
        @if (!completed()) {
          <p-button
            [label]="t().stockCount.complete"
            icon="pi pi-check"
            severity="success"
            size="small"
            [disabled]="changedCount() === 0"
            (onClick)="openConfirm()"
          />
        }
      </div>

      <!-- Tamamlandı ekranı -->
      @if (completed()) {
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; padding:40px;">
          <div style="width:80px; height:80px; border-radius:24px; background:#f0fdf4; display:flex; align-items:center; justify-content:center;">
            <i class="pi pi-check-circle" style="font-size:40px; color:#16a34a;"></i>
          </div>
          <div style="text-align:center;">
            <h2 style="font-size:22px; font-weight:700; color:var(--text-primary); margin:0 0 8px;">{{ t().stockCount.completedTitle }}</h2>
            <p style="font-size:14px; color:var(--text-secondary); margin:0;">{{ completionSummary() }}</p>
          </div>
          <div style="display:flex; gap:12px;">
            <p-button [label]="t().stockCount.newCount" icon="pi pi-refresh" severity="secondary" [outlined]="true" (onClick)="reset()" />
            <p-button [label]="t().stockCount.goToProducts" icon="pi pi-arrow-right" routerLink="/products" severity="success" />
          </div>
        </div>

      } @else {

        <!-- Arama + istatistik bar -->
        <div style="background:var(--bg-surface); border-bottom:1px solid var(--border); padding:12px 20px; display:flex; align-items:center; gap:12px; flex-shrink:0; flex-wrap:wrap;">
          <p-iconfield style="flex:1; min-width:180px; display:block;">
            <p-inputicon styleClass="pi pi-search" />
            <input pInputText (input)="q.set($any($event.target).value)" [placeholder]="t().stockCount.searchPlaceholder" style="width:100%;" />
          </p-iconfield>
          <div style="display:flex; gap:8px; flex-shrink:0;">
            <div style="background:var(--bg-page); border-radius:10px; padding:6px 12px; text-align:center; min-width:48px;">
              <p style="font-size:16px; font-weight:700; color:var(--text-primary); margin:0; line-height:1.2;">{{ rows().length }}</p>
              <p style="font-size:10px; color:var(--text-muted); margin:0;">{{ t().stockCount.productsLabel }}</p>
            </div>
            <div style="background:#fffbeb; border-radius:10px; padding:6px 12px; text-align:center; min-width:48px;">
              <p style="font-size:16px; font-weight:700; color:#d97706; margin:0; line-height:1.2;">{{ changedCount() }}</p>
              <p style="font-size:10px; color:#d97706; margin:0;">{{ t().stockCount.changesLabel }}</p>
            </div>
            <div style="background:#fef2f2; border-radius:10px; padding:6px 12px; text-align:center; min-width:48px;">
              <p style="font-size:16px; font-weight:700; color:#ef4444; margin:0; line-height:1.2;">{{ shortageCount() }}</p>
              <p style="font-size:10px; color:#ef4444; margin:0;">{{ t().stockCount.shortage }}</p>
            </div>
            <div style="background:#f0fdf4; border-radius:10px; padding:6px 12px; text-align:center; min-width:48px;">
              <p style="font-size:16px; font-weight:700; color:#16a34a; margin:0; line-height:1.2;">{{ surplusCount() }}</p>
              <p style="font-size:10px; color:#16a34a; margin:0;">{{ t().stockCount.surplus }}</p>
            </div>
          </div>
        </div>

        <!-- Ürün listesi -->
        <div style="flex:1; overflow-y:auto; padding:12px 16px; display:flex; flex-direction:column; gap:8px;">

          @if (filteredRows().length === 0) {
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; gap:10px;">
              <i class="pi pi-box" style="font-size:40px; color:#cbd5e1;"></i>
              <p style="font-size:14px; color:var(--text-muted); margin:0;">{{ t().products.noProducts }}</p>
            </div>
          }

          @for (row of filteredRows(); track row.product.id) {
            <div style="background:var(--bg-surface); border-radius:14px; border:1px solid var(--border); padding:12px 16px; display:flex; align-items:center; gap:12px; transition:border-color 0.15s;"
              [style.border-color]="row.counted !== null && diff(row) !== 0 ? (diff(row) < 0 ? '#fecaca' : '#bbf7d0') : 'var(--border)'"
              [style.background]="diffBg(row)">

              <!-- İkon -->
              <div style="width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-weight:700; font-size:15px; color:white;"
                [style.background]="row.counted !== null && diff(row) < 0 ? 'linear-gradient(135deg,#f87171,#ef4444)' : row.counted !== null && diff(row) > 0 ? 'linear-gradient(135deg,#4ade80,#16a34a)' : 'linear-gradient(135deg,#a78bfa,#7c3aed)'">
                {{ row.product.name.charAt(0).toUpperCase() }}
              </div>

              <!-- Bilgi -->
              <div style="flex:1; min-width:0;">
                <p style="font-size:13px; font-weight:600; color:var(--text-primary); margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ row.product.name }}</p>
                <div style="display:flex; align-items:center; gap:8px; margin-top:3px;">
                  <span style="font-size:11px; color:var(--text-secondary);">{{ row.product.category }}</span>
                  <span style="font-size:11px; font-weight:600; color:var(--text-muted);">·</span>
                  <span style="font-size:11px; color:var(--text-secondary);">{{ t().stockCount.system }}: <b style="color:var(--text-primary);">{{ row.product.stock }}</b></span>
                </div>
              </div>

              <!-- Sayım input -->
              <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
                <p-inputNumber
                  [(ngModel)]="row.counted"
                  (ngModelChange)="countVersion.update(v => v + 1)"
                  [min]="0"
                  [showButtons]="true"
                  buttonLayout="horizontal"
                  incrementButtonIcon="pi pi-plus"
                  decrementButtonIcon="pi pi-minus"
                  [inputStyle]="{ width: '48px', textAlign: 'center', fontSize: '14px', fontWeight: '700', padding: '6px 2px' }"
                  [style]="{ fontSize: '13px' }"
                />

                <!-- Fark badge -->
                <div style="width:44px; text-align:center;">
                  @if (row.counted !== null && diff(row) !== 0) {
                    <span style="font-size:12px; font-weight:700; padding:3px 8px; border-radius:8px; display:inline-block;"
                      [style.background]="diff(row) < 0 ? '#fef2f2' : '#f0fdf4'"
                      [style.color]="diff(row) < 0 ? '#ef4444' : '#16a34a'">
                      {{ diff(row) > 0 ? '+' : '' }}{{ diff(row) }}
                    </span>
                  } @else if (row.counted !== null) {
                    <span style="font-size:12px; font-weight:700; padding:3px 8px; border-radius:8px; background:#f0fdf4; color:#16a34a; display:inline-block;">✓</span>
                  } @else {
                    <span style="font-size:13px; color:#cbd5e1;">—</span>
                  }
                </div>
              </div>

            </div>
          }
        </div>
      }
    </div>

    <!-- Onay Dialog -->
    <p-dialog
      [(visible)]="confirmVisible"
      [header]="t().stockCount.reasonsTitle"
      [modal]="true"
      [style]="{ width: '520px', maxWidth: '95vw' }"
      [draggable]="false"
    >
      <p style="font-size:13px; color:var(--text-secondary); margin:0 0 16px;">{{ confirmItems().length }} {{ t().stockCount.productsLabel }} · {{ t().stockCount.confirmSubtitle }}</p>

      <div style="display:flex; flex-direction:column; gap:10px; max-height:400px; overflow-y:auto;">
        @for (item of confirmItems(); track item.product.id) {
          <div style="background:var(--bg-page); border-radius:14px; padding:14px 16px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <div style="flex:1; min-width:140px;">
              <p style="font-size:13px; font-weight:600; color:var(--text-primary); margin:0;">{{ item.product.name }}</p>
              <p style="font-size:12px; margin:4px 0 0;" [style.color]="item.delta < 0 ? '#ef4444' : '#16a34a'">
                <i [class]="item.delta < 0 ? 'pi pi-arrow-down' : 'pi pi-arrow-up'" style="font-size:10px; margin-right:4px;"></i>
                {{ item.product.stock }} → {{ item.product.stock + item.delta }} {{ t().products.piece }}
                <span style="font-weight:700; margin-left:4px;">({{ item.delta > 0 ? '+' : '' }}{{ item.delta }})</span>
              </p>
              @if (item.delta < 0 && item.affectedBatch) {
                <p style="font-size:11px; color:var(--text-muted); margin:4px 0 0; display:flex; align-items:center; gap:4px;">
                  <i class="pi pi-box" style="font-size:10px;"></i>
                  FEFO ·
                  @if (item.affectedBatch.expiryDate) {
                    {{ t().stockCount.expiryPrefix }} {{ item.affectedBatch.expiryDate.toDate() | date:'dd.MM.yyyy' }}
                    ({{ item.affectedBatch.quantity }} {{ t().products.piece }})
                  } @else {
                    {{ t().stockCount.noExpiry }}
                  }
                  @if (item.affectedBatch.gtsNo) {
                    · GTS: {{ item.affectedBatch.gtsNo }}
                  }
                </p>
              }
            </div>
            <p-autocomplete
              [(ngModel)]="item.reason"
              [suggestions]="reasonSuggestions"
              (completeMethod)="searchReasons($event, item.delta < 0 ? 'shortage' : 'surplus')"
              [forceSelection]="false"
              [dropdown]="true"
              appendTo="body"
              styleClass="w-full"
              [style]="{ minWidth: '200px' }"
              [placeholder]="t().stockCount.reason"
            />
          </div>
        }
      </div>

      <ng-template pTemplate="footer">
        <p-button [label]="t().common.cancel" severity="secondary" [outlined]="true" (onClick)="confirmVisible = false" />
        <p-button [label]="t().stockCount.apply" icon="pi pi-check" severity="success" [loading]="saving()" (onClick)="doComplete()" />
      </ng-template>
    </p-dialog>
  `,
})
export class StockCountPage implements OnInit {
  private readonly store = inject(ProductStore);
  private readonly svc = inject(ProductService);
  private readonly toast = inject(MessageService);
  readonly t = inject(LangService).t;

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
      localStorage.setItem(key, JSON.stringify(saved.slice(0, 20)));
    }
  }

  searchReasons(event: { query: string }, type: 'shortage' | 'surplus'): void {
    const q = event.query.trim().toLowerCase();
    const saved = this.savedReasons(type);
    this.reasonSuggestions = q ? saved.filter(r => r.toLowerCase().includes(q)) : saved;
  }

  readonly q = signal('');
  readonly saving = signal(false);
  readonly completed = signal(false);
  readonly completionSummary = signal('');
  readonly countVersion = signal(0);
  confirmVisible = false;
  readonly confirmItems = signal<ConfirmItem[]>([]);

  readonly rows = computed<CountRow[]>(() =>
    this.store.products().map(p => ({ product: p, counted: null }))
  );

  readonly filteredRows = computed(() => {
    const search = this.q().toLowerCase().trim();
    if (!search) return this.rows();
    return this.rows().filter(r =>
      r.product.name.toLowerCase().includes(search) ||
      (r.product.category ?? '').toLowerCase().includes(search)
    );
  });

  readonly changedCount = computed(() => { this.countVersion(); return this.rows().filter(r => r.counted !== null && r.counted !== r.product.stock).length; });
  readonly shortageCount = computed(() => { this.countVersion(); return this.rows().filter(r => r.counted !== null && r.counted < r.product.stock).length; });
  readonly surplusCount = computed(() => { this.countVersion(); return this.rows().filter(r => r.counted !== null && r.counted > r.product.stock).length; });

  ngOnInit(): void {
    this.store.loadProducts(undefined as any);
  }

  diff(row: CountRow): number {
    return (row.counted ?? 0) - row.product.stock;
  }

  diffBg(row: CountRow): string {
    if (row.counted === null) return 'transparent';
    const d = this.diff(row);
    if (d === 0) return '#f0fdf4';
    return d < 0 ? '#fef2f2' : '#fffbeb';
  }

  diffStyle(row: CountRow): string {
    const d = this.diff(row);
    if (d === 0) return 'font-size:13px; font-weight:700; color:#16a34a;';
    return d < 0
      ? 'font-size:13px; font-weight:700; color:#ef4444;'
      : 'font-size:13px; font-weight:700; color:#f59e0b;';
  }

  openConfirm(): void {
    const items = this.rows()
      .filter(r => r.counted !== null && r.counted !== r.product.stock)
      .map(r => {
        const delta = (r.counted ?? 0) - r.product.stock;
        const affectedBatch = delta < 0 ? this.firstFefo(r.product.batches ?? []) : null;
        return {
          product: r.product,
          delta,
          reason: '',
          affectedBatch,
        };
      });
    this.confirmItems.set(items);
    this.confirmVisible = true;
  }

  private firstFefo(batches: Batch[]): Batch | null {
    const active = batches.filter(b => b.quantity > 0);
    if (!active.length) return null;
    return [...active].sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate.toMillis() - b.expiryDate.toMillis();
    })[0];
  }

  async doComplete(): Promise<void> {
    const items = this.confirmItems();
    if (!items.length) return;
    this.saving.set(true);
    let ok = 0;
    let err = 0;
    for (const item of items) {
      try {
        await this.svc.adjustStock(item.product, item.delta, item.reason);
        this.saveReason(item.delta < 0 ? 'shortage' : 'surplus', item.reason);
        ok++;
      } catch {
        err++;
      }
    }
    this.saving.set(false);
    this.confirmVisible = false;
    if (err > 0) {
      const sc = this.t().stockCount;
      this.toast.add({ severity: 'warn', summary: sc.partialError, detail: `${ok} ${sc.updated}, ${err} ${this.t().common.error}` });
    }
    const shortage = items.filter(i => i.delta < 0).length;
    const surplus = items.filter(i => i.delta > 0).length;
    const sc = this.t().stockCount;
    this.completionSummary.set(
      `${ok} ${sc.productsLabel} ${sc.updated}.${shortage ? ` ${shortage} ${sc.shortage.toLowerCase()}` : ''}${surplus ? ` ${surplus} ${sc.surplus.toLowerCase()}` : ''} ${sc.corrected}.`
    );
    this.completed.set(true);
  }

  reset(): void {
    this.completed.set(false);
    this.q.set('');
    this.confirmItems.set([]);
  }
}
