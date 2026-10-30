import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { TenantSettingsService } from '../../../core/settings/tenant-settings.service';
import {
  Firestore, collection, doc, query, where, orderBy, onSnapshot, writeBatch, runTransaction,
  serverTimestamp, increment,
} from '@angular/fire/firestore';
import { Observable, catchError, combineLatest, map, of, shareReplay } from 'rxjs';
import { AuthService } from '../../../core/auth/services/auth.service';
import { NetworkService } from '../../../core/offline/network.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { Customer } from '../../../shared/models/customer.model';
import { CreditTransaction } from '../../../shared/models/credit.model';
import { CustomerService } from '../../customers/services/customer.service';
import {
  AgingRow, CreditLimitCheck, CreditStatus, InstallmentPlan, OverdueSummary, agingOf, buildInstallmentPlan, buildSchedule,
  checkCreditLimit, creditStatus, roundKurus, summarizeOverdue,
} from './credit.utils';

export { roundKurus } from './credit.utils';

const TX_COL = 'creditTransactions';
const CUSTOMER_COL = 'customers';

export class OverpaymentError extends Error {
  constructor(readonly balance: number) { super('OVERPAYMENT'); }
}

export interface PaymentInput {
  amount: number;
  method: 'cash' | 'card' | 'transfer';
  description: string;
}

export interface PaymentResult {
  /** İşlem sonrası müşteri bakiyesi. */
  balance: number;
  /** true ise yazma çevrimdışı kuyruğa bırakıldı, sunucu onayı beklenmedi. */
  offline: boolean;
}

/** Müşteri + hesaplanmış vade durumu (veresiye listesi ve dashboard için). */
export interface CustomerCreditStatus extends CreditStatus {
  customer: Customer;
}

