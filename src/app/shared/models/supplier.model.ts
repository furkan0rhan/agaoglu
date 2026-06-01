import { Timestamp } from '@angular/fire/firestore';

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNo: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateSupplierDto = Omit<Supplier, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;
