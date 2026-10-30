/**
 * Tasarım v2 cari ekranları (müşteri, veresiye, tedarikçi, gider) metinleri.
 * translations.ts içinde `acc` anahtarıyla bağlanır.
 */
export interface AccountTexts {
  // Müşteri başlığı + borç şeridi
  totalDebt: string;
  openInstallments: (n: number) => string;
  noDebt: string;
  overdue: string;
  lateFor: (count: number, days: number) => string;
  noOverdue: string;
  nextDue: string;
  inDays: (days: number) => string;
  noNextDue: string;
  creditLimit: string;
  limitUsed: (pct: number, left: string) => string;
  limitOver: (over: string) => string;
  totalPaid: string;
  totalBorrowed: (v: string) => string;
  sale: string;
  collect: string;
  statement: string;
  remind: string;
  customerCard: string;
  cks: string;
  paymentMethod: string;
  /** Y11: Havale/EFT, hızlı tutar seçimi, tahsilat makbuzu */
  transfer: string;
  transferPayDesc: string;
  pickNext: (v: string) => string;
  pickOverdue: (v: string) => string;
  pickAll: (v: string) => string;
  amountRequired: string;
  paymentDone: string;
  receiptTitle: string;
  prevBalance: string;
  newBalance: string;
  printReceipt: string;
  sendWhatsApp: string;
  receiptWaText: (business: string, customer: string, amount: string, method: string, balance: string) => string;
  // Taksit planı
  planTitle: string;
  planMeta: (open: number, total: number) => string;
  paid: string;
  lateDays: (d: number) => string;
  daysLeft: (d: number) => string;
  instNo: (no: number, count: number) => string;
  harvestDue: string;
  undatedSale: string;
  partial: (paid: string) => string;
  paidHint: string;
  showPaid: (n: number) => string;
  hidePaid: string;
  noPlan: string;
  // Hareketler
  movements: string;
  filterAll: string;
  filterSale: string;
  filterPayment: string;
  balance: (v: string) => string;
  allMovements: string;
  // Veresiye listesi
  dueWeek: string;
  dueWeekHint: (n: number) => string;
  debtorCount: string;
  debtorsTitle: string;
  colCustomer: string;
  colStatus: string;
  colNextDue: string;
  colOverdue: string;
  colDebt: string;
  onTime: string;
  undatedOnly: string;
  // Müşteri listesi / form
  customersTitle: string;
  filterDebtors: string;
  colVillage: string;
  colPhone: string;
  colTc: string;
  colBalance: string;
  customerCount: string;
  receivable: string;
  secIdentity: string;
  secFarm: string;
  secCredit: string;
  // Tedarikçi
  suppliersTitle: string;
  colCompany: string;
  colContact: string;
  colTax: string;
  colOwed: string;
  supplierCount: string;
  owedSuppliers: string;
  lastMove: string;
  noMove: string;
  // Gider
  periodTotal: string;
  topCategory: string;
  byCategory: string;
  expensesTitle: string;
  colDate: string;
  colExpense: string;
  colCategory: string;
  colAmount: string;
  recurringCount: string;
  avgPerRecord: string;
}

