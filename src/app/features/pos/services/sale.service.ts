import { inject, Injectable } from '@angular/core';
import {
  Firestore, doc, writeBatch, serverTimestamp, collection, increment, getDoc, getDocFromCache, Timestamp,
  runTransaction, DocumentReference, DocumentData, DocumentSnapshot, arrayRemove, arrayUnion,
} from '@angular/fire/firestore';
import { AuthService } from '../../../core/auth/services/auth.service';
import { CartStore } from '../store/cart.store';
import { ProductStore } from '../../products/store/product.store';
import { Sale, SaleItem, SaleReceipt } from '../../../shared/models/sale.model';
import { Batch, Product } from '../../../shared/models/product.model';
import { LoggerService } from '../../../core/logging/logger.service';
import { diffBatches, nearestExpiry } from '../../../shared/utils/batch.utils';
import { NetworkService } from '../../../core/offline/network.service';
import { LangService } from '../../../core/i18n/lang.service';
import { generateSaleNumber, resolveProduct, restoreBatches, round2, roundQty, toSaleItem } from './sale.utils';
import { planSaleStock, SaleStockLine, SaleStockPlan, SaleWarnings } from './sale-stock';
import { TenantSettingsService } from '../../../core/settings/tenant-settings.service';
import { creditDebtFields, SaleCreditPlan } from './credit-plan';
import { FarmerSyncService } from './farmer-sync.service';
import { CancelDenial, cancelDenial, isValidCancelReason } from '../../sales/services/cancel-policy';
import {
  checkPrescription, normalizePrescriptionNo, PrescriptionGap, productRequiresPrescription,
} from '../../../shared/utils/regulatory.utils';

export interface CreditOptions {
  interestRate: number | null;
  installmentCount: number | null;
  installmentAmount: number | null;
  totalWithInterest: number | null;
  /** Vade / taksit planı (POS veresiye dialogu). Varsa borç = plan.financed, peşinat nakit sayılır. */
  plan?: SaleCreditPlan | null;
}

export interface CompletedSale {
  id: string;
  saleNumber: string;
  /** Satış sonrası özet ve fiş için. */
  receipt: SaleReceipt;
  /** WhatsApp paylaşımı için (POS doldurur). */
  customerPhone?: string | null;
}

/** Sepetteki ürün artık bulunamadığında fırlatılır (pasif/silinmiş ürün). */
export class ProductNotFoundError extends Error {
  constructor(readonly productName: string) {
    super(`Product not found: ${productName}`);
    this.name = 'ProductNotFoundError';
  }
}

/** writeBatch / transaction'a uygulanacak yazma işlemlerini toplar. */
class WriteOps {
  readonly ops: { type: 'set' | 'update'; ref: DocumentReference; data: DocumentData }[] = [];
  set(ref: DocumentReference, data: DocumentData): void { this.ops.push({ type: 'set', ref, data }); }
  update(ref: DocumentReference, data: DocumentData): void { this.ops.push({ type: 'update', ref, data }); }
}

/** Cari hareket kaydının `balance` alanı = işlem sonrası müşteri bakiyesi (2.5). */
interface RunningBalance {
  txRef: DocumentReference;
  customerId: string;
  delta: number;
}

/** Ürün stoğu sepetteki miktarı karşılamıyorsa fırlatılır (satış engellenir). */
export class InsufficientStockError extends Error {
  constructor(readonly productName: string, readonly missing: number) {
    super(`Insufficient stock: ${productName} (${missing})`);
    this.name = 'InsufficientStockError';
  }
}

export type { SaleWarnings } from './sale-stock';

/** Transaction içinde (çevrimiçi) belge okuyucu. */
type DocReader = (ref: DocumentReference) => Promise<DocumentSnapshot>;

export class SaleNeedsConfirmationError extends Error {
  constructor(readonly warnings: SaleWarnings) {
    super('Sale needs confirmation');
    this.name = 'SaleNeedsConfirmationError';
  }
}

