import { computed, inject } from '@angular/core';
import { LangService } from '../i18n/lang.service';
import type { TourId } from './onboarding.model';

export interface StepText { title: string; body: string }

export interface OnboardingTexts {
  welcomeTitle: (name: string) => string;
  welcomeBody: string;
  welcomeFarmerBody: string;
  welcomeAdminBody: string;
  start: string;
  later: string;
  never: string;
  next: string;
  prev: string;
  done: string;
  close: string;
  /** "3 / 7" */
  progress: string;
  startTour: string;
  pageTour: string;
  replayTitle: string;
  replayDesc: string;
  replayBtn: string;
  nudgeTitle: (pct: number) => string;
  nudgeBody: string;
  nudgeBtn: string;
  nudgeHide: string;
  tours: Record<TourId, Record<string, StepText>>;
}

const TR: OnboardingTexts = {
  welcomeTitle: name => (name ? `Hoş geldiniz, ${name}!` : 'Hoş geldiniz!'),
  welcomeBody: 'Kısa bir tur ister misiniz? Satış, ürün ve veresiye nerede, 2 dakikada gösterelim.',
  welcomeFarmerBody: 'Kısa bir tur ister misiniz? Tarlalarınızı ve defterinizi nerede bulacağınızı 1 dakikada gösterelim.',
  welcomeAdminBody: 'Kısa bir tur ister misiniz? İşletmeler, lisans ve destek modunu 1 dakikada gösterelim.',
  start: 'Başla',
  later: 'Sonra',
  never: 'Bir daha gösterme',
  next: 'İleri',
  prev: 'Geri',
  done: 'Bitti',
  close: 'Turu kapat',
  progress: '{{current}} / {{total}}',
  startTour: 'Turu başlat',
  pageTour: 'Bu sayfayı tanı',
  replayTitle: 'Tanıtım turu',
  replayDesc: 'Uygulamanın kısa tanıtımını baştan izleyin.',
  replayBtn: 'Tanıtım turunu tekrar izle',
  nudgeTitle: pct => `Kurulum %${pct} tamam`,
  nudgeBody: 'İşletme bilgilerinizi, fiş başlığınızı ve ilk ürününüzü ekleyin; fişleriniz ve raporlarınız eksiksiz çıksın.',
  nudgeBtn: 'Kuruluma devam et',
  nudgeHide: 'Gizle',
  tours: {
    'welcome-admin': {
      hello: { title: 'Hoş geldiniz', body: 'Tarım Market Pro\'yu birlikte tanıyalım. İstediğiniz an Esc ile çıkabilir, ok tuşlarıyla ilerleyebilirsiniz.' },
      menu: { title: 'Ana menü', body: 'Tüm ekranlar burada: satış, ürünler, veresiye, müşteriler, alışlar ve raporlar. Kırmızı sayılar dikkat isteyen işleri gösterir.' },
      pos: { title: 'Hızlı Satış (F2)', body: 'Satışı buradan yaparsınız. Hangi ekranda olursanız olun F2 tuşu sizi kasaya getirir.' },
      products: { title: 'Ürünler', body: 'Ürün ekleyin, stok ve SKT\'yi takip edin. Barkodu ya da ilaç karekodunu (GTS) kamerayla veya okuyucuyla okutabilirsiniz.' },
      credit: { title: 'Veresiye', body: 'Kimin ne kadar borcu var, vadesi geçen var mı, burada görürsünüz. Tahsilatı da buradan alırsınız.' },
      reports: { title: 'Raporlar', body: 'Günlük ciro, kâr, en çok satanlar ve stok değeri. Excel\'e de aktarabilirsiniz.' },
      settings: { title: 'Ayarlar ve kurulum', body: 'İlk iş: işletme bilgilerinizi tamamlayın. Ayarlar\'daki kurulum kartı eksikleri tek tek gösterir.' },
      help: { title: 'Yardım burada', body: 'Bu turu ve sayfa tanıtımlarını menüdeki "Turu başlat" ile istediğiniz zaman yeniden açabilirsiniz. Kolay gelsin!' },
    },
    'welcome-cashier': {
      hello: { title: 'Hoş geldiniz', body: 'Kasayı 1 dakikada tanıyalım. Esc ile çıkabilir, ok tuşlarıyla ilerleyebilirsiniz.' },
      search: { title: 'Ürünü bulun', body: 'Adını yazın ya da barkodu okutun; kamerayla okutmak için kamera düğmesine dokunun. F4 aramaya döner.' },
      cart: { title: 'Sepet', body: '+ / − ile miktarı değiştirin ya da kutuya yazın. Kg/litre ürünlerde küsurat girebilirsiniz.' },
      pay: { title: 'Ödeme: F1 · F2 · F3', body: 'F1 nakit, F2 kart, F3 veresiye. Satıştan sonra fişi yazdırabilir ya da yeni satışa geçebilirsiniz.' },
      credit: { title: 'Müşteri ve veresiye', body: 'Veresiye için önce müşteriyi seçin. Reçeteli zirai ilaçta e-reçete numarası istenir.' },
      help: { title: 'Yardım burada', body: 'Bu turu menüdeki "Turu başlat" ile yeniden açabilirsiniz. Bol satışlar!' },
    },
    pos: {
      search: { title: 'Ara veya okut', body: 'Ürün adını yazın ya da barkod / ilaç karekodunu okutun. Kamera düğmesi telefonla okutur; F4 buraya döner.' },
      favorites: { title: 'Sık satılanlar', body: 'Son 30 günde en çok satılanlar. Tek dokunuşla sepete ekleyin.' },
      cart: { title: 'Sepet ve miktar', body: '+ / − ile ya da kutuya yazarak miktarı değiştirin. Stok azalınca uyarı görürsünüz.' },
      pay: { title: 'Ödeme: F1 · F2 · F3', body: 'F1 nakit, F2 kart, F3 veresiye. Klavyeden tek tuşla ödeme alın.' },
      credit: { title: 'Veresiye ve e-reçete', body: 'Veresiye satışta müşteri seçilir. Sepette reçeteli zirai ilaç varsa e-reçete numarası sorulur.' },
      receipt: { title: 'Fiş', body: 'Satış bitince fiş özeti açılır: Enter fişi yazdırır, Esc yeni satışa geçer.' },
    },
    farmer: {
      hello: { title: 'Hoş geldiniz', body: 'Uygulamayı birlikte tanıyalım. Sadece 5 adım.' },
      fields: { title: 'Tarlalarım', body: 'Tarlalarınızı ve ektiğiniz ürünü buraya yazın.' },
      logbook: { title: 'Defter', body: 'İlaçlama ve gübrelemeyi buraya not edin. Bu defter sizin içindir, resmî Üretici Kayıt Defteri (ÜKD) değildir.' },
      dealer: { title: 'Bayim', body: 'Bayinizin önerileri ve borcunuz burada.' },
      account: { title: 'Hesap ve izinler', body: 'Bayinizin neyi görebileceğini buradan açıp kapatırsınız. Tanıtımı da buradan yeniden izlersiniz.' },
    },
    superadmin: {
      hello: { title: 'Yönetim paneli', body: 'Platformu yöneten ekranları kısaca tanıyalım.' },
      stats: { title: 'Genel durum', body: 'Toplam işletme, deneme, süresi dolan ve askıdaki lisanslar tek bakışta.' },
      tenants: { title: 'İşletmeler', body: 'Bir işletmeye tıklayın: lisans planını, bitiş tarihini ve kullanıcı sınırını oradan değiştirirsiniz.' },
      filters: { title: 'Lisans filtreleri', body: 'Süresi dolanları veya denemede olanları süzerek hızlıca bulun.' },
      support: { title: 'Destek modu (KVKK)', body: 'İşletme detayındaki "Destek modunda aç" ile işletmenin verisini görürsünüz. Yalnız gerektiğinde ve işletmenin izniyle kullanın; her oturum işletmenin de görebileceği şekilde kaydedilir.' },
      audit: { title: 'Denetim kaydı', body: 'Destek oturumları ve lisans değişiklikleri burada silinemez şekilde listelenir.' },
    },
  },
};

