/**
 * Tasarım v2 ana sayfa (dashboard) metinleri. translations.ts içinde `home` anahtarıyla bağlanır.
 */
export interface HomeTexts {
  todayRevenue: string;
  salesPart: string;
  interestPart: string;
  vsYesterday: string;
  saleCount: (n: number) => string;
  cash: string;
  card: string;
  credit: string;
  grossProfit: string;
  margin: (pct: string) => string;
  overdueTitle: string;
  overdueCustomers: (n: number) => string;
  overdueNone: string;
  attentionTitle: string;
  alertsUnit: string;
  criticalStock: (n: number) => string;
  expiring: (n: number) => string;
  allClear: string;
  trendTitle: string;
  trendMeta: string;
  periodLabel: (days: number) => string;
  periodTotal: (days: number) => string;
  dailyAvg: string;
  bestDay: string;
  today: string;
  soFar: string;
  quickTitle: string;
  addExpense: string;
  purchase: string;
  stockCount: string;
  colTime: string;
  colCustomer: string;
  colReceipt: string;
  colPayment: string;
  colAmount: string;
  stockAlertsTitle: string;
  goProducts: string;
  stockShort: (stock: number, min: number) => string;
  outOfStock: string;
  critical: string;
  backupTitle: string;
  backupDesc: string;
  backupAction: string;
  licenseAction: string;
}

export const HOME_TR: HomeTexts = {
  todayRevenue: 'Bugünkü ciro',
  salesPart: 'Satış',
  interestPart: 'Vade farkı',
  vsYesterday: 'düne göre',
  saleCount: n => `${n} satış`,
  cash: 'Nakit',
  card: 'Kart',
  credit: 'Veresiye',
  grossProfit: 'Bugünkü brüt kâr',
  margin: p => `Kâr marjı %${p}`,
  overdueTitle: 'Gecikmiş alacak',
  overdueCustomers: n => `${n} müşteri gecikmede`,
  overdueNone: 'Vadesi geçen borç yok',
  attentionTitle: 'Dikkat gerekenler',
  alertsUnit: 'uyarı',
  criticalStock: n => `${n} kritik stok`,
  expiring: n => `${n} SKT yaklaşıyor`,
  allClear: 'Her şey yolunda',
  trendTitle: 'Satış trendi',
  trendMeta: 'Günlük ciro, ₺',
  periodLabel: d => `${d}G`,
  periodTotal: d => `${d} gün toplam`,
  dailyAvg: 'Günlük ortalama',
  bestDay: 'En iyi gün',
  today: 'Bugün',
  soFar: '(şu ana kadar)',
  quickTitle: 'Hızlı işlemler',
  addExpense: 'Gider ekle',
  purchase: 'Mal alımı',
  stockCount: 'Stok sayımı',
  colTime: 'Saat',
  colCustomer: 'Müşteri',
  colReceipt: 'Fiş',
  colPayment: 'Ödeme',
  colAmount: 'Tutar',
  stockAlertsTitle: 'Kritik stok & SKT',
  goProducts: 'Ürünlere git',
  stockShort: (s, m) => `Stok ${s} · en az ${m}`,
  outOfStock: 'Tükendi',
  critical: 'Kritik',
  backupTitle: 'Yedek hatırlatması',
  backupDesc: 'Son 7 günde yedek alınmadı. Verilerinizi korumak için şimdi yedek alın.',
  backupAction: 'Yedek al',
  licenseAction: 'Lisans ayrıntıları',
};

export const HOME_EN: HomeTexts = {
  todayRevenue: "Today's revenue",
  salesPart: 'Sales',
  interestPart: 'Interest',
  vsYesterday: 'vs yesterday',
  saleCount: n => `${n} sale(s)`,
  cash: 'Cash',
  card: 'Card',
  credit: 'Credit',
  grossProfit: "Today's gross profit",
  margin: p => `Margin ${p}%`,
  overdueTitle: 'Overdue receivables',
  overdueCustomers: n => `${n} customer(s) overdue`,
  overdueNone: 'No overdue debt',
  attentionTitle: 'Needs attention',
  alertsUnit: 'alerts',
  criticalStock: n => `${n} critical stock`,
  expiring: n => `${n} expiring soon`,
  allClear: 'All good',
  trendTitle: 'Sales trend',
  trendMeta: 'Daily revenue, ₺',
  periodLabel: d => `${d}D`,
  periodTotal: d => `${d}-day total`,
  dailyAvg: 'Daily average',
  bestDay: 'Best day',
  today: 'Today',
  soFar: '(so far)',
  quickTitle: 'Quick actions',
  addExpense: 'Add expense',
  purchase: 'Purchase',
  stockCount: 'Stock count',
  colTime: 'Time',
  colCustomer: 'Customer',
  colReceipt: 'Receipt',
  colPayment: 'Payment',
  colAmount: 'Amount',
  stockAlertsTitle: 'Critical stock & expiry',
  goProducts: 'Go to products',
  stockShort: (s, m) => `Stock ${s} · min ${m}`,
  outOfStock: 'Out of stock',
  critical: 'Critical',
  backupTitle: 'Backup reminder',
  backupDesc: 'No backup in the last 7 days. Take a backup now to protect your data.',
  backupAction: 'Back up',
  licenseAction: 'License details',
};
