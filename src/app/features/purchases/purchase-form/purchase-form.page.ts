import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LangService } from '../../../core/i18n/lang.service';
import { CurrencyTrPipe } from '../../../shared/pipes/currency-tr.pipe';
import { Product, isDecimalUnit, productUnit } from '../../../shared/models/product.model';
import { PurchaseDocType, PurchasePaymentType } from '../../../shared/models/purchase.model';
import { SupplierPaymentMethod } from '../../../shared/models/supplier.model';
import { DateFieldComponent, GlassCardComponent, IconButtonComponent, PageHeaderComponent, EmptyStateComponent, normalizeDay } from '../../../shared/ui';
import { ProductStore } from '../../products/store/product.store';
import { normalizeLotNo } from '../../../shared/utils/batch.utils';
import { SupplierService } from '../../suppliers/services/supplier.service';
import { MAX_PURCHASE_LINES, PurchaseService } from '../services/purchase.service';
import { PurchaseError, calcLine, calcTotals, parseGtsText, validateLine } from '../services/purchase.utils';
import {
  gtinMatches, Gs1KeysDirective, injectScannerTexts, ScanButtonComponent, ScanFeedback, ScanResult, scanResultFromText,
} from '../../../shared/scanner';
import { isPlantProtection } from '../../../shared/utils/regulatory.utils';

interface FormLine {
  key: string;
  product: Product;
  quantity: number;
  unitCost: number;
  vatRate: number;
  /** SKT (yerel gün başı) */
  expiry: Date | null;
  gtsText: string;
  /** Parti / şarj no (karekod AI 10; kalemin tüm birimlerine yazılır) */
  lotNo: string;
  showGts: boolean;
}