@Injectable({ providedIn: 'root' })
export class CreditService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly net = inject(NetworkService);
  private readonly logger = inject(LoggerService);
  private readonly customers = inject(CustomerService);
  private readonly settings = inject(TenantSettingsService);
  private readonly creditSettings$ = toObservable(this.settings.credit);

  /**
   * POS veresiye dialogu için taksit planı (saf, statik; servis enjekte etmeden çağrılabilir).
   * Borç kaydına yazılacaklar: `amount = plan.financed`, `dueDate = plan.dueDate`,
   * `installments = plan.installments` (JS Date'ler Firestore'da Timestamp olur), `downPayment = plan.downPayment`.
   * Kuruş farkı son taksitte; tarihler ilk vadeden `intervalMonths` ay arayla.
   */
  static buildInstallmentPlan(
    total: number, count: number, firstDueDate: Date, downPayment = 0, intervalMonths = 1,
  ): InstallmentPlan {
    return buildInstallmentPlan(total, count, firstDueDate, downPayment, intervalMonths);
  }

  /** Müşteri veresiye limiti kontrolü (statik). `exceeded` ise POS uyarı göstermeli; engelleme kararı kullanıcıda. */
  static checkCreditLimit(customer: Pick<Customer, 'balance' | 'creditLimit'>, additionalDebt: number): CreditLimitCheck {
    return checkCreditLimit(customer.balance ?? 0, customer.creditLimit ?? null, additionalDebt);
  }

  /**
   * İşletmenin tüm borç kayıtları (iptaller dahil, tahsilatlar hariç).
   * Yalnızca eşitlik filtresi → bileşik indeks gerekmez.
   */
  private debts$(): Observable<CreditTransaction[]> {
    return new Observable<CreditTransaction[]>(observer => {
      const q = query(
        collection(this.firestore, TX_COL),
        where('tenantId', '==', this.auth.currentTenantId()),
        where('type', '==', 'debt'),
      );
      const unsub = onSnapshot(
        q,
        snap => observer.next(snap.docs.map(d =>
          ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as CreditTransaction))),
        err => { this.logger.error('debts listener error', err); observer.error(err); },
      );
      return () => unsub();
    });
  }

  /**
   * Borçlu müşterilerin vade durumu (gecikmiş tutar, gecikme günü, bu hafta vadesi gelen, sıradaki vade).
   * Tahsilatlar taksitlere en eski vadeden başlayarak dağıtılmış kabul edilir (bkz. buildSchedule).
   */
  statusByCustomer$(): Observable<Map<string, CustomerCreditStatus>> {
    // Borç sorgusu başarısız olursa (kural/indeks) liste yine bakiyelerle çalışır; vade bilgisi boş kalır
    this.settings.ensureLoaded();
    return combineLatest([
      this.customers.getAll$(),
      this.debts$().pipe(catchError(() => of([] as CreditTransaction[]))),
      this.creditSettings$,
    ]).pipe(
      map(([customers, debts, cs]) => {
        const byCustomer = new Map<string, CreditTransaction[]>();
        for (const tx of debts) {
          const list = byCustomer.get(tx.customerId);
          if (list) list.push(tx); else byCustomer.set(tx.customerId, [tx]);
        }
        const now = new Date();
        const out = new Map<string, CustomerCreditStatus>();
        for (const c of customers) {
          if (!(roundKurus(c.balance ?? 0) > 0)) continue;
          // Y7: vadesiz borçlar Ayarlar → Veresiye "varsayılan vade" ile gecikmeye düşer
          const st = creditStatus(buildSchedule(byCustomer.get(c.id) ?? [], c.balance, { defaultDueDays: cs.defaultDueDays }), now);
          out.set(c.id, { ...st, customer: c });
        }
        return out;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  /**
   * 5.7 Yaşlandırma raporu: borçlu (bakiye > 0) müşterilerin bakiyesi vade dilimlerine dağıtılmış (bkz. agingOf).
   * Borç sorgusu hatası raporda gizlenmez (yanlış "vadesi gelmemiş" göstermemek için) — çağıran ele alır.
   */
  agingByCustomer$(today = new Date()): Observable<{ customer: Customer; aging: AgingRow }[]> {
    this.settings.ensureLoaded();
    return combineLatest([this.customers.getAll$(), this.debts$(), this.creditSettings$]).pipe(
      map(([customers, debts, cs]) => {
        const byCustomer = new Map<string, CreditTransaction[]>();
        for (const tx of debts) {
          const list = byCustomer.get(tx.customerId);
          if (list) list.push(tx); else byCustomer.set(tx.customerId, [tx]);
        }
        return customers
          .filter(c => roundKurus(c.balance ?? 0) > 0)
          .map(c => ({
            customer: c,
            aging: agingOf(buildSchedule(byCustomer.get(c.id) ?? [], c.balance, { defaultDueDays: cs.defaultDueDays }), c.balance, today),
          }));
      }),
    );
  }

  /** Vade takvimi seçenekleri (Y7: varsayılan vade). Bileşenler buildSchedule'a bunu verir. */
  scheduleOptions(): { defaultDueDays: number } {
    this.settings.ensureLoaded();
    return { defaultDueDays: this.settings.credit().defaultDueDays };
  }

  /** Dashboard: toplam gecikmiş alacak ve gecikmiş borcu olan müşteri sayısı. */
  overdueSummary$(): Observable<OverdueSummary> {
    return this.statusByCustomer$().pipe(map(m => summarizeOverdue(m.values())));
  }

  /** Tek müşterinin vade durumu (müşteri / veresiye detay). */
  customerStatus(customer: Customer, txs: CreditTransaction[], today = new Date()): CreditStatus & { schedule: ReturnType<typeof buildSchedule> } {
    const schedule = buildSchedule(txs, customer.balance ?? 0, this.scheduleOptions());
    return { ...creditStatus(schedule, today), schedule };
  }

  /**
   * Bir müşterinin cari hareketleri (yeniden eskiye).
   * İndeks: creditTransactions (tenantId ASC, customerId ASC, createdAt DESC).
   */
  getByCustomer$(customerId: string): Observable<CreditTransaction[]> {
    return new Observable<CreditTransaction[]>(observer => {
      const q = query(
        collection(this.firestore, TX_COL),
        where('tenantId', '==', this.auth.currentTenantId()),
        where('customerId', '==', customerId),
        orderBy('createdAt', 'desc'),
      );
      const unsub = onSnapshot(
        q,
        snap => observer.next(snap.docs.map(d =>
          ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as CreditTransaction))),
        err => { this.logger.error('creditTransactions listener error', err); observer.error(err); },
      );
      return () => unsub();
    });
  }

  /**
   * Tahsilat kaydı. `balance` alanı = işlem sonrası müşteri bakiyesi.
   * - Online: runTransaction ile güncel bakiye okunur, aşırı ödeme reddedilir (OverpaymentError).
   * - Offline: writeBatch + increment(-amount); commit beklenmeden döner (UI kilitlenmez).
   */
  async recordPayment(customer: Customer, input: PaymentInput): Promise<PaymentResult> {
    const amount = roundKurus(input.amount);
    if (!(amount > 0)) throw new Error('INVALID_AMOUNT');

    const customerRef = doc(this.firestore, CUSTOMER_COL, customer.id);
    const txRef = doc(collection(this.firestore, TX_COL));
    const base = {
      tenantId: this.auth.currentTenantId(),
      customerId: customer.id,
      customerName: `${customer.firstName} ${customer.lastName}`,
      saleId: null,
      type: 'payment' as const,
      amount,
      description: input.description,
      paymentMethod: input.method,
      originalAmount: null,
      interestRate: null,
      installmentCount: null,
      installmentAmount: null,
      createdAt: serverTimestamp(),
      createdBy: this.auth.currentUserId(),
    };
    const customerUpdate = {
      totalPaid: increment(amount),
      balance: increment(-amount),
      updatedAt: serverTimestamp(),
    };

    if (this.net.isOnline()) {
      const balance = await runTransaction(this.firestore, async tx => {
        const snap = await tx.get(customerRef);
        if (!snap.exists()) throw new Error('CUSTOMER_NOT_FOUND');
        const current = roundKurus(Number(snap.data()['balance'] ?? 0));
        if (amount > current) throw new OverpaymentError(current);
        const after = roundKurus(current - amount);
        tx.set(txRef, { ...base, balance: after });
        tx.update(customerRef, customerUpdate);
        return after;
      });
      return { balance, offline: false };
    }

    // Offline: eldeki bakiyeye göre doğrula; bakiye sunucuda increment ile güncellenir.
    const current = roundKurus(customer.balance ?? 0);
    if (amount > current) throw new OverpaymentError(current);
    const after = roundKurus(current - amount);
    const batch = writeBatch(this.firestore);
    batch.set(txRef, { ...base, balance: after });
    batch.update(customerRef, customerUpdate);
    batch.commit().catch(err => this.logger.error('credit payment (offline) commit failed', err));
    return { balance: after, offline: true };
  }
}
