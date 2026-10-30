import { inject, Injectable } from '@angular/core';
import {
  Firestore, collection, doc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  Timestamp, where, DocumentReference, QueryConstraint, Transaction,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/services/auth.service';
import { NetworkService } from '../../../core/offline/network.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { Product, productUnit } from '../../../shared/models/product.model';
import {
  Purchase, PurchaseDocType, PurchaseItem, PurchasePaymentType,
} from '../../../shared/models/purchase.model';
import {
  Supplier, SupplierPaymentMethod, SupplierTransaction, SupplierTransactionType,
} from '../../../shared/models/supplier.model';
import { normalizeLotNo, roundQty } from '../../../shared/utils/batch.utils';
import {
  PurchaseError, PurchaseSummary, applyPurchaseItem, calcLine, calcTotals, cleanGts, nextSupplierBalance,
  revertPurchaseItem, roundKurus, summarize, validateLine,
} from './purchase.utils';

const PURCHASES = 'purchases';
const SUPPLIER_TX = 'supplierTransactions';
const SUPPLIERS = 'suppliers';
const PRODUCTS = 'products';
const MOVEMENTS = 'stockMovements';

/** Firestore yazma grubu sınırı 500; kalem başına 2 yazma (ürün + hareket) + belge/cari yazmaları */
export const MAX_PURCHASE_LINES = 200;

export interface PurchaseLineInput {
  productId: string;
  quantity: number;
  unitCost: number;
  vatRate: number;
  expiryDate: Date | null;
  gtsNumbers: string[];
  /** Parti / şarj no (ops.) */
  lotNo?: string | null;
}

export interface PurchaseInput {
  supplierId: string;
  docType: PurchaseDocType;
  documentNo: string;
  documentDate: Date;
  lines: PurchaseLineInput[];
  discount: number;
  paymentType: PurchasePaymentType;
  /** Peşin alışta ödeme şekli */
  paymentMethod: SupplierPaymentMethod | null;
  /** Vadeli alışta vade tarihi */
  dueDate: Date | null;
  /** Ürün kartındaki alış fiyatını son alış fiyatıyla güncelle */
  updatePurchasePrice: boolean;
  notes: string | null;
}

/** Çağıran taraftan gelen (i18n) açıklama metinleri */
export interface PurchaseTexts {
  /** Stok hareketi nedeni, ör. "Alış faturası" */
  stockReason: string;
  /** Cari hareket açıklaması (alış), ör. "Alış: FTR-001" */
  ledgerPurchase: string;
  /** Peşin alışta otomatik ödeme açıklaması */
  ledgerCashPayment: string;
}

export interface SupplierPaymentInput {
  amount: number;
  method: SupplierPaymentMethod;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly net = inject(NetworkService);
  private readonly logger = inject(LoggerService);

  // ------------------------------------------------------------------ okuma

  /** Belge tarihine göre [start, end] aralığındaki alışlar (yeni önce). İndeks: purchases(tenantId, documentDate desc). */
  getRange$(start: Date, end: Date): Observable<Purchase[]> {
    return this.live<Purchase>(PURCHASES,
      where('tenantId', '==', this.auth.currentTenantId()),
      where('documentDate', '>=', Timestamp.fromDate(start)),
      where('documentDate', '<=', Timestamp.fromDate(end)),
      orderBy('documentDate', 'desc'),
    );
  }

  /** Tedarikçinin alışları. İndeks: purchases(tenantId, supplierId, documentDate desc). */
  getBySupplier$(supplierId: string): Observable<Purchase[]> {
    return this.live<Purchase>(PURCHASES,
      where('tenantId', '==', this.auth.currentTenantId()),
      where('supplierId', '==', supplierId),
      orderBy('documentDate', 'desc'),
    );
  }

  getById$(id: string): Observable<Purchase | null> {
    return new Observable<Purchase | null>(observer => {
      const unsub = onSnapshot(
        doc(this.firestore, PURCHASES, id),
        snap => observer.next(snap.exists() ? ({ id: snap.id, ...snap.data({ serverTimestamps: 'estimate' }) } as Purchase) : null),
        err => observer.error(err),
      );
      return () => unsub();
    });
  }

  /** Tedarikçi cari hareketleri (yeni önce). İndeks: supplierTransactions(tenantId, supplierId, createdAt desc). */
  getSupplierTransactions$(supplierId: string): Observable<SupplierTransaction[]> {
    return this.live<SupplierTransaction>(SUPPLIER_TX,
      where('tenantId', '==', this.auth.currentTenantId()),
      where('supplierId', '==', supplierId),
      orderBy('createdAt', 'desc'),
    );
  }

  /**
   * Rapor katkısı: [start, end] aralığında toplam alış (belge tarihine göre, iptaller hariç),
   * aynı aralıkta tedarikçilere yapılan ödemeler (ters kayıtlar düşülmüş) ve
   * şu anki toplam tedarikçi borcu (pozitif bakiyeler toplamı).
   */
  async summary(start: Date, end: Date): Promise<PurchaseSummary> {
    const tenantId = this.auth.currentTenantId();
    const [purchases, txs, suppliers] = await Promise.all([
      getDocs(query(collection(this.firestore, PURCHASES),
        where('tenantId', '==', tenantId),
        where('documentDate', '>=', Timestamp.fromDate(start)),
        where('documentDate', '<=', Timestamp.fromDate(end)),
        orderBy('documentDate', 'desc'))),
      getDocs(query(collection(this.firestore, SUPPLIER_TX),
        where('tenantId', '==', tenantId),
        where('createdAt', '>=', Timestamp.fromDate(start)),
        where('createdAt', '<=', Timestamp.fromDate(end)),
        orderBy('createdAt', 'desc'))),
      getDocs(query(collection(this.firestore, SUPPLIERS), where('tenantId', '==', tenantId))),
    ]);
    return summarize(
      purchases.docs.map(d => d.data() as Purchase),
      txs.docs.map(d => d.data() as SupplierTransaction),
      suppliers.docs.map(d => (d.data() as Supplier).isActive === false ? 0 : (d.data() as Supplier).balance),
    );
  }

  // ------------------------------------------------------------------ yazma

  /**
   * Alış belgesini kaydeder — tek transaction:
   *  ürün stokları + partiler (adjustStock kurallarıyla), stockMovements 'in' (reference = alış id),
   *  opsiyonel purchasePrice güncellemesi, alış belgesi, tedarikçi cari (alış borcu; peşinse ödeme de) ve bakiye.
   * Ürün/tedarikçi belgeleri transaction içinde güncel okunur (bayat stok/bakiye yazılmaz). Çevrimiçi olmalı.
   * @returns yeni alış belgesi kimliği
   */
  async create(input: PurchaseInput, texts: PurchaseTexts): Promise<string> {
    if (!this.net.isOnline()) throw new PurchaseError('offline');
    if (!input.supplierId) throw new PurchaseError('no-supplier');
    const lines = input.lines.map(l => ({ ...l, gtsNumbers: cleanGts(l.gtsNumbers) }));
    if (lines.length === 0) throw new PurchaseError('no-items');
    if (lines.length > MAX_PURCHASE_LINES) throw new PurchaseError('too-many-items');
    for (const l of lines) {
      const err = validateLine(l);
      if (err) throw new PurchaseError(err);
    }

    const tenantId = this.auth.currentTenantId();
    const uid = this.auth.currentUserId();
    const totals = calcTotals(lines, input.discount);
    const purchaseRef = doc(collection(this.firestore, PURCHASES));
    const supplierRef = doc(this.firestore, SUPPLIERS, input.supplierId);
    const productIds = [...new Set(lines.map(l => l.productId))];

    await runTransaction(this.firestore, async tx => {
      // 1) Okumalar (transaction kuralı: tüm okumalar yazmalardan önce)
      const supplierSnap = await tx.get(supplierRef);
      if (!supplierSnap.exists()) throw new PurchaseError('supplier-not-found');
      const supplier = { id: supplierSnap.id, ...supplierSnap.data() } as Supplier;
      const products = new Map<string, Product>();
      for (const id of productIds) {
        const snap = await tx.get(doc(this.firestore, PRODUCTS, id));
        if (!snap.exists()) throw new PurchaseError('product-not-found', id);
        products.set(id, { id: snap.id, ...snap.data() } as Product);
      }

      // 2) Stok hesapları (aynı ürün birden çok satırda olabilir → sıralı uygula)
      const addedAt = Timestamp.now();
      const items: PurchaseItem[] = [];
      const lastCost = new Map<string, number>();
      for (const line of lines) {
        const product = products.get(line.productId)!;
        const expiryTs = line.expiryDate ? Timestamp.fromDate(line.expiryDate) : null;
        const res = applyPurchaseItem(product, { quantity: line.quantity, expiryDate: expiryTs, gtsNumbers: line.gtsNumbers, lotNo: line.lotNo ?? null }, supplier.id, addedAt);
        const calc = calcLine(line);
        this.addMovement(tx, {
          productId: product.id, productName: product.name, type: 'in', quantity: res.quantity,
          previousStock: Number(product.stock) || 0, newStock: res.stock, reason: texts.stockReason, reference: purchaseRef.id,
        });
        products.set(product.id, { ...product, stock: res.stock, batches: res.batches, expiryDate: res.expiryDate });
        lastCost.set(product.id, roundKurus(line.unitCost));
        items.push({
          productId: product.id, productName: product.name, barcode: product.barcode || null, unit: productUnit(product),
          quantity: res.quantity, unitCost: roundKurus(line.unitCost), vatRate: Number(line.vatRate) || 0,
          expiryDate: expiryTs, gtsNumbers: line.gtsNumbers, lineSubtotal: calc.lineSubtotal, lineVat: calc.lineVat,
          batchIds: res.batchIds,
          ...(normalizeLotNo(line.lotNo) ? { lotNo: normalizeLotNo(line.lotNo) } : {}),
        });
      }

      // 3) Ürün yazmaları
      for (const p of products.values()) {
        const update: Record<string, unknown> = {
          stock: p.stock, batches: p.batches, expiryDate: p.expiryDate, updatedAt: serverTimestamp(),
        };
        if (input.updatePurchasePrice && lastCost.has(p.id)) update['purchasePrice'] = lastCost.get(p.id);
        tx.update(doc(this.firestore, PRODUCTS, p.id), update);
      }

      // 4) Alış belgesi
      const purchase: Omit<Purchase, 'id'> = {
        tenantId, supplierId: supplier.id, supplierName: supplier.name,
        docType: input.docType, documentNo: input.documentNo.trim(),
        documentDate: Timestamp.fromDate(input.documentDate),
        items, ...totals,
        paymentType: input.paymentType,
        paymentMethod: input.paymentType === 'cash' ? (input.paymentMethod ?? 'cash') : null,
        dueDate: input.paymentType === 'credit' && input.dueDate ? Timestamp.fromDate(input.dueDate) : null,
        updatedPurchasePrice: input.updatePurchasePrice,
        notes: input.notes?.trim() || null,
        status: 'active', cancelledAt: null, cancelledBy: null, cancelReason: null,
        createdAt: serverTimestamp() as unknown as Timestamp, createdBy: uid,
      };
      tx.set(purchaseRef, purchase);

      // 5) Tedarikçi cari
      let balance = roundKurus(supplier.balance ?? 0);
      let paid = 0;
      balance = this.addLedger(tx, supplier, balance, 'purchase', totals.grandTotal, purchaseRef.id, texts.ledgerPurchase, null);
      if (input.paymentType === 'cash' && totals.grandTotal > 0) {
        balance = this.addLedger(tx, supplier, balance, 'payment', totals.grandTotal, purchaseRef.id,
          texts.ledgerCashPayment, input.paymentMethod ?? 'cash');
        paid = totals.grandTotal;
      }
      tx.update(supplierRef, {
        balance,
        totalPurchased: roundKurus((supplier.totalPurchased ?? 0) + totals.grandTotal),
        totalPaid: roundKurus((supplier.totalPaid ?? 0) + paid),
        updatedAt: serverTimestamp(),
      });
    });
    return purchaseRef.id;
  }

  /**
   * Alış iptali — tek transaction: stok geri düşer (önce bu alışın partileri, sonra FEFO),
   * stockMovements 'out' (reference = alış id), cari ters kayıtlar (isReversal, negatif tutar), belge 'cancelled'.
   * @returns partilerin/stoğun karşılayamadığı toplam miktar (mal satılmışsa > 0; stok 0'da sabitlenir)
   */
  async cancel(purchaseId: string, reason: string, stockReason: string, ledgerText: string): Promise<{ shortfall: number }> {
    if (!this.net.isOnline()) throw new PurchaseError('offline');
    const uid = this.auth.currentUserId();
    const purchaseRef = doc(this.firestore, PURCHASES, purchaseId);
    let shortfall = 0;

    await runTransaction(this.firestore, async tx => {
      const pSnap = await tx.get(purchaseRef);
      if (!pSnap.exists()) throw new PurchaseError('product-not-found', purchaseId);
      const purchase = { id: pSnap.id, ...pSnap.data() } as Purchase;
      if (purchase.status === 'cancelled') throw new PurchaseError('already-cancelled');
      const supplierRef = doc(this.firestore, SUPPLIERS, purchase.supplierId);
      const sSnap = await tx.get(supplierRef);
      const products = new Map<string, Product>();
      for (const id of new Set(purchase.items.map(i => i.productId))) {
        const snap = await tx.get(doc(this.firestore, PRODUCTS, id));
        if (snap.exists()) products.set(id, { id: snap.id, ...snap.data() } as Product);
      }

      shortfall = 0;
      for (const item of purchase.items) {
        const product = products.get(item.productId);
        if (!product) { shortfall = roundQty(shortfall + item.quantity); continue; }
        const r = revertPurchaseItem(product, item);
        shortfall = roundQty(shortfall + r.shortfall);
        if (r.removed > 0) {
          this.addMovement(tx, {
            productId: product.id, productName: product.name, type: 'out', quantity: r.removed,
            previousStock: Number(product.stock) || 0, newStock: r.stock, reason: stockReason, reference: purchase.id,
          });
        }
        products.set(product.id, { ...product, stock: r.stock, batches: r.batches, expiryDate: r.expiryDate });
      }
      for (const p of products.values()) {
        tx.update(doc(this.firestore, PRODUCTS, p.id), {
          stock: p.stock, batches: p.batches, expiryDate: p.expiryDate, updatedAt: serverTimestamp(),
        });
      }

      if (sSnap.exists()) {
        const supplier = { id: sSnap.id, ...sSnap.data() } as Supplier;
        let balance = roundKurus(supplier.balance ?? 0);
        balance = this.addLedger(tx, supplier, balance, 'purchase', -purchase.grandTotal, purchase.id, ledgerText, null, true);
        let paidBack = 0;
        if (purchase.paymentType === 'cash' && purchase.grandTotal > 0) {
          balance = this.addLedger(tx, supplier, balance, 'payment', -purchase.grandTotal, purchase.id, ledgerText,
            purchase.paymentMethod ?? 'cash', true);
          paidBack = purchase.grandTotal;
        }
        tx.update(supplierRef, {
          balance,
          totalPurchased: roundKurus((supplier.totalPurchased ?? 0) - purchase.grandTotal),
          totalPaid: roundKurus((supplier.totalPaid ?? 0) - paidBack),
          updatedAt: serverTimestamp(),
        });
      }

      tx.update(purchaseRef, {
        status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: uid, cancelReason: reason.trim() || null,
      });
    });
    return { shortfall };
  }

  /**
   * Tedarikçiye ödeme. Bakiye transaction içinde güncel okunur. Fazla ödemeye izin verilir
   * (bakiye negatife düşer = tedarikçide alacak / avans).
   * @returns işlem sonrası bakiye
   */
  async recordPayment(supplierId: string, input: SupplierPaymentInput): Promise<number> {
    if (!this.net.isOnline()) throw new PurchaseError('offline');
    const amount = roundKurus(input.amount);
    if (!(amount > 0)) throw new PurchaseError('invalid-amount');
    const supplierRef = doc(this.firestore, SUPPLIERS, supplierId);
    return runTransaction(this.firestore, async tx => {
      const snap = await tx.get(supplierRef);
      if (!snap.exists()) throw new PurchaseError('supplier-not-found');
      const supplier = { id: snap.id, ...snap.data() } as Supplier;
      const balance = this.addLedger(tx, supplier, roundKurus(supplier.balance ?? 0), 'payment', amount, null,
        input.description.trim(), input.method);
      tx.update(supplierRef, {
        balance,
        totalPaid: roundKurus((supplier.totalPaid ?? 0) + amount),
        updatedAt: serverTimestamp(),
      });
      return balance;
    });
  }

  // ------------------------------------------------------------------ yardımcılar

  private addLedger(
    tx: Transaction, supplier: Supplier, current: number, type: SupplierTransactionType, amount: number,
    purchaseId: string | null, description: string, method: SupplierPaymentMethod | null, isReversal = false,
  ): number {
    const balance = nextSupplierBalance(current, type, amount);
    const ref = doc(collection(this.firestore, SUPPLIER_TX));
    const entry: Omit<SupplierTransaction, 'id'> = {
      tenantId: this.auth.currentTenantId(),
      supplierId: supplier.id,
      supplierName: supplier.name,
      type, amount: roundKurus(amount), balance, purchaseId, description, paymentMethod: method,
      ...(isReversal ? { isReversal: true } : {}),
      createdAt: serverTimestamp() as unknown as Timestamp,
      createdBy: this.auth.currentUserId(),
    };
    tx.set(ref, entry);
    return balance;
  }

  private addMovement(tx: Transaction, m: {
    productId: string; productName: string; type: 'in' | 'out'; quantity: number;
    previousStock: number; newStock: number; reason: string; reference: string | null;
  }): void {
    const ref: DocumentReference = doc(this.firestore, MOVEMENTS, crypto.randomUUID());
    tx.set(ref, {
      ...m,
      tenantId: this.auth.currentTenantId(),
      createdBy: this.auth.currentUserId(),
      createdAt: serverTimestamp(),
    });
  }

  private live<T>(col: string, ...constraints: QueryConstraint[]): Observable<T[]> {
    return new Observable<T[]>(observer => {
      const unsub = onSnapshot(
        query(collection(this.firestore, col), ...constraints),
        snap => observer.next(snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as T))),
        err => { this.logger.error(`${col} listener error`, err); observer.error(err); },
      );
      return () => unsub();
    });
  }
}
