import type { Lang } from '../../core/i18n/translations';
import type { AuditAction } from '../../shared/models/user.model';

/**
 * Yönetim paneli + destek erişim geçmişi metinleri. translations.ts paylaşımlı ve büyük olduğu için
 * bu modülün metinleri burada (LangService.lang() ile seçilir).
 */
export interface AdminTexts {
  title: string;
  subtitle: string;
  overview: string;
  totalTenants: string;
  active: string;
  trial: string;
  expired: string;
  suspended: string;
  activeLast7: string;
  tenants: string;
  search: string;
  allPlans: string;
  allStatuses: string;
  name: string;
  owner: string;
  plan: string;
  expires: string;
  users: string;
  lastActivity: string;
  never: string;
  unlimited: string;
  legacy: string;
  noTenants: string;
  loadFailed: string;
  open: string;
  back: string;
  info: string;
  tenantId: string;
  createdAt: string;
  supportAccess: string;
  supportOn: string;
  supportOff: string;
  openSupport: string;
  supportDisabledMsg: string;
  license: string;
  status: string;
  maxUsers: string;
  extend30: string;
  extend365: string;
  suspend: string;
  activate: string;
  saveLicense: string;
  licenseSaved: string;
  role: string;
  activeUser: string;
  passiveUser: string;
  makePassive: string;
  makeActive: string;
  resetPassword: string;
  resetSent: string;
  userUpdated: string;
  actionFailed: string;
  auditLog: string;
  recentAudit: string;
  noAudit: string;
  logout: string;
  confirmSuspend: string;
  // Destek erişim geçmişi (işletme ayarları)
  accessLogTitle: string;
  accessLogDesc: string;
  accessToggle: string;
  accessToggleHint: string;
  accessSaved: string;
  actions: Record<AuditAction, string>;
  planNames: Record<string, string>;
  statusNames: Record<string, string>;
  roleNames: Record<string, string>;
  // v2 kabuk + detay
  platform: string;
  badge: string;
  navMenu: string;
  navTenants: string;
  backToApp: string;
  daysLeft: (n: number) => string;
  daysOver: (n: number) => string;
  supportConfirmTitle: string;
  supportConfirm: (name: string) => string;
  supportHint: string;
  planSettings: string;
  quickExtend: string;
  noUsers: string;
}

const TR: AdminTexts = {
  title: 'Yönetim Paneli',
  subtitle: 'Tüm işletmeler, lisanslar ve destek erişimi',
  overview: 'Genel bakış',
  totalTenants: 'Toplam işletme',
  active: 'Aktif (ücretli)',
  trial: 'Deneme',
  expired: 'Süresi dolan',
  suspended: 'Askıda',
  activeLast7: 'Son 7 günde aktif',
  tenants: 'İşletmeler',
  search: 'Ad, e-posta veya ID ara',
  allPlans: 'Tüm planlar',
  allStatuses: 'Tüm durumlar',
  name: 'İşletme',
  owner: 'Sahip',
  plan: 'Plan',
  expires: 'Bitiş',
  users: 'Kullanıcı',
  lastActivity: 'Son aktivite',
  never: 'Hiç',
  unlimited: 'Süresiz',
  legacy: 'Eski (lisanssız)',
  noTenants: 'İşletme bulunamadı',
  loadFailed: 'Veriler yüklenemedi. Yetkinizi ve bağlantınızı kontrol edin.',
  open: 'Aç',
  back: 'Geri',
  info: 'İşletme bilgileri',
  tenantId: 'İşletme ID',
  createdAt: 'Kayıt tarihi',
  supportAccess: 'Destek erişimi',
  supportOn: 'Açık',
  supportOff: 'Kapalı (işletme kapattı)',
  openSupport: 'Destek modunda aç',
  supportDisabledMsg: 'İşletme destek erişimini kapatmış. Açmaları için işletme admini ile iletişime geçin.',
  license: 'Lisans',
  status: 'Durum',
  maxUsers: 'Azami kullanıcı',
  extend30: '+30 gün',
  extend365: '+365 gün',
  suspend: 'Askıya al',
  activate: 'Aktifleştir',
  saveLicense: 'Lisansı kaydet',
  licenseSaved: 'Lisans güncellendi',
  role: 'Rol',
  activeUser: 'Aktif',
  passiveUser: 'Pasif',
  makePassive: 'Pasife al',
  makeActive: 'Aktifleştir',
  resetPassword: 'Şifre sıfırlama e-postası',
  resetSent: 'Şifre sıfırlama e-postası gönderildi',
  userUpdated: 'Kullanıcı güncellendi',
  actionFailed: 'İşlem başarısız',
  auditLog: 'Denetim kaydı',
  recentAudit: 'Son işlemler',
  noAudit: 'Kayıt yok',
  logout: 'Çıkış',
  confirmSuspend: 'İşletme askıya alınsın mı? Kullanıcılar salt okunur moda geçer.',
  accessLogTitle: 'Destek erişim geçmişi',
  accessLogDesc: 'Destek ekibinin işletmenize eriştiği oturumlar ve lisans işlemleri',
  accessToggle: 'Destek ekibinin verilerime erişmesine izin ver',
  accessToggleHint: 'Kapatırsanız destek ekibi sorunları çözmek için verilerinizi göremez. Lisans bilgileri her zaman görünür.',
  accessSaved: 'Destek erişimi ayarı kaydedildi',
  actions: {
    support_start: 'Destek oturumu başladı',
    support_end: 'Destek oturumu bitti',
    license_change: 'Lisans değişikliği',
    user_change: 'Kullanıcı değişikliği',
  },
  planNames: { trial: 'Deneme', basic: 'Temel', pro: 'Pro' },
  statusNames: { legacy: 'Eski', ok: 'Aktif', warning: 'Bitiyor', expired: 'Süresi doldu', suspended: 'Askıda' },
  roleNames: { admin: 'Yönetici', cashier: 'Kasiyer', staff: 'Personel' },
  platform: 'Platform Yönetimi',
  badge: 'SUPERADMIN',
  navMenu: 'Yönetim menüsü',
  navTenants: 'İşletmeler',
  backToApp: 'Kendi işletmem',
  daysLeft: n => `${n} gün kaldı`,
  daysOver: n => `${n} gün geçti`,
  supportConfirmTitle: 'Destek modunda açılsın mı?',
  supportConfirm: name => `"${name}" işletmesi yönetici yetkisiyle açılacak. Yaptığınız kayıtlarda sizin hesabınız görünür; oturumun başlangıcı ve bitişi denetim kaydına yazılır ve işletme admini bunu görebilir.`,
  supportHint: 'Oturum denetim kaydına yazılır, işletme admini görebilir.',
  planSettings: 'Plan ve kullanıcı sınırı',
  quickExtend: 'Süreyi uzat',
  noUsers: 'Kullanıcı yok',
};

