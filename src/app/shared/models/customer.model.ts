import { Timestamp } from '@angular/fire/firestore';

export interface Customer {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  tcNo: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  birthDate: Timestamp | null;
  notes: string | null;
  totalDebt: number;
  totalPaid: number;
  balance: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateCustomerDto = Omit<Customer, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'totalDebt' | 'totalPaid' | 'balance'>;
