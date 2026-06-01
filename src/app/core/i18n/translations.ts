export type Lang = 'tr' | 'en';

export interface Translations {
  nav: {
    dashboard: string; products: string; pos: string; customers: string;
    credit: string; reports: string; expenses: string; suppliers: string;
    stockCount: string; settings: string; other: string;
    lightMode: string; darkMode: string;
    admin: string; cashier: string; staff: string;
    cart: string; home: string;
    switchToEn: string; switchToTr: string;
    offline: string; offlineDesc: string;
  };
  common: {
    save: string; cancel: string; edit: string; add: string; delete: string;
    back: string; close: string; search: string; all: string; new: string;
    update: string; complete: string; apply: string; optional: string;
    piece: string; today: string; thisWeek: string; thisMonth: string;
    loading: string; error: string; success: string; notFound: string;
    noInfo: string; yes: string; no: string; total: string;
  };
  auth: {
    loginTitle: string; email: string; password: string; rememberMe: string;
    forgotPassword: string; login: string; noAccount: string; register: string;
    emailPlaceholder: string; passwordPlaceholder: string;
    emailInvalid: string; passwordRequired: string;
    registerTitle: string; registerSubtitle: string; displayName: string;
    displayNamePlaceholder: string; displayNameRequired: string;
    confirmPassword: string; confirmPasswordPlaceholder: string;
    passwordMismatch: string; passwordTooShort: string;
    hasAccount: string; goLogin: string;
    forgotTitle: string; forgotSubtitle: string; sendReset: string;
    backToLogin: string; resetSent: string;
    verifyTitle: string; verifySubtitle: string; resendEmail: string; goHome: string;
    verifyConfirm: string; otherAccount: string;
    notVerifiedYet: string; resendFailed: string;
    errUserNotFound: string; errWrongPassword: string;
    errTooManyRequests: string; errInvalidCredential: string; errDefault: string;
  };
  dashboard: {
    title: string; dateFormat: string;
    todaySales: string; todayLabel: string;
    totalProducts: string; activeProducts: string;
    criticalStock: string; warning: string;
    expiryDate: string; attention: string; in30Days: string;
    criticalStockWarning: string; expiringProducts: string;
    transactions: string; items: string;
    expired: string; expiresToday: string; daysLeft: string;
  };
  products: {
    title: string; newProduct: string; editProduct: string; addProduct: string;
    editSubtitle: string; addSubtitle: string;
    searchPlaceholder: string; criticalStock: string; nearExpiry: string;
    loadError: string; noProducts: string; addFirst: string;
    addToCart: string; salePrice: string; criticalStockWarn: string;
    expired: string; expiresToday: string; daysLeftPrefix: string;
    detail: string; currentStock: string; minStockWarn: string;
    productInfo: string; stockMovements: string; viewAll: string;
    noMovements: string; stockActions: string; addStock: string;
    removeStock: string; viewMovements: string;
    prices: string; purchasePrice: string; vat: string; margin: string;
    batches: string; batchCount: string; noBatches: string; noExpiry: string;
    piece: string;
    formName: string; formBarcode: string; formBrand: string; formCategory: string;
    formPricing: string; formVat: string; formStockInfo: string; formStockQty: string;
    formMinStock: string; formFirstBatch: string; formGtsNo: string;
    formExpiry: string; formDescription: string; formIsActive: string;
    formIsActiveDesc: string; formNameRequired: string;
    formCategoryPlaceholder: string; formVatPlaceholder: string;
    formGtsPlaceholder: string; formExpiryPlaceholder: string;
    formDescriptionPlaceholder: string; formBarcodePlaceholder: string;
    formBrandPlaceholder: string;
    dialogAddStock: string; dialogRemoveStock: string;
    dialogQty: string; dialogReason: string; dialogSupplier: string;
    dialogSelectSupplier: string; dialogGts: string; dialogExpiry: string;
    dialogReasonPlaceholder: string; dialogGtsPlaceholder: string;
    dialogExpiryPlaceholder: string; dialogAdd: string; dialogRemove: string;
    updated: string; added: string; stockUpdated: string;
    updateFailed: string; stockFailed: string;
    permissionError: string; categoryOther: string;
    categoryPlaceholder: string;
    stockIn: string; stockOut: string;
    infoName: string; infoCategory: string; infoBarcode: string; infoBrand: string;
    infoMinStock: string; infoVat: string; infoExpiry: string; infoDescription: string;
    totalMovements: string; movementsIn: string; movementsOut: string;
  };
  pos: {
    title: string; emptyCart: string; emptyCartDesc: string; goToProducts: string;
    clearCart: string; selectCustomer: string;
    orderSummary: string; subtotal: string; discount: string; total: string;
    cashPayment: string; cardPayment: string; creditPayment: string;
    cash: string; card: string;
    totalAmount: string; receivedAmount: string; change: string;
    complete: string; cancel: string;
    basketAmount: string; interestRate: string; installments: string;
    interestAmount: string; totalWithInterest: string; perInstallment: string;
    searchCustomer: string; noCustomer: string;
    saleCompleted: string; saleFailed: string; barcodeNotFound: string; added: string;
    items: string; itemUnit: string;
  };
  customers: {
    title: string; newCustomer: string; searchPlaceholder: string;
    noCustomers: string; loadError: string;
    editCustomer: string; addCustomer: string;
    editSubtitle: string; addSubtitle: string;
    firstName: string; lastName: string; phone: string; email: string;
    address: string; notes: string; tcNo: string;
    firstNamePlaceholder: string; lastNamePlaceholder: string;
    phonePlaceholder: string; emailPlaceholder: string;
    addressPlaceholder: string; notesPlaceholder: string; tcNoPlaceholder: string;
    firstNameRequired: string; lastNameRequired: string; phoneRequired: string;
    customerInfo: string; debtStatus: string;
    noDebt: string; debt: string; totalDebt: string;
    totalPaid: string; remainingBalance: string; accountSummary: string;
    transactions: string; noTransactions: string; viewTransactions: string;
    added: string; updated: string; saveFailed: string;
  };
  credit: {
    title: string; debtors: string; searchPlaceholder: string;
    noDebtors: string; debt: string;
    cashCollection: string; cardCollection: string;
    currentDebt: string; collectionAmount: string; note: string;
    notePlaceholder: string; descriptionPlaceholder: string;
    collected: string; collectFailed: string;
    movementHistory: string; records: string; saveFailed: string;
    noTransactions: string;
    paidWithCard: string; paidCash: string; paid: string;
    cashPayDesc: string; cardPayDesc: string;
  };
  reports: {
    title: string; subtitle: string;
    totalRevenue: string; saleCount: string; sale: string; avgSale: string;
    paymentTypes: string; cash: string; card: string; credit: string; mixed: string;
    expenseTotal: string; expense: string; netProfit: string;
    salesTrend: string; noData: string;
    today: string; thisWeek: string; thisMonth: string;
    hourly: string; daily: string; chartSales: string; cashSale: string;
    weekDays: string; cashCustomer: string;
  };
  expenses: {
    title: string; subtitle: string; addExpense: string;
    month: string; week: string; all: string;
    noExpenses: string; addFirst: string;
    expenseName: string; expenseNamePlaceholder: string;
    amount: string; category: string; date: string; note: string;
    notePlaceholder: string; recurring: string; recurringDesc: string;
    editExpense: string; addExpenseTitle: string;
    added: string; deleted: string;
    deleteTitle: string; deleteConfirm: string; deleteYes: string; deleteNo: string;
  };
  suppliers: {
    title: string; newSupplier: string; searchPlaceholder: string;
    noInfo: string; noSuppliers: string;
    editSupplier: string; addSupplier: string;
    editSubtitle: string; addSubtitle: string;
    companyName: string; companyNamePlaceholder: string; companyNameRequired: string;
    contactPerson: string; contactPersonPlaceholder: string; contactShort: string;
    phone: string; phonePlaceholder: string;
    email: string; emailPlaceholder: string;
    address: string; addressPlaceholder: string;
    taxNo: string; taxNoPlaceholder: string;
    notes: string; notesPlaceholder: string; isActive: string;
    productsSupplied: string; noProducts: string; noProductsHint: string;
    suppliedCount: string; companyInfo: string;
    saved: string; saveFailed: string;
    updated: string; updateFailed: string;
    deleteTitle: string; deleteConfirm: string;
    deleteAccept: string; deleteCancel: string; deleteFailed: string;
  };
  stockCount: {
    title: string; subtitle: string; complete: string;
    searchPlaceholder: string; countedLabel: string; diffLabel: string;
    system: string; noChanges: string; changes: string;
    shortage: string; surplus: string; completed: string;
    confirmTitle: string; confirmSubtitle: string;
    reason: string; batchAffected: string; noExpiry: string; apply: string;
    shortageExpiry: string; shortageDamage: string; shortageTheft: string;
    shortageCountError: string; shortageOther: string;
    surplusCountError: string; surplusReturn: string; surplusOther: string;
    failed: string;
    productsLabel: string; changesLabel: string; completedTitle: string;
    newCount: string; goToProducts: string; partialError: string;
    corrected: string; reasonsTitle: string; updated: string;
    expiryPrefix: string;
  };
  settings: {
    title: string; subtitle: string;
    email: string; registrationDate: string;
    updateName: string; namePlaceholder: string; update: string;
    updateEmail: string; newEmailPlaceholder: string;
    currentPasswordPlaceholder: string; sendVerification: string;
    verificationInfo: string;
    changePassword: string; currentPassword: string;
    newPassword: string; confirmPassword: string;
    passwordMismatch: string; changePasswordBtn: string;
    appInfo: string; appName: string; version: string; platform: string;
    logout: string; logoutDesc: string; logoutBtn: string;
    nameUpdated: string; updateFailed: string;
    verificationSent: string; emailUpdateFailed: string;
    wrongPassword: string; passwordChanged: string; passwordFailed: string;
  };
}

