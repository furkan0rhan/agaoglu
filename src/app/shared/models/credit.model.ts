import { Timestamp } from '@angular/fire/firestore';

export type CreditTransactionType = 'debt' | 'payment';

export interface CreditTransaction {
  id: string;
  tenantId: string;
  customerId: string;
  customerName: string;
  saleId: string | null;
  type: CreditTransactionType;
  amount: number;
  description: string;
  paymentMethod: 'cash' | 'card' | null;
  balance: number;
  originalAmount: number | null;
  interestRate: number | null;
  installmentCount: number | null;
  installmentAmount: number | null;
  createdAt: Timestamp;
  createdBy: string;
}
