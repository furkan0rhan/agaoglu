import type { Lang } from '../../../core/i18n/translations';

/** Müşteri formu sağ paneli (önizleme, kontrol listesi, veresiye/KVKK özeti) metinleri. */
export interface CustomerFormTexts {
  preview: string;
  newCustomer: string;
  noPhone: string;
  checklist: string;
  filled: string;
  required: string;
  ready: string;
  missing: string;
  secCreditNotes: string;
  credit: string;
  limit: string;
  unlimited: string;
  defaultDue: string;
  days: string;
  fromSettings: string;
  custom: string;
  kvkk: string;
  processing: string;
  contact: string;
  given: string;
  notGiven: string;
  saveAndSell: string;
  sections: string;
}

const TR: CustomerFormTexts = {
  preview: 'Önizleme',
  newCustomer: 'Yeni müşteri',
  noPhone: 'Telefon girilmedi',
  checklist: 'Kontrol listesi',
  filled: 'alan dolu',
  required: 'zorunlu',
  ready: 'Hazır',
  missing: 'Eksik / hatalı',
  secCreditNotes: 'Veresiye ve not',
  credit: 'Veresiye',
  limit: 'Limit',
  unlimited: 'Limitsiz',
  defaultDue: 'Varsayılan vade',
  days: 'gün',
  fromSettings: 'Ayarlar varsayılanı',
  custom: 'Müşteriye özel',
  kvkk: 'KVKK',
  processing: 'Veri işleme',
  contact: 'İletişim',
  given: 'Verildi',
  notGiven: 'Verilmedi',
  saveAndSell: 'Kaydet ve satış yap',
  sections: 'Bölümler',
};

const EN: CustomerFormTexts = {
  preview: 'Preview',
  newCustomer: 'New customer',
  noPhone: 'No phone yet',
  checklist: 'Checklist',
  filled: 'fields filled',
  required: 'required',
  ready: 'Ready',
  missing: 'Needs attention',
  secCreditNotes: 'Credit and notes',
  credit: 'Credit',
  limit: 'Limit',
  unlimited: 'Unlimited',
  defaultDue: 'Default term',
  days: 'days',
  fromSettings: 'Settings default',
  custom: 'Customer specific',
  kvkk: 'KVKK',
  processing: 'Data processing',
  contact: 'Contact',
  given: 'Given',
  notGiven: 'Not given',
  saveAndSell: 'Save and sell',
  sections: 'Sections',
};

export const CUSTOMER_FORM_TEXTS: Record<Lang, CustomerFormTexts> = { tr: TR, en: EN };
