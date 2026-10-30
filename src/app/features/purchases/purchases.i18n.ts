/**
 * Satın alma + tedarikçi cari metinleri. `Translations.purchases` olarak translations.ts'e bağlıdır
 * (dosya çakışmalarını azaltmak için metinler modülün yanında tutulur).
 */
export interface PurchasesTexts {
  title: string; subtitle: string; newPurchase: string; countSuffix: string;
  dateRange: string; supplierFilter: string; allSuppliers: string;
  empty: string; emptyHint: string; totalInRange: string; countInRange: string;
  date: string; docNo: string; supplier: string; total: string; payment: string; status: string;
  paymentCash: string; paymentCredit: string; statusActive: string; statusCancelled: string;
  docInvoice: string; docWaybill: string; docType: string;
  selectSupplier: string; documentDate: string; items: string; itemCount: string;
  scanOrSearch: string; noProductFound: string; product: string; quantity: string; unitCost: string; vat: string;
  expiry: string; gts: string; gtsHint: string; lineTotal: string; removeLine: string;
  discount: string; subtotal: string; vatTotal: string; grandTotal: string;
  paymentType: string; paymentMethod: string; cash: string; card: string; transfer: string; dueDate: string;
  updatePrice: string; updatePriceHint: string; notes: string; save: string; saved: string;
  errNoSupplier: string; errNoItems: string; errInvalidLine: string; errDuplicateGts: string; errOffline: string;
  errTooMany: string; errProductNotFound: string; saveFailed: string; loadFailed: string;
  /** Y3: bitki koruma ürünü kaleminde SKT zorunlu ({name}) */
  errExpiryRequired: string; gtsSplit: (n: number) => string;
  detailTitle: string; cancel: string; cancelConfirm: string; cancelReason: string; cancelReasonPlaceholder: string;
  cancelled: string; cancelShortfall: string; cancelFailed: string; cancelledAt: string; alreadyCancelled: string;
  purchasePriceUpdated: string;
  stockReason: string; stockCancelReason: string; ledgerPurchase: string; ledgerCashPayment: string; ledgerCancel: string;
  account: string; balance: string; weOwe: string; weAreOwed: string; settled: string;
  totalPurchased: string; totalPaid: string; makePayment: string; amount: string; description: string;
  paymentDefaultDesc: string; paymentSaved: string; paymentFailed: string; invalidAmount: string; overpayNote: string;
  transactions: string; noTransactions: string; txPurchase: string; txPayment: string; reversal: string;
  supplierPurchases: string; noSupplierPurchases: string; debtColumn: string; newPurchaseForSupplier: string;
  balanceAfter: string;
  /** Y16: alış formundan hızlı tedarikçi ekleme */
  quickSupplier: string; quickSupplierHint: string; quickSupplierSaved: string; quickSupplierPhoneInvalid: string;
}

