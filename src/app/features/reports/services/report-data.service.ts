import { inject, Injectable } from '@angular/core';
import { Firestore, collection, query, where, orderBy, getDocs } from '@angular/fire/firestore';
import { AuthService } from '../../../core/auth/services/auth.service';
import { Sale } from '../../../shared/models/sale.model';
import { CreditTransaction } from '../../../shared/models/credit.model';
import { Expense } from '../../../shared/models/expense.model';
import { DateRange } from '../../../shared/utils/date-range.util';
import { isCompletedSale } from './report-calc';

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
    const snap = await getDocs(query(
      collection(this.firestore, 'sales'),
      where('tenantId', '==', this.auth.currentTenantId()),
      where('createdAt', '>=', range.start),
      where('createdAt', '<=', range.end),
      orderBy('createdAt', 'desc'),
    ));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Sale))
      .filter(isCompletedSale);
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