const EN: AdminTexts = {
  title: 'Admin Panel',
  subtitle: 'All businesses, licenses and support access',
  overview: 'Overview',
  totalTenants: 'Total businesses',
  active: 'Active (paid)',
  trial: 'Trial',
  expired: 'Expired',
  suspended: 'Suspended',
  activeLast7: 'Active in last 7 days',
  tenants: 'Businesses',
  search: 'Search name, e-mail or ID',
  allPlans: 'All plans',
  allStatuses: 'All statuses',
  name: 'Business',
  owner: 'Owner',
  plan: 'Plan',
  expires: 'Expires',
  users: 'Users',
  lastActivity: 'Last activity',
  never: 'Never',
  unlimited: 'Unlimited',
  legacy: 'Legacy (no license)',
  noTenants: 'No businesses found',
  loadFailed: 'Could not load data. Check your permissions and connection.',
  open: 'Open',
  back: 'Back',
  info: 'Business info',
  tenantId: 'Business ID',
  createdAt: 'Registered',
  supportAccess: 'Support access',
  supportOn: 'On',
  supportOff: 'Off (disabled by business)',
  openSupport: 'Open in support mode',
  supportDisabledMsg: 'The business has disabled support access. Ask the business admin to enable it.',
  license: 'License',
  status: 'Status',
  maxUsers: 'Max users',
  extend30: '+30 days',
  extend365: '+365 days',
  suspend: 'Suspend',
  activate: 'Activate',
  saveLicense: 'Save license',
  licenseSaved: 'License updated',
  role: 'Role',
  activeUser: 'Active',
  passiveUser: 'Inactive',
  makePassive: 'Deactivate',
  makeActive: 'Activate',
  resetPassword: 'Password reset e-mail',
  resetSent: 'Password reset e-mail sent',
  userUpdated: 'User updated',
  actionFailed: 'Action failed',
  auditLog: 'Audit log',
  recentAudit: 'Recent actions',
  noAudit: 'No records',
  logout: 'Log out',
  confirmSuspend: 'Suspend this business? Users will be switched to read-only mode.',
  accessLogTitle: 'Support access history',
  accessLogDesc: 'Sessions in which the support team accessed your business, and license actions',
  accessToggle: 'Allow the support team to access my data',
  accessToggleHint: 'If disabled, support cannot see your data to resolve issues. License information is always visible.',
  accessSaved: 'Support access setting saved',
  actions: {
    support_start: 'Support session started',
    support_end: 'Support session ended',
    license_change: 'License change',
    user_change: 'User change',
  },
  planNames: { trial: 'Trial', basic: 'Basic', pro: 'Pro' },
  statusNames: { legacy: 'Legacy', ok: 'Active', warning: 'Expiring', expired: 'Expired', suspended: 'Suspended' },
  roleNames: { admin: 'Admin', cashier: 'Cashier', staff: 'Staff' },
  platform: 'Platform Admin',
  badge: 'SUPERADMIN',
  navMenu: 'Admin menu',
  navTenants: 'Businesses',
  backToApp: 'My business',
  daysLeft: n => `${n} days left`,
  daysOver: n => `${n} days ago`,
  supportConfirmTitle: 'Open in support mode?',
  supportConfirm: name => `"${name}" will be opened with admin rights. Your account is recorded on any changes; the session start and end are written to the audit log and visible to the business admin.`,
  supportHint: 'The session is written to the audit log and visible to the business admin.',
  planSettings: 'Plan and user limit',
  quickExtend: 'Extend',
  noUsers: 'No users',
};

export const ADMIN_TEXTS: Record<Lang, AdminTexts> = { tr: TR, en: EN };
