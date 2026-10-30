import { Timestamp } from '@angular/fire/firestore';

export type CreditTransactionType = 'debt' | 'payment';

/**
 * Veresiye borcunun bir taksiti.
 * `paidAmount` yazıldığı andaki değerdir (yeni kayıtta 0); defter değişmez (kurallar update'e izin vermez),
 * bu yüzden güncel ödenen tutar tahsilatlar en eski vadeden başlayarak dağıtılıp HESAPLANIR:
 * bkz. `features/credit/services/credit.utils.ts` → `buildSchedule()`.
 * Firestore'a JS `Date` yazılabilir; okurken `Timestamp` gelir.
 */
export interface Installment {
  no: number;
  dueDate: Timestamp | Date;
  amount: number;
  paidAmount: number;
}

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
  /** İşlem sonrası müşteri bakiyesi (koşan bakiye). Hem borç hem tahsilat kayıtlarında aynı anlam. */
  balance: number;
  originalAmount: number | null;
  interestRate: number | null;
  installmentCount: number | null;
  installmentAmount: number | null;
  /** Vade (son taksitin tarihi). Eski kayıtlarda yok; yoksa borç vadesiz sayılır (gecikmeye düşmez). */
  dueDate?: Timestamp | Date | null;
  /** Taksit planı (borç kayıtlarında). Yoksa tek taksit = amount, vade = dueDate. */
  installments?: Installment[] | null;
  /** Satışta alınan peşinat (bilgi amaçlı; borç tutarına dahil değil). */
  downPayment?: number | null;
  /** Bekleyen serverTimestamp() yerel snapshot'ta null gelebilir. */
  createdAt: Timestamp | null;
  createdBy: string;
  /** Satış iptalinde yazılan ters kayıt (amount negatif). */
  isReversal?: boolean;
  cancelReason?: string | null;
}
