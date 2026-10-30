import { canonicalGts, parseGs1 } from './gs1';
import type { ScanResult } from './scanner.types';

/**
 * Klavyeden gelen kod (USB el okuyucu, elle yazma, yapıştırma) → kamera okutmasıyla AYNI biçimde ScanResult.
 * Böylece karekoddaki SKT (17), parti (10), seri (21) ve GTIN (01) her giriş yolunda aynı işlenir (Y3).
 */
export function scanResultFromText(raw: string, today: Date = new Date()): ScanResult {
  const text = (raw ?? '').replace(/[\r\n\t]+$/, '');
  const gs1 = parseGs1(text, today);
  return { text, code: canonicalGts(text), format: gs1 ? 'datamatrix' : 'unknown', source: 'manual', gs1 };
}
