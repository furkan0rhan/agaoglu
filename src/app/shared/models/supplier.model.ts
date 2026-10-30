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
  /**
   * Tedarikçiye borcumuz (cari bakiye). Alış +, ödeme −. Eski kayıtlarda alan yok → 0.
   * Negatif = tedarikçide alacağımız var (fazla ödeme / iptal).
   */
  balance?: number;
  /** Toplam alış tutarı (iptaller düşülmüş) */
  totalPurchased?: number;
  /** Toplam ödeme */
  totalPaid?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateSupplierDto = Omit<Supplier, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'balance' | 'totalPurchased' | 'totalPaid'>;

export type SupplierTransactionType = 'purchase' | 'payment';
export type SupplierPaymentMethod = 'cash' | 'card' | 'transfer';

/**
 * Tedarikçi cari hareketi — değişmez defter (update/delete yok).
 * `purchase`: borç artar (+amount). `payment`: borç azalır (−amount).
 * İptal = aynı tipte, negatif tutarlı ters kayıt (`isReversal: true`).
 */
export interface SupplierTransaction {
  id: string;
  tenantId: string;
  supplierId: string;
  supplierName: string;
  type: SupplierTransactionType;
  amount: number;
  /** İşlem sonrası tedarikçi bakiyesi (koşan bakiye) */
  balance: number;
  purchaseId: string | null;
  description: string;
  paymentMethod: SupplierPaymentMethod | null;
  isReversal?: boolean;
  /** Bekleyen serverTimestamp() yerel snapshot'ta null gelebilir */
  createdAt: Timestamp | null;
  createdBy: string;
}