export interface CompleteSaleOptions {
  /** Süresi geçmiş birim ve parti yetersizliği uyarıları kullanıcı tarafından onaylandı. */
  confirmed?: boolean;
  /** Reçeteli satışta kayda geçecek müşteri kimlik bilgileri (satış anındaki kopya). */
  customerIds?: { tcNo: string | null; cksNo: string | null };
  /** Müşterinin bağlı olduğu çiftçi (biliniyorsa; ambar senkronu için). undefined = müşteri dokümanından okunur. */
  farmerId?: string | null;
}

/**
 * Reçeteli ürün içeren satışta müşteri veya e-reçete numarası eksik ('required' modda).
 * Reçeteli satış anonim yapılamaz; e-reçete numarası üzerinden işlem yapılır (BKÜ satış yön. md. 18/4).
 */
export class PrescriptionRequiredError extends Error {
  constructor(readonly missing: PrescriptionGap[], readonly productNames: string[]) {
    super(`Prescription required: ${missing.join(',')}`);
    this.name = 'PrescriptionRequiredError';
  }
}

/** Bitki koruma ürününde SKT geçmiş birim satılamaz (md. 21/b) — onayla geçilemez. */
export class ExpiredPlantProtectionError extends Error {
  constructor(readonly productName: string, readonly quantity: number, readonly gtsNos: string[]) {
    super(`Expired plant protection product: ${productName}`);
    this.name = 'ExpiredPlantProtectionError';
  }
}

/** Okutulan GTS artık stokta (partilerde) yok — satılmış ya da çıkarılmış olabilir. */
export class GtsUnavailableError extends Error {
  constructor(readonly productName: string, readonly gtsNos: string[]) {
    super(`GTS not in stock: ${gtsNos.join(', ')}`);
    this.name = 'GtsUnavailableError';
  }
}

/** Satış zaten iptal edilmişse fırlatılır. */
export class SaleAlreadyCancelledError extends Error {
  constructor() {
    super('Sale already cancelled');
    this.name = 'SaleAlreadyCancelledError';
  }
}

/** Y4: iptal yetkisi yok (kasiyer: başkasının / geçmiş günün satışı) ya da neden girilmedi. */
export class SaleCancelDeniedError extends Error {
  constructor(readonly reason: CancelDenial | 'reason-required') {
    super(`Sale cancel denied: ${reason}`);
    this.name = 'SaleCancelDeniedError';
  }
}

