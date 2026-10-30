import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, of, tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LangService } from '../../../core/i18n/lang.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { Batch, isDecimalUnit, Product, productUnit } from '../../../shared/models/product.model';
import {
  SUPPLIER_RETURN_REASONS, SupplierReturn, SupplierReturnReason,
} from '../../../shared/models/supplier-return.model';
import { isBatchExpired, roundQty } from '../../../shared/utils/batch.utils';
import { BatchPickError } from '../../../shared/utils/batch-pick.utils';
import {
  DateFieldComponent, EmptyStateComponent, GlassCardComponent, MoneyComponent, PageHeaderComponent, StatusBadgeComponent, UiTone,
} from '../../../shared/ui';
import { SumStripComponent, SumStripItem } from '../../products/components/sum-strip.component';
import { ProductStore } from '../../products/store/product.store';
import { ProductStockError } from '../../products/services/product.service';
import { SupplierService } from '../../suppliers/services/supplier.service';
import { qtyWithUnit } from '../../sales/services/sales.helpers';
import { exportExcel } from '../../reports/services/report-export';
import { SupplierReturnError, SupplierReturnService } from './supplier-return.service';
import { returnCandidates, summarizeReturns } from './supplier-return.utils';
import { injectReturnTexts } from './supplier-return.i18n';

interface BatchRow { batch: Batch; expired: boolean }

/**
 * 11.13 Firmaya iade: SKT geçmiş BKÜ "iade edilmeli (30 gün)" listesi + iade kayıtları + yeni iade dialogu.
 * Yalnız yönetici (rota /purchases altında; kurallar supplierReturns). `?product=<id>` dialogu o ürünle açar.
 */