export const ACCOUNT_TR: AccountTexts = {
  totalDebt: 'Toplam borç',
  openInstallments: n => `${n} açık taksit`,
  noDebt: 'Borç yok',
  overdue: 'Vadesi geçen',
  lateFor: (c, d) => `${c} taksit · ${d} gündür gecikmede`,
  noOverdue: 'Gecikme yok',
  nextDue: 'Sonraki vade',
  inDays: d => (d === 0 ? 'bugün' : `${d} gün`),
  noNextDue: 'Planlı vade yok',
  creditLimit: 'Kredi limiti',
  limitUsed: (p, left) => `%${p} kullanıldı · ${left} kaldı`,
  limitOver: over => `Limit aşıldı · +${over}`,
  totalPaid: 'Toplam ödenen',
  totalBorrowed: v => `Toplam borçlanma ${v}`,
  sale: 'Satış Yap',
  collect: 'Tahsilat Al',
  statement: 'Ekstre PDF',
  remind: 'Hatırlat',
  customerCard: 'Müşteri kartı',
  cks: 'ÇKS',
  paymentMethod: 'Ödeme yöntemi',
  transfer: 'Havale/EFT',
  transferPayDesc: 'Havale/EFT ile ödeme',
  pickNext: v => `Sıradaki taksit (${v})`,
  pickOverdue: v => `Gecikmiş (${v})`,
  pickAll: v => `Tüm borç (${v})`,
  amountRequired: 'Tahsil edilen tutarı yazın',
  paymentDone: 'Tahsilat kaydedildi',
  receiptTitle: 'Tahsilat makbuzu',
  prevBalance: 'Önceki borç',
  newBalance: 'Kalan borç',
  printReceipt: 'Makbuz yazdır',
  sendWhatsApp: "WhatsApp'la gönder",
  receiptWaText: (business, customer, amount, method, balance) =>
    `${business}\nSayın ${customer}, ${amount} tutarındaki ödemeniz (${method}) alınmıştır. Kalan borcunuz: ${balance}. Teşekkür ederiz.`,
  planTitle: 'Taksit Planı',
  planMeta: (o, t) => `${o} açık · toplam ${t} vade`,
  paid: 'Ödendi',
  lateDays: d => `${d} gün gecikti`,
  daysLeft: d => (d === 0 ? 'Bugün' : `${d} gün kaldı`),
  instNo: (n, c) => `${n}/${c}. taksit`,
  harvestDue: 'Tek vade (hasatta ödeme)',
  undatedSale: 'Vadesiz borç',
  partial: p => `${p} kısmi ödendi`,
  paidHint: 'ödendi',
  showPaid: n => `Ödenen ${n} vadeyi göster`,
  hidePaid: 'Ödenenleri gizle',
  noPlan: 'Vadeli borç yok',
  movements: 'Hesap Hareketleri',
  filterAll: 'Tümü',
  filterSale: 'Satış',
  filterPayment: 'Tahsilat',
  balance: v => `Bakiye ${v}`,
  allMovements: 'Tüm hareketler',
  dueWeek: 'Bu hafta vadeli',
  dueWeekHint: n => `${n} müşteri`,
  debtorCount: 'Borçlu müşteri',
  debtorsTitle: 'Borçlu müşteriler',
  colCustomer: 'Müşteri',
  colStatus: 'Durum',
  colNextDue: 'Sonraki vade',
  colOverdue: 'Gecikmiş',
  colDebt: 'Borç',
  onTime: 'Zamanında',
  undatedOnly: 'Vadesiz',
  customersTitle: 'Müşteri listesi',
  filterDebtors: 'Borçlu',
  colVillage: 'Köy / Mahalle',
  colPhone: 'Telefon',
  colTc: 'TC No',
  colBalance: 'Bakiye',
  customerCount: 'Toplam müşteri',
  receivable: 'Toplam alacak',
  secIdentity: 'Kimlik ve iletişim',
  secFarm: 'Köy, ÇKS ve adres',
  secCredit: 'Veresiye ve not',
  suppliersTitle: 'Tedarikçi listesi',
  colCompany: 'Firma',
  colContact: 'Yetkili / Telefon',
  colTax: 'Vergi no',
  colOwed: 'Borcumuz',
  supplierCount: 'Tedarikçi',
  owedSuppliers: 'Borçlu olduğumuz',
  lastMove: 'Son hareket',
  noMove: 'Hareket yok',
  periodTotal: 'Dönem toplamı',
  topCategory: 'En büyük kalem',
  byCategory: 'Kategoriye göre',
  expensesTitle: 'Gider kayıtları',
  colDate: 'Tarih',
  colExpense: 'Gider',
  colCategory: 'Kategori',
  colAmount: 'Tutar',
  recurringCount: 'Tekrarlayan',
  avgPerRecord: 'Ortalama kayıt',
};

