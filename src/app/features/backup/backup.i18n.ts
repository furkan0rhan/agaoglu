/**
 * Yedekleme metinleri. `Translations.backup` olarak translations.ts'e bağlıdır
 * (dosya çakışmalarını azaltmak için metinler modülün yanında tutulur).
 */
export interface BackupTexts {
  title: string; subtitle: string;
  downloadTitle: string; downloadDesc: string; downloadZip: string; downloadExcel: string;
  preparing: string; downloaded: string; downloadFailed: string;
  lastBackup: string; never: string; overdue: string; overdueShort: string; upToDate: string; adminOnlyNote: string;
  restoreTitle: string; restoreDesc: string; chooseFile: string; preview: string; records: string; total: string;
  exportedAt: string; sourceBusiness: string; restoreBtn: string; restoreConfirm: string; restoreConfirmTitle: string;
  restoring: string; restored: string; restoreFailed: string; restorePartial: string;
  notEmpty: string; invalidFile: string; checking: string; quotaNote: string; clear: string;
  collections: {
    products: string; customers: string; sales: string; creditTransactions: string; stockMovements: string;
    expenses: string; suppliers: string; supplierTransactions: string; purchases: string;
  };
}

export const BACKUP_TR: BackupTexts = {
  title: 'Yedekleme ve Dışa Aktarma', subtitle: 'İşletme verilerinizin kopyasını indirin veya yedekten geri yükleyin',
  downloadTitle: 'Tüm verimi indir',
  downloadDesc: 'Ürünler, müşteriler, satışlar, veresiye, stok hareketleri, giderler, tedarikçiler ve alışlar tek dosyada.',
  downloadZip: 'JSON yedeği (.zip)', downloadExcel: 'Excel (.xlsx)',
  preparing: 'Veriler okunuyor...', downloaded: 'Yedek indirildi', downloadFailed: 'Yedek alınamadı',
  lastBackup: 'Son yedek', never: 'Hiç alınmadı', overdueShort: 'Yedek gecikti', upToDate: 'Güncel',
  overdue: 'Son yedeğin üzerinden 7 günden fazla geçti. Verilerinizi indirmeniz önerilir.',
  adminOnlyNote: 'Son yedek tarihi yalnızca yönetici hesabıyla kaydedilir.',
  restoreTitle: 'Yedekten geri yükle',
  restoreDesc: 'Yalnızca hiç verisi olmayan (yeni açılmış) bir işletmeye yüklenebilir; mevcut veri asla ezilmez.',
  chooseFile: 'Yedek dosyası seç (.zip / .json)', preview: 'Önizleme', records: 'kayıt', total: 'Toplam',
  exportedAt: 'Yedek tarihi', sourceBusiness: 'Kaynak işletme', restoreBtn: 'Geri Yükle',
  restoreConfirm: '{n} kayıt bu işletmeye yüklenecek. Devam edilsin mi?', restoreConfirmTitle: 'Geri yükleme',
  restoring: 'Yükleniyor: {written} / {total}', restored: 'Geri yükleme tamamlandı: {n} kayıt',
  restoreFailed: 'Geri yükleme başarısız', restorePartial: 'Geri yükleme yarıda kaldı: {written} / {total} kayıt yazıldı.',
  notEmpty: 'Bu işletmede zaten veri var ({list}). Geri yükleme yalnızca boş işletmeye yapılır.',
  invalidFile: 'Geçersiz veya desteklenmeyen yedek dosyası', checking: 'Kontrol ediliyor...',
  quotaNote: 'Ücretsiz Firebase planında günlük yazma sınırı 20.000 kayıttır; daha büyük yedekler için destek alın.',
  clear: 'Temizle',
  collections: {
    products: 'Ürünler', customers: 'Müşteriler', sales: 'Satışlar', creditTransactions: 'Veresiye hareketleri',
    stockMovements: 'Stok hareketleri', expenses: 'Giderler', suppliers: 'Tedarikçiler',
    supplierTransactions: 'Tedarikçi cari', purchases: 'Alışlar',
  },
};

export const BACKUP_EN: BackupTexts = {
  title: 'Backup & Export', subtitle: 'Download a copy of your business data or restore from a backup',
  downloadTitle: 'Download all my data',
  downloadDesc: 'Products, customers, sales, credit, stock movements, expenses, suppliers and purchases in one file.',
  downloadZip: 'JSON backup (.zip)', downloadExcel: 'Excel (.xlsx)',
  preparing: 'Reading data...', downloaded: 'Backup downloaded', downloadFailed: 'Backup failed',
  lastBackup: 'Last backup', never: 'Never', overdueShort: 'Backup overdue', upToDate: 'Up to date',
  overdue: 'Your last backup is more than 7 days old. Downloading your data is recommended.',
  adminOnlyNote: 'The last backup date is only recorded for administrator accounts.',
  restoreTitle: 'Restore from backup',
  restoreDesc: 'Can only be restored into a business with no data (newly created); existing data is never overwritten.',
  chooseFile: 'Choose backup file (.zip / .json)', preview: 'Preview', records: 'records', total: 'Total',
  exportedAt: 'Backup date', sourceBusiness: 'Source business', restoreBtn: 'Restore',
  restoreConfirm: '{n} records will be loaded into this business. Continue?', restoreConfirmTitle: 'Restore',
  restoring: 'Loading: {written} / {total}', restored: 'Restore completed: {n} records',
  restoreFailed: 'Restore failed', restorePartial: 'Restore stopped: {written} / {total} records written.',
  notEmpty: 'This business already has data ({list}). Restore is only allowed into an empty business.',
  invalidFile: 'Invalid or unsupported backup file', checking: 'Checking...',
  quotaNote: 'The free Firebase plan allows 20,000 writes per day; contact support for larger backups.',
  clear: 'Clear',
  collections: {
    products: 'Products', customers: 'Customers', sales: 'Sales', creditTransactions: 'Credit transactions',
    stockMovements: 'Stock movements', expenses: 'Expenses', suppliers: 'Suppliers',
    supplierTransactions: 'Supplier account', purchases: 'Purchases',
  },
};