const TR: Translations = {
  nav: {
    dashboard: 'Ana Sayfa', products: 'Ürünler', pos: 'Satış / POS',
    customers: 'Müşteriler', credit: 'Veresiye', reports: 'Raporlar',
    expenses: 'Giderler', suppliers: 'Tedarikçiler', stockCount: 'Stok Sayımı',
    settings: 'Ayarlar', other: 'Diğer', lightMode: 'Aydınlık Mod',
    darkMode: 'Karanlık Mod', admin: 'Yönetici', cashier: 'Kasiyer',
    staff: 'Personel', cart: 'Sepet', home: 'Ana Sayfa',
    switchToEn: 'English', switchToTr: 'Türkçe',
    offline: 'Çevrimdışı', offlineDesc: 'Satışlar internete bağlanınca otomatik senkronize edilir',
  },
  common: {
    save: 'Kaydet', cancel: 'İptal', edit: 'Düzenle', add: 'Ekle', delete: 'Sil',
    back: 'Geri', close: 'Kapat', search: 'Ara', all: 'Tümü', new: 'Yeni',
    update: 'Güncelle', complete: 'Tamamla', apply: 'Uygula', optional: 'opsiyonel',
    piece: 'adet', today: 'Bugün', thisWeek: 'Bu Hafta', thisMonth: 'Bu Ay',
    loading: 'Yükleniyor...', error: 'Hata', success: 'Başarılı',
    notFound: 'Bulunamadı', noInfo: 'Bilgi yok', yes: 'Evet', no: 'Hayır',
    total: 'Toplam',
  },
  auth: {
    loginTitle: 'Hesabınıza giriş yapın', email: 'E-posta', password: 'Şifre',
    rememberMe: 'Beni hatırla', forgotPassword: 'Şifremi unuttum',
    login: 'Giriş Yap', noAccount: 'Hesabınız yok mu?', register: 'Kayıt ol',
    emailPlaceholder: 'ornek@email.com', passwordPlaceholder: 'Şifreniz',
    emailInvalid: 'Geçerli bir e-posta girin', passwordRequired: 'Şifre gerekli',
    registerTitle: 'Kayıt Ol', registerSubtitle: 'Yeni hesap oluşturun',
    displayName: 'Ad Soyad', displayNamePlaceholder: 'Adınız Soyadınız',
    displayNameRequired: 'Ad soyad gerekli',
    confirmPassword: 'Şifre Tekrar', confirmPasswordPlaceholder: 'Şifrenizi tekrar girin',
    passwordMismatch: 'Şifreler eşleşmiyor', passwordTooShort: 'Şifre en az 6 karakter',
    hasAccount: 'Zaten hesabınız var mı?', goLogin: 'Giriş yap',
    forgotTitle: 'Şifre Sıfırla', forgotSubtitle: 'E-posta adresinize sıfırlama bağlantısı göndereceğiz',
    sendReset: 'Sıfırlama Gönder', backToLogin: 'Giriş sayfasına dön', resetSent: 'Sıfırlama e-postası gönderildi',
    verifyTitle: 'E-postanızı Doğrulayın', verifySubtitle: 'Kayıt e-postanıza doğrulama bağlantısı gönderdik',
    resendEmail: 'Tekrar Gönder', goHome: 'Ana Sayfaya Git',
    verifyConfirm: 'Doğruladım, Devam Et', otherAccount: 'Farklı hesapla giriş yap',
    notVerifiedYet: 'E-posta henüz doğrulanmadı. Maildeki linke tıkladıktan sonra tekrar dene.',
    resendFailed: 'Mail gönderilemedi, biraz bekleyip tekrar dene.',
    errUserNotFound: 'Bu e-posta ile kayıtlı kullanıcı yok.',
    errWrongPassword: 'Hatalı şifre.',
    errTooManyRequests: 'Çok fazla deneme. Lütfen bekleyin.',
    errInvalidCredential: 'E-posta veya şifre hatalı.',
    errDefault: 'Giriş başarısız.',
  },
  dashboard: {
    title: 'Ana Sayfa', dateFormat: 'tr-TR',
    todaySales: 'Bugünkü Satış', todayLabel: 'Bugün',
    totalProducts: 'Toplam Ürün', activeProducts: 'aktif ürün',
    criticalStock: 'Kritik Stok', warning: 'Uyarı',
    expiryDate: 'Son Kullanma', attention: 'Dikkat', in30Days: '30 gün içinde',
    criticalStockWarning: 'Kritik Stok Uyarısı',
    expiringProducts: 'Son Kullanma Tarihi Yaklaşan Ürünler',
    transactions: 'işlem', items: 'ürün',
    expired: 'SKT geçmiş', expiresToday: 'Bugün son', daysLeft: 'gün kaldı',
  },
  products: {
    title: 'Ürünler', newProduct: 'Yeni Ürün',
    editProduct: 'Ürünü Düzenle', addProduct: 'Yeni Ürün Ekle',
    editSubtitle: 'Ürün bilgilerini güncelleyin', addSubtitle: 'Yeni ürün bilgilerini girin',
    searchPlaceholder: 'Ürün adı, barkod veya marka ara...',
    criticalStock: 'Kritik Stok', nearExpiry: 'Yakın SKT',
    loadError: 'Ürünler yüklenemedi', noProducts: 'Ürün bulunamadı', addFirst: 'Ürün Ekle',
    addToCart: 'Sepete Ekle', salePrice: 'Satış Fiyatı', criticalStockWarn: 'Kritik stok',
    expired: 'SKT geçmiş', expiresToday: 'Bugün son', daysLeftPrefix: 'SKT:',
    detail: 'Ürün Detayı', currentStock: 'Mevcut Stok', minStockWarn: 'Min. stok:',
    productInfo: 'Ürün Bilgileri', stockMovements: 'Son Stok Hareketleri',
    viewAll: 'Tümünü gör', noMovements: 'Henüz stok hareketi yok',
    stockActions: 'Stok İşlemleri', addStock: 'Stok Ekle', removeStock: 'Stok Çıkar',
    viewMovements: 'Stok Hareketleri',
    prices: 'Fiyatlar', purchasePrice: 'Alış Fiyatı', vat: 'KDV', margin: 'Kâr Marjı',
    batches: 'Partiler', batchCount: 'parti', noBatches: 'Parti kaydı yok', noExpiry: 'SKT yok',
    piece: 'adet',
    formName: 'Ürün Adı *', formBarcode: 'Barkod', formBrand: 'Marka', formCategory: 'Kategori *',
    formPricing: 'Fiyatlandırma', formVat: 'KDV Oranı (%)', formStockInfo: 'Stok Bilgileri',
    formStockQty: 'Stok Miktarı *', formMinStock: 'Minimum Stok',
    formFirstBatch: 'İlk Parti Bilgileri', formGtsNo: 'GTS No',
    formExpiry: 'Son Kullanma Tarihi', formDescription: 'Açıklama',
    formIsActive: 'Ürün Aktif', formIsActiveDesc: 'Kapalıysa ürün listede ve satışta görünmez',
    formNameRequired: 'Ürün adı zorunlu',
    formCategoryPlaceholder: 'Kategori seçin veya yazın',
    formVatPlaceholder: 'Örn: 8, 18, 20',
    formGtsPlaceholder: 'Bu partinin GTS numarası',
    formExpiryPlaceholder: 'Tarih seçin',
    formDescriptionPlaceholder: 'Ürün açıklaması (opsiyonel)',
    formBarcodePlaceholder: 'Barkod numarası',
    formBrandPlaceholder: 'Marka adı',
    dialogAddStock: 'Stok Ekle', dialogRemoveStock: 'Stok Çıkar',
    dialogQty: 'Miktar', dialogReason: 'Neden', dialogSupplier: 'Tedarikçi',
    dialogSelectSupplier: 'Tedarikçi seçin...', dialogGts: 'GTS No', dialogExpiry: 'Son Kullanma Tarihi',
    dialogReasonPlaceholder: 'Örn: Sayım, iade, tedarik...',
    dialogGtsPlaceholder: 'Bu partinin GTS numarası',
    dialogExpiryPlaceholder: 'GG.AA.YYYY',
    dialogAdd: 'Ekle', dialogRemove: 'Çıkar',
    updated: 'Ürün güncellendi', added: 'Ürün eklendi', stockUpdated: 'Stok güncellendi',
    updateFailed: 'Güncelleme başarısız', stockFailed: 'Stok güncellenemedi',
    permissionError: 'Yetki hatası — Firebase kurallarını kontrol edin', categoryOther: 'Diğer',
    categoryPlaceholder: 'Kategori seçin veya yazın',
    stockIn: 'Stok girişi', stockOut: 'Stok çıkışı',
    infoName: 'Ürün Adı', infoCategory: 'Kategori', infoBarcode: 'Barkod', infoBrand: 'Marka',
    infoMinStock: 'Min. Stok', infoVat: 'KDV Oranı', infoExpiry: 'Son Kullanma',
    infoDescription: 'Açıklama',
    totalMovements: 'Toplam', movementsIn: 'Girişler', movementsOut: 'Çıkışlar',
  },
  pos: {
    title: 'Sepet', emptyCart: 'Sepet boş',
    emptyCartDesc: 'Ürünler sayfasından ürün ekleyebilirsiniz',
    goToProducts: 'Ürünlere Git', clearCart: 'Temizle', selectCustomer: 'Müşteri Seç',
    orderSummary: 'Sipariş Özeti', subtotal: 'Ara Toplam', discount: 'İndirim', total: 'Toplam',
    cashPayment: 'Nakit Ödeme', cardPayment: 'Kart ile Öde', creditPayment: 'Veresiye',
    cash: 'Nakit', card: 'Kart',
    totalAmount: 'Toplam Tutar', receivedAmount: 'Alınan Tutar', change: 'Para Üstü',
    complete: 'Tamamla', cancel: 'İptal',
    basketAmount: 'Sepet Tutarı', interestRate: 'Vade Farkı (%)', installments: 'Taksit Sayısı',
    interestAmount: 'Vade Farkı', totalWithInterest: 'Toplam (faizli)', perInstallment: 'Taksit',
    searchCustomer: 'Ad veya telefon ara...', noCustomer: 'Müşteri bulunamadı',
    saleCompleted: 'Satış tamamlandı!', saleFailed: 'Satış kaydedilemedi!',
    barcodeNotFound: 'Barkod bulunamadı', added: 'eklendi', items: 'ürün', itemUnit: 'adet',
  },
  customers: {
    title: 'Müşteriler', newCustomer: 'Yeni Müşteri',
    searchPlaceholder: 'Ad, soyad veya telefon ara...',
    noCustomers: 'Müşteri bulunamadı', loadError: 'Müşteriler yüklenemedi',
    editCustomer: 'Müşteriyi Düzenle', addCustomer: 'Yeni Müşteri',
    editSubtitle: 'Müşteri bilgilerini güncelleyin', addSubtitle: 'Yeni müşteri ekleyin',
    firstName: 'Ad *', lastName: 'Soyad *', phone: 'Telefon *',
    email: 'E-posta', address: 'Adres', notes: 'Not', tcNo: 'TC No',
    firstNamePlaceholder: 'Müşteri adı', lastNamePlaceholder: 'Müşteri soyadı',
    phonePlaceholder: '05XX XXX XX XX', emailPlaceholder: 'ornek@email.com',
    addressPlaceholder: 'Adres (opsiyonel)', notesPlaceholder: 'Not (opsiyonel)',
    tcNoPlaceholder: '11 haneli TC kimlik no',
    firstNameRequired: 'Ad zorunlu', lastNameRequired: 'Soyad zorunlu', phoneRequired: 'Telefon zorunlu',
    customerInfo: 'Müşteri Bilgileri', debtStatus: 'Borç Durumu',
    noDebt: 'Borç yok', debt: 'Borç', totalDebt: 'Toplam Borç',
    totalPaid: 'Toplam Ödeme', remainingBalance: 'Kalan Bakiye', accountSummary: 'Cari Özet',
    transactions: 'İşlemler', noTransactions: 'Henüz işlem yok',
    viewTransactions: 'Cari Hareketleri Görüntüle',
    added: 'Müşteri eklendi', updated: 'Müşteri güncellendi', saveFailed: 'Kaydedilemedi',
  },
  credit: {
    title: 'Veresiye / Cari', debtors: 'müşteri borçlu',
    searchPlaceholder: 'Müşteri ara...', noDebtors: 'Veresiyeli müşteri yok', debt: 'Borç',
    cashCollection: 'Nakit Tahsilat', cardCollection: 'Kart ile Tahsilat',
    currentDebt: 'Mevcut Borç', collectionAmount: 'Tahsilat Tutarı',
    note: 'Not', notePlaceholder: 'Açıklama', descriptionPlaceholder: 'Açıklama',
    collected: 'Tahsilat kaydedildi', collectFailed: 'Tahsilat kaydedilemedi',
    movementHistory: 'Hareket Geçmişi', records: 'kayıt', saveFailed: 'Kayıt başarısız',
    noTransactions: 'Henüz hareket yok',
    paidWithCard: 'kart ile', paidCash: 'nakit', paid: 'ödendi',
    cashPayDesc: 'Nakit ödeme', cardPayDesc: 'Kart ile ödeme',
  },
  reports: {
    title: 'Raporlar', subtitle: 'Satış ve gelir analizleri',
    totalRevenue: 'Toplam Ciro', saleCount: 'Satış Sayısı', sale: 'satış', avgSale: 'Ort. Satış',
    paymentTypes: 'Ödeme Tipleri', cash: 'Nakit', card: 'Kart', credit: 'Veresiye', mixed: 'Karma',
    expenseTotal: 'Toplam Gider', expense: 'gider', netProfit: 'Net Gelir',
    salesTrend: 'Satış Trendi', noData: 'Bu dönem veri yok',
    today: 'Bugün', thisWeek: 'Bu Hafta', thisMonth: 'Bu Ay',
    hourly: 'Saatlik', daily: 'Günlük', chartSales: 'Satış', cashSale: 'Nakit Satış',
    weekDays: 'Pzt,Sal,Çar,Per,Cum,Cmt,Paz', cashCustomer: 'Peşin',
  },
  expenses: {
    title: 'Giderler', subtitle: 'Kira, elektrik, su ve diğer giderler', addExpense: 'Gider Ekle',
    month: 'Bu Ay', week: 'Bu Hafta', all: 'Tümü',
    noExpenses: 'Gider bulunamadı', addFirst: 'Gider ekle',
    expenseName: 'Gider Adı', expenseNamePlaceholder: 'Örn: Kira, Elektrik...',
    amount: 'Tutar (₺)', category: 'Kategori', date: 'Tarih', note: 'Not',
    notePlaceholder: 'Opsiyonel açıklama', recurring: 'Tekrarlı Gider',
    recurringDesc: 'Her ay otomatik tekrar etsin',
    editExpense: 'Gider Düzenle', addExpenseTitle: 'Gider Ekle',
    added: 'Gider eklendi', deleted: 'Gider silindi',
    deleteTitle: 'Gider Sil', deleteConfirm: 'Bu gideri silmek istediğinize emin misiniz?',
    deleteYes: 'Evet, Sil', deleteNo: 'Hayır',
  },
  suppliers: {
    title: 'Tedarikçiler', newSupplier: 'Yeni Tedarikçi',
    searchPlaceholder: 'Firma adı veya telefon ara...',
    noInfo: 'Bilgi yok', noSuppliers: 'Tedarikçi bulunamadı',
    editSupplier: 'Tedarikçiyi Düzenle', addSupplier: 'Yeni Tedarikçi',
    editSubtitle: 'Tedarikçi bilgilerini güncelleyin', addSubtitle: 'Yeni tedarikçi ekleyin',
    companyName: 'Firma Adı *', companyNamePlaceholder: 'Tedarikçi firma adı',
    companyNameRequired: 'Firma adı zorunlu',
    contactPerson: 'Yetkili Kişi', contactPersonPlaceholder: 'Ad Soyad', contactShort: 'Yetkili',
    phone: 'Telefon', phonePlaceholder: '05XX XXX XX XX',
    email: 'E-posta', emailPlaceholder: 'firma@email.com',
    address: 'Adres', addressPlaceholder: 'Firma adresi',
    taxNo: 'Vergi No', taxNoPlaceholder: 'Vergi numarası',
    notes: 'Notlar', notesPlaceholder: 'Opsiyonel notlar', isActive: 'Aktif',
    productsSupplied: 'Tedarik Ettiği Ürünler', companyInfo: 'Firma Bilgileri',
    noProducts: 'Bu tedarikçiden ürün alınmamış',
    noProductsHint: 'Stok eklerken tedarikçi seçerek ilişkilendirin',
    suppliedCount: 'ürün',
    saved: 'Tedarikçi kaydedildi', saveFailed: 'Kaydedilemedi',
    updated: 'Güncellendi', updateFailed: 'Güncelleme başarısız',
    deleteTitle: 'Tedarikçiyi Sil', deleteConfirm: 'Bu tedarikçiyi silmek istiyor musunuz?',
    deleteAccept: 'Sil', deleteCancel: 'İptal', deleteFailed: 'Silme başarısız',
  },
  stockCount: {
    title: 'Stok Sayımı', subtitle: 'Sayılan adedi girin, farkı onaylayın',
    complete: 'Tamamla', searchPlaceholder: 'Ürün ara...',
    countedLabel: 'Sayılan', diffLabel: 'Fark', system: 'Sistem',
    noChanges: 'Hiçbir değişiklik yok', changes: 'değişiklik',
    shortage: 'Eksik', surplus: 'Fazla', completed: 'Stok sayımı tamamlandı',
    confirmTitle: 'Stok Düzeltmeleri', confirmSubtitle: 'Aşağıdaki değişiklikler uygulanacak',
    reason: 'Neden', batchAffected: 'Etkilenecek Parti', noExpiry: 'SKT yok', apply: 'Uygula',
    shortageExpiry: 'SKT geçimi', shortageDamage: 'Bozulma / hasar',
    shortageTheft: 'Çalıntı / kayıp', shortageCountError: 'Sayım hatası', shortageOther: 'Diğer',
    surplusCountError: 'Sayım hatası', surplusReturn: 'İade / iade alımı', surplusOther: 'Diğer',
    failed: 'Stok güncellenemedi',
    productsLabel: 'Ürün', changesLabel: 'Fark Var',
    completedTitle: 'Sayım Tamamlandı', newCount: 'Yeni Sayım',
    goToProducts: 'Ürünlere Git', partialError: 'Kısmi Hata',
    corrected: 'düzeltildi', reasonsTitle: 'Fark Nedenleri', updated: 'güncellendi',
    expiryPrefix: 'SKT:',
  },
  settings: {
    title: 'Ayarlar & Profil', subtitle: 'Hesap bilgileri ve uygulama ayarları',
    email: 'E-posta', registrationDate: 'Kayıt Tarihi',
    updateName: 'Ad Soyad Güncelle', namePlaceholder: 'Ad Soyad', update: 'Güncelle',
    updateEmail: 'E-posta Güncelle', newEmailPlaceholder: 'Yeni e-posta adresi',
    currentPasswordPlaceholder: 'Mevcut şifreniz', sendVerification: 'Doğrulama Gönder',
    verificationInfo: 'Yeni adrese doğrulama e-postası gönderilir. Linke tıkladıktan sonra e-postanız güncellenir.',
    changePassword: 'Şifre Değiştir', currentPassword: 'Mevcut şifre',
    newPassword: 'Yeni şifre', confirmPassword: 'Yeni şifre tekrar',
    passwordMismatch: 'Şifreler eşleşmiyor', changePasswordBtn: 'Şifreyi Değiştir',
    appInfo: 'Uygulama', appName: 'Uygulama Adı', version: 'Sürüm', platform: 'Platform',
    logout: 'Oturumu Kapat', logoutDesc: 'Hesabınızdan güvenli çıkış yapın', logoutBtn: 'Çıkış Yap',
    nameUpdated: 'Ad soyad güncellendi', updateFailed: 'Güncelleme başarısız',
    verificationSent: 'Doğrulama e-postası gönderildi. Linke tıklayınca e-postanız güncellenir.',
    emailUpdateFailed: 'E-posta güncellenemedi', wrongPassword: 'Mevcut şifre yanlış',
    passwordChanged: 'Şifre değiştirildi', passwordFailed: 'Şifre değiştirilemedi',
  },
};

