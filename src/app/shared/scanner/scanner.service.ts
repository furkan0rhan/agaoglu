import { ApplicationRef, computed, createComponent, EnvironmentInjector, inject, Injectable, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import type { Format as NativeFormat } from '@tauri-apps/plugin-barcode-scanner';
import { LangService } from '../../core/i18n/lang.service';
import { canonicalGts, parseGs1 } from './gs1';
import { hasVideoInput, isTauriMobile, scanFeedback } from './platform';
import { ScannerDialogComponent, ScannerSession } from './scanner-dialog.component';
import { SCANNER_TEXTS } from './scanner.i18n';
import {
  PRODUCT_FORMATS, ScanFeedback, ScanFormat, ScanHandler, ScannerAvailability, ScanOptions, ScanResult,
} from './scanner.types';

/** Tauri eklentisinin Format enum değerleri (string) — eklenti yalnız mobilde dinamik yüklenir */
const NATIVE_FORMAT: Record<Exclude<ScanFormat, 'unknown'>, string> = {
  ean13: 'EAN_13', ean8: 'EAN_8', upca: 'UPC_A', upce: 'UPC_E', code128: 'CODE_128', code39: 'CODE_39',
  qr: 'QR_CODE', datamatrix: 'DATA_MATRIX',
};
const SAME_CODE_COOLDOWN = 2000;

/**
 * Ortak kamera tarayıcı.
 *  - Tauri Android/iOS: `@tauri-apps/plugin-barcode-scanner` (yerel, tam ekran kamera).
 *  - Web / Tauri masaüstü: ZXing + getUserMedia dialogu (`ScannerDialogComponent`).
 *
 * ```ts
 * const r = await scanner.scan({ formats: PRODUCT_FORMATS });
 * if (r) { r.code; r.gs1?.expiry; }
 * await scanner.scanContinuous(r => ({ tone: 'success', message: '+1' }));
 * ```
 * USB el okuyucu ayrı çalışır (`appBarcodeInput`); bu servis yalnız kamera içindir.
 */
@Injectable({ providedIn: 'root' })
export class ScannerService {
  private readonly appRef = inject(ApplicationRef);
  private readonly env = inject(EnvironmentInjector);
  private readonly lang = inject(LangService).lang;
  private readonly toast = inject(MessageService, { optional: true });
  private readonly tx = computed(() => SCANNER_TEXTS[this.lang()]);

  /** Bu cihazda kamera taraması mümkün mü. Butonlar buna göre görünür/bilgi verir. */
  readonly availability = signal<ScannerAvailability>('unknown');
  readonly hasCamera = computed(() => this.availability() === 'native' || this.availability() === 'camera');
  /** Açık bir tarama var mı (çift açılmayı önler) */
  readonly active = signal(false);

  constructor() {
    void this.refresh();
    try {
      navigator.mediaDevices?.addEventListener?.('devicechange', () => void this.refresh());
    } catch { /* desteklenmiyor */ }
  }

  /** Kamera var mı yeniden bak (USB kamera takıldı/çıkarıldı) */
  async refresh(): Promise<ScannerAvailability> {
    const a: ScannerAvailability = isTauriMobile() ? 'native' : (await hasVideoInput()) ? 'camera' : 'none';
    this.availability.set(a);
    return a;
  }

  /** Tek okutma. İptalde `null`. */
  async scan(opts: ScanOptions = {}): Promise<ScanResult | null> {
    if (this.active()) return null;
    this.active.set(true);
    try {
      if (isTauriMobile()) return await this.nativeScan(opts);
      return await new Promise<ScanResult | null>(resolve => {
        this.openDialog({
          title: opts.title ?? this.tx().title,
          hint: opts.hint ?? this.tx().hint,
          continuous: false,
          formats: opts.formats ?? PRODUCT_FORMATS,
          finish: resolve,
        });
      });
    } finally {
      this.active.set(false);
    }
  }

  /**
   * Sürekli mod (stok sayımı, GTS toplu ekleme): her okutmada `onCode` çağrılır; kullanıcı "Bitti"ye
   * basınca (Android'de geri tuşu / iptal) Promise çözülür. Aynı kod 2 sn içinde tekrar sayılmaz.
   */
  async scanContinuous(onCode: ScanHandler, opts: ScanOptions = {}): Promise<void> {
    if (this.active()) return;
    this.active.set(true);
    const handle = async (r: ScanResult) => (await onCode(r)) ?? undefined;
    try {
      if (isTauriMobile()) {
        let last = '';
        let lastAt = 0;
        for (;;) {
          const r = await this.nativeScan(opts);
          if (!r) break;
          if (r.code === last && Date.now() - lastAt < SAME_CODE_COOLDOWN) continue;
          last = r.code;
          lastAt = Date.now();
          const fb = await handle(r);
          this.nativeFeedback(fb ?? null);
          await new Promise(res => setTimeout(res, 350));
        }
        return;
      }
      await new Promise<void>(resolve => {
        this.openDialog({
          title: opts.title ?? this.tx().titleContinuous,
          hint: opts.hint ?? this.tx().hintContinuous,
          continuous: true,
          formats: opts.formats ?? PRODUCT_FORMATS,
          handle,
          finish: () => resolve(),
        });
      });
    } finally {
      this.active.set(false);
    }
  }

  // ---------------- Web / masaüstü dialogu ----------------

  private openDialog(session: ScannerSession): void {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const ref = createComponent(ScannerDialogComponent, { environmentInjector: this.env, hostElement: host });
    const finish = session.finish;
    ref.setInput('session', {
      ...session,
      finish: (r: ScanResult | null) => {
        // Önce sonucu ver, sonra dialogu kaldır (aynı tick'te view yok edilir)
        finish(r);
        queueMicrotask(() => {
          this.appRef.detachView(ref.hostView);
          ref.destroy();
          host.remove();
        });
      },
    } satisfies ScannerSession);
    this.appRef.attachView(ref.hostView);
    ref.changeDetectorRef.detectChanges();
  }

  // ---------------- Tauri mobil (yerel eklenti) ----------------

  private async nativeScan(opts: ScanOptions): Promise<ScanResult | null> {
    const bs = await import('@tauri-apps/plugin-barcode-scanner');
    try {
      let perm = await bs.checkPermissions();
      if (perm !== 'granted') perm = await bs.requestPermissions();
      if (perm !== 'granted') {
        this.toast?.add({ severity: 'warn', summary: this.tx().denied, detail: this.tx().deniedHelp, life: 6000 });
        return null;
      }
    } catch {
      // izin API'si yoksa scan() kendisi isteyecek
    }
    const formats = (opts.formats ?? PRODUCT_FORMATS)
      .filter((f): f is Exclude<ScanFormat, 'unknown'> => f !== 'unknown')
      .map(f => NATIVE_FORMAT[f] as NativeFormat);
    try {
      const r = await bs.scan({ windowed: false, cameraDirection: 'back', formats });
      const text = r.content ?? '';
      if (!text) return null;
      const fmt = (Object.entries(NATIVE_FORMAT).find(([, v]) => v === (r.format as unknown as string))?.[0] ?? 'unknown') as ScanFormat;
      scanFeedback('success');
      return { text, code: canonicalGts(text), format: fmt, source: 'native', gs1: parseGs1(text) };
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e ?? '');
      // İptal (geri tuşu) sessizce null; diğer hatalar bildirilir
      if (!/cancel/i.test(msg)) this.toast?.add({ severity: 'error', summary: this.tx().failed, detail: msg, life: 6000 });
      return null;
    }
  }

  private nativeFeedback(fb: ScanFeedback | null): void {
    if (!fb) return;
    if (fb.tone !== 'success') scanFeedback(fb.tone);
    this.toast?.add({ severity: fb.tone === 'success' ? 'success' : fb.tone === 'warn' ? 'warn' : 'error', summary: fb.message, life: 2500 });
  }
}
