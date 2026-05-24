import { Timestamp } from '@angular/fire/firestore';

export type PaymentMethod = 'cash' | 'card' | 'credit' | 'mixed';
export type SaleStatus = 'completed' | 'cancelled' | 'refunded';
export type DiscountType = 'percent' | 'amount';

export interface SaleItem {
  productId: string;
  productName: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: DiscountType;
  totalPrice: number;
}

export interface Sale {
  id: string;
  tenantId: string;
  saleNumber: string;
  customerId: string | null;
  customerName: string | null;
  items: SaleItem[];
  subtotal: number;
  totalDiscount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  cashPaid: number;
  cardPaid: number;
  creditAmount: number;
  change: number;
  status: SaleStatus;
  notes: string | null;
  interestRate: number | null;
  installmentCount: number | null;
  installmentAmount: number | null;
  createdAt: Timestamp;
  createdBy: string;
  cancelledAt: Timestamp | null;
}

export interface CartItem extends SaleItem {
  _tempId: string;
}
