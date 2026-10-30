import { Injectable, inject } from '@angular/core';
import {
  Firestore, doc, setDoc, updateDoc, onSnapshot, runTransaction, serverTimestamp, orderBy, where,
  collection, getDocs, query,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/services/auth.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { NetworkService } from '../../../core/offline/network.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { Customer, CreateCustomerDto } from '../../../shared/models/customer.model';
import { anonymizePatch } from './customer.utils';

const COL = 'customers';

/** Müşterinin dışa aktarılan tüm verisi (KVKK m.11 bilgi talebi). */
export interface CustomerDataExport {
  exportedAt: string;
  customer: Record<string, unknown>;
  creditTransactions: Record<string, unknown>[];
  sales: Record<string, unknown>[];
}

/** Bakiyesi olan müşteri silinmek istendiğinde fırlatılır. */
export class CustomerHasBalanceError extends Error {
  constructor() { super('CUSTOMER_HAS_BALANCE'); }
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly fs = inject(FirestoreService);
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly net = inject(NetworkService);
  private readonly logger = inject(LoggerService);

  getAll$(): Observable<Customer[]> {
    return this.fs.query$<Customer>(
      COL,
      where('tenantId', '==', this.auth.currentTenantId()),
      where('isActive', '==', true),
      orderBy('firstName')
    );
  }

  /** Arşivlenmiş (soft delete) müşteriler. */
  getArchived$(): Observable<Customer[]> {
    return this.fs.query$<Customer>(
      COL,
      where('tenantId', '==', this.auth.currentTenantId()),
      where('isActive', '==', false),
      orderBy('firstName')
    );
  }

  getById$(id: string): Observable<Customer | null> {
    return this.fs.getById<Customer>(COL, id);
  }

  /** Müşteri belgesini canlı izler (bakiye başka terminalde değişirse güncellenir). */
  watch$(id: string): Observable<Customer | null> {
    return new Observable<Customer | null>(observer => {
      const unsub = onSnapshot(
        doc(this.firestore, COL, id),
        snap => observer.next(snap.exists()
          ? ({ id: snap.id, ...snap.data({ serverTimestamps: 'estimate' }) } as Customer)
          : null),
        err => { this.logger.error('customer watch error', id, err); observer.error(err); },
      );
      return () => unsub();
    });
  }

  async create(dto: CreateCustomerDto): Promise<string> {
    const ref = doc(this.fs.col(COL));
    await this.write(setDoc(ref, {
      ...dto,
      tenantId: this.auth.currentTenantId(),
      totalDebt: 0,
      totalPaid: 0,
      balance: 0,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }), 'create');
    return ref.id;
  }

  async update(id: string, changes: Partial<Customer>): Promise<void> {
    const { id: _id, tenantId: _t, createdAt: _c, ...rest } = changes;
    await this.write(updateDoc(doc(this.firestore, COL, id), { ...rest, updatedAt: serverTimestamp() }), 'update');
  }

  /**
   * Soft delete (arşivleme). Bakiyesi > 0 olan müşteri silinemez.
   * Online iken güncel bakiye transaction içinde okunur; offline iken eldeki bakiyeye bakılır.
   */
  async delete(customer: Customer): Promise<void> {
    if ((customer.balance ?? 0) > 0.004) throw new CustomerHasBalanceError();
    const ref = doc(this.firestore, COL, customer.id);
    if (this.net.isOnline()) {
      await runTransaction(this.firestore, async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        if ((snap.data()['balance'] ?? 0) > 0.004) throw new CustomerHasBalanceError();
        tx.update(ref, { isActive: false, updatedAt: serverTimestamp() });
      });
      return;
    }
    await this.write(updateDoc(ref, { isActive: false, updatedAt: serverTimestamp() }), 'delete');
  }

  /**
   * KVKK: kişisel verileri anonimleştirir (yalnızca borcu 0 iken; online gerekir).
   * Ad soyad "Silinmiş Müşteri #xxxx", TC/telefon/e-posta/adres/ÇKS/not silinir, müşteri arşivlenir.
   * Satış ve cari kayıtları muhasebe için kalır (bu kayıtlardaki `customerName` kopyası kurallar gereği
   * değiştirilemez; bkz. rapor).
   */
  async anonymize(customer: Customer): Promise<void> {
    if ((customer.balance ?? 0) > 0.004 || (customer.balance ?? 0) < -0.004) throw new CustomerHasBalanceError();
    if (!this.net.isOnline()) throw new Error('OFFLINE');
    const ref = doc(this.firestore, COL, customer.id);
    await runTransaction(this.firestore, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('CUSTOMER_NOT_FOUND');
      const bal = Number(snap.data()['balance'] ?? 0);
      if (Math.abs(bal) > 0.004) throw new CustomerHasBalanceError();
      tx.update(ref, { ...anonymizePatch(customer.id), anonymizedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    });
  }

  /** KVKK: müşterinin kayıtlı tüm verisini toplar (müşteri belgesi + cari hareketler + satışlar). */
  async collectData(customer: Customer): Promise<CustomerDataExport> {
    const tenantId = this.auth.currentTenantId();
    const byCustomer = (col: string) => getDocs(query(
      collection(this.firestore, col),
      where('tenantId', '==', tenantId),
      where('customerId', '==', customer.id),
    ));
    const [txSnap, saleSnap] = await Promise.all([byCustomer('creditTransactions'), byCustomer('sales')]);
    const plain = (v: unknown): unknown => {
      if (v && typeof v === 'object') {
        const o = v as { toDate?: () => Date };
        if (typeof o.toDate === 'function') return o.toDate().toISOString();
        if (Array.isArray(v)) return v.map(plain);
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
      }
      return v;
    };
    const rows = (snap: Awaited<ReturnType<typeof getDocs>>) => snap.docs
      .map(d => plain({ id: d.id, ...(d.data() as object) }) as Record<string, unknown>)
      .sort((a, b) => String(a['createdAt'] ?? '').localeCompare(String(b['createdAt'] ?? '')));
    return {
      exportedAt: new Date().toISOString(),
      customer: plain(customer) as Record<string, unknown>,
      creditTransactions: rows(txSnap),
      sales: rows(saleSnap),
    };
  }

  /** Arşivlenmiş müşteriyi geri alır. */
  async restore(id: string): Promise<void> {
    await this.write(updateDoc(doc(this.firestore, COL, id), { isActive: true, updatedAt: serverTimestamp() }), 'restore');
  }

  /** Online ise sunucu onayını bekler; offline ise yazmayı yerel kuyruğa bırakıp hemen döner. */
  private async write(p: Promise<unknown>, op: string): Promise<void> {
    if (this.net.isOnline()) { await p; return; }
    p.catch(err => this.logger.error(`customer ${op} (offline) failed`, err));
  }
}
