import { inject, Injectable } from '@angular/core';
import { Firestore, collection, query, where, orderBy, getDocs, limit } from '@angular/fire/firestore';
import { AuthService } from '../../../core/auth/services/auth.service';
import { Sale } from '../../../shared/models/sale.model';
import { CreditTransaction } from '../../../shared/models/credit.model';
import { Expense } from '../../../shared/models/expense.model';
import { DateRange } from '../../../shared/utils/date-range.util';
import { isCompletedSale } from './report-calc';
import { SaleCancelLog } from './cancellations';

/**
 * Rapor/dashboard için tarih aralıklı Firestore okumaları.
 * Gerekli indeksler: sales(tenantId ASC, createdAt DESC), creditTransactions(tenantId ASC, createdAt DESC),
 * expenses(tenantId ASC, date DESC).
 */
@Injectable({ providedIn: 'root' })
export class ReportDataService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  /** Aralıktaki tamamlanmış satışlar (yeniden eskiye). Status süzmesi istemcide (ek indeks gerekmesin). */
  async getSales(range: DateRange): Promise<Sale[]> {
    return (await this.getSalesSplit(range)).completed;
  }

  /** Aynı okuma: tamamlanan + iptal edilen satışlar ayrı (İptaller raporu). */
  async getSalesSplit(range: DateRange): Promise<{ completed: Sale[]; cancelled: Sale[] }> {
    const snap = await getDocs(query(
      collection(this.firestore, 'sales'),
      where('tenantId', '==', this.auth.currentTenantId()),
      where('createdAt', '>=', range.start),
      where('createdAt', '<=', range.end),
      orderBy('createdAt', 'desc'),
    ));
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
    return { completed: all.filter(isCompletedSale), cancelled: all.filter(s => s.status === 'cancelled') };
  }

  /**
   * Aralıkta yapılan satış iptallerinin denetim kayıtları (kurallar: yalnız yönetici okur).
   * Mevcut indeks auditLogs(tenantId ASC, createdAt DESC); action süzmesi istemcide (ek indeks / deploy gerekmesin).
   */
  async getCancelLogs(range: DateRange, max = 500): Promise<SaleCancelLog[]> {
    const snap = await getDocs(query(
      collection(this.firestore, 'auditLogs'),
      where('tenantId', '==', this.auth.currentTenantId()),
      where('createdAt', '>=', range.start),
      where('createdAt', '<=', range.end),
      orderBy('createdAt', 'desc'),
      limit(max),
    ));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as SaleCancelLog))
      .filter(l => l.action === 'sale_cancel');
  }

  /** İşletme kullanıcılarının adları (uid → ad, yoksa e-posta). Kurallar: yalnız yönetici listeler. */
  async getUserNames(): Promise<Map<string, string>> {
    const snap = await getDocs(query(collection(this.firestore, 'users'), where('tenantId', '==', this.auth.currentTenantId())));
    return new Map(snap.docs.map(d => {
      const x = d.data();
      return [d.id, String(x['displayName'] || x['email'] || '')] as [string, string];
    }));
  }

  /** Aralıktaki veresiye tahsilatları (type == 'payment'; tip süzmesi istemcide). */
  async getCollections(range: DateRange): Promise<CreditTransaction[]> {
    const snap = await getDocs(query(
      collection(this.firestore, 'creditTransactions'),
      where('tenantId', '==', this.auth.currentTenantId()),
      where('createdAt', '>=', range.start),
      where('createdAt', '<=', range.end),
      orderBy('createdAt', 'desc'),
    ));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as CreditTransaction))
      .filter(t => t.type === 'payment');
  }

  /** Aralıktaki giderler (gider tarihi `date` alanına göre; ileri tarihli tekrarlı giderler dahil edilmez). */
  async getExpenses(range: DateRange): Promise<Expense[]> {
    const snap = await getDocs(query(
      collection(this.firestore, 'expenses'),
      where('tenantId', '==', this.auth.currentTenantId()),
      where('date', '>=', range.start),
      where('date', '<=', range.end),
      orderBy('date', 'desc'),
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
  }
}
