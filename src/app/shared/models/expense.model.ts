import { Timestamp } from '@angular/fire/firestore';

export interface Expense {
  id: string;
  tenantId: string;
  title: string;
  amount: number;
  category: string;
  date: Timestamp;
  note?: string;
  createdAt: Timestamp;
  createdBy: string;
}

export const EXPENSE_CATEGORIES = [
  'Kira', 'Elektrik', 'Su', 'Doğalgaz', 'İnternet',
  'Personel', 'Nakliye', 'Bakım & Onarım', 'Vergi', 'Diğer',
];