const EN: Translations = {
  nav: {
    dashboard: 'Dashboard', products: 'Products', pos: 'Sales / POS',
    customers: 'Customers', credit: 'Credit', reports: 'Reports',
    expenses: 'Expenses', suppliers: 'Suppliers', stockCount: 'Stock Count',
    settings: 'Settings', other: 'More', lightMode: 'Light Mode',
    darkMode: 'Dark Mode', admin: 'Admin', cashier: 'Cashier',
    staff: 'Staff', cart: 'Cart', home: 'Home',
    switchToEn: 'English', switchToTr: 'Türkçe',
    offline: 'Offline', offlineDesc: 'Sales will sync automatically when internet is restored',
  },
  common: {
    save: 'Save', cancel: 'Cancel', edit: 'Edit', add: 'Add', delete: 'Delete',
    back: 'Back', close: 'Close', search: 'Search', all: 'All', new: 'New',
    update: 'Update', complete: 'Complete', apply: 'Apply', optional: 'optional',
    piece: 'pcs', today: 'Today', thisWeek: 'This Week', thisMonth: 'This Month',
    loading: 'Loading...', error: 'Error', success: 'Success',
    notFound: 'Not found', noInfo: 'No info', yes: 'Yes', no: 'No', total: 'Total',
  },
  auth: {
    loginTitle: 'Sign in to your account', email: 'Email', password: 'Password',
    rememberMe: 'Remember me', forgotPassword: 'Forgot password',
    login: 'Sign In', noAccount: "Don't have an account?", register: 'Register',
    emailPlaceholder: 'example@email.com', passwordPlaceholder: 'Your password',
    emailInvalid: 'Enter a valid email', passwordRequired: 'Password is required',
    registerTitle: 'Create Account', registerSubtitle: 'Create a new account',
    displayName: 'Full Name', displayNamePlaceholder: 'Your Full Name',
    displayNameRequired: 'Full name is required',
    confirmPassword: 'Confirm Password', confirmPasswordPlaceholder: 'Repeat your password',
    passwordMismatch: 'Passwords do not match', passwordTooShort: 'Password must be at least 6 characters',
    hasAccount: 'Already have an account?', goLogin: 'Sign in',
    forgotTitle: 'Reset Password', forgotSubtitle: "We'll send a reset link to your email",
    sendReset: 'Send Reset Link', backToLogin: 'Back to login', resetSent: 'Reset email sent',
    verifyTitle: 'Verify Your Email', verifySubtitle: 'We sent a verification link to your email',
    resendEmail: 'Resend', goHome: 'Go to Home',
    verifyConfirm: 'Verified, Continue', otherAccount: 'Sign in with different account',
    notVerifiedYet: 'Email not yet verified. Click the link in the email then try again.',
    resendFailed: 'Failed to send email. Please wait a moment and try again.',
    errUserNotFound: 'No user found with this email.',
    errWrongPassword: 'Wrong password.',
    errTooManyRequests: 'Too many attempts. Please wait.',
    errInvalidCredential: 'Invalid email or password.',
    errDefault: 'Sign in failed.',
  },
  dashboard: {
    title: 'Dashboard', dateFormat: 'en-US',
    todaySales: "Today's Sales", todayLabel: 'Today',
    totalProducts: 'Total Products', activeProducts: 'active products',
    criticalStock: 'Critical Stock', warning: 'Warning',
    expiryDate: 'Expiry Date', attention: 'Attention', in30Days: 'within 30 days',
    criticalStockWarning: 'Critical Stock Alert',
    expiringProducts: 'Products Nearing Expiry',
    transactions: 'transactions', items: 'products',
    expired: 'Expired', expiresToday: 'Expires today', daysLeft: 'days left',
  },
  products: {
    title: 'Products', newProduct: 'New Product',
    editProduct: 'Edit Product', addProduct: 'Add New Product',
    editSubtitle: 'Update product information', addSubtitle: 'Enter new product details',
    searchPlaceholder: 'Search by name, barcode or brand...',
    criticalStock: 'Critical Stock', nearExpiry: 'Near Expiry',
    loadError: 'Failed to load products', noProducts: 'No products found', addFirst: 'Add Product',
    addToCart: 'Add to Cart', salePrice: 'Sale Price', criticalStockWarn: 'Critical stock',
    expired: 'Expired', expiresToday: 'Expires today', daysLeftPrefix: 'Exp:',
    detail: 'Product Detail', currentStock: 'Current Stock', minStockWarn: 'Min stock:',
    productInfo: 'Product Information', stockMovements: 'Recent Stock Movements',
    viewAll: 'View all', noMovements: 'No stock movements yet',
    stockActions: 'Stock Actions', addStock: 'Add Stock', removeStock: 'Remove Stock',
    viewMovements: 'Stock Movements',
    prices: 'Prices', purchasePrice: 'Purchase Price', vat: 'VAT', margin: 'Profit Margin',
    batches: 'Batches', batchCount: 'batches', noBatches: 'No batch records', noExpiry: 'No expiry',
    piece: 'pcs',
    formName: 'Product Name *', formBarcode: 'Barcode', formBrand: 'Brand', formCategory: 'Category *',
    formPricing: 'Pricing', formVat: 'VAT Rate (%)', formStockInfo: 'Stock Info',
    formStockQty: 'Stock Quantity *', formMinStock: 'Minimum Stock',
    formFirstBatch: 'Initial Batch Info', formGtsNo: 'GTS No',
    formExpiry: 'Expiry Date', formDescription: 'Description',
    formIsActive: 'Product Active', formIsActiveDesc: 'If off, product is hidden from list and sales',
    formNameRequired: 'Product name is required',
    formCategoryPlaceholder: 'Select or type category',
    formVatPlaceholder: 'e.g. 5, 10, 20',
    formGtsPlaceholder: 'GTS number for this batch',
    formExpiryPlaceholder: 'Select date',
    formDescriptionPlaceholder: 'Product description (optional)',
    formBarcodePlaceholder: 'Barcode number',
    formBrandPlaceholder: 'Brand name',
    dialogAddStock: 'Add Stock', dialogRemoveStock: 'Remove Stock',
    dialogQty: 'Quantity', dialogReason: 'Reason', dialogSupplier: 'Supplier',
    dialogSelectSupplier: 'Select supplier...', dialogGts: 'GTS No', dialogExpiry: 'Expiry Date',
    dialogReasonPlaceholder: 'e.g. Count, return, supply...',
    dialogGtsPlaceholder: 'GTS number for this batch',
    dialogExpiryPlaceholder: 'DD.MM.YYYY',
    dialogAdd: 'Add', dialogRemove: 'Remove',
    updated: 'Product updated', added: 'Product added', stockUpdated: 'Stock updated',
    updateFailed: 'Update failed', stockFailed: 'Stock update failed',
    permissionError: 'Permission error — check Firebase rules', categoryOther: 'Other',
    categoryPlaceholder: 'Select or type category',
    stockIn: 'Stock in', stockOut: 'Stock out',
    infoName: 'Product Name', infoCategory: 'Category', infoBarcode: 'Barcode', infoBrand: 'Brand',
    infoMinStock: 'Min. Stock', infoVat: 'VAT Rate', infoExpiry: 'Expiry',
    infoDescription: 'Description',
    totalMovements: 'Total', movementsIn: 'Inflows', movementsOut: 'Outflows',
  },
  pos: {
    title: 'Cart', emptyCart: 'Cart is empty',
    emptyCartDesc: 'You can add products from the Products page',
    goToProducts: 'Go to Products', clearCart: 'Clear', selectCustomer: 'Select Customer',
    orderSummary: 'Order Summary', subtotal: 'Subtotal', discount: 'Discount', total: 'Total',
    cashPayment: 'Cash Payment', cardPayment: 'Pay by Card', creditPayment: 'Credit',
    cash: 'Cash', card: 'Card',
    totalAmount: 'Total Amount', receivedAmount: 'Amount Received', change: 'Change',
    complete: 'Complete', cancel: 'Cancel',
    basketAmount: 'Cart Total', interestRate: 'Interest Rate (%)', installments: 'Installments',
    interestAmount: 'Interest', totalWithInterest: 'Total (with interest)', perInstallment: 'Installment',
    searchCustomer: 'Search by name or phone...', noCustomer: 'No customer found',
    saleCompleted: 'Sale completed!', saleFailed: 'Sale could not be saved!',
    barcodeNotFound: 'Barcode not found', added: 'added', items: 'items', itemUnit: 'pcs',
  },
  customers: {
    title: 'Customers', newCustomer: 'New Customer',
    searchPlaceholder: 'Search by name or phone...',
    noCustomers: 'No customers found', loadError: 'Failed to load customers',
    editCustomer: 'Edit Customer', addCustomer: 'New Customer',
    editSubtitle: 'Update customer information', addSubtitle: 'Add new customer',
    firstName: 'First Name *', lastName: 'Last Name *', phone: 'Phone *',
    email: 'Email', address: 'Address', notes: 'Notes', tcNo: 'ID No',
    firstNamePlaceholder: 'First name', lastNamePlaceholder: 'Last name',
    phonePlaceholder: 'Phone number', emailPlaceholder: 'example@email.com',
    addressPlaceholder: 'Address (optional)', notesPlaceholder: 'Notes (optional)',
    tcNoPlaceholder: '11-digit national ID number',
    firstNameRequired: 'First name is required', lastNameRequired: 'Last name is required',
    phoneRequired: 'Phone is required',
    customerInfo: 'Customer Information', debtStatus: 'Debt Status',
    noDebt: 'No debt', debt: 'Debt', totalDebt: 'Total Debt',
    totalPaid: 'Total Paid', remainingBalance: 'Remaining Balance', accountSummary: 'Account Summary',
    transactions: 'Transactions', noTransactions: 'No transactions yet',
    viewTransactions: 'View Account Transactions',
    added: 'Customer added', updated: 'Customer updated', saveFailed: 'Save failed',
  },
  credit: {
    title: 'Credit / Current Account', debtors: 'customers in debt',
    searchPlaceholder: 'Search customer...', noDebtors: 'No customers with credit', debt: 'Debt',
    cashCollection: 'Cash Collection', cardCollection: 'Card Collection',
    currentDebt: 'Current Debt', collectionAmount: 'Collection Amount',
    note: 'Note', notePlaceholder: 'Description', descriptionPlaceholder: 'Description',
    collected: 'Collection recorded', collectFailed: 'Collection could not be saved',
    movementHistory: 'Transaction History', records: 'records', saveFailed: 'Save failed',
    noTransactions: 'No transactions yet',
    paidWithCard: 'by card', paidCash: 'cash', paid: 'paid',
    cashPayDesc: 'Cash payment', cardPayDesc: 'Card payment',
  },
  reports: {
    title: 'Reports', subtitle: 'Sales and revenue analysis',
    totalRevenue: 'Total Revenue', saleCount: 'Sales Count', sale: 'sales', avgSale: 'Avg Sale',
    paymentTypes: 'Payment Types', cash: 'Cash', card: 'Card', credit: 'Credit', mixed: 'Mixed',
    expenseTotal: 'Total Expenses', expense: 'expenses', netProfit: 'Net Profit',
    salesTrend: 'Sales Trend', noData: 'No data for this period',
    today: 'Today', thisWeek: 'This Week', thisMonth: 'This Month',
    hourly: 'Hourly', daily: 'Daily', chartSales: 'Sales', cashSale: 'Cash Sales',
    weekDays: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', cashCustomer: 'Cash',
  },
  expenses: {
    title: 'Expenses', subtitle: 'Rent, electricity, water and other expenses', addExpense: 'Add Expense',
    month: 'This Month', week: 'This Week', all: 'All',
    noExpenses: 'No expenses found', addFirst: 'Add expense',
    expenseName: 'Expense Name', expenseNamePlaceholder: 'e.g. Rent, Electricity...',
    amount: 'Amount (₺)', category: 'Category', date: 'Date', note: 'Note',
    notePlaceholder: 'Optional description', recurring: 'Recurring Expense',
    recurringDesc: 'Automatically repeat every month',
    editExpense: 'Edit Expense', addExpenseTitle: 'Add Expense',
    added: 'Expense added', deleted: 'Expense deleted',
    deleteTitle: 'Delete Expense', deleteConfirm: 'Are you sure you want to delete this expense?',
    deleteYes: 'Yes, Delete', deleteNo: 'No',
  },
  suppliers: {
    title: 'Suppliers', newSupplier: 'New Supplier',
    searchPlaceholder: 'Search by company name or phone...',
    noInfo: 'No info', noSuppliers: 'No suppliers found',
    editSupplier: 'Edit Supplier', addSupplier: 'New Supplier',
    editSubtitle: 'Update supplier information', addSubtitle: 'Add new supplier',
    companyName: 'Company Name *', companyNamePlaceholder: 'Supplier company name',
    companyNameRequired: 'Company name is required',
    contactPerson: 'Contact Person', contactPersonPlaceholder: 'Full Name', contactShort: 'Contact',
    phone: 'Phone', phonePlaceholder: 'Phone number',
    email: 'Email', emailPlaceholder: 'company@email.com',
    address: 'Address', addressPlaceholder: 'Company address',
    taxNo: 'Tax No', taxNoPlaceholder: 'Tax number',
    notes: 'Notes', notesPlaceholder: 'Optional notes', isActive: 'Active',
    productsSupplied: 'Products Supplied', companyInfo: 'Company Info',
    noProducts: 'No products purchased from this supplier',
    noProductsHint: 'Link products by selecting this supplier when adding stock',
    suppliedCount: 'products',
    saved: 'Supplier saved', saveFailed: 'Save failed',
    updated: 'Updated', updateFailed: 'Update failed',
    deleteTitle: 'Delete Supplier', deleteConfirm: 'Are you sure you want to delete this supplier?',
    deleteAccept: 'Delete', deleteCancel: 'Cancel', deleteFailed: 'Delete failed',
  },
  stockCount: {
    title: 'Stock Count', subtitle: 'Enter counted quantity, confirm differences',
    complete: 'Complete', searchPlaceholder: 'Search product...',
    countedLabel: 'Counted', diffLabel: 'Diff', system: 'System',
    noChanges: 'No changes', changes: 'changes',
    shortage: 'Shortage', surplus: 'Surplus', completed: 'Stock count completed',
    confirmTitle: 'Stock Adjustments', confirmSubtitle: 'The following changes will be applied',
    reason: 'Reason', batchAffected: 'Affected Batch', noExpiry: 'No expiry', apply: 'Apply',
    shortageExpiry: 'Expiry passed', shortageDamage: 'Damage / spoilage',
    shortageTheft: 'Theft / loss', shortageCountError: 'Count error', shortageOther: 'Other',
    surplusCountError: 'Count error', surplusReturn: 'Return / return purchase', surplusOther: 'Other',
    failed: 'Stock update failed',
    productsLabel: 'Products', changesLabel: 'Changes',
    completedTitle: 'Count Complete', newCount: 'New Count',
    goToProducts: 'Go to Products', partialError: 'Partial Error',
    corrected: 'corrected', reasonsTitle: 'Difference Reasons', updated: 'updated',
    expiryPrefix: 'Exp:',
  },
  settings: {
    title: 'Settings & Profile', subtitle: 'Account information and app settings',
    email: 'Email', registrationDate: 'Registration Date',
    updateName: 'Update Full Name', namePlaceholder: 'Full Name', update: 'Update',
    updateEmail: 'Update Email', newEmailPlaceholder: 'New email address',
    currentPasswordPlaceholder: 'Current password', sendVerification: 'Send Verification',
    verificationInfo: 'A verification email will be sent to the new address. Your email will be updated after clicking the link.',
    changePassword: 'Change Password', currentPassword: 'Current password',
    newPassword: 'New password', confirmPassword: 'Confirm new password',
    passwordMismatch: 'Passwords do not match', changePasswordBtn: 'Change Password',
    appInfo: 'Application', appName: 'App Name', version: 'Version', platform: 'Platform',
    logout: 'Sign Out', logoutDesc: 'Securely sign out of your account', logoutBtn: 'Sign Out',
    nameUpdated: 'Full name updated', updateFailed: 'Update failed',
    verificationSent: 'Verification email sent. Your email will be updated after clicking the link.',
    emailUpdateFailed: 'Email could not be updated', wrongPassword: 'Current password is wrong',
    passwordChanged: 'Password changed', passwordFailed: 'Password could not be changed',
  },
};

export const TRANSLATIONS: Record<Lang, Translations> = { tr: TR, en: EN };
