import { PURCHASES_EN, PURCHASES_TR, PurchasesTexts } from '../../features/purchases/purchases.i18n';
import { INVENTORY_EN, INVENTORY_TR, InventoryTexts } from '../../features/products/inventory.i18n';
import { BACKUP_EN, BACKUP_TR, BackupTexts } from '../../features/backup/backup.i18n';
import { FARMER_EN, FARMER_TR, FarmerTranslations } from '../../features/farmer/i18n/farmer.i18n';
import { SHELL_EN, SHELL_TR, ShellTexts } from '../../layout/shell.i18n';
import { HOME_EN, HOME_TR, HomeTexts } from '../../features/dashboard/home.i18n';
import { POS_EN, POS_TR, PosTexts } from '../../features/pos/pos.i18n';
import { ACCOUNT_EN, ACCOUNT_TR, AccountTexts } from '../../features/credit/account.i18n';

export type Lang = 'tr' | 'en';

export interface Translations {
  /** Mevzuat: e-reçete, ruhsat, GTS izlenebilirlik (ürün / POS / satış). */
  compliance: {
    sectionTitle: string; productType: string;
    typeBitkiKoruma: string; typeGubre: string; typeTohum: string; typeFide: string; typeDiger: string;
    requiresPrescription: string; requiresPrescriptionHint: string;
    licenseNo: string; activeIngredient: string; phiDays: string; phiHint: string; toxicityClass: string;
    labelNotice: string; days: string; noSuppliers: string; formGtsHint: string; gtsStockGap: string;
    rxTitle: string; rxIntroRequired: string; rxIntroWarn: string; rxCustomer: string; rxNeedsCustomer: string;
    rxNo: string; rxNoPlaceholder: string; rxNoInvalid: string; rxPrescriber: string;
    rxSkip: string; rxContinue: string; rxBadge: string; rxRequiredError: string; rxMissing: string;
    gtsRemove: string; gtsList: string; gtsAlreadyInCart: string; gtsUnavailable: string; expiredBlocked: string;
    rxSalesFilter: string; rxExport: string; rxExportEmpty: string; rxExportSheet: string; rxExportFailed: string;
    tcNo: string; cksNo: string; unit: string;
    prescriptionModeTitle: string; prescriptionModeDesc: string;
    modeRequired: string; modeRequiredDesc: string; modeWarn: string; modeWarnDesc: string; modeOff: string; modeOffDesc: string;
  };
  /** Tasarım v2 kabuk (layout/shell.i18n.ts). */
  shell: ShellTexts;
  /** Tasarım v2 ana sayfa (features/dashboard/home.i18n.ts). */
  home: HomeTexts;
  /** Tasarım v2 POS + satışlar (features/pos/pos.i18n.ts). */
  pos2: PosTexts;
  /** Tasarım v2 cari ekranları (features/credit/account.i18n.ts). */
  acc: AccountTexts;
  nav: {
    dashboard: string; products: string; pos: string; customers: string;
    credit: string; reports: string; expenses: string; suppliers: string;
    stockCount: string; settings: string; other: string;
    lightMode: string; darkMode: string;
    admin: string; cashier: string; staff: string;
    cart: string; home: string;
    switchToEn: string; switchToTr: string;
    offline: string; offlineDesc: string;
    team: string; adminPanel: string;
    account: string; logout: string; mainMenu: string; userMenu: string;
    collapseMenu: string; expandMenu: string; language: string; online: string;
  };
  common: {
    save: string; cancel: string; edit: string; add: string; delete: string;
    back: string; close: string; search: string; all: string; new: string; filters: string;
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
    verifyTitle: string; verifySubtitle: string; resendEmail: string;
    verifyConfirm: string; otherAccount: string;
    notVerifiedYet: string; resendFailed: string;
    errUserNotFound: string; errWrongPassword: string;
    errTooManyRequests: string; errInvalidCredential: string; errDefault: string;
    errUserDisabled: string; errNetwork: string; errEmailInUse: string; errWeakPassword: string;
    errInvalidEmail: string; errRecentLogin: string; errAccountInactive: string; errProfileUnavailable: string; errProfileRetry: string; retryProfile: string;
    errRegisterDefault: string; errResetDefault: string; errVerifyCheck: string;
    verifyAutoCheck: string; verifySuccess: string; resendIn: string; resendSent: string; invitePending: string;
  };
  dashboard: {
    title: string; dateFormat: string;
    todaySales: string; todayLabel: string;
    totalProducts: string;
    criticalStock: string; warning: string;
    expiryDate: string; in30Days: string;
    expiringProducts: string;
    transactions: string; items: string;
    expired: string; expiresToday: string; daysLeft: string;
    weekSales: string; monthSales: string; todayGrossProfit: string; estimated: string;
    recentSales: string; noSalesToday: string;
    quickActions: string; newSale: string; addProduct: string;
    collect: string; viewAll: string; stockOk: string; noExpiring: string;
    goodMorning: string; goodAfternoon: string; goodEvening: string; firstSaleHint: string; revenue: string;
  };
  products: {
    title: string; newProduct: string; editProduct: string; addProduct: string;
    editSubtitle: string; addSubtitle: string;
    searchPlaceholder: string; criticalStock: string;
    loadError: string; noProducts: string; addFirst: string;
    addToCart: string; salePrice: string;
    expired: string; expiresToday: string; daysLeftPrefix: string;
    detail: string; currentStock: string;
    stockMovements: string; viewAll: string;
    noMovements: string; addStock: string;
    removeStock: string; viewMovements: string;
    purchasePrice: string; vat: string; margin: string;
    batches: string; noExpiry: string;
    piece: string;
    formName: string; formBarcode: string; formBrand: string; formCategory: string;
    formVat: string; formStockQty: string;
    formMinStock: string; formGtsNo: string;
    formExpiry: string; formDescription: string; formIsActive: string;
    formIsActiveDesc: string; formNameRequired: string;
    formCategoryPlaceholder: string; formVatPlaceholder: string;
    formExpiryPlaceholder: string;
    formDescriptionPlaceholder: string; formBarcodePlaceholder: string;
    formBrandPlaceholder: string;
    dialogAddStock: string; dialogRemoveStock: string;
    dialogQty: string; dialogReason: string; dialogSupplier: string;
    dialogSelectSupplier: string; dialogGts: string; dialogExpiry: string;
    dialogReasonPlaceholder: string;
    dialogExpiryPlaceholder: string; dialogAdd: string; dialogRemove: string;
    updated: string; added: string; stockUpdated: string;
    updateFailed: string; stockFailed: string;
    permissionError: string; categoryOther: string;
    stockIn: string; stockOut: string;
    infoName: string; infoCategory: string; infoBarcode: string; infoBrand: string;
    infoMinStock: string; infoVat: string; infoExpiry: string; infoDescription: string;
    totalMovements: string; movementsIn: string; movementsOut: string;
    active: string; passive: string; makeActive: string; makePassive: string;
    statusUpdated: string; statusFailed: string; showPassive: string;
    deleteTitle: string; deleteConfirm: string; deleteAccept: string; deleteCancel: string;
    deleted: string; deleteFailed: string;
    dialogGtsScanPlaceholder: string; dialogGtsDuplicate: string;
    dialogGtsListEmpty: string;
    gtsListTitle: string; gtsAddBtn: string; gtsColExpiry: string; gtsColAdded: string;
    gtsNone: string; gtsEmpty: string;
    gtsRemoveTitle: string; gtsRemoveConfirm: string; gtsRemoved: string; gtsSaved: string;
    gtsColCode: string; dayShort: string; locale: string; expiredBadge: string; expiredUnits: string;
    mismatchTitle: string; mismatchStock: string; mismatchBatchTotal: string;
    reconcileBtn: string; addMissingBatchBtn: string; reconcileReason: string; reconcileConfirm: string;
    addMissingBatchConfirm: string; reconciled: string; fefoShortfall: string;
    initialStockReason: string; gtsOutReason: string; unitOutReason: string;
    gtsRemoveQtyTitle: string; gtsRemoveQtyLabel: string; gtsRemoveQtyHint: string;
    gtsDuplicateOther: string; barcodeDuplicate: string; vatInvalid: string;
    categoryRequired: string; salePriceRequired: string; formStockEditHint: string;
    movementsLimitNote: string;
    unitLabel: string; unitAdet: string; unitKg: string; unitLt: string; unitPaket: string; unitCuval: string; unitMetre: string;
    unitDecimalHint: string; markup: string; productCount: string; loadMore: string; outOfStock: string;
    cartIncrease: string; cartDecrease: string; inCart: string; gtsChipRemove: string;
    reconcileHint: string; gtsUnitsCount: string;
  };
  pos: {
    title: string; emptyCart: string; goToProducts: string;
    clearCart: string; selectCustomer: string;
    subtotal: string; discount: string; total: string;
    cashPayment: string; creditPayment: string;
    cash: string; card: string;
    totalAmount: string; receivedAmount: string; change: string;
    complete: string; cancel: string;
    interestRate: string; installments: string;
    interestAmount: string; totalWithInterest: string; perInstallment: string;
    /** Y12: fişte veresiyeye yazılan borç (peşinat düşülmüş, vade farkı dahil) — "toplam" değildir. */
    creditDebtWithInterest: string;
    searchCustomer: string; noCustomer: string;
    saleCompleted: string; saleFailed: string; barcodeNotFound: string; added: string;
    items: string;
    outOfStock: string; stockLimit: string; insufficientCash: string;
    remainingToCredit: string; creditNeedsCustomer: string;
    productUnavailable: string; globalDiscount: string;
    insufficientStock: string; expiredUnitsWarn: string; batchShortfallWarn: string;
    confirmSaleTitle: string; confirmSellAnyway: string;
    units: { adet: string; kg: string; lt: string; paket: string; cuval: string; metre: string };
    pageTitle: string; searchLabel: string; searchPlaceholder: string; scannerReady: string; scannerPaused: string;
    noResults: string; moreResults: string;
    inCart: string; stock: string; quantity: string; decrease: string; increase: string; removeItem: string;
    emptyCartHint: string; changeCustomer: string; removeCustomer: string;
    discountPercent: string; discountAmount: string; discountValue: string; removeDiscount: string;
    cardConfirmTitle: string; cardConfirmQuestion: string; cardConfirmYes: string;
    printReceipt: string; newSale: string;
  };
  sales: {
    title: string; subtitle: string; saleRef: string; cancelRef: string;
    searchPlaceholder: string; from: string; to: string; status: string;
    statusCompleted: string; statusCancelled: string; statusRefunded: string;
    noSales: string; loadError: string; detail: string; notFound: string;
    saleNo: string; date: string; customer: string; walkIn: string;
    products: string; quantity: string; unitPrice: string; lineTotal: string;
    paymentMethod: string; methodCash: string; methodCard: string; methodCredit: string; methodMixed: string;
    cashPaid: string; cardPaid: string; creditAmount: string; change: string;
    cancelSale: string; cancelConfirmTitle: string; cancelConfirmDesc: string;
    cancelReason: string; cancelSuccess: string; cancelFailed: string; alreadyCancelled: string;
    cancelledAt: string; count: string;
    /** Y4: iptal yetkisi / zorunlu neden */
    cancelReasonPlaceholder: string; cancelReasonRequired: string; cancelDeniedOwn: string; cancelDeniedToday: string;
    cancelDeniedRole: string; cancelAudit: string;
    printReceipt: string; thankYou: string; receiptTotal: string; items: string;
    /** Y12 fiş: KDV dökümü, borçlu imza; Y11 tahsilat makbuzu */
    vatBreakdown: string; vatBase: string; vatUnknown: string; debtorSignature: string;
    paymentReceipt: string; paymentAmount: string; prevBalance: string; newBalance: string; methodTransfer: string;
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
    customerInfo: string;
    noDebt: string; debt: string; totalDebt: string;
    totalPaid: string; accountSummary: string;
    transactions: string; noTransactions: string;
    added: string; updated: string; saveFailed: string;
    showArchived: string; archivedBadge: string; restore: string; restored: string;
    deleteTitle: string; deleteConfirm: string; deleted: string; deleteFailed: string; deleteHasBalance: string;
    countSuffix: string; emptyHint: string; emailInvalid: string; tcNoInvalid: string;
    village: string; villagePlaceholder: string; cksNo: string; cksNoPlaceholder: string;
    creditLimit: string; creditLimitHint: string; phoneInvalid: string; tcNoChecksum: string; tcNeedsConsent: string;
    kvkkTitle: string; kvkkShow: string; kvkkSection: string; kvkkInfo: string; kvkkLoadFailed: string; print: string;
    consentProcessing: string; consentContact: string; consentGivenAt: string; consentNone: string;
    showTc: string; hideTc: string; newSale: string; reminder: string; whatsapp: string; sms: string;
    noContactConsent: string; noPhone: string; privacy: string;
    exportData: string; exportJson: string; exportExcel: string; exportFailed: string;
    sheetCustomer: string; sheetTransactions: string; sheetSales: string;
    anonymize: string; anonymizeConfirm: string; anonymizeHasBalance: string; anonymized: string;
    anonymizeFailed: string; anonymizeOffline: string; anonymizedBadge: string;
  };
  credit: {
    title: string; debtors: string; searchPlaceholder: string;
    noDebtors: string; debt: string;
    currentDebt: string; collectionAmount: string; note: string;
    notePlaceholder: string;
    collected: string; collectFailed: string;
    records: string; saveFailed: string;
    noTransactions: string;
    paid: string;
    cashPayDesc: string; cardPayDesc: string;
    overpayment: string; noDebtToCollect: string; savedOffline: string;
    totalReceivable: string; debtorCount: string; largestDebt: string; customerCard: string;
    pending: string; amountPositive: string; balanceAfter: string;
    collection: string; cash: string; card: string; saleReversal: string; creditSale: string;
    filterAll: string; filterOverdue: string; filterDueWeek: string; overdueTotal: string; overdueCustomers: string;
    daysLate: string; nextDue: string; dueThisWeek: string; noFilterResult: string;
    dueDate: string; remaining: string; undatedDebt: string;
    creditLimit: string; limitExceeded: string; downPayment: string;
    statement: string; statementFrom: string; statementTo: string; statementCreate: string; statementFailed: string;
    stTitle: string; stPeriod: string; stCustomer: string; stDate: string; stDescription: string;
    stDebit: string; stCredit: string; stBalance: string; stOpening: string; stClosing: string; stTotal: string;
    stOverdue: string; stPrintedAt: string;
  };
  reports: {
    title: string; subtitle: string;
    saleCount: string; sale: string;
    paymentTypes: string; cash: string; card: string; credit: string; mixed: string;
    expenseTotal: string; netProfit: string;
    salesTrend: string; noData: string;
    today: string; thisWeek: string; thisMonth: string;
    hourly: string; daily: string; chartSales: string;
    weekDays: string; cashCustomer: string;
    thisYear: string; monthsShort: string; dateLocale: string;
    grossProfit: string; cost: string; costEstimatedNote: string;
    interestIncome: string; interestIncomeNote: string;
    collections: string; collectionsCash: string; collectionsCard: string; collectionsTransfer: string;
    cashRegister: string; cashSales: string; cardSales: string; creditSales: string; netCash: string; netCashNote: string;
    topProducts: string; byCategory: string; product: string; category: string; quantity: string; revenue: string;
    uncategorized: string; exportExcel: string; exportPdf: string; exportFailed: string;
    date: string; customer: string; payment: string; amount: string; summary: string; loadError: string;
    period: string; profitChain: string; printCash: string; salesList: string; grossMargin: string; printedAt: string;
  };
  expenses: {
    title: string; subtitle: string; addExpense: string;
    month: string; week: string; all: string;
    noExpenses: string; addFirst: string;
    expenseName: string; expenseNamePlaceholder: string;
    amount: string; category: string; date: string; note: string;
    notePlaceholder: string; recurring: string; recurringDesc: string;
    addExpenseTitle: string;
    added: string; deleted: string;
    deleteTitle: string; deleteConfirm: string; deleteYes: string; deleteNo: string;
    deleteSeries: string; deleteOnlyThis: string; deleteSeriesConfirm: string; seriesDeleted: string;
    recordCount: string; recurringBadge: string; titleRequired: string; categoryRequired: string; amountRequired: string;
  };
  suppliers: {
    title: string; newSupplier: string; searchPlaceholder: string;
    noInfo: string; noSuppliers: string;
    addSupplier: string;
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
    loadError: string; deleteHasProducts: string;
    countSuffix: string; emailInvalid: string;
  };
  stockCount: {
    title: string; subtitle: string; complete: string;
    searchPlaceholder: string; countedLabel: string;
    system: string; changes: string;
    shortage: string; surplus: string; completed: string;
    confirmSubtitle: string;
    reason: string; noExpiry: string; apply: string;
    failed: string;
    productsLabel: string; changesLabel: string; completedTitle: string;
    newCount: string; goToProducts: string; partialError: string;
    corrected: string; reasonsTitle: string; updated: string;
    expiryPrefix: string;
    fefoLabel: string; applying: string; errorsTitle: string; retryFailed: string;
    matched: string; movementReason: string;
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
    appName: string; version: string; platform: string;
    logout: string; logoutDesc: string; logoutBtn: string;
    nameUpdated: string; updateFailed: string;
    verificationSent: string; emailUpdateFailed: string;
    wrongPassword: string; passwordChanged: string; passwordFailed: string;
    emailInUse: string;
    security: string;
    business: string; businessName: string; address: string; phone: string;
    taxOffice: string; taxNo: string; receiptFooter: string;
    businessSaved: string; businessSaveFailed: string; businessLoadFailed: string; businessReadOnly: string;
    platformDesktop: string; platformAndroid: string; platformWeb: string;
  };
  team: {
    title: string; subtitle: string;
    inviteTitle: string; inviteEmailPlaceholder: string; inviteBtn: string; inviteInfo: string;
    pendingInvites: string; cancelInvite: string; cancelInviteConfirm: string;
    members: string; owner: string; you: string; inactive: string;
    deactivate: string; activate: string; deactivateConfirm: string;
    loadFailed: string; alreadyMember: string; inviteCreated: string; inviteExists: string; inviteFailed: string; maxUsersReached: string; licenseReadOnly: string;
    actionFailed: string; roleChanged: string; deactivated: string; activated: string;
    role: string;
  };
  /** Satın alma + tedarikçi cari (metinler: features/purchases/purchases.i18n.ts) */
  purchases: PurchasesTexts;
  /** Tasarım v2 ürün/stok/alış ekranları (features/products/inventory.i18n.ts) */
  inventory: InventoryTexts;
  /** Yedekleme (metinler: features/backup/backup.i18n.ts) */
  backup: BackupTexts;
  farmer: FarmerTranslations;
}