@Component({
  selector: 'app-supplier-returns',
  standalone: true,
  imports: [
    FormsModule, DatePipe, ButtonModule, CheckboxModule, DialogModule, InputNumberModule, InputTextModule, SelectModule, ToastModule,
    PageHeaderComponent, GlassCardComponent, EmptyStateComponent, StatusBadgeComponent, MoneyComponent, SumStripComponent, DateFieldComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast />
    <ui-page-header [title]="rt().title" [subtitle]="rt().subtitle(returns().length)" backLink="/purchases">
      <p-button severity="secondary" icon="pi pi-file-excel" [label]="rt().exportExcel" [disabled]="returns().length === 0"
        (onClick)="exportXlsx()" />
      <p-button icon="pi pi-plus" [label]="rt().newReturn" (onClick)="openNew(null)" />
    </ui-page-header>

    <div class="page-body">
      <app-sum-strip [items]="summary()" [ariaLabel]="rt().title" />

      <!-- İade edilmeli (30 gün) -->
      <ui-glass-card [title]="rt().candidatesTitle" [subtitle]="rt().candidatesDesc" icon="pi-exclamation-triangle"
        [iconTone]="candidates().length ? 'danger' : 'success'" padding="none" clip>
        @if (candidates().length === 0) {
          <ui-empty-state compact icon="pi-check-circle" tone="success" [title]="rt().candidatesEmpty" />
        } @else {
          <ul class="m-0 flex list-none flex-col p-0">
            @for (c of candidates(); track c.product.id) {
              <li class="list-row flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0">
                <div class="min-w-0 flex-1 basis-60">
                  <p class="m-0 truncate text-sm font-semibold text-fg">{{ c.product.name }}</p>
                  <p class="num m-0 mt-0.5 text-xs text-fg-muted">
                    {{ rt().expiredQty }}: {{ qty(c.expiredQty, c.product) }} · {{ rt().oldestExpiry }}: {{ c.oldestExpiry | date: 'dd.MM.yyyy' }}
                    · {{ rt().deadline }}: {{ c.deadline | date: 'dd.MM.yyyy' }}
                  </p>
                </div>
                <ui-status-badge size="sm" [tone]="deadlineTone(c.daysLeft)" [icon]="c.daysLeft < 0 ? 'pi-exclamation-circle' : 'pi-clock'">
                  {{ c.daysLeft < 0 ? rt().overdue(-c.daysLeft) : rt().daysLeft(c.daysLeft) }}
                </ui-status-badge>
                <p-button size="small" icon="pi pi-reply" [label]="rt().returnAction" (onClick)="openNew(c.product.id, true)" />
              </li>
            }
          </ul>
        }
      </ui-glass-card>

      <!-- İade kayıtları -->
      <ui-glass-card [title]="rt().listTitle" icon="pi-reply" iconTone="info" padding="none" clip>
        @if (loading()) {
          <div class="flex flex-col gap-3 p-4" aria-hidden="true">
            @for (i of [1, 2, 3]; track i) { <div class="h-11 animate-pulse rounded-token-md bg-surface-muted"></div> }
          </div>
        } @else if (returns().length === 0) {
          <ui-empty-state compact icon="pi-reply" [title]="rt().listEmpty" [description]="rt().listEmptyHint" />
        } @else {
          <table class="hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr class="h-10 border-b border-line bg-surface-muted text-left text-12.5 uppercase tracking-wide text-fg-muted">
                <th class="px-4 font-bold">{{ rt().date }}</th>
                <th class="px-4 font-bold">{{ rt().product }}</th>
                <th class="px-4 font-bold">{{ rt().supplier }}</th>
                <th class="px-4 text-right font-bold">{{ rt().quantity }}</th>
                <th class="px-4 font-bold">{{ rt().reason }}</th>
                <th class="px-4 font-bold">{{ rt().documentNo }}</th>
                <th class="px-4 font-bold">{{ rt().units }}</th>
                <th class="px-4 text-right font-bold">{{ rt().cost }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of returns(); track r.id) {
                <tr class="list-row border-b border-line align-top last:border-b-0">
                  <td class="num whitespace-nowrap px-4 py-3 text-fg-secondary">{{ r.returnDate.toDate() | date: 'dd.MM.yyyy' }}</td>
                  <td class="px-4 py-3 font-semibold text-fg">{{ r.productName }}</td>
                  <td class="px-4 py-3 text-fg-secondary">{{ r.supplierName }}</td>
                  <td class="num whitespace-nowrap px-4 py-3 text-right text-fg">{{ qtyUnit(r.quantity, r.unit) }}</td>
                  <td class="px-4 py-3"><ui-status-badge size="sm" [tone]="r.reason === 'expired' ? 'danger' : 'neutral'">{{ rt().reasons[r.reason] }}</ui-status-badge></td>
                  <td class="num px-4 py-3 text-fg-secondary">{{ r.documentNo || '—' }}</td>
                  <td class="num max-w-[16rem] break-all px-4 py-3 text-xs text-fg-muted">{{ unitsText(r) }}</td>
                  <td class="px-4 py-3 text-right"><ui-money class="num text-fg" [value]="r.totalCost" /></td>
                </tr>
              }
            </tbody>
          </table>
          <ul class="m-0 flex list-none flex-col p-0 md:hidden">
            @for (r of returns(); track r.id) {
              <li class="list-row flex items-start gap-3 border-b border-line px-3 py-2.5 last:border-b-0">
                <span class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-token-md bg-info-soft text-info-text" aria-hidden="true">
                  <i class="pi pi-reply text-base"></i>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-15 font-semibold text-fg">{{ r.productName }}</span>
                  <span class="num mt-0.5 block text-xs text-fg-muted">
                    {{ r.returnDate.toDate() | date: 'dd.MM.yyyy' }} · {{ r.supplierName }} · {{ r.documentNo || '—' }}
                  </span>
                  @if (unitsText(r)) { <span class="num mt-0.5 block break-all text-xs text-fg-muted">{{ unitsText(r) }}</span> }
                </span>
                <span class="flex shrink-0 flex-col items-end gap-1">
                  <span class="num text-sm font-extrabold text-fg">{{ qtyUnit(r.quantity, r.unit) }}</span>
                  <ui-status-badge size="sm" [tone]="r.reason === 'expired' ? 'danger' : 'neutral'">{{ rt().reasons[r.reason] }}</ui-status-badge>
                </span>
              </li>
            }
          </ul>
        }
      </ui-glass-card>
    </div>

    <!-- Yeni iade -->
    <p-dialog [header]="rt().dialogTitle" [(visible)]="showDialog" [modal]="true" [draggable]="false"
      appendTo="body" styleClass="w-[580px] max-w-[calc(100vw-2rem)]">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label for="sr-product" class="text-sm font-semibold text-fg-secondary">{{ rt().product }}</label>
          <p-select inputId="sr-product" [options]="productOptions()" optionLabel="label" optionValue="value" [filter]="true"
            filterBy="label" [placeholder]="rt().selectProduct" [ngModel]="productId()" (ngModelChange)="selectProduct($event, false)"
            styleClass="w-full" appendTo="body" />
        </div>

        @if (selectedProduct(); as p) {
          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-semibold text-fg-secondary">{{ rt().pickUnits }}</span>
              @if (hasExpiredRows()) {
                <p-button size="small" severity="secondary" [text]="true" icon="pi pi-check-square" [label]="rt().selectExpired"
                  (onClick)="pickExpired()" />
              }
            </div>
            @if (batchRows().length === 0) {
              <p class="m-0 rounded-token-md bg-surface-muted px-3 py-2.5 text-sm text-fg-muted">{{ rt().noBatches }}</p>
            } @else {
              <p class="m-0 text-xs text-fg-muted">{{ rt().pickHint }}</p>
              <ul class="m-0 flex max-h-[280px] list-none flex-col overflow-y-auto rounded-token-md border border-line p-0">
                @for (row of batchRows(); track row.batch.id) {
                  <li class="flex min-h-[48px] items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
                    <p-checkbox [inputId]="'sr-b-' + row.batch.id" [binary]="true" [ngModel]="isPicked(row.batch.id)"
                      (ngModelChange)="togglePick(row.batch, $event)" />
                    <label [for]="'sr-b-' + row.batch.id" class="min-w-0 flex-1 cursor-pointer">
                      <span class="num block truncate text-sm font-semibold text-fg">{{ row.batch.gtsNo || rt().bulk }}</span>
                      <span class="num block text-xs text-fg-muted">
                        @if (row.batch.lotNo) { {{ rt().lot }} {{ row.batch.lotNo }} · }
                        {{ row.batch.expiryDate ? (row.batch.expiryDate.toDate() | date: 'dd.MM.yyyy') : rt().noExpiry }}
                        · {{ qty(row.batch.quantity, p) }}
                      </span>
                    </label>
                    @if (row.expired) { <ui-status-badge size="sm" tone="danger">{{ rt().expired }}</ui-status-badge> }
                    @if (row.batch.quantity > 1 && isPicked(row.batch.id)) {
                      <p-inputNumber [inputId]="'sr-q-' + row.batch.id" [ngModel]="picks()[row.batch.id]" (ngModelChange)="setPickQty(row.batch, $event)"
                        [min]="0" [max]="row.batch.quantity" [maxFractionDigits]="decimal() ? 2 : 0" locale="tr-TR"
                        [ariaLabel]="rt().quantity" inputStyleClass="num w-20 text-right" />
                    }
                  </li>
                }
              </ul>
              <p class="num m-0 text-sm font-semibold text-fg">{{ rt().selectedTotal(qty(pickedTotal(), p)) }}</p>
            }
          </div>
        }

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex min-w-0 flex-col gap-1.5">
            <label for="sr-supplier" class="text-sm font-semibold text-fg-secondary">{{ rt().supplier }}</label>
            <p-select inputId="sr-supplier" [options]="supplierOptions()" optionLabel="label" optionValue="value" [filter]="true"
              [placeholder]="rt().selectSupplier" [ngModel]="supplierId()" (ngModelChange)="supplierId.set($event)"
              styleClass="w-full" appendTo="body" />
          </div>
          <div class="flex min-w-0 flex-col gap-1.5">
            <label for="sr-reason" class="text-sm font-semibold text-fg-secondary">{{ rt().reason }}</label>
            <p-select inputId="sr-reason" [options]="reasonOptions()" optionLabel="label" optionValue="value"
              [ngModel]="reason()" (ngModelChange)="reason.set($event)" styleClass="w-full" appendTo="body" />
          </div>
          <ui-date-field inputId="sr-date" [label]="rt().date" labelClass="text-sm font-semibold text-fg-secondary"
            [clearable]="false" [max]="today" [(value)]="returnDate" />
          <div class="flex min-w-0 flex-col gap-1.5">
            <label for="sr-doc" class="text-sm font-semibold text-fg-secondary">{{ rt().documentNo }}</label>
            <input pInputText id="sr-doc" class="h-11 w-full" maxlength="60" [placeholder]="rt().documentNoPlaceholder"
              [ngModel]="documentNo()" (ngModelChange)="documentNo.set($event ?? '')" />
          </div>
          <div class="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
            <label for="sr-note" class="text-sm font-semibold text-fg-secondary">{{ rt().note }}</label>
            <input pInputText id="sr-note" class="h-11 w-full" maxlength="200" [ngModel]="note()" (ngModelChange)="note.set($event ?? '')" />
          </div>
        </div>

        <div class="flex gap-2.5 rounded-token-lg border border-info-line bg-info-soft px-3 py-2.5 text-xs text-info-text">
          <i class="pi pi-info-circle mt-0.5" aria-hidden="true"></i>
          <p class="m-0">{{ rt().ledgerNote }} {{ rt().trackingNote }}</p>
        </div>
      </div>
      <ng-template #footer>
        <div class="flex w-full justify-end gap-2">
          <p-button [label]="t().common.cancel" severity="secondary" (onClick)="showDialog.set(false)" [disabled]="saving()" />
          <p-button [label]="rt().save" icon="pi pi-check" (onClick)="save()" [loading]="saving()"
            [disabled]="saving() || !canSave()" />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class SupplierReturnsPage implements OnInit {
  private readonly svc = inject(SupplierReturnService);
  private readonly suppliersSvc = inject(SupplierService);
  private readonly store = inject(ProductStore);
  private readonly toast = inject(MessageService);
  private readonly logger = inject(LoggerService);
  private readonly route = inject(ActivatedRoute);
  private readonly lang = inject(LangService);
  readonly t = this.lang.t;
  readonly rt = injectReturnTexts();
  private readonly currency = new CurrencyTrPipe();
  readonly today = new Date();

  readonly loading = signal(true);
  readonly returns = toSignal(
    this.svc.getAll$().pipe(tap(() => this.loading.set(false)), catchError(err => {
      this.logger.error('supplierReturns load', err);
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.rt().loadFailed });
      this.loading.set(false);
      return of([] as SupplierReturn[]);
    })),
    { initialValue: [] as SupplierReturn[] },
  );
  private readonly suppliers = toSignal(this.suppliersSvc.getAll$().pipe(catchError(() => of([]))), { initialValue: [] });

  readonly candidates = computed(() => returnCandidates(this.store.products()));

  readonly summary = computed<SumStripItem[]>(() => {
    const s = summarizeReturns(this.returns());
    return [
      { icon: 'pi-exclamation-triangle', tone: this.candidates().length ? 'danger' : 'success', label: this.rt().candidates, value: this.candidates().length },
      { icon: 'pi-reply', tone: 'info', label: this.rt().count, value: this.loading() ? '…' : s.count },
      { icon: 'pi-wallet', tone: 'neutral', label: this.rt().totalCost, value: this.loading() ? '…' : this.currency.transform(s.totalCost) },
    ];
  });

  // ---- Dialog ----
  readonly showDialog = signal(false);
  readonly saving = signal(false);
  readonly productId = signal<string | null>(null);
  /** batchId → iade miktarı */
  readonly picks = signal<Record<string, number>>({});
  readonly supplierId = signal<string | null>(null);
  readonly reason = signal<SupplierReturnReason>('expired');
  readonly returnDate = signal<Date | null>(new Date());
  readonly documentNo = signal('');
  readonly note = signal('');

  readonly selectedProduct = computed(() => this.store.products().find(p => p.id === this.productId()) ?? null);
  readonly decimal = computed(() => isDecimalUnit(productUnit(this.selectedProduct())));
  readonly batchRows = computed<BatchRow[]>(() => {
    const now = Date.now();
    return (this.selectedProduct()?.batches ?? [])
      .filter(b => b.quantity > 0)
      .map(b => ({ batch: b, expired: isBatchExpired(b, now) }))
      .sort((a, b) => Number(b.expired) - Number(a.expired)
        || (a.batch.expiryDate?.toMillis() ?? Infinity) - (b.batch.expiryDate?.toMillis() ?? Infinity));
  });
  readonly hasExpiredRows = computed(() => this.batchRows().some(r => r.expired));
  readonly pickedTotal = computed(() => roundQty(Object.values(this.picks()).reduce((s, q) => s + (q > 0 ? q : 0), 0)));

  readonly productOptions = computed(() => this.store.products()
    .filter(p => (p.batches ?? []).some(b => b.quantity > 0))
    .map(p => ({ label: p.barcode ? `${p.name} · ${p.barcode}` : p.name, value: p.id })));
  readonly supplierOptions = computed(() => this.suppliers().map(s => ({ label: s.name, value: s.id })));
  readonly reasonOptions = computed(() => SUPPLIER_RETURN_REASONS.map(r => ({ label: this.rt().reasons[r], value: r })));
  readonly canSave = computed(() => !!this.productId() && !!this.supplierId() && this.pickedTotal() > 0 && !!this.returnDate());

  ngOnInit(): void {
    this.store.ensureLoaded();
    const pid = this.route.snapshot.queryParamMap.get('product');
    if (pid) this.openNew(pid, true);
  }

  openNew(productId: string | null, preselectExpired = false): void {
    this.reason.set('expired');
    this.returnDate.set(new Date());
    this.documentNo.set('');
    this.note.set('');
    this.supplierId.set(null);
    this.selectProduct(productId, preselectExpired);
    this.showDialog.set(true);
  }

  selectProduct(id: string | null, preselectExpired: boolean): void {
    this.productId.set(id);
    this.picks.set({});
    if (preselectExpired) this.pickExpired();
    this.suggestSupplier();
  }

  pickExpired(): void {
    const next: Record<string, number> = { ...this.picks() };
    for (const r of this.batchRows()) if (r.expired) next[r.batch.id] = r.batch.quantity;
    this.picks.set(next);
    if (Object.keys(next).length) this.reason.set('expired');
    this.suggestSupplier();
  }

  isPicked(batchId: string): boolean {
    return (this.picks()[batchId] ?? 0) > 0;
  }

  togglePick(b: Batch, on: boolean): void {
    const next = { ...this.picks() };
    if (on) next[b.id] = b.quantity; else delete next[b.id];
    this.picks.set(next);
    this.suggestSupplier();
  }

  setPickQty(b: Batch, v: number | null): void {
    const q = roundQty(Math.min(b.quantity, Math.max(0, Number(v) || 0)));
    const next = { ...this.picks() };
    if (q > 0) next[b.id] = q; else delete next[b.id];
    this.picks.set(next);
  }

  /** Tedarikçi seçilmemişse: seçilen ilk partinin tedarikçisi, yoksa ürünün varsayılan tedarikçisi. */
  private suggestSupplier(): void {
    if (this.supplierId()) return;
    const p = this.selectedProduct();
    if (!p) return;
    const picked = (p.batches ?? []).find(b => this.isPicked(b.id) && b.supplierId);
    const id = picked?.supplierId ?? p.supplierId ?? null;
    if (id && this.suppliers().some(s => s.id === id)) this.supplierId.set(id);
  }

  async save(): Promise<void> {
    const productId = this.productId();
    const date = this.returnDate();
    if (!productId || !date || this.saving()) return;
    if (!this.supplierId()) { this.warn(this.rt().errNoSupplier); return; }
    const picks = Object.entries(this.picks()).filter(([, q]) => q > 0).map(([batchId, quantity]) => ({ batchId, quantity }));
    if (!picks.length) { this.warn(this.rt().errNoPicks); return; }
    this.saving.set(true);
    try {
      await this.svc.create({
        productId, supplierId: this.supplierId()!, picks, reason: this.reason(),
        note: this.note(), returnDate: date, documentNo: this.documentNo(),
      }, this.rt().stockReason);
      this.toast.add({ severity: 'success', summary: this.rt().saved, life: 3000 });
      this.showDialog.set(false);
    } catch (err) {
      this.logger.error('supplier return save', err);
      const msg = err instanceof SupplierReturnError
        ? (err.code === 'offline' ? this.rt().errOffline : err.code === 'no-picks' ? this.rt().errNoPicks : this.rt().errNoSupplier)
        : err instanceof BatchPickError || err instanceof ProductStockError ? this.rt().errQuantity
        : this.rt().errFailed;
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: msg, life: 5000 });
    } finally {
      this.saving.set(false);
    }
  }

  deadlineTone(daysLeft: number): UiTone {
    return daysLeft < 0 ? 'danger' : daysLeft <= 7 ? 'warning' : 'neutral';
  }

  qty(q: number, p: Pick<Product, 'unit'> | null): string {
    return qtyWithUnit(this.t(), q, productUnit(p), this.lang.lang());
  }

  qtyUnit(q: number, unit: SupplierReturn['unit']): string {
    return qtyWithUnit(this.t(), q, unit, this.lang.lang());
  }

  unitsText(r: SupplierReturn): string {
    const parts = [...(r.gtsNos ?? [])];
    if (r.lotNos?.length) parts.push(`${this.rt().lot}: ${r.lotNos.join(', ')}`);
    return parts.join(', ');
  }

  async exportXlsx(): Promise<void> {
    const rt = this.rt();
    const fmt = (d: Date) => d.toLocaleDateString('tr-TR');
    try {
      await exportExcel(`firmaya-iade-${new Date().toISOString().slice(0, 10)}`, [{
        title: rt.title,
        headers: [rt.date, rt.product, rt.licenseNo, rt.supplier, rt.quantity, rt.reason, rt.documentNo, 'GTS', rt.lot, rt.note, rt.cost],
        rows: this.returns().map(r => [
          fmt(r.returnDate.toDate()), r.productName, r.licenseNo ?? '', r.supplierName, r.quantity, rt.reasons[r.reason],
          r.documentNo ?? '', (r.gtsNos ?? []).join(', '), (r.lotNos ?? []).join(', '), r.note ?? '', r.totalCost,
        ]),
      }]);
    } catch (err) {
      this.logger.error('supplier return export', err);
      this.warn(this.t().reports.exportFailed);
    }
  }

  private warn(detail: string): void {
    this.toast.add({ severity: 'warn', summary: '', detail, life: 4000 });
  }
}
