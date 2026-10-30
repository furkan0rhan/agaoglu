import { Timestamp } from '@angular/fire/firestore';

export type PaymentMethod = 'cash' | 'card' | 'credit' | 'mixed';
export type SaleStatus = 'completed' | 'cancelled' | 'refunded';
export type DiscountType = 'percent' | 'amount';

/** Satış birimi (ürünün `unit` alanı). Yoksa 'adet' kabul edilir. */
export type SaleUnit = 'adet' | 'kg' | 'lt' | 'paket' | 'cuval' | 'metre' | 'viyol' | 'kasa' | 'demet' | 'sise';
export const SALE_UNITS: readonly SaleUnit[] = ['adet', 'kg', 'lt', 'paket', 'cuval', 'metre', 'viyol', 'kasa', 'demet', 'sise'];
/** Ondalıklı miktara (2 hane) izin verilen birimler; diğerleri tam sayı. */
export const DECIMAL_UNITS: readonly SaleUnit[] = ['kg', 'lt', 'metre'];

/** Satışta bir kalemden düşülen parti (iptal/iadede geri yüklemek için). */
export interface SaleItemBatch {
  batchId: string;
  quantity: number;
  gtsNo: string | null;
  /** Partinin parti / şarj no'su (AI 10). Eski satışlarda yoktur. */
  lotNo?: string | null;
  expiryDate: Timestamp | null;
}

export interface SaleItem {
  productId: string;
  productName: string;
  barcode: string;
  /** kg / lt / metre birimlerinde ondalıklı olabilir (3 haneye yuvarlı). */
  quantity: number;
  /** Satış anındaki birim. Eski satışlarda yoktur (= adet). */
  unit?: SaleUnit | null;
  unitPrice: number;
  discount: number;
  discountType: DiscountType;
  /** Kalem indirimi düşülmüş satır toplamı (kuruşa yuvarlı). */
  totalPrice: number;
  /**
   * Satış anındaki NET (KDV hariç) birim alış fiyatı — kâr hesabı için.
   * (Alış fiyatı KDV dahil işaretli ürünlerde KDV düşülmüş hali; bkz. shared/utils/pricing.ts.)
   */
  costPrice?: number | null;
  /** Satış anındaki KDV oranı (%; ürünün vatRate'i, yoksa null). Eski satışlarda yoktur → raporda ürünün güncel oranı (tahmini). */
  vatRate?: number | null;
  /** FEFO ile düşülen partiler. Eski satışlarda yoktur. */
  batches?: SaleItemBatch[];
  /**
   * Satılan birimlerin GTS / karekod numaraları (okutulan + FEFO ile seçilen).
   * Sepette: okutularak eklenen GTS'ler (satışta önce bunlar düşülür).
   */
  gtsNos?: string[];
  /** Satılan partilerin parti / şarj no'ları (tekrarsız). Yalnız parti no bilinen partilerden. */
  lotNos?: string[];
  /** Satış anında ürün e-reçeteli miydi? */
  requiresPrescription?: boolean;
  /** E-reçete numarası (reçeteli kalemlerde). */
  prescriptionNo?: string | null;
  /** Satış anındaki ruhsat no (denetim kaydı için). */
  licenseNo?: string | null;
}

export interface Sale {
  id: string;
  tenantId: string;
  saleNumber: string;
  customerId: string | null;
  customerName: string | null;
  items: SaleItem[];
  subtotal: number;
  /** Kalem indirimleri + genel indirim. */
  totalDiscount: number;
  /** Genel (sepet) indirimi girdi değeri. */
  globalDiscount?: number;
  globalDiscountType?: DiscountType;
  /** Genel indirimin TL karşılığı. */
  globalDiscountAmount?: number;
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
  /** Veresiyeye yazılan borç: vade farkı varsa veresiye + vade farkı (raporda vade farkı = bu − creditAmount). */
  totalWithInterest: number | null;
  /** Veresiye vadesi (son taksit tarihi). Eski satışlarda yok. */
  creditDueDate?: Timestamp | Date | null;
  /** Veresiye satışta alınan peşinat (nakit olarak `cashPaid` içinde). */
  downPayment?: number | null;
  /** Taksit aralığı (ay). Fiş yeniden basımında plan buna göre türetilir. Eski satışlarda yok (= 1). */
  installmentIntervalMonths?: number | null;
  createdAt: Timestamp;
  createdBy: string;
  cancelledAt: Timestamp | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
  // ---- Mevzuat (reçeteli satış kaydı; 5 yıl saklanır) ----
  /** Sepette e-reçeteli ürün var mıydı? (Reçeteli satışlar filtresi) */
  hasPrescriptionItems?: boolean;
  /** E-reçete numarası. */
  prescriptionNo?: string | null;
  /** Reçeteyi yazan (opsiyonel). */
  prescriberName?: string | null;
  /** Reçeteli satışta müşterinin TC kimlik no'su (satış anındaki). */
  customerTcNo?: string | null;
  /** Reçeteli satışta müşterinin ÇKS / kayıt no'su (satış anındaki). */
  customerCksNo?: string | null;
}

/** Sepet kalemi — yalnızca istemcide; satış dokümanına _tempId ve stock yazılmaz. */
export interface CartItem extends SaleItem {
  _tempId: string;
  stock: number;
}

/** Fiş / satış sonrası özet için gereken alanlar (Firestore'dan bağımsız). */
export interface SaleReceipt {
  saleNumber: string;
  date: Date;
  customerName: string | null;
  items: (Pick<SaleItem, 'productName' | 'quantity' | 'unit' | 'unitPrice' | 'discount' | 'discountType' | 'totalPrice'>
    & Partial<Pick<SaleItem, 'gtsNos' | 'lotNos' | 'licenseNo' | 'vatRate'>>)[];
  /** E-reçete numarası (reçeteli satışta). */
  prescriptionNo?: string | null;
  subtotal: number;
  totalDiscount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  cashPaid: number;
  cardPaid: number;
  creditAmount: number;
  change: number;
  totalWithInterest: number | null;
  installmentCount: number | null;
  /** Veresiye vadesi ve peşinat (POS özeti / fiş). */
  dueDate?: Date | null;
  downPayment?: number | null;
  /** Taksit planı (fişte listelenir). */
  installments?: { no: number; dueDate: Date; amount: number }[] | null;
  /** Y11: 'payment' = veresiye tahsilat makbuzu (kalemsiz; `payment` alanı dolu). Varsayılan satış fişi. */
  kind?: 'sale' | 'payment';
  payment?: PaymentReceiptInfo | null;
}

/** Y11: tahsilat makbuzu bilgileri. */
export interface PaymentReceiptInfo {
  amount: number;
  method: 'cash' | 'card' | 'transfer';
  previousBalance: number;
  newBalance: number;
  note?: string | null;
}