@Injectable({ providedIn: 'root' })
export class SaleService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartStore);
  private readonly productStore = inject(ProductStore);
  private readonly logger = inject(LoggerService);
  private readonly network = inject(NetworkService);
  private readonly t = inject(LangService).t;
  private readonly settings = inject(TenantSettingsService);
  private readonly farmerSync = inject(FarmerSyncService);

  private inFlight = false;

  /**
   * Sepeti satışa çevirir. Sepet commit'ten önce snapshot'lanıp temizlenir;
   * hata olursa geri yüklenir. Eşzamanlı ikinci çağrı reddedilir (1.3).
   */
  async completeSale(creditOptions?: CreditOptions, options: CompleteSaleOptions = {}): Promise<CompletedSale> {
    if (this.inFlight) throw new Error('Sale already in progress');
    this.inFlight = true;
    const snap = this.cart.snapshot();
    try {
      const tenantId = this.auth.currentTenantId();
      const userId = this.auth.currentUserId();
      const saleNumber = generateSaleNumber(new Date(), userId);
      const products = this.productStore.products();

      // Önce tüm kalemleri çöz — bulunamayan varsa hiçbir şey yazmadan hata ver (2.3)
      const resolved = snap.items.map(item => {
        const product = resolveProduct(item, products);
        if (!product) throw new ProductNotFoundError(item.productName);
        return { item, product };
      });

      // E-reçete: reçeteli ürün varsa müşteri + e-reçete no ('required' modda zorunlu)
      const rxNames = resolved.filter(r => productRequiresPrescription(r.product)).map(r => r.product.name);
      const rxNo = normalizePrescriptionNo(snap.prescriptionNo) || null;
      const rx = checkPrescription({
        mode: this.settings.prescriptionMode(),
        hasPrescriptionItems: rxNames.length > 0,
        customerId: snap.customerId,
        prescriptionNo: rxNo,
      });
      if (rx.blocking.length) throw new PrescriptionRequiredError(rx.blocking, rxNames);

      // Stok / FEFO ön kontrolü (yerel önbellek): hızlı geri bildirim ve onay diyaloğu için. Okutulan GTS'ler
      // önce düşülür (2.11). Bitki koruma ürününde SKT geçmiş birim kullanılmaz (engel); diğerlerinde SKT geçmiş
      // birim veya parti kaydı yetersizliği varsa onay istenir. Çevrimiçiyken aynı kontrol commit sırasında
      // transaction içinde SUNUCUDAKİ ürünle tekrarlanır (2.2: iki kasa aynı anda satabilir).
      this.planOrThrow(resolved, options);

      // Doğrulamalar bitti — Firestore referansları ancak şimdi oluşturulur
      const saleRef = doc(collection(this.firestore, 'sales'));

      // Sepet toplamları (sepet henüz temizlenmedi)
      const subtotal = this.cart.subtotal();
      const totalDiscount = this.cart.totalDiscount();
      const globalDiscountAmount = this.cart.globalDiscountAmount();
      const totalAmount = this.cart.totalAmount();
      const cartCredit = this.cart.creditAmount();
      const change = this.cart.change();
      const debt = creditDebtFields(cartCredit, creditOptions);
      const creditDebt = debt.amount;
      const plan = creditOptions?.plan ?? null;
      if (cartCredit > 0 && !snap.customerId) throw new Error('Credit sale requires a customer');
      const creditTxRef = cartCredit > 0 ? doc(collection(this.firestore, 'creditTransactions')) : null;
      const running: RunningBalance | undefined = creditTxRef && snap.customerId
        ? { txRef: creditTxRef, customerId: snap.customerId, delta: creditDebt }
        : undefined;

      /** Satışın tüm yazımları. `read` varsa (çevrimiçi) transaction içinde sunucudaki ürünlerle kurulur. */
      let saleItems: SaleItem[] = [];
      const build = async (read: DocReader | null): Promise<WriteOps> => {
        const lines = read ? await this.readLines(read, resolved) : resolved;
        const stockPlan = this.planOrThrow(lines, options);
        for (const w of stockPlan.warnings.batchShortfall) {
          this.logger.warn(`FEFO shortfall on sale ${saleNumber}: ${w.productName} (${w.quantity})`);
        }
        const batch = new WriteOps();
        saleItems = lines.map(({ item, product }, idx) => {
          const itemRx = productRequiresPrescription(product);
          return toSaleItem(item, product, stockPlan.allocations[idx].taken, { requiresPrescription: itemRx, prescriptionNo: itemRx ? rxNo : null });
        });

        for (const [idx, { item, product }] of lines.entries()) {
          batch.set(doc(collection(this.firestore, 'stockMovements')), {
            tenantId,
            productId: product.id,
            productName: product.name,
            type: 'out',
            quantity: item.quantity,
            previousStock: stockPlan.movements[idx].previousStock,
            newStock: stockPlan.movements[idx].newStock,
            reason: `${this.t().sales.saleRef}: ${saleNumber}`,
            reference: saleRef.id,
            createdAt: serverTimestamp(),
            createdBy: userId,
          });
        }
        for (const ch of stockPlan.products.values()) {
          // lastSaleId: kurallar çevrimdışı fazla satışta (iki kasa son birimi sattı) stoğun negatife
          // düşmesine yalnız aynı yazımda oluşturulan bu satış için izin verir (2.38) — satış kaydı kaybolmaz.
          this.writeProductStock(batch, ch.product, ch.batches, -ch.quantity, !!read, { lastSaleId: saleRef.id });
        }

        const sale: Omit<Sale, 'id'> = {
          tenantId,
          saleNumber,
          customerId: snap.customerId,
          customerName: snap.customerName,
          items: saleItems,
          subtotal,
          totalDiscount,
          globalDiscount: snap.globalDiscount,
          globalDiscountType: snap.globalDiscountType,
          globalDiscountAmount,
          totalAmount,
          paymentMethod: snap.paymentMethod,
          cashPaid: snap.cashPaid,
          cardPaid: snap.cardPaid,
          creditAmount: cartCredit,
          change,
          status: 'completed',
          notes: snap.notes || null,
          interestRate: creditOptions?.interestRate ?? null,
          installmentCount: creditOptions?.installmentCount ?? null,
          installmentAmount: creditOptions?.installmentAmount ?? null,
          totalWithInterest: creditOptions?.totalWithInterest ?? null,
          createdAt: serverTimestamp() as unknown as Timestamp,
          createdBy: userId,
          cancelledAt: null,
          cancelledBy: null,
          cancelReason: null,
        };
        if (cartCredit > 0 && plan) {
          sale.creditDueDate = debt.dueDate;
          sale.downPayment = debt.downPayment;
          if (plan.installments.length > 1) sale.installmentIntervalMonths = Math.max(1, Math.floor(Number(plan.intervalMonths) || 1));
        }
        if (rxNames.length) {
          sale.hasPrescriptionItems = true;
          sale.prescriptionNo = rxNo;
          sale.prescriberName = (snap.prescriberName ?? '').trim() || null;
          sale.customerTcNo = options.customerIds?.tcNo || null;
          sale.customerCksNo = options.customerIds?.cksNo || null;
        }
        batch.set(saleRef, sale);

        // Veresiye (tam veya kısmi) ise müşteri bakiyesi güncelle
        if (creditTxRef && snap.customerId) {
          const units = this.t().pos.units;
          batch.set(creditTxRef, {
            tenantId,
            customerId: snap.customerId,
            customerName: snap.customerName,
            saleId: saleRef.id,
            type: 'debt',
            amount: creditDebt,
            originalAmount: debt.originalAmount,
            description: `${this.t().sales.saleRef}: ${saleNumber} · ${saleItems.map(i => `${i.productName} (${i.quantity} ${units[i.unit ?? 'adet']})`).join(', ')}`,
            paymentMethod: null,
            balance: creditDebt, // commit sırasında işlem sonrası müşteri bakiyesiyle değiştirilir
            interestRate: debt.interestRate,
            installmentCount: debt.installmentCount,
            installmentAmount: debt.installmentAmount,
            // Vade / taksit planı (CreditService.buildInstallmentPlan); JS Date → Timestamp
            dueDate: debt.dueDate,
            installments: debt.installments,
            downPayment: debt.downPayment,
            createdAt: serverTimestamp(),
            createdBy: userId,
          });
          batch.update(doc(this.firestore, 'customers', snap.customerId), {
            totalDebt: increment(creditDebt),
            balance: increment(creditDebt),
            updatedAt: serverTimestamp(),
          });
        }
        return batch;
      };

      // Commit'ten önce sepeti temizle (çift satışı engelle); hata olursa catch geri yükler
      this.cart.clearCart();
      await this.commit(`sale ${saleNumber}`, build, running);
      const receipt: SaleReceipt = {
        saleNumber,
        date: new Date(),
        customerName: snap.customerName,
        items: saleItems,
        subtotal,
        totalDiscount,
        totalAmount,
        paymentMethod: snap.paymentMethod,
        cashPaid: snap.cashPaid,
        cardPaid: snap.cardPaid,
        creditAmount: cartCredit,
        change,
        totalWithInterest: creditOptions?.totalWithInterest ?? null,
        installmentCount: creditOptions?.installmentCount ?? null,
        prescriptionNo: rxNames.length ? rxNo : null,
        dueDate: cartCredit > 0 ? debt.dueDate : null,
        downPayment: cartCredit > 0 ? debt.downPayment : null,
        installments: cartCredit > 0 && debt.installments
          ? debt.installments.map(i => ({ no: i.no, dueDate: i.dueDate, amount: i.amount }))
          : null,
      };
      // Çiftçi ambarı senkronu — beklenmez, hata satışı bozmaz (FarmerSyncService fırlatmaz)
      if (snap.customerId) void this.farmerSync.syncCustomer(snap.customerId, options.farmerId);
      return { id: saleRef.id, saleNumber, receipt };
    } catch (err) {
      this.cart.restore(snap);
      throw err;
    } finally {
      this.inFlight = false;
    }
  }

  /**
   * Satışı iptal eder / iade alır: stok ve partiler geri yüklenir, 'return' hareketi yazılır,
   * veresiye ise müşteri borcu ve cari hesap ters kayıtla düzeltilir. Hepsi tek yazım.
   * Çevrimiçi: transaction — satış durumu ve ürünler sunucudan okunur (iki kasa aynı satışı iptal edemez,
   * eşzamanlı satış partileri ezilmez). Çevrimdışı: önbellekteki verilerle increment + arrayRemove/arrayUnion.
   */
  async cancelSale(saleId: string, reasonInput: string): Promise<void> {
    const tenantId = this.auth.currentTenantId();
    const userId = this.auth.currentUserId();
    const reason = (reasonInput ?? '').trim();
    if (!isValidCancelReason(reason)) throw new SaleCancelDeniedError('reason-required');
    const saleRef = doc(this.firestore, 'sales', saleId);
    const saleSnap = await getDoc(saleRef);
    if (!saleSnap.exists()) throw new Error('Sale not found');
    const cached = { id: saleSnap.id, ...saleSnap.data() } as Sale;
    if (cached.status !== 'completed') throw new SaleAlreadyCancelledError();
    const user = this.auth.currentUser();
    const denial = cancelDenial(cached, user ? { id: userId, role: user.role, cancelAnySale: user.permissions?.cancelAnySale } : null);
    if (denial) throw new SaleCancelDeniedError(denial);

    const now = Timestamp.now();
    const cancelRef = `${this.t().sales.cancelRef}: ${cached.saleNumber}`;
    const debt = cached.creditAmount > 0 ? round2(cached.totalWithInterest ?? cached.creditAmount) : 0;
    const creditTxRef = debt > 0 && cached.customerId ? doc(collection(this.firestore, 'creditTransactions')) : null;
    const running: RunningBalance | undefined = creditTxRef && cached.customerId
      ? { txRef: creditTxRef, customerId: cached.customerId, delta: -debt }
      : undefined;

    const build = async (read: DocReader | null): Promise<WriteOps> => {
      let sale = cached;
      if (read) {
        const fresh = await read(saleRef);
        if (!fresh.exists()) throw new Error('Sale not found');
        sale = { id: fresh.id, ...fresh.data() } as Sale;
        if (sale.status !== 'completed') throw new SaleAlreadyCancelledError();
      }
      const batch = new WriteOps();
      batch.update(saleRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancelledBy: userId,
        cancelReason: reason,
      });
      // Y4: değiştirilemez denetim kaydı (kurallar iptali bu kayıt olmadan reddeder)
      batch.set(doc(this.firestore, 'auditLogs', `sale_cancel_${sale.id}`), {
        tenantId,
        actorUid: userId,
        actorEmail: user?.email ?? '',
        actorName: user?.displayName ?? '',
        action: 'sale_cancel',
        saleId: sale.id,
        saleNumber: sale.saleNumber ?? '',
        amount: round2(sale.totalAmount ?? 0),
        paymentMethod: sale.paymentMethod ?? null,
        saleCreatedBy: sale.createdBy ?? null,
        detail: `${sale.saleNumber ?? sale.id} · ${round2(sale.totalAmount ?? 0)} ₺ · ${reason}`.slice(0, 500),
        createdAt: serverTimestamp(),
      });

      // Aynı ürün birden fazla kalemde olabilir — ürün başına birikimli güncelle
      const working = new Map<string, { product: Product; batches: Batch[]; qty: number }>();
      for (const item of sale.items ?? []) {
        let st = working.get(item.productId);
        if (!st) {
          const product = read ? await this.readProduct(read, item.productId) : await this.fetchProduct(item.productId);
          if (!product) {
            this.logger.warn('cancelSale: product not found, stock not restored', item.productId, sale.saleNumber);
            continue;
          }
          st = { product, batches: product.batches ?? [], qty: 0 };
          working.set(item.productId, st);
        }
        const previousStock = roundQty((Number(st.product.stock) || 0) + st.qty);
        st.batches = restoreBatches(st.batches, item, now, () => crypto.randomUUID());
        st.qty = roundQty(st.qty + item.quantity);

        batch.set(doc(collection(this.firestore, 'stockMovements')), {
          tenantId,
          productId: st.product.id,
          productName: st.product.name,
          type: 'return',
          quantity: item.quantity,
          previousStock,
          newStock: roundQty(previousStock + item.quantity),
          reason: cancelRef,
          reference: sale.id,
          createdAt: serverTimestamp(),
          createdBy: userId,
        });
      }
      for (const st of working.values()) {
        this.writeProductStock(batch, st.product, st.batches, st.qty, !!read, {});
      }

      // Veresiye ters kaydı
      if (creditTxRef && sale.customerId) {
        batch.set(creditTxRef, {
          tenantId,
          customerId: sale.customerId,
          customerName: sale.customerName,
          saleId: sale.id,
          type: 'debt',
          amount: -debt,
          originalAmount: null,
          description: `${cancelRef} · ${reason}`,
          paymentMethod: null,
          balance: -debt, // commit sırasında işlem sonrası müşteri bakiyesiyle değiştirilir
          interestRate: null,
          installmentCount: null,
          installmentAmount: null,
          isReversal: true,
          createdAt: serverTimestamp(),
          createdBy: userId,
        });
        batch.update(doc(this.firestore, 'customers', sale.customerId), {
          totalDebt: increment(-debt),
          balance: increment(-debt),
          updatedAt: serverTimestamp(),
        });
      }
      return batch;
    };

    await this.commit(`cancel ${cached.saleNumber}`, build, running);
    if (cached.customerId) void this.farmerSync.syncCustomer(cached.customerId);
  }

  /** Stok planı; sorun varsa ilgili hatayı fırlatır, onaysız uyarı varsa onay ister. */
  private planOrThrow(lines: SaleStockLine[], options: CompleteSaleOptions): SaleStockPlan {
    const r = planSaleStock(lines, Date.now());
    if (r.problem) {
      const p = r.problem;
      if (p.kind === 'insufficient') throw new InsufficientStockError(p.productName, p.missing);
      if (p.kind === 'gts-missing') throw new GtsUnavailableError(p.productName, p.gtsNos);
      throw new ExpiredPlantProtectionError(p.productName, p.quantity, p.gtsNos);
    }
    const w = r.plan.warnings;
    if (!options.confirmed && (w.expired.length || w.batchShortfall.length)) throw new SaleNeedsConfirmationError(w);
    return r.plan;
  }

  /** Transaction içinde sepetteki ürünleri sunucudan oku (ürün başına bir kez). */
  private async readLines<T extends SaleStockLine>(read: DocReader, lines: readonly T[]): Promise<T[]> {
    const fresh = new Map<string, Product>();
    for (const { product } of lines) {
      if (fresh.has(product.id)) continue;
      const p = await this.readProduct(read, product.id);
      if (!p || p.isActive === false) throw new ProductNotFoundError(product.name);
      fresh.set(product.id, p);
    }
    return lines.map(l => ({ ...l, product: fresh.get(l.product.id)! }));
  }

  private async readProduct(read: DocReader, id: string): Promise<Product | null> {
    const snap = await read(doc(this.firestore, 'products', id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Product) : null;
  }

  /**
   * Ürün stoğu + partileri yaz (2.2). Stok her zaman `increment` ile.
   * - transactional (çevrimiçi): partiler sunucudan okunan hâlden hesaplandı → dizinin tamamı yazılır.
   * - çevrimdışı: dizinin tamamı yazılmaz (bayat önbellek başka kasanın sattığı birimi geri getirirdi);
   *   yalnız değişen partiler `arrayRemove` (eski hâli) + `arrayUnion` (yeni hâli) ile yazılır.
   *   Aynı GTS birimi iki kasada çevrimdışı satılırsa stok ile Σ parti ayrışır; ürün kartındaki uzlaştırma çözer.
   */
  private writeProductStock(w: WriteOps, product: Product, after: Batch[], stockDelta: number, transactional: boolean, extra: DocumentData): void {
    const ref = doc(this.firestore, 'products', product.id);
    const base: DocumentData = {
      stock: increment(roundQty(stockDelta)),
      expiryDate: nearestExpiry(after),
      updatedAt: serverTimestamp(),
      ...extra,
    };
    if (transactional) {
      w.update(ref, { ...base, batches: after });
      return;
    }
    const { removed, added } = diffBatches(product.batches ?? [], after);
    w.update(ref, removed.length ? { ...base, batches: arrayRemove(...removed) } : base);
    if (added.length) w.update(ref, { batches: arrayUnion(...added) });
  }

  private async fetchProduct(id: string): Promise<Product | null> {
    try {
      const snap = await getDoc(doc(this.firestore, 'products', id));
      if (snap.exists()) return { id: snap.id, ...snap.data() } as Product;
    } catch (err) {
      this.logger.warn('cancelSale: getDoc product failed, using store', id, err);
    }
    return this.productStore.products().find(p => p.id === id) ?? null;
  }

  /**
   * Online: tek transaction — `build` sunucudan okuyarak yazımları kurar (çakışmada SDK yeniden dener,
   * `build` her denemede baştan çalışır); müşteri bakiyesi okunur, cari kaydın `balance` alanına işlem
   * sonrası bakiye yazılır. Offline: `build(null)` önbellekle kurulur, writeBatch fire-and-forget
   * (eldeki önbellek bakiyesiyle), hata loglanır (3.9). Müşteri bakiyesi her iki durumda increment ile güncellenir.
   */
  private async commit(label: string, build: (read: DocReader | null) => Promise<WriteOps>, running?: RunningBalance): Promise<void> {
    const setRunning = (w: WriteOps, currentBalance: number) => {
      if (!running) return;
      const op = w.ops.find(o => o.ref.path === running.txRef.path);
      if (op) op.data = { ...op.data, balance: round2(currentBalance + running.delta) };
    };

    if (this.network.isOnline()) {
      await runTransaction(this.firestore, async tx => {
        const w = await build(ref => tx.get(ref));
        if (running) {
          const c = await tx.get(doc(this.firestore, 'customers', running.customerId));
          setRunning(w, Number(c.data()?.['balance'] ?? 0));
        }
        for (const o of w.ops) {
          if (o.type === 'set') tx.set(o.ref, o.data);
          else tx.update(o.ref, o.data);
        }
      });
      return;
    }

    const w = await build(null);
    if (running) {
      try {
        const c = await getDocFromCache(doc(this.firestore, 'customers', running.customerId));
        setRunning(w, Number(c.data()?.['balance'] ?? 0));
      } catch (err) {
        this.logger.warn(`Offline: customer balance not in cache (${label})`, err);
        setRunning(w, 0);
      }
    }
    const batch = writeBatch(this.firestore);
    for (const o of w.ops) {
      if (o.type === 'set') batch.set(o.ref, o.data);
      else batch.update(o.ref, o.data);
    }
    batch.commit().catch(err => this.logger.error(`Offline commit failed (${label})`, err));
  }
}
