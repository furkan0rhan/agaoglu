// Kamera ile barkod / QR / GS1 DataMatrix (karekod) okuma — TASKS 14.6
export * from './gs1';
export * from './scanner.types';
export * from './scanner.service';
export * from './scan-button.component';
export { isTauriMobile, scanFeedback } from './platform';
export { injectScannerTexts, SCANNER_TEXTS } from './scanner.i18n';
export type { ScannerTexts } from './scanner.i18n';
export { scanResultFromText } from './manual-scan';
export { Gs1KeysDirective, isGsKey } from './gs1-keys.directive';
