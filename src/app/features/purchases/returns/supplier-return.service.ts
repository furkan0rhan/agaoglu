import { inject, Injectable } from '@angular/core';
import {
  Firestore, collection, doc, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, where,
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { AuthService } from '../../../core/auth/services/auth.service';
import { NetworkService } from '../../../core/offline/network.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { productUnit } from '../../../shared/models/product.model';
import { Supplier } from '../../../shared/models/supplier.model';
import { SupplierReturn, SupplierReturnReason } from '../../../shared/models/supplier-return.model';
import type { BatchPick } from '../../../shared/utils/batch-pick.utils';
import { productNetCost, roundKurus } from '../../../shared/utils/pricing';
import { ProductService } from '../../products/services/product.service';
import { sortReturns } from './supplier-return.utils';

const RETURNS = 'supplierReturns';
const SUPPLIERS = 'suppliers';

export interface SupplierReturnInput {
  productId: string;
  supplierId: string;
  picks: BatchPick[];
  reason: SupplierReturnReason;
  note: string | null;
  returnDate: Date;
  documentNo: string | null;
}

export type SupplierReturnErrorCode = 'offline' | 'no-supplier' | 'supplier-not-found' | 'no-picks';

export class SupplierReturnError extends Error {
  constructor(readonly code: SupplierReturnErrorCode) {
    super(code);
    this.name = 'SupplierReturnError';
  }
}

/**
 * Firmaya iade (11.13). Tek transaction: tedarikçi okunur → ProductService.removePickedInTx (ürün partileri + stok +
 * stockMovements 'out', reference = iade id) → `supplierReturns` kaydı. Yalnız yönetici (kurallar). Çevrimiçi zorunlu.
 * Tedarikçi carisi değişmez (bedel iadesi / mahsup ayrı ödeme kaydıyla girilir).
 */
@Injectable({ providedIn: 'root' })
export class SupplierReturnService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly net = inject(NetworkService);
  private readonly logger = inject(LoggerService);
  private readonly products = inject(ProductService);

  /** Tüm iadeler (yeni önce). Yalnız tenantId eşitliği: bileşik indeks gerekmez; sıralama istemcide. */
  getAll$(): Observable<SupplierReturn[]> {
    return new Observable<SupplierReturn[]>(observer => {
      const unsub = onSnapshot(
        query(collection(this.firestore, RETURNS), where('tenantId', '==', this.auth.currentTenantId())),
        snap => observer.next(snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as SupplierReturn))),
        err => { this.logger.error('supplierReturns listener error', err); observer.error(err); },
      );
      return () => unsub();
    }).pipe(map(list => sortReturns(list)));
  }

  /** @returns yeni iade kaydının kimliği */
  async create(input: SupplierReturnInput, stockReason: string): Promise<string> {
    if (!this.net.isOnline()) throw new SupplierReturnError('offline');
    if (!input.supplierId) throw new SupplierReturnError('no-supplier');
    if (!input.picks.length) throw new SupplierReturnError('no-picks');
    const ref = doc(collection(this.firestore, RETURNS));
    const supplierRef = doc(this.firestore, SUPPLIERS, input.supplierId);
    const documentNo = input.documentNo?.trim() || null;

    await runTransaction(this.firestore, async tx => {
      // Okumalar yazmalardan önce: tedarikçi, sonra ürün (removePickedInTx okur + yazar)
      const sSnap = await tx.get(supplierRef);
      if (!sSnap.exists()) throw new SupplierReturnError('supplier-not-found');
      const supplier = { id: sSnap.id, ...sSnap.data() } as Supplier;
      const reason = documentNo ? `${stockReason}: ${documentNo}` : stockReason;
      const { product, result } = await this.products.removePickedInTx(tx, input.productId, input.picks, reason, ref.id);
      const unitCost = productNetCost(product);
      const units = result.removed.map(u => ({ ...u }));
      const record: Omit<SupplierReturn, 'id'> = {
        tenantId: this.auth.currentTenantId(),
        productId: product.id, productName: product.name, barcode: product.barcode || null,
        unit: productUnit(product), licenseNo: product.licenseNo ?? null,
        supplierId: supplier.id, supplierName: supplier.name,
        reason: input.reason, note: input.note?.trim() || null,
        returnDate: Timestamp.fromDate(input.returnDate), documentNo,
        quantity: result.quantity, units,
        gtsNos: units.map(u => u.gtsNo).filter((g): g is string => !!g),
        lotNos: [...new Set(units.map(u => u.lotNo).filter((l): l is string => !!l))],
        unitCost, totalCost: roundKurus(unitCost * result.quantity),
        previousStock: Number(product.stock) || 0, newStock: result.newStock,
        createdAt: serverTimestamp() as unknown as Timestamp, createdBy: this.auth.currentUserId(),
      };
      tx.set(ref, record);
    });
    return ref.id;
  }
}
