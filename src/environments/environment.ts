export const environment = {
  production: false,
  appVersion: '1.0.0',
  appName: 'Tarım Market Pro',
  firebase: {
    apiKey: 'AIzaSyC96oNJeVg4kcsjE7-dgViVI4NLyA61pQY',
    authDomain: 'stok-takip-2031b.firebaseapp.com',
    projectId: 'stok-takip-2031b',
    storageBucket: 'stok-takip-2031b.firebasestorage.app',
    messagingSenderId: '905172282065',
    appId: '1:905172282065:web:c91dd3e531282b34ae73f0',
    measurementId: 'G-NEP83B201H',
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