export const PURCHASES_TR: PurchasesTexts = {
  title: 'Alışlar', subtitle: 'Alış faturaları ve irsaliyeler', newPurchase: 'Yeni Alış', countSuffix: 'belge',
  dateRange: 'Tarih aralığı', supplierFilter: 'Tedarikçi', allSuppliers: 'Tüm tedarikçiler',
  empty: 'Bu aralıkta alış yok', emptyHint: 'Tedarikçiden gelen faturayı girin; stok otomatik artar.',
  totalInRange: 'Aralıktaki alış', countInRange: 'Belge sayısı',
  date: 'Tarih', docNo: 'Belge No', supplier: 'Tedarikçi', total: 'Toplam', payment: 'Ödeme', status: 'Durum',
  paymentCash: 'Peşin', paymentCredit: 'Vadeli', statusActive: 'Aktif', statusCancelled: 'İptal',
  docInvoice: 'Fatura', docWaybill: 'İrsaliye', docType: 'Belge türü',
  selectSupplier: 'Tedarikçi seçin', documentDate: 'Belge tarihi', items: 'Kalemler', itemCount: 'kalem',
  scanOrSearch: 'Barkod okut veya ürün ara (Enter)', noProductFound: 'Ürün bulunamadı', product: 'Ürün',
  quantity: 'Miktar', unitCost: 'Birim alış (KDV hariç)', vat: 'KDV %',
  expiry: 'SKT', gts: 'GTS / Karekod', gtsHint: 'Boşluk, virgül ya da satır ile ayırın. Doluysa miktar = GTS sayısı.',
  lineTotal: 'Tutar', removeLine: 'Kalemi kaldır',
  discount: 'İskonto (₺, KDV hariç)', subtotal: 'Ara toplam', vatTotal: 'KDV', grandTotal: 'Genel toplam',
  paymentType: 'Ödeme durumu', paymentMethod: 'Ödeme şekli', cash: 'Nakit', card: 'Kart', transfer: 'Havale / EFT', dueDate: 'Vade tarihi',
  updatePrice: 'Ürün alış fiyatlarını güncelle', updatePriceHint: 'Ürün kartındaki alış fiyatı bu belgedeki birim fiyatla değişir.',
  notes: 'Not', save: 'Alışı Kaydet', saved: 'Alış kaydedildi, stok güncellendi',
  errNoSupplier: 'Tedarikçi seçin', errNoItems: 'En az bir kalem ekleyin', errInvalidLine: 'Miktar ve fiyatları kontrol edin',
  errDuplicateGts: 'GTS tekrar ediyor veya zaten stokta: {gts}', errOffline: 'Alış kaydı için internet bağlantısı gerekli',
  errTooMany: 'Bir belgede en fazla 200 kalem olabilir', errProductNotFound: 'Ürün bulunamadı (silinmiş olabilir)',
  errExpiryRequired: '{name}: bitki koruma ürününde son kullanma tarihi (SKT) zorunlu. Karekodda yoksa kutudaki tarihi yazın.',
  gtsSplit: n => `Farklı SKT / parti nolu karekodlar ${n} ayrı kaleme bölündü`,
  saveFailed: 'Alış kaydedilemedi', loadFailed: 'Alışlar yüklenemedi',
  detailTitle: 'Alış Belgesi', cancel: 'Alışı İptal Et',
  cancelConfirm: 'Bu alış iptal edilsin mi? Ürün stokları geri düşer ve tedarikçi carisine ters kayıt yazılır.',
  cancelReason: 'İptal nedeni', cancelReasonPlaceholder: 'Örn. yanlış giriş, iade',
  cancelled: 'Alış iptal edildi', cancelShortfall: "Uyarı: {n} birim stokta yoktu (satılmış olabilir); stok 0'a çekildi.",
  cancelFailed: 'Alış iptal edilemedi', cancelledAt: 'İptal tarihi', alreadyCancelled: 'Bu alış zaten iptal edilmiş',
  purchasePriceUpdated: 'Alış fiyatları güncellendi',
  stockReason: 'Alış', stockCancelReason: 'Alış iptali', ledgerPurchase: 'Alış {doc}', ledgerCashPayment: 'Peşin ödeme {doc}',
  ledgerCancel: 'İptal: {doc}',
  account: 'Cari Hesap', balance: 'Bakiye', weOwe: 'Borcumuz', weAreOwed: 'Alacağımız', settled: 'Hesap kapalı',
  totalPurchased: 'Toplam alış', totalPaid: 'Toplam ödeme', makePayment: 'Ödeme Yap', amount: 'Tutar', description: 'Açıklama',
  paymentDefaultDesc: 'Tedarikçi ödemesi', paymentSaved: 'Ödeme kaydedildi', paymentFailed: 'Ödeme kaydedilemedi',
  invalidAmount: 'Geçerli bir tutar girin', overpayNote: 'Borçtan fazla ödeme tedarikçide alacak (avans) olarak kalır.',
  transactions: 'Cari Hareketler', noTransactions: 'Henüz hareket yok', txPurchase: 'Alış', txPayment: 'Ödeme', reversal: 'Ters kayıt',
  supplierPurchases: 'Alış Belgeleri', noSupplierPurchases: 'Bu tedarikçiden alış girilmedi', debtColumn: 'Borç',
  newPurchaseForSupplier: 'Alış Gir', balanceAfter: 'Bakiye',
  quickSupplier: 'Yeni tedarikçi', quickSupplierHint: 'Fatura bilgileriniz korunur; diğer alanları sonra Tedarikçiler sayfasından doldurabilirsiniz.',
  quickSupplierSaved: 'Tedarikçi eklendi ve seçildi', quickSupplierPhoneInvalid: 'Telefonu alan koduyla yazın: 0332 444 11 22',
};

