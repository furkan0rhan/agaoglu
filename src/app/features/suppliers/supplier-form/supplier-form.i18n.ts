import type { Lang } from '../../../core/i18n/translations';
import type { TaxNoStatus } from './tax-no';

/** Tedarikçi formu bölüm başlıkları ve sağ panel (önizleme, vergi no durumu, kontrol listesi) metinleri. */
export interface SupplierFormTexts {
  secCompany: string;
  secContact: string;
  secNotes: string;
  preview: string;
  newSupplier: string;
  noPhone: string;
  checklist: string;
  filled: string;
  required: string;
  ready: string;
  missing: string;
  taxTitle: string;
  tax: Record<TaxNoStatus, string>;
  taxHint: string;
  saveAndPurchase: string;
  sections: string;
}

const TR: SupplierFormTexts = {
  secCompany: 'Firma bilgileri',
  secContact: 'İletişim ve adres',
  secNotes: 'Notlar',
  preview: 'Önizleme',
  newSupplier: 'Yeni tedarikçi',
  noPhone: 'Telefon girilmedi',
  checklist: 'Kontrol listesi',
  filled: 'alan dolu',
  required: 'zorunlu',
  ready: 'Hazır',
  missing: 'Eksik / hatalı',
  taxTitle: 'Vergi no',
  tax: {
    empty: 'Girilmedi',
    vkn: 'VKN geçerli',
    tckn: 'TCKN geçerli (şahıs firması)',
    length: '10 (VKN) ya da 11 (TCKN) hane olmalı',
    checksum: 'Kontrol hanesi tutmuyor',
  },
  taxHint: 'Kaydı engellemez; faturadaki numarayla karşılaştırın.',
  saveAndPurchase: 'Kaydet ve alış gir',
  sections: 'Bölümler',
};

const EN: SupplierFormTexts = {
  secCompany: 'Company',
  secContact: 'Contact and address',
  secNotes: 'Notes',
  preview: 'Preview',
  newSupplier: 'New supplier',
  noPhone: 'No phone yet',
  checklist: 'Checklist',
  filled: 'fields filled',
  required: 'required',
  ready: 'Ready',
  missing: 'Needs attention',
  taxTitle: 'Tax no',
  tax: {
    empty: 'Not entered',
    vkn: 'Tax ID valid',
    tckn: 'National ID valid (sole trader)',
    length: 'Must be 10 (tax ID) or 11 (national ID) digits',
    checksum: 'Check digit mismatch',
  },
  taxHint: 'Does not block saving; compare with the invoice.',
  saveAndPurchase: 'Save and enter purchase',
  sections: 'Sections',
};

export const SUPPLIER_FORM_TEXTS: Record<Lang, SupplierFormTexts> = { tr: TR, en: EN };
