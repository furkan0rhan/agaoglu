import { inject, Injectable } from '@angular/core';
import { Firestore, collection, doc, getDocs, onSnapshot, orderBy, query, Timestamp, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/services/auth.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { Sale } from '../../../shared/models/sale.model';
import { CreditTransaction, Installment } from '../../../shared/models/credit.model';

@Injectable({ providedIn: 'root' })
export class SalesQueryService {
  private readonly fs = inject(FirestoreService);
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  /** [start, end] aralığındaki satışlar, en yeni önce. İndeks: (tenantId, createdAt desc). */
  getRange$(start: Date, end: Date): Observable<Sale[]> {
    return this.fs.query$<Sale>(
      'sales',
      where('tenantId', '==', this.auth.currentTenantId()),
      where('createdAt', '>=', Timestamp.fromDate(start)),
      where('createdAt', '<=', Timestamp.fromDate(end)),
      orderBy('createdAt', 'desc'),
    );
  }

  /** Tek satış — canlı (iptal sonrası durum anında güncellenir). */
  getById$(id: string): Observable<Sale | null> {
    return new Observable<Sale | null>(observer => {
      const unsub = onSnapshot(
        doc(this.firestore, 'sales', id),
        { includeMetadataChanges: false },
        snap => observer.next(snap.exists() ? ({ id: snap.id, ...snap.data({ serverTimestamps: 'estimate' }) } as Sale) : null),
        err => observer.error(err),
      );
      return () => unsub();
    });
  }

  /**
   * Satışın veresiye borç kaydındaki taksit planı (fiş yeniden basımı). Yoksa / okunamazsa null.
   * Sorgu tenantId + saleId eşitlikleri (tek alan indeksleri yeter).
   */
  async getCreditPlan(saleId: string): Promise<Installment[] | null> {
    const snap = await getDocs(query(
      collection(this.firestore, 'creditTransactions'),
      where('tenantId', '==', this.auth.currentTenantId()),
      where('saleId', '==', saleId),
    ));
    const tx = snap.docs
      .map(d => d.data() as CreditTransaction)
      .find(t => t.type === 'debt' && !t.isReversal && (t.installments?.length ?? 0) > 0);
    return tx?.installments ?? null;
  }
}
