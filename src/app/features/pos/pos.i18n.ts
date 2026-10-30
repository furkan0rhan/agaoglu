/**
 * Tasarım v2 POS + satışlar metinleri. translations.ts içinde `pos2` anahtarıyla bağlanır: `t().pos2.hold`.
 * (Eski `t().pos` / `t().sales` anahtarları da kullanılmaya devam eder.)
 */
export interface PosTexts {
  receipt: string;
  newReceipt: string;
  cashier: string;
  hintSearch: string;
  results: string;
  resultsMeta: (q: string, n: number) => string;
  select: string;
  addToCart: string;
  add: string;
  favorites: string;
  favAll: string;
  categories: { gubre: string; bitki_koruma: string; tohum: string; fide: string; diger: string };
  noFavorites: string;
  cart: string;
  lines: (n: number) => string;
  walkIn: string;
  debt: string;
  limit: string;
  noDebt: string;
  change: string;
  stockPill: (q: string) => string;
  lowStock: (q: string) => string;
  expiryDays: (n: number) => string;
  expired: string;
  subtotal: string;
  discount: string;
  vatIncluded: string;
  total: string;
  discountBtn: string;
  hold: string;
  customer: string;
  heldBtn: string;
  heldTitle: string;
  heldEmpty: string;
  heldItems: (n: number) => string;
  holdTitle: string;
  holdName: string;
  holdNamePlaceholder: string;
  holdConfirm: string;
  holdOk: (name: string) => string;
  holdFull: (max: number) => string;
  holdFailed: string;
  resume: string;
  remove: string;
  resumeBusy: string;
  resumed: (name: string) => string;
  doneTitle: string;
  amount: string;
  received: string;
  changeBig: string;
  creditBig: string;
  print: string;
  whatsapp: string;
  newSale: string;
  cancelSale: string;
  /** Y10: sepet boşaltma geri al */
  cartCleared: (n: number) => string; undo: string;
  detail: string;
  waText: (business: string, saleNo: string, total: string, credit: string | null) => string;
  mobileCart: string;
  quickCashLabel: string;
  exact: string;
  // Veresiye dialogu
  creditMode: string;
  modeInstallment: string;
  modeHarvest: string;
  downPayment: string;
  firstDue: string;
  harvestDate: string;
  interval: string;
  months: (n: number) => string;
  planTitle: string;
  financed: string;
  currentDebt: string;
  newBalance: string;
  limitExceeded: (over: string) => string;
  limitOk: (available: string) => string;
  completeAnyway: string;
  dueRequired: string;
  // Satış listesi / detay
  sumCount: string;
  sumRevenue: string;
  sumCredit: string;
  sumCancelled: string;
  dueLabel: string;
  downPaymentLabel: string;
  planLabel: string;
  /** Y18: e-reçete no müşterinin önerisinden getirildi */
  rxFromRecommendation: string;
}

export const POS_TR: PosTexts = {
  receipt: 'Fiş',
  newReceipt: 'Yeni fiş',
  cashier: 'Kasiyer',
  hintSearch: 'Ara',
  results: 'Sonuçlar',
  resultsMeta: (q, n) => (q ? `“${q}” · ${n} ürün` : `${n} ürün`),
  select: 'seç',
  addToCart: 'sepete ekle',
  add: 'Ekle',
  favorites: 'Sık Satılanlar',
  favAll: 'Tümü',
  categories: { gubre: 'Gübre', bitki_koruma: 'İlaç', tohum: 'Tohum', fide: 'Fide', diger: 'Diğer' },
  noFavorites: 'Bu kategoride ürün yok',
  cart: 'Sepet',
  lines: n => `${n} kalem`,
  walkIn: 'Perakende müşteri',
  debt: 'Borç',
  limit: 'Limit',
  noDebt: 'Borcu yok',
  change: 'Değiştir',
  stockPill: q => `Stok ${q}`,
  lowStock: q => `Stokta ${q}`,
  expiryDays: n => `SKT ${n} gün`,
  expired: 'SKT geçmiş',
  subtotal: 'Ara toplam',
  discount: 'İskonto',
  vatIncluded: 'KDV dahil',
  total: 'TOPLAM',
  discountBtn: 'İskonto',
  hold: 'Beklet',
  customer: 'Müşteri',
  heldBtn: 'Bekleyenler',
  heldTitle: 'Bekleyen sepetler',
  heldEmpty: 'Bekleyen sepet yok',
  heldItems: n => `${n} kalem`,
  holdTitle: 'Sepeti beklet',
  holdName: 'Sepet adı',
  holdNamePlaceholder: 'ör. Ali amca, kamyonet',
  holdConfirm: 'Beklet',
  holdOk: name => `“${name}” bekletildi`,
  holdFull: max => `En fazla ${max} sepet bekletilebilir. Önce birini geri çağırın ya da silin.`,
  holdFailed: 'Sepet bekletilemedi (tarayıcı depolaması kapalı).',
  resume: 'Geri çağır',
  remove: 'Sil',
  resumeBusy: 'Önce mevcut sepeti tamamlayın ya da bekletin.',
  resumed: name => `“${name}” sepete alındı`,
  doneTitle: 'Satış tamamlandı',
  amount: 'Tutar',
  received: 'Alınan',
  changeBig: 'PARA ÜSTÜ',
  creditBig: 'VERESİYE',
  print: 'Fiş Yazdır',
  whatsapp: 'WhatsApp',
  newSale: 'Yeni Satış',
  cancelSale: 'Satışı iptal et',
  cartCleared: n => `Sepet boşaltıldı (${n} kalem)`,
  undo: 'Geri al',
  detail: 'Satış detayı',
  waText: (business, saleNo, total, credit) =>
    [`${business ? business + ' · ' : ''}Satış ${saleNo}`, `Toplam: ${total}`, credit ? `Veresiye: ${credit}` : '', 'Teşekkür ederiz.']
      .filter(Boolean).join('\n'),
  mobileCart: 'Sepet & Ödeme',
  quickCashLabel: 'Alınan:',
  exact: 'Tam',
  creditMode: 'Ödeme şekli',
  modeInstallment: 'Taksitli',
  modeHarvest: 'Hasatta öde',
  downPayment: 'Peşinat (nakit)',
  firstDue: 'İlk vade',
  harvestDate: 'Hasat (ödeme) tarihi',
  interval: 'Taksit aralığı',
  months: n => `${n} ay`,
  planTitle: 'Ödeme planı',
  financed: 'Veresiyeye yazılacak',
  currentDebt: 'Mevcut borç',
  newBalance: 'Yeni bakiye',
  limitExceeded: over => `Veresiye limiti ${over} aşılıyor. Yine de devam edebilirsiniz.`,
  limitOk: available => `Limite kalan: ${available}`,
  completeAnyway: 'Limiti aşarak tamamla',
  dueRequired: 'Geçerli bir vade tarihi seçin.',
  sumCount: 'Satış',
  sumRevenue: 'Ciro',
  sumCredit: 'Veresiye',
  sumCancelled: 'İptal / iade',
  dueLabel: 'Vade',
  downPaymentLabel: 'Peşinat',
  planLabel: 'Taksit planı',
  rxFromRecommendation: 'Çiftçiye yazılan önerideki e-reçete no getirildi; kontrol edin.',
};

