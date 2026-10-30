import { Timestamp } from '@angular/fire/firestore';
import type { ProductUnit } from './product.model';

export type PurchaseDocType = 'invoice' | 'waybill';
/** cash = peşin (kayıtta ödendi), credit = vadeli (tedarikçi cari borcu) */
export type PurchasePaymentType = 'cash' | 'credit';
export type PurchaseStatus = 'active' | 'cancelled';

export interface PurchaseItem {
  productId: string;
  productName: string;
  barcode: string | null;
  unit: ProductUnit;
  quantity: number;
  /** KDV hariç birim alış fiyatı */
  unitCost: number;
  /** KDV oranı (%) */
  vatRate: number;
  expiryDate: Timestamp | null;
  gtsNumbers: string[];
  /** quantity × unitCost (KDV hariç, iskonto öncesi) */
  lineSubtotal: number;
  /** Satırın KDV'si (iskonto öncesi) */
  lineVat: number;
  /** Bu alışla ürüne eklenen parti kimlikleri (iptalde önce bunlar düşülür) */
  batchIds: string[];
}

export interface Purchase {
  id: string;
  tenantId: string;
  supplierId: string;
  supplierName: string;
  docType: PurchaseDocType;
  documentNo: string;
  documentDate: Timestamp;
  items: PurchaseItem[];
  /** Σ lineSubtotal */
  subtotal: number;
  /** Belge altı iskonto (KDV hariç tutardan düşülür) */
  discount: number;
  /** İskonto sonrası KDV toplamı */
  vatTotal: number;
  /** subtotal − discount + vatTotal */
  grandTotal: number;
  paymentType: PurchasePaymentType;
  paymentMethod: 'cash' | 'card' | 'transfer' | null;
  dueDate: Timestamp | null;
  /** Ürün kartındaki alış fiyatı bu belgeyle güncellendi mi */
  updatedPurchasePrice: boolean;
  notes: string | null;
  status: PurchaseStatus;
  cancelledAt?: Timestamp | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
  createdAt: Timestamp | null;
  createdBy: string;
}
