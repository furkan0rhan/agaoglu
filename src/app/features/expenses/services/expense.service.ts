import { inject, Injectable } from '@angular/core';
import { Timestamp, orderBy, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/services/auth.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { Expense } from '../../../shared/models/expense.model';

const COL = 'expenses';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly fs = inject(FirestoreService);
  private readonly auth = inject(AuthService);

  getAll$(): Observable<Expense[]> {
    return this.fs.query$<Expense>(
      COL,
      where('tenantId', '==', this.auth.currentTenantId()),
      orderBy('date', 'desc')
    );
  }

  async create(data: { title: string; amount: number; category: string; date: Date; note?: string }): Promise<void> {
    const expense: Omit<Expense, 'id'> = {
      tenantId: this.auth.currentTenantId(),
      title: data.title,
      amount: data.amount,
      category: data.category,
      date: Timestamp.fromDate(data.date),
      note: data.note ?? '',
      createdBy: this.auth.currentUserId(),
    } as any;
    await firstValueFrom(this.fs.add<Expense>(COL, expense as any));
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.fs.delete(COL, id));
  }
}
