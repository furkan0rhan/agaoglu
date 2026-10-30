/**
 * Tasarım v2 kabuk metinleri (sidebar grupları, topbar, mobil çubuklar, giriş tanıtım paneli).
 * translations.ts içinde `shell` anahtarıyla bağlanır: `t().shell.quickSale`.
 */
export interface ShellTexts {
  groupOps: string;
  groupAnalysis: string;
  groupManage: string;
  quickSale: string;
  searchPlaceholder: string;
  notifications: string;
  syncOnline: string;
  syncOffline: string;
  openCart: string;
  cartItems: (n: number) => string;
  menu: string;
  heroTagline: string;
  heroTitleA: string;
  heroTitleEm: string;
  heroTitleB: string;
  features: { title: string; desc: string; icon: string }[];
  heroFoot: string;
}

export const SHELL_TR: ShellTexts = {
  groupOps: 'Operasyon',
  groupAnalysis: 'Analiz',
  groupManage: 'Yönetim',
  quickSale: 'Hızlı Satış',
  searchPlaceholder: 'Ürün, barkod ara…',
  notifications: 'Uyarılar',
  syncOnline: 'Çevrimiçi · veriler eşitleniyor',
  syncOffline: 'Çevrimdışı · bağlantı bekleniyor',
  openCart: 'Açık sepet',
  cartItems: n => `${n} kalem`,
  menu: 'Menü',
  heroTagline: 'Zirai bayi yönetimi',
  heroTitleA: 'Tezgâhtan tarlaya,',
  heroTitleEm: 'bütün dükkân',
  heroTitleB: 'tek ekranda.',
  features: [
    { icon: 'pi-barcode', title: 'Sezonda hızlı satış', desc: "Barkod okut, miktarı yaz, F1'e bas. Sıra beklemez." },
    { icon: 'pi-book', title: 'Veresiye ve hasat vadesi', desc: 'Taksit, vade farkı ve gecikme takibi.' },
    { icon: 'pi-clock', title: 'SKT ve GTS takibi', desc: 'Süresi yaklaşan ilacı önceden görün.' },
    { icon: 'pi-cloud', title: 'İnternet gitse de çalışır', desc: 'Bağlantı gelince kendiliğinden eşitlenir.' },
  ],
  heroFoot: 'Zirai ilaç · gübre · tohum · fide bayileri için',
};

export const SHELL_EN: ShellTexts = {
  groupOps: 'Operations',
  groupAnalysis: 'Analysis',
  groupManage: 'Management',
  quickSale: 'Quick Sale',
  searchPlaceholder: 'Search product, barcode…',
  notifications: 'Alerts',
  syncOnline: 'Online · data syncing',
  syncOffline: 'Offline · waiting for connection',
  openCart: 'Open cart',
  cartItems: n => `${n} item(s)`,
  menu: 'Menu',
  heroTagline: 'Agri-dealer management',
  heroTitleA: 'From counter to field,',
  heroTitleEm: 'the whole shop',
  heroTitleB: 'on one screen.',
  features: [
    { icon: 'pi-barcode', title: 'Fast sales in season', desc: 'Scan, type the quantity, press F1. No queues.' },
    { icon: 'pi-book', title: 'Credit and harvest terms', desc: 'Installments, interest and overdue tracking.' },
    { icon: 'pi-clock', title: 'Expiry and GTS tracking', desc: 'See expiring products ahead of time.' },
    { icon: 'pi-cloud', title: 'Works offline', desc: 'Syncs automatically when back online.' },
  ],
  heroFoot: 'For crop protection, fertilizer, seed and seedling dealers',
};
