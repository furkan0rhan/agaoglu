import { Timestamp } from '@angular/fire/firestore';

/** KVKK açık rıza kaydı: ne zaman ve hangi aydınlatma metni sürümüyle verildi. */
export interface ConsentRecord {
  at: Timestamp;
  version: string;
}

/**
 * Müşterinin KVKK rızaları. `null` = verilmedi ya da geri alındı.
 * - processing: kişisel verilerin (TC no dahil) işlenmesi
 * - contact: borç/vade hatırlatması için telefonla (WhatsApp/SMS) iletişim
 */
export interface CustomerConsents {
  processing: ConsentRecord | null;
  contact: ConsentRecord | null;
}

export interface Customer {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  tcNo: string | null;
  /** Anonimleştirilmiş müşteride null. */
  phone: string | null;
  email: string | null;
  address: string | null;
  /** Köy / mahalle (opsiyonel). */
  village?: string | null;
  /** ÇKS (Çiftçi Kayıt Sistemi) kayıt no (opsiyonel; reçeteli satış dökümünde kullanılır). */
  cksNo?: string | null;
  /** Veresiye limiti (TL). null/undefined = limitsiz. */
  creditLimit?: number | null;
  /** KVKK rızaları (eski kayıtlarda yok). */
  consents?: CustomerConsents | null;
  /** Kişisel verileri anonimleştirildiyse zamanı. */
  anonymizedAt?: Timestamp | null;
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