export const PURCHASES_EN: PurchasesTexts = {
  title: 'Purchases', subtitle: 'Purchase invoices and waybills', newPurchase: 'New Purchase', countSuffix: 'documents',
  dateRange: 'Date range', supplierFilter: 'Supplier', allSuppliers: 'All suppliers',
  empty: 'No purchases in this range', emptyHint: 'Enter the supplier invoice; stock increases automatically.',
  totalInRange: 'Purchases in range', countInRange: 'Documents',
  date: 'Date', docNo: 'Doc No', supplier: 'Supplier', total: 'Total', payment: 'Payment', status: 'Status',
  paymentCash: 'Paid', paymentCredit: 'On credit', statusActive: 'Active', statusCancelled: 'Cancelled',
  docInvoice: 'Invoice', docWaybill: 'Waybill', docType: 'Document type',
  selectSupplier: 'Select supplier', documentDate: 'Document date', items: 'Items', itemCount: 'items',
  scanOrSearch: 'Scan barcode or search product (Enter)', noProductFound: 'Product not found', product: 'Product',
  quantity: 'Quantity', unitCost: 'Unit cost (excl. VAT)', vat: 'VAT %',
  expiry: 'Expiry', gts: 'GTS / QR code', gtsHint: 'Separate with space, comma or new line. If filled, quantity = number of codes.',
  lineTotal: 'Amount', removeLine: 'Remove item',
  discount: 'Discount (excl. VAT)', subtotal: 'Subtotal', vatTotal: 'VAT', grandTotal: 'Grand total',
  paymentType: 'Payment status', paymentMethod: 'Payment method', cash: 'Cash', card: 'Card', transfer: 'Bank transfer', dueDate: 'Due date',
  updatePrice: 'Update product purchase prices', updatePriceHint: 'The purchase price on the product card is set to this unit cost.',
  notes: 'Note', save: 'Save Purchase', saved: 'Purchase saved, stock updated',
  errNoSupplier: 'Select a supplier', errNoItems: 'Add at least one item', errInvalidLine: 'Check quantities and prices',
  errDuplicateGts: 'GTS repeated or already in stock: {gts}', errOffline: 'An internet connection is required to save purchases',
  errTooMany: 'A document can have at most 200 items', errProductNotFound: 'Product not found (may be deleted)',
  errExpiryRequired: '{name}: an expiry date is required for plant protection products. If the code has none, enter the date on the box.',
  gtsSplit: n => `Codes with different expiry / lot were split into ${n} separate lines`,
  saveFailed: 'Purchase could not be saved', loadFailed: 'Purchases could not be loaded',
  detailTitle: 'Purchase Document', cancel: 'Cancel Purchase',
  cancelConfirm: 'Cancel this purchase? Product stock is reduced and a reversal is posted to the supplier account.',
  cancelReason: 'Cancel reason', cancelReasonPlaceholder: 'e.g. wrong entry, return',
  cancelled: 'Purchase cancelled', cancelShortfall: 'Warning: {n} units were no longer in stock (maybe sold); stock set to 0.',
  cancelFailed: 'Purchase could not be cancelled', cancelledAt: 'Cancelled at', alreadyCancelled: 'This purchase is already cancelled',
  purchasePriceUpdated: 'Purchase prices updated',
  stockReason: 'Purchase', stockCancelReason: 'Purchase cancelled', ledgerPurchase: 'Purchase {doc}', ledgerCashPayment: 'Cash payment {doc}',
  ledgerCancel: 'Cancelled: {doc}',
  account: 'Account', balance: 'Balance', weOwe: 'We owe', weAreOwed: 'Credit with supplier', settled: 'Settled',
  totalPurchased: 'Total purchased', totalPaid: 'Total paid', makePayment: 'Make Payment', amount: 'Amount', description: 'Description',
  paymentDefaultDesc: 'Supplier payment', paymentSaved: 'Payment saved', paymentFailed: 'Payment could not be saved',
  invalidAmount: 'Enter a valid amount', overpayNote: 'Paying more than the debt leaves a credit (advance) with the supplier.',
  transactions: 'Account Transactions', noTransactions: 'No transactions yet', txPurchase: 'Purchase', txPayment: 'Payment', reversal: 'Reversal',
  supplierPurchases: 'Purchase Documents', noSupplierPurchases: 'No purchases from this supplier', debtColumn: 'Debt',
  newPurchaseForSupplier: 'Enter Purchase', balanceAfter: 'Balance',
  quickSupplier: 'New supplier', quickSupplierHint: 'Your invoice entries are kept; fill in other details later on the Suppliers page.',
  quickSupplierSaved: 'Supplier added and selected', quickSupplierPhoneInvalid: 'Enter the phone with area code: 0332 444 11 22',
};