const EN: OnboardingTexts = {
  welcomeTitle: name => (name ? `Welcome, ${name}!` : 'Welcome!'),
  welcomeBody: 'Would you like a quick tour? We\'ll show you sales, products and credit in 2 minutes.',
  welcomeFarmerBody: 'Would you like a quick tour? We\'ll show you your fields and logbook in 1 minute.',
  welcomeAdminBody: 'Would you like a quick tour? Businesses, licences and support mode in 1 minute.',
  start: 'Start',
  later: 'Later',
  never: 'Don\'t show again',
  next: 'Next',
  prev: 'Back',
  done: 'Done',
  close: 'Close tour',
  progress: '{{current}} / {{total}}',
  startTour: 'Start tour',
  pageTour: 'About this page',
  replayTitle: 'Product tour',
  replayDesc: 'Watch the short introduction again.',
  replayBtn: 'Replay the product tour',
  nudgeTitle: pct => `Setup ${pct}% complete`,
  nudgeBody: 'Add your business details, receipt header and first product so receipts and reports are complete.',
  nudgeBtn: 'Continue setup',
  nudgeHide: 'Hide',
  tours: {
    'welcome-admin': {
      hello: { title: 'Welcome', body: 'Let\'s get to know Tarım Market Pro. Press Esc to leave any time, use the arrow keys to move.' },
      menu: { title: 'Main menu', body: 'Every screen lives here: sales, products, credit, customers, purchases and reports. Red counters show what needs attention.' },
      pos: { title: 'Quick sale (F2)', body: 'Sell from here. F2 brings you to the till from any screen.' },
      products: { title: 'Products', body: 'Add products, track stock and expiry. Scan a barcode or pesticide QR code (GTS) with the camera or a scanner.' },
      credit: { title: 'Credit', body: 'See who owes what and what is overdue. Take payments here too.' },
      reports: { title: 'Reports', body: 'Daily revenue, profit, best sellers and stock value. Export to Excel.' },
      settings: { title: 'Settings and setup', body: 'First things first: complete your business details. The setup card in Settings lists what is missing.' },
      help: { title: 'Help is here', body: 'Re-open this tour and page guides any time with "Start tour" in the menu. Enjoy!' },
    },
    'welcome-cashier': {
      hello: { title: 'Welcome', body: 'Let\'s learn the till in a minute. Esc leaves, arrow keys move.' },
      search: { title: 'Find a product', body: 'Type its name or scan the barcode; tap the camera button to scan with the camera. F4 jumps back here.' },
      cart: { title: 'Cart', body: 'Change the quantity with + / − or type it. Decimal quantities work for kg / litre items.' },
      pay: { title: 'Payment: F1 · F2 · F3', body: 'F1 cash, F2 card, F3 credit. After the sale you can print the receipt or start a new one.' },
      credit: { title: 'Customer and credit', body: 'Select the customer first for credit sales. Prescription pesticides need an e-prescription number.' },
      help: { title: 'Help is here', body: 'Re-open this tour with "Start tour" in the menu. Happy selling!' },
    },
    pos: {
      search: { title: 'Search or scan', body: 'Type a product name or scan a barcode / pesticide QR code. The camera button scans with the phone; F4 returns here.' },
      favorites: { title: 'Best sellers', body: 'Your top sellers of the last 30 days. One tap adds to the cart.' },
      cart: { title: 'Cart and quantity', body: 'Change quantity with + / − or by typing. You\'ll be warned when stock runs low.' },
      pay: { title: 'Payment: F1 · F2 · F3', body: 'F1 cash, F2 card, F3 credit — one key from the keyboard.' },
      credit: { title: 'Credit and e-prescription', body: 'Credit sales need a customer. If the cart has a prescription pesticide, an e-prescription number is requested.' },
      receipt: { title: 'Receipt', body: 'After the sale the receipt summary opens: Enter prints, Esc starts a new sale.' },
    },
    farmer: {
      hello: { title: 'Welcome', body: 'Let\'s take a quick look. Only 5 steps.' },
      fields: { title: 'My fields', body: 'Write down your fields and what you planted.' },
      logbook: { title: 'Logbook', body: 'Note your spraying and fertilising here. This logbook is for you; it is not the official Producer Record Book (ÜKD).' },
      dealer: { title: 'My dealer', body: 'Your dealer\'s recommendations and your debt are here.' },
      account: { title: 'Account and permissions', body: 'Turn on or off what your dealer can see. You can replay this tour here too.' },
    },
    superadmin: {
      hello: { title: 'Admin panel', body: 'A quick look at the platform management screens.' },
      stats: { title: 'Overview', body: 'Total businesses, trials, expired and suspended licences at a glance.' },
      tenants: { title: 'Businesses', body: 'Click a business to change its licence plan, expiry date and user limit.' },
      filters: { title: 'Licence filters', body: 'Filter expired or trial businesses to find them quickly.' },
      support: { title: 'Support mode (KVKK)', body: '"Open in support mode" on a business shows its data. Use it only when needed and with the business\'s consent; every session is logged and visible to the business.' },
      audit: { title: 'Audit log', body: 'Support sessions and licence changes are listed here and cannot be deleted.' },
    },
  },
};

export const ONBOARDING_TEXTS = { tr: TR, en: EN } as const;

export function injectOnboardingTexts() {
  const lang = inject(LangService);
  return computed(() => ONBOARDING_TEXTS[lang.lang()]);
}
