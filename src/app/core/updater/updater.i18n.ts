import { computed, inject } from '@angular/core';
import { LangService } from '../i18n/lang.service';

export interface UpdaterTexts {
  available: (v: string) => string;
  availableDesc: string;
  saleNotice: string;
  updateNow: string;
  later: string;
  downloading: string;
  installing: string;
  failed: string;
  sectionTitle: string;
  sectionDesc: string;
  currentVersion: string;
  checkNow: string;
  checking: string;
  lastChecked: string;
  never: string;
  upToDate: string;
  checkFailed: string;
  offline: string;
}

const TR: UpdaterTexts = {
  available: v => `Yeni sürüm (${v}) hazır`,
  availableDesc: 'Güncelleme birkaç dakika sürer, uygulama kendiliğinden yeniden açılır.',
  saleNotice: 'Açık satış var. Satışı tamamlayınca güncelleyebilirsiniz.',
  updateNow: 'Şimdi güncelle',
  later: 'Sonra',
  downloading: 'Güncelleme indiriliyor…',
  installing: 'Kuruluyor, uygulama yeniden açılacak…',
  failed: 'Güncelleme yapılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.',
  sectionTitle: 'Güncellemeler',
  sectionDesc: 'Yeni sürümler otomatik denetlenir; kurulum için onayınız istenir.',
  currentVersion: 'Yüklü sürüm',
  checkNow: 'Güncellemeleri denetle',
  checking: 'Denetleniyor…',
  lastChecked: 'Son denetim',
  never: 'Henüz denetlenmedi',
  upToDate: 'Uygulama güncel.',
  checkFailed: 'Denetlenemedi. İnternet bağlantınızı kontrol edin.',
  offline: 'İnternet yok; bağlantı gelince denetlenir.',
};

const EN: UpdaterTexts = {
  available: v => `New version (${v}) is ready`,
  availableDesc: 'The update takes a few minutes; the app restarts by itself.',
  saleNotice: 'A sale is in progress. You can update once the sale is completed.',
  updateNow: 'Update now',
  later: 'Later',
  downloading: 'Downloading update…',
  installing: 'Installing, the app will restart…',
  failed: 'Update failed. Check your internet connection and try again.',
  sectionTitle: 'Updates',
  sectionDesc: 'New versions are checked automatically; installing asks for your approval.',
  currentVersion: 'Installed version',
  checkNow: 'Check for updates',
  checking: 'Checking…',
  lastChecked: 'Last checked',
  never: 'Not checked yet',
  upToDate: 'The app is up to date.',
  checkFailed: 'Could not check. Check your internet connection.',
  offline: 'No internet; will check when the connection is back.',
};

export const UPDATER_TEXTS = { tr: TR, en: EN } as const;

export function injectUpdaterTexts() {
  const lang = inject(LangService);
  return computed(() => UPDATER_TEXTS[lang.lang()]);
}
