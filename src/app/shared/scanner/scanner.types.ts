import type { Gs1Data } from './gs1';

/** Desteklenen simgeler */
export type ScanFormat = 'ean13' | 'ean8' | 'upca' | 'upce' | 'code128' | 'code39' | 'qr' | 'datamatrix' | 'unknown';

export const ALL_FORMATS: readonly ScanFormat[] = ['ean13', 'ean8', 'upca', 'upce', 'code128', 'code39', 'qr', 'datamatrix'];
/** Ürün barkodu + karekod (POS, ürün, sayım, alış) */
export const PRODUCT_FORMATS: readonly ScanFormat[] = ['ean13', 'ean8', 'upca', 'upce', 'code128', 'datamatrix', 'qr'];
/** Yalnız QR (davet bağlantısı) */
export const QR_FORMATS: readonly ScanFormat[] = ['qr'];

export interface ScanOptions {
  /** Dialog başlığı (varsayılan "Kamerayla okut") */
  title?: string;
  /** Vizörün altındaki ipucu */
  hint?: string;
  /** Aranacak simgeler (varsayılan: ürün barkodları + karekod + QR) */
  formats?: readonly ScanFormat[];
}

export interface ScanResult {
  /** Okuyucudan gelen ham metin (GS 0x1D içerebilir) */
  text: string;
  /** Karşılaştırma/kayıt için kanonik metin (AIM öneki ve GS atılmış) — GTS no olarak bunu kullanın */
  code: string;
  format: ScanFormat;
  source: 'camera' | 'native' | 'manual';
  /** GS1 karekod ise çözümlenmiş alanlar */
  gs1: Gs1Data | null;
}

/** Sürekli modda her okutmaya dönülen geri bildirim (dialogda, titreşim/bip tonunda kullanılır) */
export interface ScanFeedback {
  tone: 'success' | 'warn' | 'error';
  message: string;
}

export type ScanHandler = (result: ScanResult) => ScanFeedback | void | Promise<ScanFeedback | void>;

/** Bu cihazda kamera taraması: yerel (Tauri Android/iOS), tarayıcı kamerası, yok, henüz bilinmiyor */
export type ScannerAvailability = 'unknown' | 'native' | 'camera' | 'none';
