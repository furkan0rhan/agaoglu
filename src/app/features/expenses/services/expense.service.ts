import { inject, Injectable } from '@angular/core';
import { Firestore, Timestamp, doc, setDoc, writeBatch, serverTimestamp, orderBy, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/services/auth.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { NetworkService } from '../../../core/offline/network.service';
import { LoggerService } from '../../../core/logging/logger.service';
import { Expense } from '../../../shared/models/expense.model';
import { addMonthsClamped } from '../../../shared/utils/date-range.util';

const COL = 'expenses';

export interface ExpenseInput {
  title: string;
  amount: number;
  category: string;
  date: Date;
  note?: string;
}

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly fs = inject(FirestoreService);
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly net = inject(NetworkService);
  private readonly logger = inject(LoggerService);

  getAll$(): Observable<Expense[]> {
    return this.fs.query$<Expense>(
      COL,
      where('tenantId', '==', this.auth.currentTenantId()),
      orderBy('date', 'desc')
    );
  }

  async create(data: ExpenseInput): Promise<void> {
    const ref = doc(this.fs.col(COL));
    await this.write(setDoc(ref, this.toDoc(data, null)), 'create');
  }

  /**
   * Aylık tekrarlayan gider: `count` adet belge tek writeBatch ile atomik yazılır.
   * Tüm belgeler aynı `recurringId`'yi taşır. Gün, ayın son gününe kırpılır (31 → 28/30).
   */
  async createRecurring(data: ExpenseInput, count = 12): Promise<string> {
    const batch = writeBatch(this.firestore);
    const recurringId = doc(this.fs.col(COL)).id;
    const day = data.date.getDate();
    for (let i = 0; i < count; i++) {
      const ref = doc(this.fs.col(COL));
      batch.set(ref, this.toDoc({ ...data, date: addMonthsClamped(data.date, i, day) }, recurringId));
    }
    await this.write(batch.commit(), 'createRecurring');
    return recurringId;
  }

  async delete(id: string): Promise<void> {
    await this.deleteMany([id]);
  }

  /** Birden çok gideri (ör. tekrarlayan serinin tamamı) tek batch ile siler. */
  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const batch = writeBatch(this.firestore);
    for (const id of ids) batch.delete(doc(this.firestore, COL, id));
    await this.write(batch.commit(), 'deleteMany');
  }

  private toDoc(data: ExpenseInput, recurringId: string | null) {
    return {
      tenantId: this.auth.currentTenantId(),
      title: data.title,
      amount: Math.round(data.amount * 100) / 100,
      category: data.category,
      date: Timestamp.fromDate(data.date),
      note: data.note ?? '',
      recurringId,
      createdBy: this.auth.currentUserId(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  }

  /** Online ise sunucu onayını bekler; offline ise yazmayı yerel kuyruğa bırakıp hemen döner. */
  private async write(p: Promise<unknown>, op: string): Promise<void> {
    if (this.net.isOnline()) { await p; return; }
    p.catch(err => this.logger.error(`expense ${op} (offline) failed`, err));
  }
}
