import { inject, Injectable } from '@angular/core';
import { Firestore, doc, onSnapshot, orderBy, Timestamp, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/services/auth.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { Sale } from '../../../shared/models/sale.model';

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
}