@Component({
  selector: 'app-purchase-form',
  standalone: true,
  imports: [
    FormsModule, CurrencyTrPipe, ButtonModule, InputTextModule, TextareaModule, SelectModule, CheckboxModule, ToastModule, IconFieldModule, InputIconModule,
    PageHeaderComponent, GlassCardComponent, IconButtonComponent, EmptyStateComponent, DateFieldComponent, ScanButtonComponent, Gs1KeysDirective,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast />
    <ui-page-header backLink="/purchases" [backLabel]="t().common.back" [title]="t().purchases.newPurchase" icon="pi-download" iconTone="info">
      <p-button [label]="t().purchases.save" icon="pi pi-check" [loading]="saving()" [disabled]="saving()" (onClick)="save()" />
    </ui-page-header>

    <div class="page-body">
     <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-4">
      <div class="flex min-w-0 flex-col gap-3 lg:gap-4">
      <!-- Belge başlığı -->
      <ui-glass-card [title]="inv().documentInfo" icon="pi-file" tone="info">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
            <label for="pf-supplier" class="text-sm font-semibold text-fg-secondary">{{ t().purchases.supplier }}</label>
            <p-select inputId="pf-supplier" [options]="suppliers()" optionLabel="name" optionValue="id" [filter]="true"
              [placeholder]="t().purchases.selectSupplier" [ngModel]="supplierId()" (ngModelChange)="supplierId.set($event)" styleClass="w-full" />
          </div>
          <div class="flex min-w-0 flex-col gap-1.5">
            <label for="pf-doctype" class="text-sm font-semibold text-fg-secondary">{{ t().purchases.docType }}</label>
            <p-select inputId="pf-doctype" [options]="docTypeOptions()" optionLabel="label" optionValue="value"
              [ngModel]="docType()" (ngModelChange)="docType.set($event)" styleClass="w-full" />
          </div>
          <div class="flex min-w-0 flex-col gap-1.5">
            <label for="pf-docno" class="text-sm font-semibold text-fg-secondary">{{ t().purchases.docNo }}</label>
            <input pInputText id="pf-docno" class="w-full" autocomplete="off" [ngModel]="documentNo()" (ngModelChange)="documentNo.set($event)" />
          </div>
          <ui-date-field inputId="pf-date" [label]="t().purchases.documentDate" [clearable]="false"
            [ngModel]="documentDate()" (ngModelChange)="documentDate.set($event)" />
        </div>
      </ui-glass-card>

      <!-- Kalemler -->
      <ui-glass-card [title]="t().purchases.items" [subtitle]="inv().itemsHint" icon="pi-box" tone="success">
        @if (lines().length) {
          <span card-actions class="num inline-flex h-7 items-center rounded-token-sm bg-success-soft px-2.5 text-13 font-bold text-success-text">{{ lines().length }} {{ inv().lineCount }}</span>
        }
        <div class="relative mb-4">
          <label for="pf-search" class="sr-only">{{ t().purchases.scanOrSearch }}</label>
          <div class="flex items-center gap-2">
          <p-iconfield class="block min-w-0 flex-1">
          <p-inputicon styleClass="pi pi-barcode" />
          <input #pfSearch pInputText appGs1Keys id="pf-search" type="search" class="h-[52px] w-full border-line-strong text-base" autocomplete="off"
            [placeholder]="t().purchases.scanOrSearch" [value]="q()" (input)="q.set(pfSearch.value)" (keydown.enter)="onEnter($event)" />
          </p-iconfield>
          <ui-scan-button continuous [handler]="onScan" />
          </div>
          @if (suggestions().length) {
            <ul class="ui-card absolute left-0 right-0 top-full z-10 m-0 mt-1 flex list-none flex-col p-1 shadow-overlay">
              @for (p of suggestions(); track p.id) {
                <li>
                  <button type="button" class="list-row flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-token-md border-0 bg-transparent px-2 text-left"
                    (click)="addProduct(p)">
                    <span class="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{{ p.name }}</span>
                    <span class="num shrink-0 font-mono text-xs text-fg-muted">{{ p.barcode }}</span>
                  </button>
                </li>
              }
            </ul>
          }
        </div>

        @if (lines().length === 0) {
          <ui-empty-state compact icon="pi-box" [title]="t().purchases.errNoItems" />
        } @else {
          <ul class="m-0 -mx-4 flex list-none flex-col border-t border-line p-0">
            @for (l of lines(); track l.key; let i = $index) {
              <li class="border-b border-line px-4 py-3 last:border-b-0">
                <div class="mb-2 flex items-center gap-2">
                  <span class="num flex h-7 w-7 shrink-0 items-center justify-center rounded-token-sm bg-surface-strong text-xs font-bold text-fg-secondary">{{ i + 1 }}</span>
                  <span class="min-w-0 flex-1 truncate text-sm font-bold text-fg">{{ l.product.name }}</span>
                  <span class="num text-15 font-extrabold text-fg">{{ lineTotal(l) | currencyTr }}</span>
                  <ui-icon-button icon="pi-trash" tone="danger" size="sm" [ariaLabel]="t().purchases.removeLine" (click)="removeLine(l.key)" />
                </div>
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div class="flex min-w-0 flex-col gap-1">
                    <label [for]="'pf-q-' + l.key" class="text-xs font-semibold text-fg-secondary">{{ t().purchases.quantity }} ({{ unitOf(l) }})</label>
                    <input pInputText [id]="'pf-q-' + l.key" type="number" inputmode="decimal" min="0" [step]="decimal(l) ? 'any' : 1"
                      class="num w-full" [disabled]="gtsCount(l) > 0" [ngModel]="gtsCount(l) > 0 ? gtsCount(l) : l.quantity"
                      (ngModelChange)="patch(l.key, { quantity: +$event })" />
                  </div>
                  <div class="flex min-w-0 flex-col gap-1">
                    <label [for]="'pf-c-' + l.key" class="text-xs font-semibold text-fg-secondary">{{ t().purchases.unitCost }}</label>
                    <input pInputText [id]="'pf-c-' + l.key" type="number" inputmode="decimal" min="0" step="any" class="num w-full"
                      [ngModel]="l.unitCost" (ngModelChange)="patch(l.key, { unitCost: +$event })" />
                  </div>
                  <div class="flex min-w-0 flex-col gap-1">
                    <label [for]="'pf-v-' + l.key" class="text-xs font-semibold text-fg-secondary">{{ t().purchases.vat }}</label>
                    <input pInputText [id]="'pf-v-' + l.key" type="number" inputmode="decimal" min="0" step="any" class="num w-full"
                      [ngModel]="l.vatRate" (ngModelChange)="patch(l.key, { vatRate: +$event })" />
                  </div>
                  <ui-date-field class="!gap-1" [inputId]="'pf-e-' + l.key" labelClass="text-xs font-semibold text-fg-secondary" [label]="t().purchases.expiry"
                    [ngModel]="l.expiry" (ngModelChange)="patch(l.key, { expiry: $event })" />
                </div>
                <button type="button" class="mt-2 inline-flex min-h-[36px] cursor-pointer items-center border-0 bg-transparent p-0 text-13 font-semibold text-brand-text"
                  [attr.aria-expanded]="l.showGts" (click)="patch(l.key, { showGts: !l.showGts })">
                  <i class="pi pi-qrcode mr-1 text-xs" aria-hidden="true"></i>{{ t().purchases.gts }}
                  @if (gtsCount(l) > 0) { ({{ gtsCount(l) }}) }
                  @if (l.lotNo.trim()) { <span class="ml-1 font-mono text-xs text-fg-secondary">· {{ t().inventory.lotNo }} {{ l.lotNo.trim() }}</span> }
                </button>
                @if (l.showGts) {
                  <div class="mt-2 flex flex-col gap-1">
                    <label [for]="'pf-l-' + l.key" class="text-xs font-semibold text-fg-secondary">{{ t().inventory.lotNo }}</label>
                    <input pInputText [id]="'pf-l-' + l.key" type="text" maxlength="20" autocomplete="off" class="w-full font-mono text-sm uppercase placeholder:normal-case sm:max-w-[16rem]"
                      [placeholder]="t().inventory.lotNoPlaceholder" [ngModel]="l.lotNo" (ngModelChange)="patch(l.key, { lotNo: $event })" />
                    <label [for]="'pf-g-' + l.key" class="sr-only">{{ t().purchases.gts }}</label>
                    <textarea pTextarea appGs1Keys [id]="'pf-g-' + l.key" rows="3" class="w-full resize-y font-mono text-xs"
                      [ngModel]="l.gtsText" (ngModelChange)="patch(l.key, { gtsText: $event })" (blur)="applyGtsText(l.key)"></textarea>
                    <p class="m-0 text-xs text-fg-muted">{{ t().purchases.gtsHint }}</p>
                  </div>
                }
              </li>
            }
          </ul>
        }
      </ui-glass-card>

      </div>

      <!-- Sağ: toplam + ödeme (masaüstünde yapışkan) -->
      <div class="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:gap-4">
        <ui-glass-card [title]="inv().paymentCard" icon="pi-wallet" tone="warning">
          <div class="flex flex-col gap-4">
            <div class="grid grid-cols-2 gap-2" role="radiogroup" [attr.aria-label]="t().purchases.paymentType">
              @for (opt of paymentTypeOptions(); track opt.value) {
                <button type="button" role="radio" [attr.aria-checked]="paymentType() === opt.value" (click)="paymentType.set(opt.value)"
                  class="tap cursor-pointer rounded-token-md border px-3 text-sm font-semibold"
                  [class]="paymentType() === opt.value ? 'border-brand-line bg-brand-soft text-brand-text' : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'">
                  {{ opt.label }}
                </button>
              }
            </div>
            @if (paymentType() === 'cash') {
              <div class="flex flex-col gap-1.5">
                <label for="pf-method" class="text-sm font-semibold text-fg-secondary">{{ t().purchases.paymentMethod }}</label>
                <p-select inputId="pf-method" [options]="methodOptions()" optionLabel="label" optionValue="value"
                  [ngModel]="paymentMethod()" (ngModelChange)="paymentMethod.set($event)" styleClass="w-full" />
              </div>
            } @else {
              <ui-date-field inputId="pf-due" [label]="t().purchases.dueDate" [ngModel]="dueDate()" (ngModelChange)="dueDate.set($event)" />
            }
            <div class="flex items-start gap-3">
              <p-checkbox inputId="pf-price" [binary]="true" [ngModel]="updatePrice()" (ngModelChange)="updatePrice.set($event)" />
              <label for="pf-price" class="cursor-pointer">
                <span class="block text-sm font-semibold text-fg">{{ t().purchases.updatePrice }}</span>
                <span class="block text-xs text-fg-muted">{{ t().purchases.updatePriceHint }}</span>
              </label>
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="pf-notes" class="text-sm font-semibold text-fg-secondary">{{ t().purchases.notes }} <span class="font-normal text-fg-muted">({{ t().common.optional }})</span></label>
              <textarea pTextarea id="pf-notes" rows="2" class="w-full resize-y" [ngModel]="notes()" (ngModelChange)="notes.set($event)"></textarea>
            </div>
          </div>
        </ui-glass-card>

        <ui-glass-card class="lg:order-first" [title]="inv().totalsCard" icon="pi-calculator" tone="accent">
          <dl class="m-0 flex flex-col gap-2 text-sm">
            <div class="flex justify-between"><dt class="text-fg-secondary">{{ t().purchases.subtotal }}</dt><dd class="num m-0 font-semibold">{{ totals().subtotal | currencyTr }}</dd></div>
            <div class="flex items-center justify-between gap-3">
              <dt><label for="pf-discount" class="text-fg-secondary">{{ t().purchases.discount }}</label></dt>
              <dd class="m-0 w-36"><input pInputText id="pf-discount" type="number" inputmode="decimal" min="0" step="any" class="num w-full text-right"
                [ngModel]="discount()" (ngModelChange)="discount.set(+$event || 0)" /></dd>
            </div>
            <div class="flex justify-between"><dt class="text-fg-secondary">{{ t().purchases.vatTotal }}</dt><dd class="num m-0 font-semibold">{{ totals().vatTotal | currencyTr }}</dd></div>
            <div class="flex items-baseline justify-between border-t border-line pt-2"><dt class="font-bold text-fg">{{ t().purchases.grandTotal }}</dt><dd class="num-xl m-0 text-26 text-fg">{{ totals().grandTotal | currencyTr }}</dd></div>
          </dl>
          <p-button card-footer styleClass="w-full" class="block border-t border-line p-3" size="large" [label]="t().purchases.save" icon="pi pi-check" [loading]="saving()" [disabled]="saving()" (onClick)="save()" />
        </ui-glass-card>
      </div>
     </div>
    </div>
  `,
})
export class PurchaseFormPage implements OnInit {
  private readonly svc = inject(PurchaseService);
  private readonly supplierSvc = inject(SupplierService);
  private readonly productStore = inject(ProductStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);
  readonly t = inject(LangService).t;
  private readonly sx = injectScannerTexts();
  readonly inv = computed(() => this.t().inventory);

  readonly suppliers = toSignal(this.supplierSvc.getAll$().pipe(catchError(() => of([]))), { initialValue: [] });
  readonly supplierId = signal<string | null>(null);
  readonly docType = signal<PurchaseDocType>('invoice');
  readonly documentNo = signal('');
  readonly documentDate = signal<Date | null>(normalizeDay(new Date()));
  readonly lines = signal<FormLine[]>([]);
  readonly discount = signal(0);
  readonly paymentType = signal<PurchasePaymentType>('credit');
  readonly paymentMethod = signal<SupplierPaymentMethod>('cash');
  readonly dueDate = signal<Date | null>(null);
  readonly updatePrice = signal(true);
  readonly notes = signal('');
  readonly q = signal('');
  readonly saving = signal(false);

  readonly docTypeOptions = computed(() => [
    { label: this.t().purchases.docInvoice, value: 'invoice' as PurchaseDocType },
    { label: this.t().purchases.docWaybill, value: 'waybill' as PurchaseDocType },
  ]);
  readonly paymentTypeOptions = computed(() => [
    { label: this.t().purchases.paymentCredit, value: 'credit' as PurchasePaymentType },
    { label: this.t().purchases.paymentCash, value: 'cash' as PurchasePaymentType },
  ]);
  readonly methodOptions = computed(() => [
    { label: this.t().purchases.cash, value: 'cash' as SupplierPaymentMethod },
    { label: this.t().purchases.card, value: 'card' as SupplierPaymentMethod },
    { label: this.t().purchases.transfer, value: 'transfer' as SupplierPaymentMethod },
  ]);

  readonly suggestions = computed(() => {
    const q = this.q().trim().toLocaleLowerCase('tr');
    if (q.length < 2) return [];
    return this.productStore.products()
      .filter(p => p.name.toLocaleLowerCase('tr').includes(q) || (p.barcode ?? '').includes(q))
      .slice(0, 8);
  });

  readonly totals = computed(() => calcTotals(this.lines().map(l => this.toLineInput(l)), this.discount()));

  ngOnInit(): void {
    this.productStore.ensureLoaded();
    const sid = this.route.snapshot.queryParamMap.get('supplierId');
    if (sid) this.supplierId.set(sid);
  }

  /** Arama kutusunu temizle (DOM değeri de hemen: okuyucu hızında bağ güncellenmeyebilir, bkz. POS Y2). */
  private clearQuery(): void {
    this.q.set('');
    const el = document.getElementById('pf-search') as HTMLInputElement | null;
    if (el) el.value = '';
  }

  onEnter(event: Event): void {
    event.preventDefault();
    const code = this.q().trim();
    if (!code) return;
    // Y3: USB okuyucuyla okutulan karekod kamera yoluyla aynı işlenir (GTIN → ürün, SKT ve parti kaleme)
    const scanned = scanResultFromText(code);
    if (scanned.gs1?.gtin) {
      const fb = this.onScan(scanned);
      this.clearQuery();
      this.toast.add({ severity: fb.tone === 'success' ? 'success' : fb.tone === 'warn' ? 'warn' : 'error', summary: '', detail: fb.message, life: 3000 });
      return;
    }
    const exact = this.productStore.products().find(p => p.barcode === code);
    const pick = exact ?? (this.suggestions().length === 1 ? this.suggestions()[0] : null);
    if (pick) { this.addProduct(pick); return; }
    if (this.suggestions().length === 0) {
      this.toast.add({ severity: 'warn', summary: '', detail: this.t().purchases.noProductFound, life: 2500 });
    }
  }

  /**
   * Kamerayla sürekli okutma. Düz barkod → ürün kalemi +1. Karekod → GTIN'den ürün bulunur; birim GTS'si
   * aynı ürün + aynı SKT'li GTS kalemine eklenir (yoksa yeni kalem, SKT karekoddan).
   */
  readonly onScan = (r: ScanResult): ScanFeedback => {
    const sx = this.sx();
    const products = this.productStore.products();
    const gtin = r.gs1?.gtin ?? null;
    const p = products.find(x => (x.barcode ?? '').trim() === r.code)
      ?? (gtin ? products.find(x => gtinMatches(x.barcode, gtin)) : undefined);
    if (!p) return { tone: 'error', message: sx.notFound(r.gs1?.ean13 ?? gtin ?? r.code) };
    if (!r.gs1 || !(r.gs1.serial || r.gs1.lot || r.gs1.expiry)) {
      this.addProduct(p);
      return { tone: 'success', message: `${p.name} +1` };
    }
    const code = r.code;
    if (this.lines().some(l => parseGtsText(l.gtsText).includes(code))) return { tone: 'warn', message: sx.alreadyAdded };
    const exp = r.gs1.expiry ? normalizeDay(r.gs1.expiry) : null;
    const sameDay = (d: Date | null) => (d?.getTime() ?? null) === (exp?.getTime() ?? null);
    const lot = normalizeLotNo(r.gs1.lot) ?? '';
    const line = this.lines().find(l => l.product.id === p.id && l.gtsText.trim() && sameDay(l.expiry)
      && (normalizeLotNo(l.lotNo) ?? '') === lot);
    if (line) {
      this.patch(line.key, { gtsText: `${line.gtsText.trim()}\n${code}` });
    } else {
      if (this.lines().length >= MAX_PURCHASE_LINES) return { tone: 'error', message: this.t().purchases.errTooMany };
      this.lines.update(ls => [...ls, {
        key: crypto.randomUUID(), product: p, quantity: 1, unitCost: Number(p.purchasePrice) || 0,
        vatRate: p.vatRate ?? 20, expiry: exp, gtsText: code, lotNo: lot, showGts: true,
      }]);
    }
    const parts = [`${p.name} +1 GTS`];
    if (r.gs1.expiry) parts.push(`${sx.gs1Expiry}: ${r.gs1.expiry.toLocaleDateString('tr-TR')}`);
    if (r.gs1.lot) parts.push(`${sx.gs1Lot}: ${r.gs1.lot}`);
    return { tone: 'success', message: parts.join(' · ') };
  };

  /**
   * Y3: GTS kutusuna (USB okuyucu / elle) yazılan karekodları çöz. Karekoddaki SKT ve parti kaleme yazılır;
   * farklı SKT / parti nolu birimler aynı ürünün ayrı kalemlerine (ayrı partiler) bölünür.
   */
  applyGtsText(key: string): void {
    const line = this.lines().find(l => l.key === key);
    if (!line) return;
    const tokens = parseGtsText(line.gtsText);
    if (!tokens.length) return;
    const dayIso = (d: Date | null) => (d ? normalizeDay(d).getTime() : null);
    interface Group { expiry: Date | null; lot: string; codes: string[] }
    const groups = new Map<string, Group>();
    const keep: string[] = [];
    for (const tok of tokens) {
      const r = scanResultFromText(tok);
      const g = r.gs1;
      if (!g || !(g.expiry || g.lot)) { keep.push(r.code); continue; }
      const exp = g.expiry ? normalizeDay(g.expiry) : null;
      const lot = normalizeLotNo(g.lot) ?? '';
      const k = `${dayIso(exp) ?? ''}|${lot}`;
      const grp = groups.get(k) ?? { expiry: exp, lot, codes: [] };
      grp.codes.push(r.code);
      groups.set(k, grp);
    }
    const list = [...groups.values()];
    // Bu kalem: elle girilmiş SKT/parti ile uyumlu grup ya da (boşsa) ilk grup
    const lineKey = `${dayIso(line.expiry) ?? ''}|${normalizeLotNo(line.lotNo) ?? ''}`;
    const blank = !line.expiry && !(line.lotNo ?? '').trim();
    const own = groups.get(lineKey) ?? (blank ? list[0] : undefined);
    const ownCodes = [...keep, ...(own?.codes ?? [])];
    const others = list.filter(g => g !== own);
    this.patch(key, {
      gtsText: ownCodes.join('\n'),
      ...(own && blank ? { expiry: own.expiry, lotNo: own.lot } : {}),
    });
    if (!others.length) return;
    if (this.lines().length + others.length > MAX_PURCHASE_LINES) { this.warn(this.t().purchases.errTooMany); return; }
    this.lines.update(ls => {
      const at = ls.findIndex(l => l.key === key);
      const extra: FormLine[] = others.map(g => ({
        key: crypto.randomUUID(), product: line.product, quantity: g.codes.length, unitCost: line.unitCost,
        vatRate: line.vatRate, expiry: g.expiry, gtsText: g.codes.join('\n'), lotNo: g.lot, showGts: true,
      }));
      return [...ls.slice(0, at + 1), ...extra, ...ls.slice(at + 1)];
    });
    this.toast.add({ severity: 'info', summary: '', detail: this.t().purchases.gtsSplit(others.length + 1), life: 3500 });
  }

  addProduct(p: Product): void {
    this.clearQuery();
    const existing = this.lines().find(l => l.product.id === p.id && !l.gtsText.trim());
    if (existing) {
      this.patch(existing.key, { quantity: existing.quantity + 1 });
      return;
    }
    if (this.lines().length >= MAX_PURCHASE_LINES) {
      this.toast.add({ severity: 'warn', summary: '', detail: this.t().purchases.errTooMany });
      return;
    }
    this.lines.update(ls => [...ls, {
      key: crypto.randomUUID(), product: p, quantity: 1, unitCost: Number(p.purchasePrice) || 0,
      vatRate: p.vatRate ?? 20, expiry: null, gtsText: '', lotNo: '', showGts: false,
    }]);
  }

  patch(key: string, changes: Partial<FormLine>): void {
    this.lines.update(ls => ls.map(l => (l.key === key ? { ...l, ...changes } : l)));
  }

  removeLine(key: string): void {
    this.lines.update(ls => ls.filter(l => l.key !== key));
  }

  gtsCount(l: FormLine): number { return parseGtsText(l.gtsText).length; }
  unitOf(l: FormLine): string { return productUnit(l.product); }
  decimal(l: FormLine): boolean { return isDecimalUnit(productUnit(l.product)); }
  lineTotal(l: FormLine): number {
    const c = calcLine(this.toLineInput(l));
    return c.lineSubtotal + c.lineVat;
  }

  private toLineInput(l: FormLine) {
    return { quantity: Number(l.quantity) || 0, unitCost: Number(l.unitCost) || 0, vatRate: Number(l.vatRate) || 0, gtsNumbers: parseGtsText(l.gtsText) };
  }

  async save(): Promise<void> {
    const tp = this.t().purchases;
    const supplierId = this.supplierId();
    if (!supplierId) { this.warn(tp.errNoSupplier); return; }
    if (this.lines().length === 0) { this.warn(tp.errNoItems); return; }
    // GTS kutularında çözülmemiş karekod kalmasın (SKT / parti kaleme yazılsın)
    for (const l of [...this.lines()]) if (l.gtsText.trim()) this.applyGtsText(l.key);
    for (const l of this.lines()) {
      const err = validateLine(this.toLineInput(l));
      if (err === 'duplicate-gts') { this.warn(tp.errDuplicateGts.replace('{gts}', l.product.name)); return; }
      if (err) { this.warn(`${tp.errInvalidLine}: ${l.product.name}`); return; }
      // Y3 (mevzuat): bitki koruma ürünü SKT'siz stoğa girmesin
      if (!l.expiry && isPlantProtection(l.product)) { this.warn(tp.errExpiryRequired.replace('{name}', l.product.name)); return; }
    }
    const docLabel = `${this.documentNo().trim() || '-'}`;
    this.saving.set(true);
    try {
      const id = await this.svc.create({
        supplierId,
        docType: this.docType(),
        documentNo: this.documentNo(),
        documentDate: this.documentDate() ?? normalizeDay(new Date()),
        lines: this.lines().map(l => ({
          productId: l.product.id, quantity: Number(l.quantity) || 0, unitCost: Number(l.unitCost) || 0,
          vatRate: Number(l.vatRate) || 0, expiryDate: l.expiry, gtsNumbers: parseGtsText(l.gtsText), lotNo: normalizeLotNo(l.lotNo),
        })),
        discount: this.discount(),
        paymentType: this.paymentType(),
        paymentMethod: this.paymentType() === 'cash' ? this.paymentMethod() : null,
        dueDate: this.paymentType() === 'credit' ? this.dueDate() : null,
        updatePurchasePrice: this.updatePrice(),
        notes: this.notes(),
      }, {
        stockReason: `${tp.stockReason}: ${docLabel}`,
        ledgerPurchase: tp.ledgerPurchase.replace('{doc}', docLabel),
        ledgerCashPayment: tp.ledgerCashPayment.replace('{doc}', docLabel),
      });
      this.toast.add({ severity: 'success', summary: '', detail: tp.saved, life: 2500 });
      await this.router.navigate(['/purchases', id]);
    } catch (err) {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.errorText(err) });
    } finally {
      this.saving.set(false);
    }
  }

  private errorText(err: unknown): string {
    const tp = this.t().purchases;
    if (err instanceof PurchaseError) {
      switch (err.code) {
        case 'duplicate-gts': return tp.errDuplicateGts.replace('{gts}', err.detail ?? '');
        case 'offline': return tp.errOffline;
        case 'no-supplier': case 'supplier-not-found': return tp.errNoSupplier;
        case 'no-items': return tp.errNoItems;
        case 'too-many-items': return tp.errTooMany;
        case 'product-not-found': return tp.errProductNotFound;
        default: return tp.errInvalidLine;
      }
    }
    return tp.saveFailed;
  }

  private warn(detail: string): void {
    this.toast.add({ severity: 'warn', summary: '', detail, life: 3500 });
  }
}
