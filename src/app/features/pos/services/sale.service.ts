import { inject, Injectable } from '@angular/core';
import {
  Firestore, doc, writeBatch, serverTimestamp, collection, increment, getDoc, getDocFromCache, Timestamp,
  runTransaction, DocumentReference, DocumentData,
} from '@angular/fire/firestore';
import { AuthService } from '../../../core/auth/services/auth.service';
import { CartStore } from '../store/cart.store';
import { ProductStore } from '../../products/store/product.store';
import { Sale, SaleItem, SaleReceipt } from '../../../shared/models/sale.model';
import { Product } from '../../../shared/models/product.model';
import { LoggerService } from '../../../core/logging/logger.service';
import { nearestExpiry } from '../../../shared/utils/batch.utils';
import { NetworkService } from '../../../core/offline/network.service';
import { LangService } from '../../../core/i18n/lang.service';
import { allocateFEFO, generateSaleNumber, resolveProduct, restoreBatches, round2, roundQty, toSaleItem } from './sale.utils';
import { TenantSettingsService } from '../../../core/settings/tenant-settings.service';
import { creditDebtFields, SaleCreditPlan } from './credit-plan';
import { FarmerSyncService } from './farmer-sync.service';
import { CancelDenial, cancelDenial, isValidCancelReason } from '../../sales/services/cancel-policy';
import {
  checkPrescription, isPlantProtection, normalizePrescriptionNo, PrescriptionGap, productRequiresPrescription,
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

/** Kullanıcı onayı gerektiren durumlar (süresi geçmiş birim / parti kaydı yetersiz). */
export interface SaleWarnings {
  expired: { productName: string; quantity: number }[];
  batchShortfall: { productName: string; quantity: number }[];
}

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

      // Stok / FEFO ön kontrolü: gerçek stok yetersizse engelle; okutulan GTS'ler önce düşülür (2.11).
      // Bitki koruma ürününde SKT geçmiş birim kullanılmaz (engel); diğerlerinde SKT geçmiş birim
      // veya parti kaydı yetersizliği varsa onay istenir.
      const warnings: SaleWarnings = { expired: [], batchShortfall: [] };
      const allocations = resolved.map(({ item, product }) => {
        if (roundQty(item.quantity) > roundQty(product.stock)) {
          throw new InsufficientStockError(product.name, roundQty(item.quantity - product.stock));
        }
        const plantProtection = isPlantProtection(product);
        const a = allocateFEFO(product.batches ?? [], item.quantity, Date.now(), {
          preferredGts: item.gtsNos ?? [],
          skipExpired: plantProtection,
        });
        if (a.missingGts.length) throw new GtsUnavailableError(product.name, a.missingGts);
        if (a.expiredGts.length || a.expiredBlocked > 0) {
          throw new ExpiredPlantProtectionError(product.name, a.expiredBlocked || a.expiredGts.length, a.expiredGts);
        }
        if (a.expiredUsed > 0) warnings.expired.push({ productName: product.name, quantity: a.expiredUsed });
        if (a.shortfall > 0) warnings.batchShortfall.push({ productName: product.name, quantity: a.shortfall });
        return a;
      });
      if (!options.confirmed && (warnings.expired.length || warnings.batchShortfall.length)) {
        throw new SaleNeedsConfirmationError(warnings);
      }
      // Doğrulamalar bitti — Firestore referansları ancak şimdi oluşturulur
      const batch = new WriteOps();
      const saleRef = doc(collection(this.firestore, 'sales'));
      for (const w of warnings.batchShortfall) {
        this.logger.warn(`FEFO shortfall on sale ${saleNumber}: ${w.productName} (${w.quantity})`);
      }

      const saleItems: SaleItem[] = [];
      for (const [idx, { item, product }] of resolved.entries()) {
        const { remaining, taken } = allocations[idx];
        const itemRx = productRequiresPrescription(product);
        saleItems.push(toSaleItem(item, product, taken, { requiresPrescription: itemRx, prescriptionNo: itemRx ? rxNo : null }));

        batch.update(doc(this.firestore, 'products', product.id), {
          stock: increment(-item.quantity),
          batches: remaining,
          expiryDate: nearestExpiry(remaining),
          updatedAt: serverTimestamp(),
        });

        batch.set(doc(collection(this.firestore, 'stockMovements')), {
          tenantId,
          productId: product.id,
          productName: product.name,
          type: 'out',
          quantity: item.quantity,
          previousStock: product.stock,
          newStock: roundQty(product.stock - item.quantity),
          reason: `${this.t().sales.saleRef}: ${saleNumber}`,
          reference: saleRef.id,
          createdAt: serverTimestamp(),
          createdBy: userId,
        });
      }

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
      let running: RunningBalance | undefined;
      if (cartCredit > 0) {
        if (!snap.customerId) throw new Error('Credit sale requires a customer');
        const units = this.t().pos.units;
        const txRef = doc(collection(this.firestore, 'creditTransactions'));
        running = { txRef, customerId: snap.customerId, delta: creditDebt };
        batch.set(txRef, {
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

      // Commit'ten önce sepeti temizle (çift satışı engelle); hata olursa catch geri yükler
      this.cart.clearCart();
      await this.commit(batch, `sale ${saleNumber}`, running);
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
   * veresiye ise müşteri borcu ve cari hesap ters kayıtla düzeltilir. Hepsi tek writeBatch.
   */
  async cancelSale(saleId: string, reasonInput: string): Promise<void> {
    const tenantId = this.auth.currentTenantId();
    const userId = this.auth.currentUserId();
    const reason = (reasonInput ?? '').trim();
    if (!isValidCancelReason(reason)) throw new SaleCancelDeniedError('reason-required');
    const saleRef = doc(this.firestore, 'sales', saleId);
    const saleSnap = await getDoc(saleRef);
    if (!saleSnap.exists()) throw new Error('Sale not found');
    const sale = { id: saleSnap.id, ...saleSnap.data() } as Sale;
    if (sale.status !== 'completed') throw new SaleAlreadyCancelledError();
    const user = this.auth.currentUser();
    const denial = cancelDenial(sale, user ? { id: userId, role: user.role, cancelAnySale: user.permissions?.cancelAnySale } : null);
    if (denial) throw new SaleCancelDeniedError(denial);

    const batch = new WriteOps();
    const now = Timestamp.now();
    const cancelRef = `${this.t().sales.cancelRef}: ${sale.saleNumber}`;

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
    const working = new Map<string, Product>();
    const restoredQty = new Map<string, number>();
    for (const item of sale.items ?? []) {
      let product = working.get(item.productId) ?? await this.fetchProduct(item.productId);
      if (!product) {
        this.logger.warn('cancelSale: product not found, stock not restored', item.productId, sale.saleNumber);
        continue;
      }
      const batches = restoreBatches(product.batches ?? [], item, now, () => crypto.randomUUID());
      const previousStock = product.stock;
      product = { ...product, batches, stock: roundQty(previousStock + item.quantity) };
      working.set(product.id, product);
      restoredQty.set(product.id, roundQty((restoredQty.get(product.id) ?? 0) + item.quantity));

      batch.set(doc(collection(this.firestore, 'stockMovements')), {
        tenantId,
        productId: product.id,
        productName: product.name,
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

    for (const p of working.values()) {
      batch.update(doc(this.firestore, 'products', p.id), {
        stock: increment(restoredQty.get(p.id) ?? 0),
        batches: p.batches,
        expiryDate: nearestExpiry(p.batches),
        updatedAt: serverTimestamp(),
      });
    }

    // Veresiye ters kaydı
    const debt = sale.creditAmount > 0 ? round2(sale.totalWithInterest ?? sale.creditAmount) : 0;
    let running: RunningBalance | undefined;
    if (debt > 0 && sale.customerId) {
      const txRef = doc(collection(this.firestore, 'creditTransactions'));
      running = { txRef, customerId: sale.customerId, delta: -debt };
      batch.set(txRef, {
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

    await this.commit(batch, `cancel ${sale.saleNumber}`, running);
    if (sale.customerId) void this.farmerSync.syncCustomer(sale.customerId);
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
   * Online: tek transaction — müşteri bakiyesi okunur, cari kaydın `balance` alanına
   * işlem sonrası bakiye yazılır. Offline: writeBatch fire-and-forget (eldeki önbellek
   * bakiyesiyle), hata loglanır (3.9). Müşteri bakiyesi her iki durumda increment ile güncellenir.
   */
  private async commit(w: WriteOps, label: string, running?: RunningBalance): Promise<void> {
    const setRunning = (currentBalance: number) => {
      if (!running) return;
      const op = w.ops.find(o => o.ref.path === running.txRef.path);
      if (op) op.data = { ...op.data, balance: round2(currentBalance + running.delta) };
    };

    if (this.network.isOnline()) {
      await runTransaction(this.firestore, async tx => {
        if (running) {
          const c = await tx.get(doc(this.firestore, 'customers', running.customerId));
          setRunning(Number(c.data()?.['balance'] ?? 0));
        }
        for (const o of w.ops) {
          if (o.type === 'set') tx.set(o.ref, o.data);
          else tx.update(o.ref, o.data);
        }
      });
      return;
    }

    if (running) {
      try {
        const c = await getDocFromCache(doc(this.firestore, 'customers', running.customerId));
        setRunning(Number(c.data()?.['balance'] ?? 0));
      } catch (err) {
        this.logger.warn(`Offline: customer balance not in cache (${label})`, err);
        setRunning(0);
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