const TR: Translations = {
  compliance: {
    sectionTitle: 'Mevzuat', productType: 'Ürün türü',
    typeBitkiKoruma: 'Bitki koruma ürünü (zirai ilaç)', typeGubre: 'Gübre', typeTohum: 'Tohum', typeFide: 'Fide / Fidan', typeDiger: 'Diğer',
    requiresPrescription: 'E-reçete zorunlu',
    requiresPrescriptionHint: "Bakanlığın BKÜ Veri Tabanı'nda reçeteli olarak listelenen ürünlerde açık tutun. Satışta e-reçete no ve müşteri istenir.",
    licenseNo: 'Ruhsat no', activeIngredient: 'Etken madde', phiDays: 'Hasat öncesi bekleme süresi (gün)',
    phiHint: 'Etiketteki değer; yalnızca bilgi amaçlıdır.', toxicityClass: 'Toksisite / tehlike sınıfı',
    labelNotice: 'Bu bilgiler ürün etiketinden kayıt amaçlı girilir. Uygulama kullanım tavsiyesi vermez; kullanım için ürün etiketine ve reçeteye bakılmalıdır.',
    days: 'gün', noSuppliers: 'Kayıtlı tedarikçi yok',
    formGtsHint: 'Her karekodu okutup Enter’a basın; her GTS 1 birim stok olur.',
    gtsStockGap: '{n} birim GTS’siz (karekodsuz) stok olarak kaydedilecek.',
    rxTitle: 'E-reçete', rxIntroRequired: 'Sepette e-reçeteli ürün var. Satış için müşteri ve e-reçete numarası gerekli.',
    rxIntroWarn: 'Sepette e-reçeteli ürün var. Mevzuat gereği e-reçete numarası girilmelidir; bu modda atlanabilir.',
    rxCustomer: 'Müşteri (çiftçi)', rxNeedsCustomer: 'E-reçeteli ürün anonim satılamaz; müşteri seçin.',
    rxNo: 'E-reçete no', rxNoPlaceholder: 'Reçete numarasını yazın veya okutun', rxNoInvalid: 'Geçerli bir e-reçete numarası girin (en az 4 karakter, harf/rakam).',
    rxPrescriber: 'Reçeteyi yazan', rxSkip: 'E-reçetesiz devam', rxContinue: 'Devam',
    rxBadge: 'E-reçeteli', rxRequiredError: 'E-reçete bilgisi eksik', rxMissing: 'Girilmedi',
    gtsRemove: 'Karekodu kaldır', gtsList: 'GTS / karekod', gtsAlreadyInCart: 'Bu karekod zaten sepette',
    gtsUnavailable: 'Okutulan karekod stokta yok', expiredBlocked: 'Son kullanma tarihi geçmiş bitki koruma ürünü satılamaz',
    rxSalesFilter: 'Reçeteli satışlar', rxExport: 'Reçete kayıtları (Excel)', rxExportEmpty: 'Bu aralıkta reçeteli satış yok',
    rxExportSheet: 'Reçeteli Satışlar', rxExportFailed: 'Dışa aktarma başarısız',
    tcNo: 'TC kimlik no', cksNo: 'ÇKS / kayıt no', unit: 'Birim',
    prescriptionModeTitle: 'E-reçete kontrolü',
    prescriptionModeDesc: 'Bitki koruma ürünlerinde reçeteli satış kuralı (13.12.2025 tarihli yönetmelik).',
    modeRequired: 'Zorunlu', modeRequiredDesc: 'Reçeteli üründe müşteri ve e-reçete no olmadan satış tamamlanmaz.',
    modeWarn: 'Uyarı', modeWarnDesc: 'Sorulur, gerekirse atlanabilir (sorumluluk bayide).',
    modeOff: 'Kapalı', modeOffDesc: 'E-reçete sorulmaz.',
  },
  purchases: PURCHASES_TR,
  inventory: INVENTORY_TR,
  backup: BACKUP_TR,
  farmer: FARMER_TR,
  shell: SHELL_TR,
  home: HOME_TR,
  pos2: POS_TR,
  acc: ACCOUNT_TR,
  nav: {
    dashboard: 'Ana Sayfa', products: 'Ürünler', pos: 'Satış / POS',
    customers: 'Müşteriler', credit: 'Veresiye', reports: 'Raporlar',
    expenses: 'Giderler', suppliers: 'Tedarikçiler', stockCount: 'Stok Sayımı',
    settings: 'Ayarlar', other: 'Diğer', lightMode: 'Aydınlık Mod',
    darkMode: 'Karanlık Mod', admin: 'Yönetici', cashier: 'Kasiyer',
    staff: 'Personel', cart: 'Sepet', home: 'Ana Sayfa',
    switchToEn: 'English', switchToTr: 'Türkçe',
    offline: 'Çevrimdışı', offlineDesc: 'Satışlar internete bağlanınca otomatik senkronize edilir',
    team: 'Ekip',
    adminPanel: 'Yönetim Paneli',
    account: 'Hesabım', logout: 'Çıkış Yap', mainMenu: 'Ana menü', userMenu: 'Kullanıcı menüsü',
    collapseMenu: 'Menüyü daralt', expandMenu: 'Menüyü genişlet', language: 'Dil', online: 'Çevrimiçi',
  },
  common: {
    save: 'Kaydet', cancel: 'İptal', edit: 'Düzenle', add: 'Ekle', delete: 'Sil',
    back: 'Geri', close: 'Kapat', search: 'Ara', all: 'Tümü', new: 'Yeni', filters: 'Filtreler',
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
    resendEmail: 'Tekrar Gönder',
    verifyConfirm: 'Doğruladım, Devam Et', otherAccount: 'Farklı hesapla giriş yap',
    notVerifiedYet: 'E-posta henüz doğrulanmadı. Maildeki linke tıkladıktan sonra tekrar dene.',
    resendFailed: 'Mail gönderilemedi, biraz bekleyip tekrar dene.',
    errUserNotFound: 'Bu e-posta ile kayıtlı kullanıcı yok.',
    errWrongPassword: 'Hatalı şifre.',
    errTooManyRequests: 'Çok fazla deneme. Lütfen bekleyin.',
    errInvalidCredential: 'E-posta veya şifre hatalı.',
    errDefault: 'Giriş başarısız.',
    errUserDisabled: 'Bu hesap devre dışı bırakılmış.',
    errNetwork: 'İnternet bağlantısı yok. Bağlantınızı kontrol edip tekrar deneyin.',
    errEmailInUse: 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.',
    errWeakPassword: 'Şifre çok zayıf. En az 6 karakter kullanın.',
    errInvalidEmail: 'Geçersiz e-posta adresi.',
    errRecentLogin: 'Güvenlik için tekrar giriş yapmanız gerekiyor.',
    errAccountInactive: 'Hesabınız işletme yöneticisi tarafından pasife alınmış. Yöneticinizle görüşün.',
    errProfileUnavailable: 'Kullanıcı profiliniz okunamadı. İnternet bağlantınızı kontrol edip tekrar giriş yapın.',
    errProfileRetry: 'Giriş yapıldı ama sunucuya şu an ulaşılamıyor; profiliniz yüklenemedi. Bağlantınızı kontrol edip "Tekrar dene"ye basın.',
    retryProfile: 'Tekrar dene',
    errRegisterDefault: 'Kayıt başarısız. Lütfen tekrar deneyin.',
    errResetDefault: 'Sıfırlama e-postası gönderilemedi. Lütfen tekrar deneyin.',
    errVerifyCheck: 'Doğrulama durumu kontrol edilemedi. Tekrar deneyin.',
    verifyAutoCheck: 'Doğrulama otomatik kontrol ediliyor...',
    verifySuccess: 'E-postanız doğrulandı! Yönlendiriliyorsunuz...',
    resendIn: '{s} sn sonra tekrar gönderebilirsiniz',
    resendSent: 'Doğrulama e-postası tekrar gönderildi. Gelen kutunuzu (ve spam klasörünü) kontrol edin.',
    invitePending: 'Bir işletmeye davet edildiniz. E-postanızı doğruladığınızda ekibe katılacaksınız.',
  },
  dashboard: {
    title: 'Ana Sayfa', dateFormat: 'tr-TR',
    todaySales: 'Bugünkü Satış', todayLabel: 'Bugün',
    totalProducts: 'Toplam Ürün',
    criticalStock: 'Kritik Stok', warning: 'Uyarı',
    expiryDate: 'Son Kullanma', in30Days: '30 gün içinde',
    expiringProducts: 'Son Kullanma Tarihi Yaklaşan Ürünler',
    transactions: 'işlem', items: 'ürün',
    expired: 'SKT geçmiş', expiresToday: 'Bugün son', daysLeft: 'gün kaldı',
    weekSales: 'Bu Hafta', monthSales: 'Bu Ay', todayGrossProfit: 'Bugünkü Brüt Kâr', estimated: 'tahmini',
    recentSales: 'Son Satışlar', noSalesToday: 'Henüz satış yok',
    quickActions: 'Hızlı İşlemler', newSale: 'Yeni Satış',
    addProduct: 'Ürün Ekle',
    collect: 'Tahsilat', viewAll: 'Tümünü gör',
    stockOk: 'Tüm ürünlerin stoğu yeterli', noExpiring: '30 gün içinde SKT dolan ürün yok',
    goodMorning: 'Günaydın', goodAfternoon: 'İyi günler', goodEvening: 'İyi akşamlar',
    firstSaleHint: 'İlk satışı yaptığınızda burada görünecek', revenue: 'Ciro',
  },
  products: {
    title: 'Ürünler', newProduct: 'Yeni Ürün',
    editProduct: 'Ürünü Düzenle', addProduct: 'Yeni Ürün Ekle',
    editSubtitle: 'Ürün bilgilerini güncelleyin', addSubtitle: 'Yeni ürün bilgilerini girin',
    searchPlaceholder: 'Ürün adı, barkod veya marka ara...',
    criticalStock: 'Kritik Stok',
    loadError: 'Ürünler yüklenemedi', noProducts: 'Ürün bulunamadı', addFirst: 'Ürün Ekle',
    addToCart: 'Sepete Ekle', salePrice: 'Satış Fiyatı',
    expired: 'SKT geçmiş', expiresToday: 'Bugün son', daysLeftPrefix: 'SKT:',
    detail: 'Ürün Detayı', currentStock: 'Mevcut Stok',
    stockMovements: 'Son Stok Hareketleri',
    viewAll: 'Tümünü gör', noMovements: 'Henüz stok hareketi yok',
    addStock: 'Stok Ekle', removeStock: 'Stok Çıkar',
    viewMovements: 'Stok Hareketleri',
    purchasePrice: 'Alış Fiyatı', vat: 'KDV', margin: 'Kâr Marjı',
    batches: 'Partiler', noExpiry: 'SKT yok',
    piece: 'adet',
    formName: 'Ürün Adı *', formBarcode: 'Barkod', formBrand: 'Marka', formCategory: 'Kategori *',
    formVat: 'KDV Oranı (%)',
    formStockQty: 'Stok Miktarı *', formMinStock: 'Minimum Stok',
    formGtsNo: 'GTS No',
    formExpiry: 'Son Kullanma Tarihi', formDescription: 'Açıklama',
    formIsActive: 'Ürün Aktif', formIsActiveDesc: 'Kapalıysa ürün listede ve satışta görünmez',
    formNameRequired: 'Ürün adı zorunlu',
    formCategoryPlaceholder: 'Kategori seçin veya yazın',
    formVatPlaceholder: 'Örn: 0, 1, 10, 20',
    formExpiryPlaceholder: 'Tarih seçin',
    formDescriptionPlaceholder: 'Ürün açıklaması (opsiyonel)',
    formBarcodePlaceholder: 'Barkod numarası',
    formBrandPlaceholder: 'Marka adı',
    dialogAddStock: 'Stok Ekle', dialogRemoveStock: 'Stok Çıkar',
    dialogQty: 'Miktar', dialogReason: 'Neden', dialogSupplier: 'Tedarikçi',
    dialogSelectSupplier: 'Tedarikçi seçin...', dialogGts: 'GTS No', dialogExpiry: 'Son Kullanma Tarihi',
    dialogReasonPlaceholder: 'Örn: Sayım, iade, tedarik...',
    dialogExpiryPlaceholder: 'GG.AA.YYYY',
    dialogAdd: 'Ekle', dialogRemove: 'Çıkar',
    updated: 'Ürün güncellendi', added: 'Ürün eklendi', stockUpdated: 'Stok güncellendi',
    updateFailed: 'Güncelleme başarısız', stockFailed: 'Stok güncellenemedi',
    permissionError: 'Yetki hatası — Firebase kurallarını kontrol edin', categoryOther: 'Diğer',
    stockIn: 'Stok girişi', stockOut: 'Stok çıkışı',
    infoName: 'Ürün Adı', infoCategory: 'Kategori', infoBarcode: 'Barkod', infoBrand: 'Marka',
    infoMinStock: 'Min. Stok', infoVat: 'KDV Oranı', infoExpiry: 'Son Kullanma',
    infoDescription: 'Açıklama',
    totalMovements: 'Toplam', movementsIn: 'Girişler', movementsOut: 'Çıkışlar',
    active: 'Aktif', passive: 'Pasif', makeActive: 'Aktif Et', makePassive: 'Pasif Yap',
    statusUpdated: 'Ürün durumu güncellendi', statusFailed: 'Durum güncellenemedi',
    showPassive: 'Pasif Ürünler',
    deleteTitle: 'Ürünü Sil',
    deleteConfirm: 'Bu ürün listeden kaldırılsın mı? Kayıt korunur, "Pasif Ürünler" filtresinden geri getirebilirsiniz.',
    deleteAccept: 'Sil', deleteCancel: 'İptal',
    deleted: 'Ürün silindi', deleteFailed: 'Silme başarısız',
    dialogGtsScanPlaceholder: 'GTS / karekod okut veya yaz, Enter',
    dialogGtsDuplicate: 'Bu GTS zaten eklendi',
    dialogGtsListEmpty: 'Henüz GTS eklenmedi — okutunca adet otomatik artar (opsiyonel)',
    gtsListTitle: 'GTS / Karekod Listesi', gtsAddBtn: 'GTS Ekle', gtsColExpiry: 'SKT',
    gtsColAdded: 'Eklenme', gtsNone: 'GTS\'siz',
    gtsEmpty: 'Henüz parti/GTS kaydı yok',
    gtsRemoveTitle: 'Birimi Sil', gtsRemoveConfirm: 'Bu birim/GTS stoktan çıkarılsın mı?',
    gtsRemoved: 'Birim çıkarıldı', gtsSaved: 'Güncellendi',
    gtsColCode: 'GTS / Karekod', dayShort: 'gün', locale: 'tr-TR',
    expiredBadge: 'Süresi geçti', expiredUnits: 'süresi geçmiş birim',
    mismatchTitle: 'Stok ile parti toplamı uyuşmuyor', mismatchStock: 'Stok', mismatchBatchTotal: 'Parti toplamı',
    reconcileBtn: 'Stoku partilerle eşitle', addMissingBatchBtn: 'Farkı GTS\'siz parti olarak ekle',
    reconcileReason: 'Stok-parti uzlaştırma',
    reconcileConfirm: 'Stok {from} → {to} olarak güncellenecek ve fark stok hareketi olarak kaydedilecek. Devam edilsin mi?',
    addMissingBatchConfirm: '{n} adetlik GTS\'siz, SKT\'siz bir parti eklenecek (stok değişmez). Devam edilsin mi?',
    reconciled: 'Stok ve partiler eşitlendi',
    fefoShortfall: 'Partiler yetersizdi: {n} adet partilerden düşülemedi. Stoku partilerle eşitleyin.',
    initialStockReason: 'İlk stok', gtsOutReason: 'GTS çıkışı', unitOutReason: 'Birim çıkışı',
    gtsRemoveQtyTitle: 'Partiden Çıkar', gtsRemoveQtyLabel: 'Çıkarılacak adet',
    gtsRemoveQtyHint: 'Bu GTS\'siz partide {n} adet var.',
    gtsDuplicateOther: 'Bu GTS başka bir üründe kayıtlı:', barcodeDuplicate: 'Bu barkod başka bir üründe kullanılıyor:',
    vatInvalid: 'KDV oranı 0-100 arasında bir sayı olmalı', categoryRequired: 'Kategori zorunlu',
    salePriceRequired: 'Satış fiyatı 0\'dan büyük olmalı',
    formStockEditHint: 'Stok ve partiler ürün detayındaki GTS / parti tablosundan yönetilir.',
    movementsLimitNote: 'Son {n} hareket gösteriliyor',
    unitLabel: 'Birim', unitAdet: 'adet', unitKg: 'kg', unitLt: 'lt', unitPaket: 'paket', unitCuval: 'çuval', unitMetre: 'metre',
    unitDecimalHint: 'kg, lt ve metrede ondalıklı miktar girilebilir (ör. 12,5)',
    markup: 'Kâr Oranı (maliyete göre)', productCount: 'ürün', loadMore: 'Daha fazla göster', outOfStock: 'Tükendi',
    cartIncrease: 'Sepette artır', cartDecrease: 'Sepette azalt', inCart: 'Sepette',
    gtsChipRemove: "GTS'yi listeden çıkar",
    reconcileHint: 'Stok ile GTS / parti tablosundaki toplam aynı olmalı.',
    gtsUnitsCount: 'kayıt',
  },
  pos: {
    title: 'Sepet', emptyCart: 'Sepet boş',
    goToProducts: 'Ürünlere Git', clearCart: 'Temizle', selectCustomer: 'Müşteri Seç',
    subtotal: 'Ara Toplam', discount: 'İndirim', total: 'Toplam',
    cashPayment: 'Nakit Ödeme', creditPayment: 'Veresiye',
    cash: 'Nakit', card: 'Kart',
    totalAmount: 'Toplam Tutar', receivedAmount: 'Alınan Tutar', change: 'Para Üstü',
    complete: 'Tamamla', cancel: 'İptal',
    interestRate: 'Vade Farkı (%)', installments: 'Taksit Sayısı',
    interestAmount: 'Vade Farkı', totalWithInterest: 'Toplam (faizli)', perInstallment: 'Taksit',
    creditDebtWithInterest: 'Veresiye borcu (vade farkı dahil)',
    searchCustomer: 'Ad veya telefon ara...', noCustomer: 'Müşteri bulunamadı',
    saleCompleted: 'Satış tamamlandı!', saleFailed: 'Satış kaydedilemedi!',
    barcodeNotFound: 'Barkod bulunamadı', added: 'eklendi', items: 'ürün',
    outOfStock: 'Stokta yok', stockLimit: 'Stok sınırına ulaşıldı', insufficientCash: 'Alınan tutar toplamdan az',
    remainingToCredit: 'Kalan tutar veresiyeye yazılacak',
    creditNeedsCustomer: 'Eksik tutarı veresiyeye yazmak için önce müşteri seçin',
    productUnavailable: 'Ürün bulunamadı veya pasif', globalDiscount: 'Sepet İndirimi',
    insufficientStock: 'Yetersiz stok', expiredUnitsWarn: 'Süresi geçmiş birim satılıyor',
    batchShortfallWarn: 'Parti kaydı yetersiz (stok ile parti toplamı uyuşmuyor)',
    confirmSaleTitle: 'Satışı onayla', confirmSellAnyway: 'Yine de sat',
    units: { adet: 'adet', kg: 'kg', lt: 'lt', paket: 'paket', cuval: 'çuval', metre: 'm' },
    pageTitle: 'Hızlı Satış', searchLabel: 'Ürün ara',
    searchPlaceholder: 'Barkod okutun veya ürün adı / GTS yazın',
    scannerReady: 'Barkod okuyucu hazır', scannerPaused: 'Okuyucu beklemede',
    noResults: 'Eşleşen ürün yok',
    moreResults: 'Daha fazlası için aramayı daraltın',
    inCart: 'Sepette', stock: 'Stok', quantity: 'Miktar', decrease: 'Azalt', increase: 'Artır', removeItem: 'Sepetten çıkar',
    emptyCartHint: 'Barkod okutun ya da ürün adını yazıp Enter’a basın',
    changeCustomer: 'Değiştir', removeCustomer: 'Müşteriyi kaldır',
    discountPercent: 'Yüzde (%)', discountAmount: 'Tutar (₺)', discountValue: 'İndirim değeri',
    removeDiscount: 'İndirimi kaldır',
    cardConfirmTitle: 'Kart ile tahsilat', cardConfirmQuestion: '{amount} kartla tahsil edildi mi?',
    cardConfirmYes: 'Evet, tahsil edildi',
    printReceipt: 'Fiş Yazdır', newSale: 'Yeni Satış',
  },
  sales: {
    title: 'Satışlar', subtitle: 'Satış geçmişi, iptal ve iade', saleRef: 'Satış', cancelRef: 'İptal',
    searchPlaceholder: 'Satış no, müşteri veya ürün ara...', from: 'Başlangıç', to: 'Bitiş', status: 'Durum',
    statusCompleted: 'Tamamlandı', statusCancelled: 'İptal edildi', statusRefunded: 'İade edildi',
    noSales: 'Bu aralıkta satış yok', loadError: 'Satışlar yüklenemedi', detail: 'Satış Detayı',
    notFound: 'Satış bulunamadı',
    saleNo: 'Satış No', date: 'Tarih', customer: 'Müşteri', walkIn: 'Perakende müşteri',
    products: 'Ürünler', quantity: 'Adet', unitPrice: 'Birim Fiyat', lineTotal: 'Tutar',
    paymentMethod: 'Ödeme', methodCash: 'Nakit', methodCard: 'Kart', methodCredit: 'Veresiye', methodMixed: 'Karma',
    cashPaid: 'Nakit', cardPaid: 'Kart', creditAmount: 'Veresiye', change: 'Para Üstü',
    cancelSale: 'İptal Et / İade', cancelConfirmTitle: 'Satışı iptal et',
    cancelConfirmDesc: 'Stok geri yüklenecek ve varsa veresiye borcu düşülecek. Bu işlem geri alınamaz.',
    cancelReason: 'İptal nedeni', cancelSuccess: 'Satış iptal edildi', cancelFailed: 'Satış iptal edilemedi',
    alreadyCancelled: 'Satış zaten iptal edilmiş', cancelledAt: 'İptal tarihi', count: 'satış',
    cancelReasonPlaceholder: 'Örn. müşteri vazgeçti, yanlış ürün okutuldu',
    cancelReasonRequired: 'İptal nedenini yazın (en az 3 karakter)',
    cancelDeniedOwn: 'Kasiyer yalnız kendi yaptığı satışı iptal edebilir. Yöneticinize başvurun.',
    cancelDeniedToday: 'Kasiyer yalnız bugünkü satışı iptal edebilir. Geçmiş günün satışı için yöneticinize başvurun.',
    cancelDeniedRole: 'Satış iptali için yetkiniz yok. Yöneticinize başvurun.',
    cancelAudit: 'İptal, nedeni ve yapan kişiyle birlikte denetim kaydına yazılır.',
    printReceipt: 'Fiş Yazdır', thankYou: 'Teşekkür ederiz, yine bekleriz', receiptTotal: 'TOPLAM', items: 'kalem',
    vatBreakdown: 'KDV dökümü', vatBase: 'Matrah', vatUnknown: 'KDV oranı bilinmiyor', debtorSignature: 'Borçlu imza',
    paymentReceipt: 'TAHSİLAT MAKBUZU', paymentAmount: 'Tahsil edilen', prevBalance: 'Önceki borç', newBalance: 'Kalan borç',
    methodTransfer: 'Havale/EFT',
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
    customerInfo: 'Müşteri Bilgileri',
    noDebt: 'Borç yok', debt: 'Borç', totalDebt: 'Toplam Borç',
    totalPaid: 'Toplam Ödeme', accountSummary: 'Cari Özet',
    transactions: 'İşlemler', noTransactions: 'Henüz işlem yok',
    added: 'Müşteri eklendi', updated: 'Müşteri güncellendi', saveFailed: 'Kaydedilemedi',
    showArchived: 'Arşivdekiler', archivedBadge: 'Arşivde', restore: 'Geri Al', restored: 'Müşteri geri alındı',
    deleteTitle: 'Müşteriyi Sil', deleteConfirm: 'Müşteri arşivlenecek; geçmiş kayıtları korunur. Devam edilsin mi?',
    deleted: 'Müşteri arşivlendi', deleteFailed: 'Müşteri silinemedi',
    deleteHasBalance: 'Bakiyesi olan müşteri silinemez. Önce tahsilat yapın.',
    countSuffix: 'müşteri', emptyHint: 'İlk müşterinizi ekleyerek veresiye takibine başlayın.',
    emailInvalid: 'Geçerli bir e-posta girin',
    tcNoInvalid: 'TC kimlik no 11 haneli olmalı',
    village: 'Köy / Mahalle', villagePlaceholder: 'Köy veya mahalle (opsiyonel)',
    cksNo: 'ÇKS Kayıt No', cksNoPlaceholder: 'Çiftçi Kayıt Sistemi no (opsiyonel)',
    creditLimit: 'Veresiye Limiti (₺)', creditLimitHint: 'Boş bırakılırsa limitsiz. Aşılınca satışta uyarı verilir.',
    phoneInvalid: 'Telefon 05XX XXX XX XX biçiminde olmalı', tcNoChecksum: 'TC kimlik no geçersiz',
    tcNeedsConsent: 'TC no kaydetmek için veri işleme onayı gerekir',
    kvkkTitle: 'Aydınlatma Metni (KVKK)', kvkkShow: 'Aydınlatma metnini göster', kvkkSection: 'KVKK ve İzinler',
    kvkkInfo: 'Müşteriye aydınlatma metnini gösterin ya da okuyun. Onay vermemesi satış ve veresiyeye engel değildir.',
    kvkkLoadFailed: 'Aydınlatma metni yüklenemedi', print: 'Yazdır',
    consentProcessing: 'Kişisel verilerinin (TC no, ÇKS no) işlenmesine açık rıza verdi',
    consentContact: 'Borç ve vade hatırlatması için telefon, SMS ve WhatsApp ile iletişime açık rıza verdi',
    consentGivenAt: 'Onay', consentNone: 'Onay yok',
    showTc: 'Göster', hideTc: 'Gizle', newSale: 'Satış Yap', reminder: 'Hatırlatma',
    whatsapp: 'WhatsApp ile hatırlat', sms: 'SMS ile hatırlat',
    noContactConsent: 'Müşterinin iletişim (hatırlatma) onayı yok', noPhone: 'Geçerli cep telefonu yok',
    privacy: 'Kişisel Veriler (KVKK)',
    exportData: 'Verilerini dışa aktar', exportJson: 'JSON', exportExcel: 'Excel',
    exportFailed: 'Veriler dışa aktarılamadı',
    sheetCustomer: 'Müşteri', sheetTransactions: 'Cari Hareketler', sheetSales: 'Satışlar',
    anonymize: 'Kişisel verileri anonimleştir',
    anonymizeConfirm: 'Ad, TC, telefon, e-posta ve adres kalıcı olarak silinecek; satış ve cari kayıtları muhasebe için kalacak. Bu işlem geri alınamaz. Devam edilsin mi?',
    anonymizeHasBalance: 'Borcu olan müşterinin verileri anonimleştirilemez',
    anonymized: 'Kişisel veriler anonimleştirildi', anonymizeFailed: 'Anonimleştirilemedi',
    anonymizeOffline: 'Anonimleştirme için internet bağlantısı gerekir', anonymizedBadge: 'Anonimleştirildi',
  },
  credit: {
    title: 'Veresiye / Cari', debtors: 'müşteri borçlu',
    searchPlaceholder: 'Müşteri ara...', noDebtors: 'Veresiyeli müşteri yok', debt: 'Borç',
    currentDebt: 'Mevcut Borç', collectionAmount: 'Tahsilat Tutarı',
    note: 'Not', notePlaceholder: 'Açıklama',
    collected: 'Tahsilat kaydedildi', collectFailed: 'Tahsilat kaydedilemedi',
    records: 'kayıt', saveFailed: 'Kayıt başarısız',
    noTransactions: 'Henüz hareket yok',
    paid: 'ödendi',
    cashPayDesc: 'Nakit ödeme', cardPayDesc: 'Kart ile ödeme',
    overpayment: 'Tahsilat tutarı mevcut borçtan fazla olamaz',
    noDebtToCollect: 'Bu müşterinin borcu yok',
    savedOffline: 'Tahsilat çevrimdışı kaydedildi; bağlantı gelince eşitlenecek',
    totalReceivable: 'Toplam Alacak', debtorCount: 'Borçlu Müşteri', largestDebt: 'En Yüksek Borç',
    customerCard: 'Müşteri Kartı', pending: 'Bekleyen kayıtlar',
    amountPositive: "Tutar 0'dan büyük olmalı", balanceAfter: 'Bakiye',
    collection: 'Tahsilat', cash: 'Nakit', card: 'Kart',
    saleReversal: 'Satış iptali', creditSale: 'Veresiye satış',
    filterAll: 'Tümü', filterOverdue: 'Vadesi geçenler', filterDueWeek: 'Bu hafta vadesi gelenler',
    overdueTotal: 'Gecikmiş Alacak', overdueCustomers: 'müşteri gecikmede',
    daysLate: 'gün gecikti', nextDue: 'Sıradaki vade', dueThisWeek: 'Bu hafta',
    noFilterResult: 'Bu filtreye uyan müşteri yok',
    dueDate: 'Vade', remaining: 'Kalan',
    undatedDebt: 'Vadesiz (eski) borç',
    creditLimit: 'Veresiye Limiti', limitExceeded: 'Veresiye limiti aşıldı',
    downPayment: 'Peşinat',
    statement: 'Hesap Ekstresi (PDF)', statementFrom: 'Başlangıç', statementTo: 'Bitiş',
    statementCreate: 'Ekstre Oluştur', statementFailed: 'Ekstre oluşturulamadı',
    stTitle: 'HESAP EKSTRESİ', stPeriod: 'Dönem', stCustomer: 'Müşteri', stDate: 'Tarih',
    stDescription: 'Açıklama', stDebit: 'Borç', stCredit: 'Alacak', stBalance: 'Bakiye',
    stOpening: 'Devreden bakiye', stClosing: 'Dönem sonu bakiye', stTotal: 'Toplam',
    stOverdue: 'Vadesi geçen', stPrintedAt: 'Düzenlenme tarihi',
  },
  reports: {
    title: 'Raporlar', subtitle: 'Satış ve gelir analizleri',
    saleCount: 'Satış Sayısı', sale: 'satış',
    paymentTypes: 'Ödeme Tipleri', cash: 'Nakit', card: 'Kart', credit: 'Veresiye', mixed: 'Karma',
    expenseTotal: 'Toplam Gider', netProfit: 'Net Kâr',
    salesTrend: 'Satış Trendi', noData: 'Bu dönem veri yok',
    today: 'Bugün', thisWeek: 'Bu Hafta', thisMonth: 'Bu Ay',
    hourly: 'Saatlik', daily: 'Günlük', chartSales: 'Satış',
    weekDays: 'Pzt,Sal,Çar,Per,Cum,Cmt,Paz', cashCustomer: 'Peşin',
    thisYear: 'Bu Yıl', monthsShort: 'Oca,Şub,Mar,Nis,May,Haz,Tem,Ağu,Eyl,Eki,Kas,Ara', dateLocale: 'tr-TR',
    grossProfit: 'Brüt Kâr', cost: 'Maliyet', costEstimatedNote: 'Tahmini: bazı eski satışlarda maliyet kaydı yok, ürünün güncel alış fiyatı kullanıldı.',
    interestIncome: 'Vade Farkı Geliri', interestIncomeNote: 'Faizli veresiye satışlarının vade farkı; ciroya ve net kâra dahil değildir.',
    collections: 'Tahsilat', collectionsCash: 'Tahsilat (Nakit)', collectionsCard: 'Tahsilat (Kart)', collectionsTransfer: 'Tahsilat (Havale/EFT)',
    cashRegister: 'Gün Sonu / Kasa Özeti', cashSales: 'Nakit Satış', cardSales: 'Kartlı Satış', creditSales: 'Veresiye Satış',
    netCash: 'Net Nakit', netCashNote: 'Nakit satış + nakit tahsilat − gider',
    topProducts: 'En Çok Satan 10 Ürün', byCategory: 'Kategori Bazlı Satış', product: 'Ürün', category: 'Kategori',
    quantity: 'Adet', revenue: 'Tutar', uncategorized: 'Kategorisiz',
    exportExcel: 'Excel', exportPdf: 'PDF', exportFailed: 'Dışa aktarma başarısız',
    date: 'Tarih', customer: 'Müşteri', payment: 'Ödeme', amount: 'Tutar', summary: 'Özet', loadError: 'Rapor verisi yüklenemedi',
    period: 'Dönem', profitChain: 'Kâr Zinciri', printCash: 'Kasa Raporunu Yazdır', salesList: 'Satışlar',
    grossMargin: 'Brüt marj', printedAt: 'Yazdırma',
  },
  expenses: {
    title: 'Giderler', subtitle: 'Kira, elektrik, su ve diğer giderler', addExpense: 'Gider Ekle',
    month: 'Bu Ay', week: 'Bu Hafta', all: 'Tümü',
    noExpenses: 'Gider bulunamadı', addFirst: 'Gider ekle',
    expenseName: 'Gider Adı', expenseNamePlaceholder: 'Örn: Kira, Elektrik...',
    amount: 'Tutar (₺)', category: 'Kategori', date: 'Tarih', note: 'Not',
    notePlaceholder: 'Opsiyonel açıklama', recurring: 'Tekrarlı Gider',
    recurringDesc: 'Her ay otomatik tekrar etsin',
    addExpenseTitle: 'Gider Ekle',
    added: 'Gider eklendi', deleted: 'Gider silindi',
    deleteTitle: 'Gider Sil', deleteConfirm: 'Bu gideri silmek istediğinize emin misiniz?',
    deleteYes: 'Evet, Sil', deleteNo: 'Hayır',
    deleteSeries: 'Tüm seriyi sil', deleteOnlyThis: 'Sadece bunu sil',
    deleteSeriesConfirm: 'tekrarlı bir gider. Tüm seriyi mi, sadece bu kaydı mı silmek istersiniz?',
    seriesDeleted: 'Gider serisi silindi',
    recordCount: 'Kayıt Sayısı', recurringBadge: 'Tekrarlı', titleRequired: 'Gider adı zorunlu',
    categoryRequired: 'Kategori seçin', amountRequired: "Tutar 0'dan büyük olmalı",
  },
  suppliers: {
    title: 'Tedarikçiler', newSupplier: 'Yeni Tedarikçi',
    searchPlaceholder: 'Firma adı veya telefon ara...',
    noInfo: 'Bilgi yok', noSuppliers: 'Tedarikçi bulunamadı',
    addSupplier: 'Yeni Tedarikçi',
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
    loadError: 'Tedarikçiler yüklenemedi',
    deleteHasProducts: 'Bu tedarikçiye bağlı ürün partileri var; silinemez',
    countSuffix: 'tedarikçi', emailInvalid: 'Geçerli bir e-posta girin',
  },
  stockCount: {
    title: 'Stok Sayımı', subtitle: 'Sayılan adedi girin, farkı onaylayın',
    complete: 'Tamamla', searchPlaceholder: 'Ürün ara...',
    countedLabel: 'Sayılan', system: 'Sistem',
    changes: 'değişiklik',
    shortage: 'Eksik', surplus: 'Fazla', completed: 'Stok sayımı tamamlandı',
    confirmSubtitle: 'Aşağıdaki değişiklikler uygulanacak',
    reason: 'Neden', noExpiry: 'SKT yok', apply: 'Uygula',
    failed: 'Stok güncellenemedi',
    productsLabel: 'Ürün', changesLabel: 'Fark Var',
    completedTitle: 'Sayım Tamamlandı', newCount: 'Yeni Sayım',
    goToProducts: 'Ürünlere Git', partialError: 'Kısmi Hata',
    corrected: 'düzeltildi', reasonsTitle: 'Fark Nedenleri', updated: 'güncellendi',
    expiryPrefix: 'SKT:',
    fefoLabel: 'FEFO', applying: 'Uygulanıyor', errorsTitle: 'Uygulanamayan ürünler', retryFailed: 'Hatalıları tekrar dene',
    matched: 'Tutuyor', movementReason: 'Stok sayımı',
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
    appName: 'Uygulama Adı', version: 'Sürüm', platform: 'Platform',
    logout: 'Oturumu Kapat', logoutDesc: 'Hesabınızdan güvenli çıkış yapın', logoutBtn: 'Çıkış Yap',
    nameUpdated: 'Ad soyad güncellendi', updateFailed: 'Güncelleme başarısız',
    verificationSent: 'Doğrulama e-postası gönderildi. Linke tıklayınca e-postanız güncellenir.',
    emailUpdateFailed: 'E-posta güncellenemedi', wrongPassword: 'Mevcut şifre yanlış',
    passwordChanged: 'Şifre değiştirildi', passwordFailed: 'Şifre değiştirilemedi',
    emailInUse: 'Bu e-posta başka bir hesapta kullanılıyor',
    security: 'Güvenlik',
    business: 'İşletme Bilgileri',
    businessName: 'İşletme adı', address: 'Adres', phone: 'Telefon',
    taxOffice: 'Vergi dairesi', taxNo: 'Vergi no', receiptFooter: 'Fiş alt notu',
    businessSaved: 'İşletme bilgileri kaydedildi', businessSaveFailed: 'İşletme bilgileri kaydedilemedi',
    businessLoadFailed: 'İşletme bilgileri yüklenemedi', businessReadOnly: 'Bu bilgileri yalnızca yönetici değiştirebilir.',
    platformDesktop: 'Masaüstü', platformAndroid: 'Android', platformWeb: 'Web',
  },
  team: {
    title: 'Ekip / Kullanıcılar', subtitle: 'İşletmenizdeki personel, roller ve davetler',
    inviteTitle: 'Personel Davet Et', inviteEmailPlaceholder: 'personel@email.com', inviteBtn: 'Davet Oluştur',
    inviteInfo: 'Davet edilen kişi bu e-posta adresiyle "Kayıt Ol" sayfasından hesap açıp e-postasını doğruladığında ekibinize katılır. E-posta otomatik gönderilmez; kişiye kendiniz haber verin.',
    pendingInvites: 'Bekleyen Davetler', cancelInvite: 'Daveti iptal et', cancelInviteConfirm: '{email} davetini iptal etmek istiyor musunuz?',
    members: 'Kullanıcılar', owner: 'İşletme Sahibi', you: 'siz', inactive: 'Pasif',
    deactivate: 'Pasife Al', activate: 'Aktifleştir', deactivateConfirm: '{name} pasife alınsın mı? Bu kişi uygulamaya giremez.',
    loadFailed: 'Ekip bilgileri yüklenemedi', alreadyMember: 'Bu e-posta zaten ekibinizde',
    inviteCreated: 'Davet oluşturuldu', inviteExists: 'Bu e-posta için zaten bekleyen bir davet var',
    inviteFailed: 'Davet oluşturulamadı',
    maxUsersReached: "Planınızın kullanıcı sınırına ulaştınız. Daha fazla kullanıcı için destekle iletişime geçin.",
    licenseReadOnly: "Lisansınız sona erdiği için yeni kullanıcı eklenemez.", actionFailed: 'İşlem başarısız', roleChanged: 'Rol güncellendi',
    deactivated: 'Kullanıcı pasife alındı', activated: 'Kullanıcı aktifleştirildi',
    role: 'Rol',
  },
};

