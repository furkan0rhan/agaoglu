import { computed, inject, Signal } from '@angular/core';
import { LangService } from '../../core/i18n/lang.service';
import type { Lang } from '../../core/i18n/translations';

/** Kamera tarayıcı metinleri (ortak katman kendi metnini taşır; translations.ts'e dokunmadan) */
export interface ScannerTexts {
  scan: string;
  title: string;
  titleContinuous: string;
  hint: string;
  hintContinuous: string;
  starting: string;
  close: string;
  done: string;
  torchOn: string;
  torchOff: string;
  switchCamera: string;
  noCamera: string;
  noCameraHelp: string;
  denied: string;
  deniedHelp: string;
  busy: string;
  insecure: string;
  failed: string;
  manualLabel: string;
  manualPlaceholder: string;
  manualSubmit: string;
  manualHelp: string;
  lastReads: string;
  readCount: (n: number) => string;
  gs1Gtin: string;
  gs1Expiry: string;
  gs1Lot: string;
  gs1Serial: string;
  gs1Ambiguous: string;
  unavailableInfo: string;
  /** Uygulama içi yardımcı mesajlar (bağlanan ekranlar) */
  notFound: (code: string) => string;
  gtinMismatch: (gtin: string, barcode: string) => string;
  karekodApplied: string;
  counted: (name: string, qty: string) => string;
  alreadyAdded: string;
  inviteNotRecognized: string;
  scanInviteQr: string;
}

const TR: ScannerTexts = {
  scan: 'Kamerayla okut',
  title: 'Kamerayla okut',
  titleContinuous: 'Sürekli okutma',
  hint: 'Barkodu ya da karekodu çerçevenin içine getirin',
  hintContinuous: 'Her okutma ayrı kaydedilir. Bitince "Bitti"ye basın.',
  starting: 'Kamera açılıyor…',
  close: 'Kapat',
  done: 'Bitti',
  torchOn: 'Feneri aç',
  torchOff: 'Feneri kapat',
  switchCamera: 'Kamerayı değiştir',
  noCamera: 'Bu cihazda kamera bulunamadı.',
  noCameraHelp: 'USB barkod okuyucuyla doğrudan okutabilir ya da kodu aşağıya elle yazabilirsiniz.',
  denied: 'Kamera izni verilmedi.',
  deniedHelp: 'Tarayıcının / uygulamanın ayarlarından kamera iznini açıp tekrar deneyin.',
  busy: 'Kamera başka bir uygulama tarafından kullanılıyor.',
  insecure: 'Kamera yalnız güvenli bağlantıda (https) kullanılabilir.',
  failed: 'Kamera başlatılamadı.',
  manualLabel: 'Elle kod gir',
  manualPlaceholder: '(01)08691234567890(17)270531(10)LOT1',
  manualSubmit: 'Uygula',
  manualHelp: 'Barkod ya da karekod metni. Karekod ayırıcısı için <GS> yazın veya parantezli biçimi kullanın.',
  lastReads: 'Son okutmalar',
  readCount: n => `${n} okutma`,
  gs1Gtin: 'GTIN',
  gs1Expiry: 'SKT',
  gs1Lot: 'Parti',
  gs1Serial: 'Seri',
  gs1Ambiguous: 'Ayırıcısız karekod: alan sınırları tahmin edildi, kontrol edin.',
  unavailableInfo: 'Kamera yok — USB okuyucu kullanın',
  notFound: code => `Kayıtlı ürün bulunamadı: ${code}`,
  gtinMismatch: (gtin, barcode) => `Karekoddaki GTIN (${gtin}) bu ürünün barkoduyla (${barcode}) eşleşmiyor.`,
  karekodApplied: 'Karekod okundu: SKT / parti bilgisi dolduruldu.',
  counted: (name, qty) => `${name} → ${qty}`,
  alreadyAdded: 'Bu kod zaten eklendi.',
  inviteNotRecognized: 'Bu QR bir çiftçi daveti değil.',
  scanInviteQr: "Davet QR'ını okut",
};

const EN: ScannerTexts = {
  scan: 'Scan with camera',
  title: 'Scan with camera',
  titleContinuous: 'Continuous scan',
  hint: 'Place the barcode or DataMatrix inside the frame',
  hintContinuous: 'Each scan is recorded. Press "Done" when finished.',
  starting: 'Starting camera…',
  close: 'Close',
  done: 'Done',
  torchOn: 'Torch on',
  torchOff: 'Torch off',
  switchCamera: 'Switch camera',
  noCamera: 'No camera found on this device.',
  noCameraHelp: 'Use a USB barcode scanner, or type the code below.',
  denied: 'Camera permission denied.',
  deniedHelp: 'Allow camera access in the browser / app settings and try again.',
  busy: 'The camera is in use by another application.',
  insecure: 'The camera is only available over a secure (https) connection.',
  failed: 'Could not start the camera.',
  manualLabel: 'Enter code manually',
  manualPlaceholder: '(01)08691234567890(17)270531(10)LOT1',
  manualSubmit: 'Apply',
  manualHelp: 'Barcode or GS1 text. Use <GS> as the separator or the parenthesised form.',
  lastReads: 'Last scans',
  readCount: n => `${n} scans`,
  gs1Gtin: 'GTIN',
  gs1Expiry: 'Expiry',
  gs1Lot: 'Lot',
  gs1Serial: 'Serial',
  gs1Ambiguous: 'No separators: field boundaries were guessed, please check.',
  unavailableInfo: 'No camera — use the USB scanner',
  notFound: code => `No product found: ${code}`,
  gtinMismatch: (gtin, barcode) => `GTIN in the code (${gtin}) does not match this product's barcode (${barcode}).`,
  karekodApplied: 'GS1 code read: expiry / lot filled in.',
  counted: (name, qty) => `${name} → ${qty}`,
  alreadyAdded: 'This code was already added.',
  inviteNotRecognized: 'This QR is not a farmer invitation.',
  scanInviteQr: 'Scan invitation QR',
};

export const SCANNER_TEXTS: Record<Lang, ScannerTexts> = { tr: TR, en: EN };

/** Etkin dildeki tarayıcı metinleri (injection context'te çağrılır: alan ilklendiricisi) */
export function injectScannerTexts(): Signal<ScannerTexts> {
  const lang = inject(LangService).lang;
  return computed(() => SCANNER_TEXTS[lang()]);
}
