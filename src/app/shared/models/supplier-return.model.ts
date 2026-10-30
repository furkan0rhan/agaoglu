import { Timestamp } from '@angular/fire/firestore';
import { ProductUnit } from './product.model';

/** Firmaya iade nedeni (11.13). */
export type SupplierReturnReason = 'expired' | 'damaged' | 'recall' | 'other';
export const SUPPLIER_RETURN_REASONS: readonly SupplierReturnReason[] = ['expired', 'damaged', 'recall', 'other'];

/** İade edilen parti / GTS birimi (üründen çıkarıldı; satılmadı). */
export interface SupplierReturnUnit {
  batchId: string;
  quantity: number;
  gtsNo: string | null;
  lotNo: string | null;
  expiryDate: Timestamp | null;
}

/**
 * Firmaya iade (stok çıkışı) — `supplierReturns`. Değişmez kayıt (kurallar: yalnız yönetici oluşturur, düzenleme/silme yok).
 * Aynı transaction'da ürün partilerinden düşülür ve `stockMovements` 'out' (reference = iade id) yazılır.
 * Birimler satış kaydına girmez: GTS / parti no bu kayıtta "iade edildi" olarak kalır.
 */
export interface SupplierReturn {
  id: string;
  tenantId: string;
  productId: string;
  productName: string;
  barcode: string | null;
  unit: ProductUnit;
  licenseNo: string | null;
  supplierId: string;
  supplierName: string;
  reason: SupplierReturnReason;
  /** Açıklama (ops.). */
  note: string | null;
  /** İade tarihi (belge / teslim tarihi). */
  returnDate: Timestamp;
  /** İade faturası / irsaliye no (ops.). */
  documentNo: string | null;
  /** Toplam iade miktarı (Σ units.quantity). */
  quantity: number;
  units: SupplierReturnUnit[];
  gtsNos: string[];
  lotNos: string[];
  /** Kayıt anındaki net (KDV hariç) birim alış fiyatı — bilgi amaçlı (cari etkilenmez). */
  unitCost: number;
  totalCost: number;
  previousStock: number;
  newStock: number;
  createdAt: Timestamp;
  createdBy: string;
}
