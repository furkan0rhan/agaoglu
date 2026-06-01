import { ApplicationConfig, ErrorHandler, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeTr from '@angular/common/locales/tr';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';

registerLocaleData(localeTr);
import { provideHttpClient } from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, initializeFirestore, persistentLocalCache } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { MessageService, ConfirmationService } from 'primeng/api';
import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { GlobalErrorHandler } from './core/error/global-error-handler';

const firebaseApp = initializeApp(environment.firebase);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(),
    provideIonicAngular({ mode: 'md', animated: false }),
    providePrimeNG({ theme: { preset: Aura, options: { prefix: 'p', darkModeSelector: '.dark', cssLayer: false } } }),
    MessageService,
    ConfirmationService,

    provideFirebaseApp(() => firebaseApp),
    provideAuth(() => getAuth(firebaseApp)),
    provideFirestore(() => initializeFirestore(firebaseApp, { localCache: persistentLocalCache() })),
    provideStorage(() => getStorage(firebaseApp)),

    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: LOCALE_ID, useValue: 'tr' },
  ],
};
