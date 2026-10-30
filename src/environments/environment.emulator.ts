/**
 * Yerel Firebase Emulator Suite ortamı (`ng serve --configuration emulator` / `npm run dev:emu`).
 * Canlı projeye (stok-takip-2031b) hiçbir istek gitmez: `demo-` önekli proje kimliği Firebase'de
 * gerçek bir kaynağa karşılık gelmez, Auth ve Firestore 127.0.0.1'deki emulator'lere bağlanır.
 * Ayrıntı: docs/TEST-ORTAMI.md
 */
export const environment = {
  production: false,
  useEmulators: true,
  appVersion: '1.0.0',
  /** false: e-postası doğrulanmamış hesaplar doğrulama ekranına takılmaz (eski hesaplar için geçiş). docs/TEST-ORTAMI.md */
  requireEmailVerification: true,
  appName: 'Tarım Market Pro (Test)',
  firebase: {
    apiKey: 'demo-api-key',
    authDomain: 'demo-tarim-market.firebaseapp.com',
    projectId: 'demo-tarim-market',
    storageBucket: 'demo-tarim-market.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000',
  },
  emulators: {
    host: '127.0.0.1',
    authPort: 9099,
    firestorePort: 8080,
  },
  features: {
    offlineSync: true,
    barcodeCamera: true,
    reporting: true,
  },
  sync: {
    retryAttempts: 3,
    retryDelayMs: 2000,
  },
};
