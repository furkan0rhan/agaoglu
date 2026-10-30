import type { Lang } from '../i18n/translations';

/**
 * Lisans + destek modu şeritlerinin metinleri. translations.ts paylaşımlı olduğu için
 * bu modülün metinleri burada tutulur (LangService.lang() ile seçilir).
 */
export interface LicenseTexts {
  expiredTitle: string;
  suspendedTitle: string;
  readOnlyDesc: string;
  contact: string;
  warning: (days: number) => string;
  trialWarning: (days: number) => string;
  details: string;
  pageTitle: string;
  plan: string;
  expires: string;
  unlimited: string;
  backHome: string;
  supportMode: string;
  supportExit: string;
  supportHint: string;
  planNames: Record<string, string>;
  stateActive: string;
  stateWarning: string;
  daysLeft: string;
}

const TR: LicenseTexts = {
  expiredTitle: 'Lisansınız sona erdi',
  suspendedTitle: 'Hesabınız askıya alındı',
  readOnlyDesc: 'Uygulama salt okunur modda: kayıtlarınızı görebilirsiniz ancak satış, ürün ekleme gibi işlemler yapılamaz.',
  contact: 'Destek',
  warning: d => `Lisansınızın bitmesine ${d} gün kaldı.`,
  trialWarning: d => `Deneme sürenizin bitmesine ${d} gün kaldı.`,
  details: 'Ayrıntılar',
  pageTitle: 'Lisans durumu',
  plan: 'Plan',
  expires: 'Bitiş',
  unlimited: 'Süresiz',
  backHome: 'Ana sayfaya dön',
  supportMode: 'Destek modu',
  supportExit: 'Çık',
  supportHint: 'Bu işletmenin verisini destek amacıyla görüntülüyorsunuz. Tüm oturumlar kayıt altındadır.',
  planNames: { trial: 'Deneme', basic: 'Temel', pro: 'Pro' },
  stateActive: 'Etkin',
  stateWarning: 'Bitişe az kaldı',
  daysLeft: 'Kalan gün',
};

const EN: LicenseTexts = {
  expiredTitle: 'Your license has expired',
  suspendedTitle: 'Your account is suspended',
  readOnlyDesc: 'The app is in read-only mode: you can view your records but cannot make sales or add products.',
  contact: 'Support',
  warning: d => `Your license expires in ${d} day(s).`,
  trialWarning: d => `Your trial ends in ${d} day(s).`,
  details: 'Details',
  pageTitle: 'License status',
  plan: 'Plan',
  expires: 'Expires',
  unlimited: 'Unlimited',
  backHome: 'Back to home',
  supportMode: 'Support mode',
  supportExit: 'Exit',
  supportHint: 'You are viewing this business for support purposes. All sessions are logged.',
  planNames: { trial: 'Trial', basic: 'Basic', pro: 'Pro' },
  stateActive: 'Active',
  stateWarning: 'Expiring soon',
  daysLeft: 'Days left',
};

export const LICENSE_TEXTS: Record<Lang, LicenseTexts> = { tr: TR, en: EN };
