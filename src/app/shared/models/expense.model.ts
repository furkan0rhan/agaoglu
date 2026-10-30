import { Timestamp } from '@angular/fire/firestore';

export interface Expense {
  id: string;
  tenantId: string;
  title: string;
  amount: number;
  category: string;
  date: Timestamp;
  note?: string;
  /** Tekrarlayan gider serisinin ortak kimliği; tekil giderde yok/null. */
  recurringId?: string | null;
  createdAt: Timestamp;
  createdBy: string;
}

export const EXPENSE_CATEGORIES: readonly string[] = [
  'Kira', 'Elektrik', 'Su', 'Doğalgaz', 'İnternet',
  'Personel', 'Nakliye', 'Bakım & Onarım', 'Vergi', 'Diğer',
];