export const ACCOUNT_EN: AccountTexts = {
  totalDebt: 'Total debt',
  openInstallments: n => `${n} open installment${n === 1 ? '' : 's'}`,
  noDebt: 'No debt',
  overdue: 'Overdue',
  lateFor: (c, d) => `${c} installment${c === 1 ? '' : 's'} · ${d} days late`,
  noOverdue: 'Nothing overdue',
  nextDue: 'Next due',
  inDays: d => (d === 0 ? 'today' : `in ${d} days`),
  noNextDue: 'No scheduled due date',
  creditLimit: 'Credit limit',
  limitUsed: (p, left) => `${p}% used · ${left} left`,
  limitOver: over => `Limit exceeded · +${over}`,
  totalPaid: 'Total paid',
  totalBorrowed: v => `Total borrowed ${v}`,
  sale: 'New sale',
  collect: 'Collect payment',
  statement: 'Statement PDF',
  remind: 'Remind',
  customerCard: 'Customer card',
  cks: 'Farmer reg.',
  paymentMethod: 'Payment method',
  transfer: 'Bank transfer',
  transferPayDesc: 'Bank transfer payment',
  pickNext: v => `Next instalment (${v})`,
  pickOverdue: v => `Overdue (${v})`,
  pickAll: v => `Full debt (${v})`,
  amountRequired: 'Enter the amount collected',
  paymentDone: 'Payment recorded',
  receiptTitle: 'Payment receipt',
  prevBalance: 'Previous balance',
  newBalance: 'Remaining balance',
  printReceipt: 'Print receipt',
  sendWhatsApp: 'Send via WhatsApp',
  receiptWaText: (business, customer, amount, method, balance) =>
    `${business}\nDear ${customer}, your payment of ${amount} (${method}) has been received. Remaining balance: ${balance}. Thank you.`,
  planTitle: 'Installment plan',
  planMeta: (o, t) => `${o} open · ${t} due dates`,
  paid: 'Paid',
  lateDays: d => `${d} days late`,
  daysLeft: d => (d === 0 ? 'Today' : `${d} days left`),
  instNo: (n, c) => `Installment ${n}/${c}`,
  harvestDue: 'Single due date (at harvest)',
  undatedSale: 'No due date',
  partial: p => `${p} partially paid`,
  paidHint: 'paid',
  showPaid: n => `Show ${n} paid`,
  hidePaid: 'Hide paid',
  noPlan: 'No dated debt',
  movements: 'Account activity',
  filterAll: 'All',
  filterSale: 'Sales',
  filterPayment: 'Payments',
  balance: v => `Balance ${v}`,
  allMovements: 'All activity',
  dueWeek: 'Due this week',
  dueWeekHint: n => `${n} customer${n === 1 ? '' : 's'}`,
  debtorCount: 'Customers in debt',
  debtorsTitle: 'Customers in debt',
  colCustomer: 'Customer',
  colStatus: 'Status',
  colNextDue: 'Next due',
  colOverdue: 'Overdue',
  colDebt: 'Debt',
  onTime: 'On time',
  undatedOnly: 'No due date',
  customersTitle: 'Customer list',
  filterDebtors: 'In debt',
  colVillage: 'Village',
  colPhone: 'Phone',
  colTc: 'ID no',
  colBalance: 'Balance',
  customerCount: 'Total customers',
  receivable: 'Total receivable',
  secIdentity: 'Identity and contact',
  secFarm: 'Village, farmer reg. and address',
  secCredit: 'Credit and note',
  suppliersTitle: 'Supplier list',
  colCompany: 'Company',
  colContact: 'Contact / Phone',
  colTax: 'Tax no',
  colOwed: 'We owe',
  supplierCount: 'Suppliers',
  owedSuppliers: 'We owe to',
  lastMove: 'Last activity',
  noMove: 'No activity',
  periodTotal: 'Period total',
  topCategory: 'Largest item',
  byCategory: 'By category',
  expensesTitle: 'Expense records',
  colDate: 'Date',
  colExpense: 'Expense',
  colCategory: 'Category',
  colAmount: 'Amount',
  recurringCount: 'Recurring',
  avgPerRecord: 'Average per record',
};