const EN: Translations = {
  compliance: {
    sectionTitle: 'Regulatory', productType: 'Product type',
    typeBitkiKoruma: 'Plant protection product (pesticide)', typeGubre: 'Fertilizer', typeTohum: 'Seed', typeFide: 'Seedling / Sapling', typeDiger: 'Other',
    requiresPrescription: 'E-prescription required',
    requiresPrescriptionHint: "Keep on for products listed as prescription-only in the Ministry's PPP database. Sales will ask for the e-prescription no and a customer.",
    licenseNo: 'License no', activeIngredient: 'Active ingredient', phiDays: 'Pre-harvest interval (days)',
    phiHint: 'Value from the label; for information only.', toxicityClass: 'Toxicity / hazard class',
    labelNotice: 'This information is recorded from the product label. The app gives no usage advice; always follow the label and the prescription.',
    days: 'days', noSuppliers: 'No suppliers yet',
    formGtsHint: 'Scan each QR code and press Enter; each GTS becomes 1 unit of stock.',
    gtsStockGap: '{n} unit(s) will be recorded as stock without GTS (no QR code).',
    rxTitle: 'E-prescription', rxIntroRequired: 'The cart contains prescription-only products. A customer and an e-prescription number are required.',
    rxIntroWarn: 'The cart contains prescription-only products. Entering the e-prescription number is expected by regulation.',
    rxCustomer: 'Customer (farmer)', rxNeedsCustomer: 'Prescription-only products cannot be sold anonymously; select a customer.',
    rxNo: 'E-prescription no', rxNoPlaceholder: 'Type or scan the prescription number', rxNoInvalid: 'Enter a valid e-prescription number (at least 4 letters/digits).',
    rxPrescriber: 'Prescribed by', rxSkip: 'Continue without', rxContinue: 'Continue',
    rxBadge: 'Prescription', rxRequiredError: 'E-prescription details missing', rxMissing: 'Not entered',
    gtsRemove: 'Remove QR code', gtsList: 'GTS / QR code', gtsAlreadyInCart: 'This QR code is already in the cart',
    gtsUnavailable: 'Scanned QR code is not in stock', expiredBlocked: 'Expired plant protection products cannot be sold',
    rxSalesFilter: 'Prescription sales', rxExport: 'Prescription records (Excel)', rxExportEmpty: 'No prescription sales in this range',
    rxExportSheet: 'Prescription Sales', rxExportFailed: 'Export failed',
    tcNo: 'National ID no', cksNo: 'Farmer registry (ÇKS) no', unit: 'Unit',
    prescriptionModeTitle: 'E-prescription check',
    prescriptionModeDesc: 'Prescription rule for plant protection products (regulation of 13.12.2025).',
    modeRequired: 'Required', modeRequiredDesc: 'Sales of prescription-only products need a customer and an e-prescription no.',
    modeWarn: 'Warn', modeWarnDesc: 'Asked, but can be skipped (dealer is responsible).',
    modeOff: 'Off', modeOffDesc: 'E-prescription is not asked.',
  },
  purchases: PURCHASES_EN,
  inventory: INVENTORY_EN,
  backup: BACKUP_EN,
  farmer: FARMER_EN,
  shell: SHELL_EN,
  home: HOME_EN,
  pos2: POS_EN,
  acc: ACCOUNT_EN,
  nav: {
    dashboard: 'Dashboard', products: 'Products', pos: 'Sales / POS',
    customers: 'Customers', credit: 'Credit', reports: 'Reports',
    expenses: 'Expenses', suppliers: 'Suppliers', stockCount: 'Stock Count',
    settings: 'Settings', other: 'More', lightMode: 'Light Mode',
    darkMode: 'Dark Mode', admin: 'Admin', cashier: 'Cashier',
    staff: 'Staff', cart: 'Cart', home: 'Home',
    switchToEn: 'English', switchToTr: 'Türkçe',
    offline: 'Offline', offlineDesc: 'Sales will sync automatically when internet is restored',
    team: 'Team',
    adminPanel: 'Admin Panel',
    account: 'My Account', logout: 'Sign Out', mainMenu: 'Main menu', userMenu: 'User menu',
    collapseMenu: 'Collapse menu', expandMenu: 'Expand menu', language: 'Language', online: 'Online',
  },
  common: {
    save: 'Save', cancel: 'Cancel', edit: 'Edit', add: 'Add', delete: 'Delete',
    back: 'Back', close: 'Close', search: 'Search', all: 'All', new: 'New', filters: 'Filters',
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
    resendEmail: 'Resend',
    verifyConfirm: 'Verified, Continue', otherAccount: 'Sign in with different account',
    notVerifiedYet: 'Email not yet verified. Click the link in the email then try again.',
    resendFailed: 'Failed to send email. Please wait a moment and try again.',
    errUserNotFound: 'No user found with this email.',
    errWrongPassword: 'Wrong password.',
    errTooManyRequests: 'Too many attempts. Please wait.',
    errInvalidCredential: 'Invalid email or password.',
    errDefault: 'Sign in failed.',
    errUserDisabled: 'This account has been disabled.',
    errNetwork: 'No internet connection. Check your connection and try again.',
    errEmailInUse: 'An account with this email already exists. Try signing in.',
    errWeakPassword: 'Password is too weak. Use at least 6 characters.',
    errInvalidEmail: 'Invalid email address.',
    errRecentLogin: 'For security, please sign in again.',
    errAccountInactive: 'Your account has been deactivated by the business admin. Contact your admin.',
    errProfileUnavailable: 'Your user profile could not be loaded. Check your connection and sign in again.',
    errProfileRetry: 'You are signed in but the server cannot be reached right now, so your profile could not be loaded. Check your connection and press "Try again".',
    retryProfile: 'Try again',
    errRegisterDefault: 'Registration failed. Please try again.',
    errResetDefault: 'Reset email could not be sent. Please try again.',
    errVerifyCheck: 'Could not check verification status. Try again.',
    verifyAutoCheck: 'Checking verification automatically...',
    verifySuccess: 'Your email is verified! Redirecting...',
    resendIn: 'You can resend in {s}s',
    resendSent: 'Verification email sent again. Check your inbox (and spam folder).',
    invitePending: 'You have been invited to a business. You will join the team once you verify your email.',
  },
  dashboard: {
    title: 'Dashboard', dateFormat: 'en-US',
    todaySales: "Today's Sales", todayLabel: 'Today',
    totalProducts: 'Total Products',
    criticalStock: 'Critical Stock', warning: 'Warning',
    expiryDate: 'Expiry Date', in30Days: 'within 30 days',
    expiringProducts: 'Products Nearing Expiry',
    transactions: 'transactions', items: 'products',
    expired: 'Expired', expiresToday: 'Expires today', daysLeft: 'days left',
    weekSales: 'This Week', monthSales: 'This Month', todayGrossProfit: "Today's Gross Profit", estimated: 'estimated',
    recentSales: 'Recent Sales', noSalesToday: 'No sales yet',
    quickActions: 'Quick Actions', newSale: 'New Sale',
    addProduct: 'Add Product',
    collect: 'Collect Payment', viewAll: 'View all',
    stockOk: 'All products are sufficiently stocked', noExpiring: 'No products expiring within 30 days',
    goodMorning: 'Good morning', goodAfternoon: 'Good afternoon', goodEvening: 'Good evening',
    firstSaleHint: 'Your first sale will show up here', revenue: 'Revenue',
  },
  products: {
    title: 'Products', newProduct: 'New Product',
    editProduct: 'Edit Product', addProduct: 'Add New Product',
    editSubtitle: 'Update product information', addSubtitle: 'Enter new product details',
    searchPlaceholder: 'Search by name, barcode or brand...',
    criticalStock: 'Critical Stock',
    loadError: 'Failed to load products', noProducts: 'No products found', addFirst: 'Add Product',
    addToCart: 'Add to Cart', salePrice: 'Sale Price',
    expired: 'Expired', expiresToday: 'Expires today', daysLeftPrefix: 'Exp:',
    detail: 'Product Detail', currentStock: 'Current Stock',
    stockMovements: 'Recent Stock Movements',
    viewAll: 'View all', noMovements: 'No stock movements yet',
    addStock: 'Add Stock', removeStock: 'Remove Stock',
    viewMovements: 'Stock Movements',
    purchasePrice: 'Purchase Price', vat: 'VAT', margin: 'Profit Margin',
    batches: 'Batches', noExpiry: 'No expiry',
    piece: 'pcs',
    formName: 'Product Name *', formBarcode: 'Barcode', formBrand: 'Brand', formCategory: 'Category *',
    formVat: 'VAT Rate (%)',
    formStockQty: 'Stock Quantity *', formMinStock: 'Minimum Stock',
    formGtsNo: 'GTS No',
    formExpiry: 'Expiry Date', formDescription: 'Description',
    formIsActive: 'Product Active', formIsActiveDesc: 'If off, product is hidden from list and sales',
    formNameRequired: 'Product name is required',
    formCategoryPlaceholder: 'Select or type category',
    formVatPlaceholder: 'e.g. 0, 1, 10, 20',
    formExpiryPlaceholder: 'Select date',
    formDescriptionPlaceholder: 'Product description (optional)',
    formBarcodePlaceholder: 'Barcode number',
    formBrandPlaceholder: 'Brand name',
    dialogAddStock: 'Add Stock', dialogRemoveStock: 'Remove Stock',
    dialogQty: 'Quantity', dialogReason: 'Reason', dialogSupplier: 'Supplier',
    dialogSelectSupplier: 'Select supplier...', dialogGts: 'GTS No', dialogExpiry: 'Expiry Date',
    dialogReasonPlaceholder: 'e.g. Count, return, supply...',
    dialogExpiryPlaceholder: 'DD.MM.YYYY',
    dialogAdd: 'Add', dialogRemove: 'Remove',
    updated: 'Product updated', added: 'Product added', stockUpdated: 'Stock updated',
    updateFailed: 'Update failed', stockFailed: 'Stock update failed',
    permissionError: 'Permission error — check Firebase rules', categoryOther: 'Other',
    stockIn: 'Stock in', stockOut: 'Stock out',
    infoName: 'Product Name', infoCategory: 'Category', infoBarcode: 'Barcode', infoBrand: 'Brand',
    infoMinStock: 'Min. Stock', infoVat: 'VAT Rate', infoExpiry: 'Expiry',
    infoDescription: 'Description',
    totalMovements: 'Total', movementsIn: 'Inflows', movementsOut: 'Outflows',
    active: 'Active', passive: 'Passive', makeActive: 'Activate', makePassive: 'Deactivate',
    statusUpdated: 'Product status updated', statusFailed: 'Failed to update status',
    showPassive: 'Passive Products',
    deleteTitle: 'Delete Product',
    deleteConfirm: 'Remove this product from the list? The record is kept and can be restored from the "Passive Products" filter.',
    deleteAccept: 'Delete', deleteCancel: 'Cancel',
    deleted: 'Product deleted', deleteFailed: 'Delete failed',
    dialogGtsScanPlaceholder: 'Scan or type GTS / QR, press Enter',
    dialogGtsDuplicate: 'This GTS is already added',
    dialogGtsListEmpty: 'No GTS added yet — scanning auto-increments quantity (optional)',
    gtsListTitle: 'GTS / QR List', gtsAddBtn: 'Add GTS', gtsColExpiry: 'Expiry',
    gtsColAdded: 'Added', gtsNone: 'No GTS',
    gtsEmpty: 'No batch/GTS records yet',
    gtsRemoveTitle: 'Remove Unit', gtsRemoveConfirm: 'Remove this unit/GTS from stock?',
    gtsRemoved: 'Unit removed', gtsSaved: 'Updated',
    gtsColCode: 'GTS / QR code', dayShort: 'd', locale: 'en-US',
    expiredBadge: 'Expired', expiredUnits: 'expired units',
    mismatchTitle: 'Stock does not match batch total', mismatchStock: 'Stock', mismatchBatchTotal: 'Batch total',
    reconcileBtn: 'Sync stock with batches', addMissingBatchBtn: 'Add difference as batch without GTS',
    reconcileReason: 'Stock-batch reconciliation',
    reconcileConfirm: 'Stock will be updated {from} → {to} and the difference recorded as a stock movement. Continue?',
    addMissingBatchConfirm: 'A batch of {n} units without GTS and expiry will be added (stock unchanged). Continue?',
    reconciled: 'Stock and batches reconciled',
    fefoShortfall: 'Batches were insufficient: {n} units could not be taken from batches. Sync stock with batches.',
    initialStockReason: 'Initial stock', gtsOutReason: 'GTS removal', unitOutReason: 'Unit removal',
    gtsRemoveQtyTitle: 'Remove from Batch', gtsRemoveQtyLabel: 'Quantity to remove',
    gtsRemoveQtyHint: 'This batch without GTS has {n} units.',
    gtsDuplicateOther: 'This GTS is registered on another product:', barcodeDuplicate: 'This barcode is used by another product:',
    vatInvalid: 'VAT rate must be a number between 0 and 100', categoryRequired: 'Category is required',
    salePriceRequired: 'Sale price must be greater than 0',
    formStockEditHint: 'Stock and batches are managed from the GTS / batch table on the product detail page.',
    movementsLimitNote: 'Showing the last {n} movements',
    unitLabel: 'Unit', unitAdet: 'pcs', unitKg: 'kg', unitLt: 'L', unitPaket: 'pack', unitCuval: 'sack', unitMetre: 'm',
    unitDecimalHint: 'Decimal quantities are allowed for kg, L and m (e.g. 12.5)',
    markup: 'Markup (on cost)', productCount: 'products', loadMore: 'Show more', outOfStock: 'Out of stock',
    cartIncrease: 'Increase in cart', cartDecrease: 'Decrease in cart', inCart: 'In cart',
    gtsChipRemove: 'Remove GTS from list',
    reconcileHint: 'Stock should equal the total in the GTS / batch table.',
    gtsUnitsCount: 'records',
  },
  pos: {
    title: 'Cart', emptyCart: 'Cart is empty',
    goToProducts: 'Go to Products', clearCart: 'Clear', selectCustomer: 'Select Customer',
    subtotal: 'Subtotal', discount: 'Discount', total: 'Total',
    cashPayment: 'Cash Payment', creditPayment: 'Credit',
    cash: 'Cash', card: 'Card',
    totalAmount: 'Total Amount', receivedAmount: 'Amount Received', change: 'Change',
    complete: 'Complete', cancel: 'Cancel',
    interestRate: 'Interest Rate (%)', installments: 'Installments',
    interestAmount: 'Interest', totalWithInterest: 'Total (with interest)', perInstallment: 'Installment',
    creditDebtWithInterest: 'Credit debt (incl. interest)',
    searchCustomer: 'Search by name or phone...', noCustomer: 'No customer found',
    saleCompleted: 'Sale completed!', saleFailed: 'Sale could not be saved!',
    barcodeNotFound: 'Barcode not found', added: 'added', items: 'items',
    outOfStock: 'Out of stock', stockLimit: 'Stock limit reached', insufficientCash: 'Amount received is less than total',
    remainingToCredit: 'Remaining amount will be added to credit',
    creditNeedsCustomer: 'Select a customer first to put the remaining amount on credit',
    productUnavailable: 'Product not found or inactive', globalDiscount: 'Cart Discount',
    insufficientStock: 'Insufficient stock', expiredUnitsWarn: 'Selling expired units',
    batchShortfallWarn: 'Not enough batch records (stock and batch total differ)',
    confirmSaleTitle: 'Confirm sale', confirmSellAnyway: 'Sell anyway',
    units: { adet: 'pcs', kg: 'kg', lt: 'L', paket: 'pack', cuval: 'sack', metre: 'm' },
    pageTitle: 'Quick Sale', searchLabel: 'Search products',
    searchPlaceholder: 'Scan a barcode or type product name / GTS',
    scannerReady: 'Barcode scanner ready', scannerPaused: 'Scanner paused',
    noResults: 'No matching products',
    moreResults: 'Refine your search to see more',
    inCart: 'In cart', stock: 'Stock', quantity: 'Quantity', decrease: 'Decrease', increase: 'Increase', removeItem: 'Remove from cart',
    emptyCartHint: 'Scan a barcode or type a product name and press Enter',
    changeCustomer: 'Change', removeCustomer: 'Remove customer',
    discountPercent: 'Percent (%)', discountAmount: 'Amount (₺)', discountValue: 'Discount value',
    removeDiscount: 'Remove discount',
    cardConfirmTitle: 'Card payment', cardConfirmQuestion: 'Was {amount} charged to the card?',
    cardConfirmYes: 'Yes, charged',
    printReceipt: 'Print Receipt', newSale: 'New Sale',
  },
  sales: {
    title: 'Sales', subtitle: 'Sales history, cancellations and refunds', saleRef: 'Sale', cancelRef: 'Cancellation',
    searchPlaceholder: 'Search sale no, customer or product...', from: 'From', to: 'To', status: 'Status',
    statusCompleted: 'Completed', statusCancelled: 'Cancelled', statusRefunded: 'Refunded',
    noSales: 'No sales in this range', loadError: 'Sales could not be loaded', detail: 'Sale Details',
    notFound: 'Sale not found',
    saleNo: 'Sale No', date: 'Date', customer: 'Customer', walkIn: 'Walk-in customer',
    products: 'Products', quantity: 'Qty', unitPrice: 'Unit Price', lineTotal: 'Amount',
    paymentMethod: 'Payment', methodCash: 'Cash', methodCard: 'Card', methodCredit: 'Credit', methodMixed: 'Mixed',
    cashPaid: 'Cash', cardPaid: 'Card', creditAmount: 'Credit', change: 'Change',
    cancelSale: 'Cancel / Refund', cancelConfirmTitle: 'Cancel sale',
    cancelConfirmDesc: 'Stock will be restored and any credit debt will be reversed. This cannot be undone.',
    cancelReason: 'Cancellation reason', cancelSuccess: 'Sale cancelled', cancelFailed: 'Sale could not be cancelled',
    alreadyCancelled: 'Sale is already cancelled', cancelledAt: 'Cancelled at', count: 'sales',
    cancelReasonPlaceholder: 'e.g. customer changed mind, wrong item scanned',
    cancelReasonRequired: 'Enter a reason (at least 3 characters)',
    cancelDeniedOwn: 'Cashiers can only cancel their own sales. Ask a manager.',
    cancelDeniedToday: 'Cashiers can only cancel today\'s sales. Ask a manager for older sales.',
    cancelDeniedRole: 'You are not allowed to cancel sales. Ask a manager.',
    cancelAudit: 'The cancellation is recorded in the audit log with its reason and user.',
    printReceipt: 'Print Receipt', thankYou: 'Thank you, see you again', receiptTotal: 'TOTAL', items: 'items',
    vatBreakdown: 'VAT breakdown', vatBase: 'Net', vatUnknown: 'VAT rate unknown', debtorSignature: 'Debtor signature',
    paymentReceipt: 'PAYMENT RECEIPT', paymentAmount: 'Amount received', prevBalance: 'Previous balance', newBalance: 'Remaining balance',
    methodTransfer: 'Bank transfer',
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
    customerInfo: 'Customer Information',
    noDebt: 'No debt', debt: 'Debt', totalDebt: 'Total Debt',
    totalPaid: 'Total Paid', accountSummary: 'Account Summary',
    transactions: 'Transactions', noTransactions: 'No transactions yet',
    added: 'Customer added', updated: 'Customer updated', saveFailed: 'Save failed',
    showArchived: 'Archived', archivedBadge: 'Archived', restore: 'Restore', restored: 'Customer restored',
    deleteTitle: 'Delete Customer', deleteConfirm: 'The customer will be archived; history is kept. Continue?',
    deleted: 'Customer archived', deleteFailed: 'Could not delete customer',
    deleteHasBalance: 'A customer with an outstanding balance cannot be deleted. Collect payment first.',
    countSuffix: 'customers', emptyHint: 'Add your first customer to start tracking credit sales.',
    emailInvalid: 'Enter a valid email',
    tcNoInvalid: 'National ID must be 11 digits',
    village: 'Village / Neighbourhood', villagePlaceholder: 'Village or neighbourhood (optional)',
    cksNo: 'Farmer Registry No (ÇKS)', cksNoPlaceholder: 'Farmer Registry System no (optional)',
    creditLimit: 'Credit Limit (₺)', creditLimitHint: 'Leave empty for no limit. A warning is shown at checkout when exceeded.',
    phoneInvalid: 'Phone must be in 05XX XXX XX XX format', tcNoChecksum: 'Invalid national ID',
    tcNeedsConsent: 'Data processing consent is required to store the national ID',
    kvkkTitle: 'Privacy Notice (KVKK)', kvkkShow: 'Show privacy notice', kvkkSection: 'Privacy and Consents',
    kvkkInfo: 'Show or read the privacy notice to the customer. Refusing consent does not prevent sales or credit.',
    kvkkLoadFailed: 'Privacy notice could not be loaded', print: 'Print',
    consentProcessing: 'Gave explicit consent to processing of personal data (national ID, farmer registry no)',
    consentContact: 'Gave explicit consent to be contacted by phone, SMS and WhatsApp for debt reminders',
    consentGivenAt: 'Consent', consentNone: 'No consent',
    showTc: 'Show', hideTc: 'Hide', newSale: 'New Sale', reminder: 'Reminder',
    whatsapp: 'Remind via WhatsApp', sms: 'Remind via SMS',
    noContactConsent: 'Customer has not consented to reminders', noPhone: 'No valid mobile number',
    privacy: 'Personal Data (KVKK)',
    exportData: 'Export customer data', exportJson: 'JSON', exportExcel: 'Excel',
    exportFailed: 'Data could not be exported',
    sheetCustomer: 'Customer', sheetTransactions: 'Account Movements', sheetSales: 'Sales',
    anonymize: 'Anonymize personal data',
    anonymizeConfirm: 'Name, national ID, phone, email and address will be permanently deleted; sales and account records are kept for accounting. This cannot be undone. Continue?',
    anonymizeHasBalance: 'A customer with an outstanding balance cannot be anonymized',
    anonymized: 'Personal data anonymized', anonymizeFailed: 'Could not anonymize',
    anonymizeOffline: 'An internet connection is required to anonymize', anonymizedBadge: 'Anonymized',
  },
  credit: {
    title: 'Credit / Current Account', debtors: 'customers in debt',
    searchPlaceholder: 'Search customer...', noDebtors: 'No customers with credit', debt: 'Debt',
    currentDebt: 'Current Debt', collectionAmount: 'Collection Amount',
    note: 'Note', notePlaceholder: 'Description',
    collected: 'Collection recorded', collectFailed: 'Collection could not be saved',
    records: 'records', saveFailed: 'Save failed',
    noTransactions: 'No transactions yet',
    paid: 'paid',
    cashPayDesc: 'Cash payment', cardPayDesc: 'Card payment',
    overpayment: 'Payment cannot exceed the current debt',
    noDebtToCollect: 'This customer has no debt',
    savedOffline: 'Payment saved offline; it will sync when the connection is back',
    totalReceivable: 'Total Receivable', debtorCount: 'Customers in Debt', largestDebt: 'Largest Debt',
    customerCard: 'Customer Card', pending: 'Pending records',
    amountPositive: 'Amount must be greater than 0', balanceAfter: 'Balance',
    collection: 'Payment', cash: 'Cash', card: 'Card',
    saleReversal: 'Sale cancelled', creditSale: 'Credit sale',
    filterAll: 'All', filterOverdue: 'Overdue', filterDueWeek: 'Due this week',
    overdueTotal: 'Overdue Receivables', overdueCustomers: 'customers overdue',
    daysLate: 'days late', nextDue: 'Next due', dueThisWeek: 'This week',
    noFilterResult: 'No customers match this filter',
    dueDate: 'Due', remaining: 'Remaining',
    undatedDebt: 'Debt without due date',
    creditLimit: 'Credit Limit', limitExceeded: 'Credit limit exceeded',
    downPayment: 'Down payment',
    statement: 'Account Statement (PDF)', statementFrom: 'From', statementTo: 'To',
    statementCreate: 'Create Statement', statementFailed: 'Statement could not be created',
    stTitle: 'ACCOUNT STATEMENT', stPeriod: 'Period', stCustomer: 'Customer', stDate: 'Date',
    stDescription: 'Description', stDebit: 'Debit', stCredit: 'Credit', stBalance: 'Balance',
    stOpening: 'Opening balance', stClosing: 'Closing balance', stTotal: 'Total',
    stOverdue: 'Overdue', stPrintedAt: 'Issued',
  },
  reports: {
    title: 'Reports', subtitle: 'Sales and revenue analysis',
    saleCount: 'Sales Count', sale: 'sales',
    paymentTypes: 'Payment Types', cash: 'Cash', card: 'Card', credit: 'Credit', mixed: 'Mixed',
    expenseTotal: 'Total Expenses', netProfit: 'Net Profit',
    salesTrend: 'Sales Trend', noData: 'No data for this period',
    today: 'Today', thisWeek: 'This Week', thisMonth: 'This Month',
    hourly: 'Hourly', daily: 'Daily', chartSales: 'Sales',
    weekDays: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', cashCustomer: 'Cash',
    thisYear: 'This Year', monthsShort: 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec', dateLocale: 'en-US',
    grossProfit: 'Gross Profit', cost: 'Cost', costEstimatedNote: 'Estimated: some older sales have no cost snapshot; current purchase price was used.',
    interestIncome: 'Interest Income', interestIncomeNote: 'Interest on credit sales; not included in revenue or net profit.',
    collections: 'Collections', collectionsCash: 'Collections (Cash)', collectionsCard: 'Collections (Card)', collectionsTransfer: 'Collections (Bank transfer)',
    cashRegister: 'End of Day / Register', cashSales: 'Cash Sales', cardSales: 'Card Sales', creditSales: 'Credit Sales',
    netCash: 'Net Cash', netCashNote: 'Cash sales + cash collections − expenses',
    topProducts: 'Top 10 Products', byCategory: 'Sales by Category', product: 'Product', category: 'Category',
    quantity: 'Qty', revenue: 'Amount', uncategorized: 'Uncategorized',
    exportExcel: 'Excel', exportPdf: 'PDF', exportFailed: 'Export failed',
    date: 'Date', customer: 'Customer', payment: 'Payment', amount: 'Amount', summary: 'Summary', loadError: 'Could not load report data',
    period: 'Period', profitChain: 'Profit Chain', printCash: 'Print Cash Report', salesList: 'Sales',
    grossMargin: 'Gross margin', printedAt: 'Printed',
  },
  expenses: {
    title: 'Expenses', subtitle: 'Rent, electricity, water and other expenses', addExpense: 'Add Expense',
    month: 'This Month', week: 'This Week', all: 'All',
    noExpenses: 'No expenses found', addFirst: 'Add expense',
    expenseName: 'Expense Name', expenseNamePlaceholder: 'e.g. Rent, Electricity...',
    amount: 'Amount (₺)', category: 'Category', date: 'Date', note: 'Note',
    notePlaceholder: 'Optional description', recurring: 'Recurring Expense',
    recurringDesc: 'Automatically repeat every month',
    addExpenseTitle: 'Add Expense',
    added: 'Expense added', deleted: 'Expense deleted',
    deleteTitle: 'Delete Expense', deleteConfirm: 'Are you sure you want to delete this expense?',
    deleteYes: 'Yes, Delete', deleteNo: 'No',
    deleteSeries: 'Delete whole series', deleteOnlyThis: 'Delete only this',
    deleteSeriesConfirm: 'is a recurring expense. Delete the whole series or only this entry?',
    seriesDeleted: 'Expense series deleted',
    recordCount: 'Records', recurringBadge: 'Recurring', titleRequired: 'Expense name is required',
    categoryRequired: 'Select a category', amountRequired: 'Amount must be greater than 0',
  },
  suppliers: {
    title: 'Suppliers', newSupplier: 'New Supplier',
    searchPlaceholder: 'Search by company name or phone...',
    noInfo: 'No info', noSuppliers: 'No suppliers found',
    addSupplier: 'New Supplier',
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
    loadError: 'Could not load suppliers',
    deleteHasProducts: 'This supplier is referenced by product batches; cannot delete',
    countSuffix: 'suppliers', emailInvalid: 'Enter a valid email',
  },
  stockCount: {
    title: 'Stock Count', subtitle: 'Enter counted quantity, confirm differences',
    complete: 'Complete', searchPlaceholder: 'Search product...',
    countedLabel: 'Counted', system: 'System',
    changes: 'changes',
    shortage: 'Shortage', surplus: 'Surplus', completed: 'Stock count completed',
    confirmSubtitle: 'The following changes will be applied',
    reason: 'Reason', noExpiry: 'No expiry', apply: 'Apply',
    failed: 'Stock update failed',
    productsLabel: 'Products', changesLabel: 'Changes',
    completedTitle: 'Count Complete', newCount: 'New Count',
    goToProducts: 'Go to Products', partialError: 'Partial Error',
    corrected: 'corrected', reasonsTitle: 'Difference Reasons', updated: 'updated',
    expiryPrefix: 'Exp:',
    fefoLabel: 'FEFO', applying: 'Applying', errorsTitle: 'Products that failed', retryFailed: 'Retry failed',
    matched: 'Matches', movementReason: 'Stock count',
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
    appName: 'App Name', version: 'Version', platform: 'Platform',
    logout: 'Sign Out', logoutDesc: 'Securely sign out of your account', logoutBtn: 'Sign Out',
    nameUpdated: 'Full name updated', updateFailed: 'Update failed',
    verificationSent: 'Verification email sent. Your email will be updated after clicking the link.',
    emailUpdateFailed: 'Email could not be updated', wrongPassword: 'Current password is wrong',
    passwordChanged: 'Password changed', passwordFailed: 'Password could not be changed',
    emailInUse: 'This email is used by another account',
    security: 'Security',
    business: 'Business Information',
    businessName: 'Business name', address: 'Address', phone: 'Phone',
    taxOffice: 'Tax office', taxNo: 'Tax no', receiptFooter: 'Receipt footer',
    businessSaved: 'Business information saved', businessSaveFailed: 'Business information could not be saved',
    businessLoadFailed: 'Business information could not be loaded', businessReadOnly: 'Only an administrator can change this information.',
    platformDesktop: 'Desktop', platformAndroid: 'Android', platformWeb: 'Web',
  },
  team: {
    title: 'Team / Users', subtitle: 'Staff, roles and invites of your business',
    inviteTitle: 'Invite Staff', inviteEmailPlaceholder: 'staff@email.com', inviteBtn: 'Create Invite',
    inviteInfo: 'The invited person joins your team after registering with this email on the "Register" page and verifying it. No email is sent automatically; let them know yourself.',
    pendingInvites: 'Pending Invites', cancelInvite: 'Cancel invite', cancelInviteConfirm: 'Cancel the invite for {email}?',
    members: 'Users', owner: 'Owner', you: 'you', inactive: 'Inactive',
    deactivate: 'Deactivate', activate: 'Activate', deactivateConfirm: 'Deactivate {name}? They will not be able to use the app.',
    loadFailed: 'Team could not be loaded', alreadyMember: 'This email is already in your team',
    inviteCreated: 'Invite created', inviteExists: 'There is already a pending invite for this email',
    inviteFailed: 'Invite could not be created',
    maxUsersReached: "You have reached your plan's user limit. Contact support for more users.",
    licenseReadOnly: 'Your license has expired; new users cannot be added.', actionFailed: 'Action failed', roleChanged: 'Role updated',
    deactivated: 'User deactivated', activated: 'User activated',
    role: 'Role',
  },
};

export const TRANSLATIONS: Record<Lang, Translations> = { tr: TR, en: EN };