export const POS_EN: PosTexts = {
  receipt: 'Receipt',
  newReceipt: 'New receipt',
  cashier: 'Cashier',
  hintSearch: 'Search',
  results: 'Results',
  resultsMeta: (q, n) => (q ? `“${q}” · ${n} products` : `${n} products`),
  select: 'select',
  addToCart: 'add to cart',
  add: 'Add',
  favorites: 'Best sellers',
  favAll: 'All',
  categories: { gubre: 'Fertilizer', bitki_koruma: 'Pesticide', tohum: 'Seed', fide: 'Seedling', diger: 'Other' },
  noFavorites: 'No products in this category',
  cart: 'Cart',
  lines: n => `${n} lines`,
  walkIn: 'Walk-in customer',
  debt: 'Debt',
  limit: 'Limit',
  noDebt: 'No debt',
  change: 'Change',
  stockPill: q => `Stock ${q}`,
  lowStock: q => `Only ${q}`,
  expiryDays: n => `Exp. ${n} d`,
  expired: 'Expired',
  subtotal: 'Subtotal',
  discount: 'Discount',
  vatIncluded: 'VAT incl.',
  total: 'TOTAL',
  discountBtn: 'Discount',
  hold: 'Hold',
  customer: 'Customer',
  heldBtn: 'On hold',
  heldTitle: 'Carts on hold',
  heldEmpty: 'No carts on hold',
  heldItems: n => `${n} lines`,
  holdTitle: 'Hold cart',
  holdName: 'Cart name',
  holdNamePlaceholder: 'e.g. Ali, pickup truck',
  holdConfirm: 'Hold',
  holdOk: name => `“${name}” is on hold`,
  holdFull: max => `At most ${max} carts can be held. Resume or delete one first.`,
  holdFailed: 'Could not hold the cart (browser storage is disabled).',
  resume: 'Resume',
  remove: 'Delete',
  resumeBusy: 'Complete or hold the current cart first.',
  resumed: name => `“${name}” moved to the cart`,
  doneTitle: 'Sale completed',
  amount: 'Amount',
  received: 'Received',
  changeBig: 'CHANGE',
  creditBig: 'ON CREDIT',
  print: 'Print receipt',
  whatsapp: 'WhatsApp',
  newSale: 'New sale',
  cancelSale: 'Cancel sale',
  cartCleared: n => `Cart cleared (${n} items)`,
  undo: 'Undo',
  detail: 'Sale detail',
  waText: (business, saleNo, total, credit) =>
    [`${business ? business + ' · ' : ''}Sale ${saleNo}`, `Total: ${total}`, credit ? `On credit: ${credit}` : '', 'Thank you.']
      .filter(Boolean).join('\n'),
  mobileCart: 'Cart & payment',
  quickCashLabel: 'Received:',
  exact: 'Exact',
  creditMode: 'Payment type',
  modeInstallment: 'Installments',
  modeHarvest: 'Pay at harvest',
  downPayment: 'Down payment (cash)',
  firstDue: 'First due date',
  harvestDate: 'Harvest (due) date',
  interval: 'Interval',
  months: n => `${n} mo`,
  planTitle: 'Payment plan',
  financed: 'Recorded as credit',
  currentDebt: 'Current debt',
  newBalance: 'New balance',
  limitExceeded: over => `Credit limit exceeded by ${over}. You can still continue.`,
  limitOk: available => `Available limit: ${available}`,
  completeAnyway: 'Complete over limit',
  dueRequired: 'Pick a valid due date.',
  sumCount: 'Sales',
  sumRevenue: 'Revenue',
  sumCredit: 'On credit',
  sumCancelled: 'Cancelled / refunded',
  dueLabel: 'Due',
  downPaymentLabel: 'Down payment',
  planLabel: 'Installment plan',
  rxFromRecommendation: 'E-prescription no filled from the farmer recommendation; please check.',
};
