/**
 * Tasarım v2 (Saha / Komuta) — Ürünler, stok hareketleri, stok sayımı ve alış ekranlarının yeni metinleri.
 * `Translations.inventory` olarak translations.ts'e bağlıdır (dosya çakışmalarını azaltmak için modülün yanında).
 * Eski anahtarlar `products`, `stockCount`, `purchases` altında kalır; burada yalnız v2 ile gelenler var.
 */
export interface InventoryTexts {
  // Ürün listesi
  totalProducts: string; criticalStock: string; expiringSoon: (days: number) => string; stockValue: string;
  expiringChip: string; noBarcode: string; searchPlaceholder: string; columnFilters: string;
  colProduct: string; colCategory: string; colStock: string; colExpiry: string;
  colPurchase: string; colSale: string; colMarkup: string;
  stockEntry: string; stockCount: string; critical: string; days: string; statusFilters: string; categoryFilters: string;
  barcodeCount: string;
  // Ürün detayı
  stockCard: string; priceCard: string; threshold: string; batchCount: string; nearestExpiry: string;
  unitProfit: string; infoCard: string; gtsCount: string; lastMovements: string;
  // Ürün formu
  secBasic: string; secBasicHint: string; secPrice: string; secPriceHint: string; secStock: string; secStockHint: string;
  secRegulatoryHint: string; secGts: string; secGtsHint: string; secOther: string; jumpTo: string; summary: string;
  markupPreview: string; marginPreview: string; saveHint: string;
  // KDV ↔ kâr (14.3)
  purchaseIncludesVat: string; purchaseIncludesVatHint: string;
  vatBreakdown: (gross: string, net: string, vat: string) => string; profitNetNote: string;
  netSale: string; netCost: string; vatInPrice: string;
  // Stok hareketleri
  movementsTitle: string; colDate: string; colReason: string; colChange: string; colStockAfter: string;
  refPurchase: string; refSale: string;
  // Stok sayımı
  counted: string; remaining: string; onlyDiff: string; uncounted: string; countList: string; countHint: string;
  // Alışlar
  purchaseTotal: string; purchaseDocs: string; purchaseCredit: string; purchaseCash: string; purchaseList: string;
  documentInfo: string; totalsCard: string; paymentCard: string; itemsHint: string; lineCount: string;
  stockAdded: string;
  // Parti / şarj no (karekod AI 10)
  lotNo: string; lotNoPlaceholder: string;
  /** Y3: bitki koruma ürününde SKT zorunlu */
  expiryRequiredPp: string; expiryRequiredPpHint: string; gtsNoExpiry: (n: number) => string;
}

export const INVENTORY_TR: InventoryTexts = {
  totalProducts: 'Toplam ürün', criticalStock: 'Kritik stok', expiringSoon: (d: number) => `SKT ≤ ${d} gün`, stockValue: 'Stok değeri (alış)',
  expiringChip: 'SKT yaklaşan', noBarcode: 'Barkodsuz', searchPlaceholder: 'Ad, barkod, marka veya GTS no…',
  columnFilters: 'Sütun filtreleri',
  colProduct: 'Ürün', colCategory: 'Kategori', colStock: 'Stok', colExpiry: 'SKT',
  colPurchase: 'Alış', colSale: 'Satış', colMarkup: 'Kâr oranı',
  stockEntry: 'Stok girişi', stockCount: 'Stok sayımı', critical: 'Kritik', days: 'gün',
  statusFilters: 'Durum filtreleri', categoryFilters: 'Kategori filtreleri', barcodeCount: 'barkodsuz',

  stockCard: 'Stok', priceCard: 'Fiyat ve kâr', threshold: 'Kritik eşik', batchCount: 'Parti / GTS kaydı',
  nearestExpiry: 'En yakın SKT', unitProfit: 'Birim kâr', infoCard: 'Ürün bilgileri', gtsCount: 'GTS',
  lastMovements: 'Son hareketler',

  secBasic: 'Temel bilgiler', secBasicHint: 'Ad, barkod, kategori ve tedarikçi',
  secPrice: 'Fiyat', secPriceHint: 'Alış, satış ve KDV',
  secStock: 'Stok ve birim', secStockHint: 'Satış birimi, açılış stoğu ve kritik eşik',
  secRegulatoryHint: 'Ruhsat, e-reçete ve etiket bilgileri',
  secGts: 'GTS / ilk parti', secGtsHint: 'Karekodları okutun; her GTS 1 birim stok olur',
  secOther: 'Açıklama ve durum', jumpTo: 'Bölüme git', summary: 'Özet',
  markupPreview: 'Kâr oranı', marginPreview: 'Kâr marjı', saveHint: 'Ctrl+S ile de kaydedebilirsiniz',
  purchaseIncludesVat: 'Alış fiyatı KDV dahil', purchaseIncludesVatHint: 'Kapalıysa alış fiyatı KDV hariç kabul edilir',
  vatBreakdown: (g: string, n: string, v: string) => `KDV dahil satış ${g} → net ${n}, KDV ${v}`,
  profitNetNote: 'Kâr, KDV hariç tutarlardan hesaplanır (satış fiyatı KDV dahildir).',
  netSale: 'Net satış (KDV hariç)', netCost: 'Net alış (KDV hariç)', vatInPrice: 'Fiyattaki KDV',

  movementsTitle: 'Hareketler', colDate: 'Tarih', colReason: 'Açıklama', colChange: 'Değişim', colStockAfter: 'Sonraki stok',
  refPurchase: 'Alış', refSale: 'Satış',

  counted: 'Sayılan', remaining: 'Kalan', onlyDiff: 'Yalnız farklar', uncounted: 'Sayılmayan', countList: 'Sayım listesi',
  countHint: 'Rafta saydığınız miktarı yazın; tutmayanlar kırmızı / sarı işaretlenir.',

  purchaseTotal: 'Toplam alış', purchaseDocs: 'Belge', purchaseCredit: 'Vadeli (cari)', purchaseCash: 'Peşin',
  purchaseList: 'Alış belgeleri', documentInfo: 'Belge bilgileri', totalsCard: 'Toplam', paymentCard: 'Ödeme',
  itemsHint: 'Barkod okutun veya ürün adı yazın; Enter ilk sonucu ekler.', lineCount: 'kalem',
  stockAdded: 'Stoğa eklenir',
  lotNo: 'Parti no', lotNoPlaceholder: 'Parti / şarj no (ops.)',
  expiryRequiredPp: 'Bitki koruma ürününde son kullanma tarihi (SKT) zorunludur. Karekodda SKT yoksa kutudaki tarihi yazın.',
  expiryRequiredPpHint: 'Bitki koruma ürünü: SKT zorunlu',
  gtsNoExpiry: n => `${n} karekodda SKT yok; formdaki SKT bu birimlere yazılacak.`,
};

