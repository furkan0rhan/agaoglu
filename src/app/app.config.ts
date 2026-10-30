import { ApplicationConfig, ErrorHandler, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeTr from '@angular/common/locales/tr';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';

registerLocaleData(localeTr);
import { provideHttpClient } from '@angular/common/http';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator, memoryLocalCache } from '@angular/fire/firestore';
import { provideAuth, getAuth, connectAuthEmulator } from '@angular/fire/auth';
import { providePrimeNG } from 'primeng/config';
import { TarimPreset } from './core/theme/primeng-preset';
import { PRIMENG_TR } from './core/i18n/primeng-locale';
import { MessageService, ConfirmationService } from 'primeng/api';
import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { GlobalErrorHandler } from './core/error/global-error-handler';

const firebaseApp = initializeApp(environment.firebase);

/** Yalnız `--configuration emulator` (environment.emulator.ts) için true. Ayrıntı: docs/TEST-ORTAMI.md */
const useEmulators = 'useEmulators' in environment && environment.useEmulators === true;
interface EmulatorEnv { host?: string; authPort?: number; firestorePort?: number; persistentCache?: boolean }
const emu: EmulatorEnv = ('emulators' in environment ? environment.emulators : {}) as EmulatorEnv;
const EMULATOR_HOST = emu.host ?? '127.0.0.1';
const AUTH_EMULATOR_PORT = emu.authPort ?? 9099;
const FIRESTORE_EMULATOR_PORT = emu.firestorePort ?? 8080;
/** Emulator'de varsayılan bellek önbelleği; `persistentCache: true` canlıdaki IndexedDB önbelleğini taklit eder. */
const useMemoryCache = useEmulators && emu.persistentCache !== true;

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(),
    providePrimeNG({
      theme: { preset: TarimPreset, options: { prefix: 'p', darkModeSelector: '.dark', cssLayer: false } },
      translation: PRIMENG_TR,
      // Dialog içi select/autocomplete panelleri kırpılmasın / asılı kalmasın
      overlayAppendTo: 'body',
    }),
    MessageService,
    ConfirmationService,

    provideFirebaseApp(() => firebaseApp),
    provideAuth(() => {
      const auth = getAuth(firebaseApp);
      if (useEmulators) connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`, { disableWarnings: true });
      return auth;
    }),
    provideFirestore(() => {
      // Emulator'de bellek önbelleği: emulator verisi sıfırlanınca eski IndexedDB önbelleği görünmesin
      const firestore = initializeFirestore(firebaseApp, {
        localCache: useMemoryCache ? memoryLocalCache() : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
      if (useEmulators) connectFirestoreEmulator(firestore, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
      return firestore;
    }),

    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: LOCALE_ID, useValue: 'tr' },
  ],
};