export const INVENTORY_EN: InventoryTexts = {
  totalProducts: 'Total products', criticalStock: 'Critical stock', expiringSoon: (d: number) => `Expiry ≤ ${d} days`, stockValue: 'Stock value (cost)',
  expiringChip: 'Expiring soon', noBarcode: 'No barcode', searchPlaceholder: 'Name, barcode, brand or GTS no…',
  columnFilters: 'Column filters',
  colProduct: 'Product', colCategory: 'Category', colStock: 'Stock', colExpiry: 'Expiry',
  colPurchase: 'Cost', colSale: 'Price', colMarkup: 'Markup',
  stockEntry: 'Stock entry', stockCount: 'Stock count', critical: 'Critical', days: 'days',
  statusFilters: 'Status filters', categoryFilters: 'Category filters', barcodeCount: 'without barcode',

  stockCard: 'Stock', priceCard: 'Price & profit', threshold: 'Critical level', batchCount: 'Batch / GTS records',
  nearestExpiry: 'Nearest expiry', unitProfit: 'Unit profit', infoCard: 'Product info', gtsCount: 'GTS',
  lastMovements: 'Recent movements',

  secBasic: 'Basics', secBasicHint: 'Name, barcode, category and supplier',
  secPrice: 'Price', secPriceHint: 'Cost, sale price and VAT',
  secStock: 'Stock & unit', secStockHint: 'Sales unit, opening stock and critical level',
  secRegulatoryHint: 'License, e-prescription and label info',
  secGts: 'GTS / first batch', secGtsHint: 'Scan the QR codes; each GTS is 1 unit of stock',
  secOther: 'Description & status', jumpTo: 'Jump to section', summary: 'Summary',
  markupPreview: 'Markup', marginPreview: 'Margin', saveHint: 'You can also save with Ctrl+S',
  purchaseIncludesVat: 'Cost includes VAT', purchaseIncludesVatHint: 'When off, the cost price is treated as excluding VAT',
  vatBreakdown: (g: string, n: string, v: string) => `Sale price incl. VAT ${g} → net ${n}, VAT ${v}`,
  profitNetNote: 'Profit is calculated from amounts excluding VAT (the sale price includes VAT).',
  netSale: 'Net sale (excl. VAT)', netCost: 'Net cost (excl. VAT)', vatInPrice: 'VAT in price',

  movementsTitle: 'Movements', colDate: 'Date', colReason: 'Description', colChange: 'Change', colStockAfter: 'Stock after',
  refPurchase: 'Purchase', refSale: 'Sale',

  counted: 'Counted', remaining: 'Remaining', onlyDiff: 'Differences only', uncounted: 'Not counted', countList: 'Count list',
  countHint: 'Enter the quantity you counted on the shelf; mismatches are marked red / yellow.',

  purchaseTotal: 'Total purchases', purchaseDocs: 'Documents', purchaseCredit: 'On account', purchaseCash: 'Paid',
  purchaseList: 'Purchase documents', documentInfo: 'Document', totalsCard: 'Total', paymentCard: 'Payment',
  itemsHint: 'Scan a barcode or type a product name; Enter adds the first match.', lineCount: 'lines',
  stockAdded: 'Added to stock',
  lotNo: 'Lot no', lotNoPlaceholder: 'Lot / batch no (opt.)',
  expiryRequiredPp: 'An expiry date is required for plant protection products. If the code has none, enter the date on the box.',
  expiryRequiredPpHint: 'Plant protection product: expiry required',
  gtsNoExpiry: n => `${n} codes have no expiry; the form expiry will be used for them.`,
};
