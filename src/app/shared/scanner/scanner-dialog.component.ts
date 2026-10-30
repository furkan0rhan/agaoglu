import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, signal, viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import type { IScannerControls } from '@zxing/browser';
import { LangService } from '../../core/i18n/lang.service';
import { IconButtonComponent } from '../ui/icon-button.component';
import { canonicalGts, parseGs1 } from './gs1';
import { hasMediaDevices, scanFeedback } from './platform';
import { SCANNER_TEXTS } from './scanner.i18n';
import type { ScanFeedback, ScanFormat, ScanResult } from './scanner.types';

type CameraState = 'starting' | 'live' | 'nocamera' | 'denied' | 'busy' | 'insecure' | 'error';

/** Servisin dialoga verdiği oturum: tek okutmada `finish(result)`, sürekli modda `handle` her okutmada çağrılır */
export interface ScannerSession {
  title: string;
  hint: string;
  continuous: boolean;
  formats: readonly ScanFormat[];
  /** Sürekli mod: her okutma (geri bildirim döndürebilir) */
  handle?: (r: ScanResult) => Promise<ScanFeedback | void>;
  /** Dialog kapanır: tek okutmada sonuç ya da null (iptal) */
  finish: (r: ScanResult | null) => void;
}

interface ReadRow { id: number; code: string; feedback: ScanFeedback | null; summary: string }

const ZXING_FORMAT: Record<Exclude<ScanFormat, 'unknown'>, string> = {
  ean13: 'EAN_13', ean8: 'EAN_8', upca: 'UPC_A', upce: 'UPC_E', code128: 'CODE_128', code39: 'CODE_39',
  qr: 'QR_CODE', datamatrix: 'DATA_MATRIX',
};

/** Aynı kodun art arda okunmasını yok say (ms) — sürekli modda kamera aynı kodu saniyede onlarca kez görür */
const SAME_CODE_COOLDOWN = 1800;

/**
 * Kamera tarayıcı dialogu (web / Tauri masaüstü): getUserMedia + ZXing.
 * Vizör çerçevesi, fener (destekleniyorsa), kamera değiştir, iptal; kamera yoksa/izin yoksa anlaşılır mesaj
 * ve "elle kod gir" alanı (USB okuyucu da bu alana yazabilir).
 * Servis tarafından `document.body`'ye dinamik eklenir — sayfalarda kullanılmaz.
 */
@Component({
  selector: 'app-scanner-dialog',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, IconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ui-scanner-mask fixed inset-0 z-[1300] flex items-end justify-center bg-black/60 sm:items-center sm:p-4',
    '(keydown.escape)': 'close()',
  },
  template: `
    <div role="dialog" aria-modal="true" [attr.aria-label]="session().title"
         class="flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-token-lg border border-line bg-surface shadow-overlay animate-sheet-up sm:max-w-[480px] sm:rounded-token-lg">
      <header class="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <i class="pi pi-camera text-brand-text" aria-hidden="true"></i>
        <h2 class="m-0 flex-1 truncate text-16 font-bold text-fg">{{ session().title }}</h2>
        @if (session().continuous && rows().length) {
          <span class="num text-13 text-fg-muted">{{ tx().readCount(count()) }}</span>
        }
        <ui-icon-button icon="pi-times" [ariaLabel]="tx().close" (click)="close()" />
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto">
        @if (showVideo()) {
          <div class="relative aspect-[4/3] w-full overflow-hidden bg-black">
            <video #video class="h-full w-full object-cover" muted playsinline autoplay aria-hidden="true"></video>
            <!-- Vizör çerçevesi -->
            <div class="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
              <div class="h-[62%] w-[72%] rounded-token-lg border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"></div>
            </div>
            @if (state() === 'starting') {
              <div class="absolute inset-0 grid place-items-center text-14 text-white">
                <span><i class="pi pi-spin pi-spinner mr-2" aria-hidden="true"></i>{{ tx().starting }}</span>
              </div>
            }
            <div class="absolute bottom-2 right-2 flex gap-2">
              @if (torchSupported()) {
                <ui-icon-button [icon]="torch() ? 'pi-sun' : 'pi-bolt'" variant="outline" [pressed]="torch()"
                                [ariaLabel]="torch() ? tx().torchOff : tx().torchOn" (click)="toggleTorch()" />
              }
              @if (devices().length > 1) {
                <ui-icon-button icon="pi-sync" variant="outline" [ariaLabel]="tx().switchCamera" (click)="switchCamera()" />
              }
            </div>
          </div>
          <p class="m-0 px-4 pt-2.5 text-13 text-fg-secondary">{{ session().hint }}</p>
        } @else {
          <div class="flex gap-3 px-4 py-4" role="alert">
            <i class="pi text-xl" [class]="state() === 'denied' ? 'pi-lock text-danger-text' : 'pi-info-circle text-warning-text'" aria-hidden="true"></i>
            <div class="flex flex-col gap-1">
              <b class="text-14 text-fg">{{ errorTitle() }}</b>
              <span class="text-13 text-fg-secondary">{{ errorHelp() }}</span>
            </div>
          </div>
        }

        @if (lastFeedback(); as fb) {
          <div class="mx-4 mt-2.5 rounded-token-md px-3 py-2 text-13.5 font-semibold" aria-live="assertive"
               [class]="fb.tone === 'success' ? 'bg-success-soft text-success-text' : fb.tone === 'warn' ? 'bg-warning-soft text-warning-text' : 'bg-danger-soft text-danger-text'">
            {{ fb.message }}
          </div>
        }

        <!-- Elle kod gir (kamera yoksa da çalışır; USB okuyucu da buraya yazar) -->
        <form class="flex flex-col gap-1.5 px-4 pb-1 pt-3" (submit)="$event.preventDefault(); submitManual()">
          <label for="scanner-manual" class="text-13 font-semibold text-fg-secondary">{{ tx().manualLabel }}</label>
          <div class="flex gap-2">
            <input #manualInput id="scanner-manual" pInputText name="manual" [(ngModel)]="manual" autocomplete="off" spellcheck="false"
                   class="min-w-0 flex-1 font-mono" [placeholder]="tx().manualPlaceholder" aria-describedby="scanner-manual-help" />
            <p-button type="submit" [label]="tx().manualSubmit" severity="secondary" [disabled]="!manual.trim()" />
          </div>
          <span id="scanner-manual-help" class="text-12 text-fg-muted">{{ tx().manualHelp }}</span>
        </form>

        @if (rows().length) {
          <section class="px-4 pb-3 pt-2" [attr.aria-label]="tx().lastReads">
            <h3 class="m-0 mb-1 text-12 font-bold uppercase tracking-wide text-fg-muted">{{ tx().lastReads }}</h3>
            <ul class="m-0 flex list-none flex-col p-0">
              @for (r of rows(); track r.id) {
                <li class="flex flex-col gap-0.5 border-b border-line py-1.5 last:border-b-0">
                  <span class="break-all font-mono text-12.5 text-fg">{{ r.code }}</span>
                  @if (r.summary) { <span class="text-12 text-fg-secondary">{{ r.summary }}</span> }
                  @if (r.feedback) {
                    <span class="text-12 font-semibold"
                          [class]="r.feedback.tone === 'success' ? 'text-success-text' : r.feedback.tone === 'warn' ? 'text-warning-text' : 'text-danger-text'">{{ r.feedback.message }}</span>
                  }
                </li>
              }
            </ul>
          </section>
        }
      </div>

      <footer class="flex justify-end gap-2 border-t border-line px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <p-button [label]="session().continuous ? tx().done : tx().close" [severity]="session().continuous ? 'primary' : 'secondary'"
                  (onClick)="close()" />
      </footer>
    </div>
  `,
})
export class ScannerDialogComponent {
  private readonly lang = inject(LangService).lang;
  readonly tx = computed(() => SCANNER_TEXTS[this.lang()]);

  readonly session = input.required<ScannerSession>();

  readonly state = signal<CameraState>('starting');
  readonly devices = signal<MediaDeviceInfo[]>([]);
  readonly torchSupported = signal(false);
  readonly torch = signal(false);
  readonly rows = signal<ReadRow[]>([]);
  readonly count = signal(0);
  readonly lastFeedback = signal<ScanFeedback | null>(null);
  manual = '';

  readonly showVideo = computed(() => this.state() === 'starting' || this.state() === 'live');
  readonly errorTitle = computed(() => {
    const t = this.tx();
    switch (this.state()) {
      case 'nocamera': return t.noCamera;
      case 'denied': return t.denied;
      case 'busy': return t.busy;
      case 'insecure': return t.insecure;
      default: return t.failed;
    }
  });
  readonly errorHelp = computed(() => (this.state() === 'denied' ? this.tx().deniedHelp : this.tx().noCameraHelp));

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly manualInput = viewChild<ElementRef<HTMLInputElement>>('manualInput');
  private controls: IScannerControls | null = null;
  private deviceIndex = -1;
  private closed = false;
  private busy = false;
  private lastCode = '';
  private lastAt = 0;
  private seq = 0;
  private readonly prevFocus = document.activeElement as HTMLElement | null;

  constructor() {
    afterNextRender(() => void this.start());
    inject(DestroyRef).onDestroy(() => this.stopCamera());
  }

  private async start(): Promise<void> {
    if (!hasMediaDevices()) {
      this.state.set(window.isSecureContext === false ? 'insecure' : 'nocamera');
      this.focusManual();
      return;
    }
    try {
      const { BrowserCodeReader } = await import('@zxing/browser');
      const list = await BrowserCodeReader.listVideoInputDevices();
      if (this.closed) return;
      if (!list.length) {
        this.state.set('nocamera');
        this.focusManual();
        return;
      }
      this.devices.set(list);
      // Arka kamerayı tercih et (etiketler izin sonrası dolar; yoksa facingMode: environment)
      const back = list.findIndex(d => /back|rear|arka|environment/i.test(d.label));
      this.deviceIndex = back;
      await this.startDevice();
    } catch (e) {
      this.fail(e);
    }
  }

  private async startDevice(): Promise<void> {
    this.stopCamera();
    this.state.set('starting');
    const videoEl = this.video()?.nativeElement;
    if (!videoEl) return;
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const { BarcodeFormat, DecodeHintType } = await import('@zxing/library');
    const hints = new Map<unknown, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, this.session().formats
      .filter((f): f is Exclude<ScanFormat, 'unknown'> => f !== 'unknown')
      .map(f => BarcodeFormat[ZXING_FORMAT[f] as keyof typeof BarcodeFormat]));
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints as Map<never, never>, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 400 });
    const device = this.devices()[this.deviceIndex];
    const video: MediaTrackConstraints = device
      ? { deviceId: { exact: device.deviceId } }
      : { facingMode: { ideal: 'environment' } };
    Object.assign(video, { width: { ideal: 1280 }, height: { ideal: 720 } });
    try {
      this.controls = await reader.decodeFromConstraints({ video, audio: false }, videoEl, (result) => {
        if (!result || this.closed) return;
        const text = result.getText();
        const fmt = (Object.entries(ZXING_FORMAT).find(([, z]) => BarcodeFormat[z as keyof typeof BarcodeFormat] === result.getBarcodeFormat())?.[0] ?? 'unknown') as ScanFormat;
        void this.accept(text, fmt, 'camera');
      });
      if (this.closed) {
        this.stopCamera();
        return;
      }
      this.state.set('live');
      this.torchSupported.set(!!this.controls.switchTorch);
      this.torch.set(false);
      // İzin sonrası etiketler dolar: arka kamerayı şimdi bulabiliriz
      if (this.deviceIndex < 0) {
        const { BrowserCodeReader } = await import('@zxing/browser');
        this.devices.set(await BrowserCodeReader.listVideoInputDevices());
      }
    } catch (e) {
      this.fail(e);
    }
  }

  private fail(e: unknown): void {
    if (this.closed) return;
    const name = (e as { name?: string })?.name ?? '';
    if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') this.state.set('denied');
    else if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') this.state.set('nocamera');
    else if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') this.state.set('busy');
    else this.state.set('error');
    this.stopCamera();
    this.focusManual();
  }

  async switchCamera(): Promise<void> {
    const n = this.devices().length;
    if (n < 2) return;
    this.deviceIndex = (this.deviceIndex + 1 + n) % n;
    await this.startDevice();
  }

  async toggleTorch(): Promise<void> {
    const next = !this.torch();
    try {
      await this.controls?.switchTorch?.(next);
      this.torch.set(next);
    } catch {
      this.torchSupported.set(false);
    }
  }

  submitManual(): void {
    const text = this.manual.trim();
    if (!text) return;
    this.manual = '';
    const gs1 = parseGs1(text);
    void this.accept(text, gs1 ? 'datamatrix' : 'unknown', 'manual');
  }

  private async accept(text: string, format: ScanFormat, source: ScanResult['source']): Promise<void> {
    const code = canonicalGts(text);
    if (!code || this.busy) return;
    const now = Date.now();
    if (source === 'camera' && code === this.lastCode && now - this.lastAt < SAME_CODE_COOLDOWN) {
      this.lastAt = now;
      return;
    }
    this.lastCode = code;
    this.lastAt = now;
    const gs1 = parseGs1(text);
    const result: ScanResult = { text, code, format, source, gs1 };
    const s = this.session();

    if (!s.continuous) {
      scanFeedback('success');
      this.closed = true;
      this.stopCamera();
      s.finish(result);
      return;
    }

    this.busy = true;
    let fb: ScanFeedback | null = null;
    try {
      fb = (await s.handle?.(result)) ?? null;
    } catch (e) {
      fb = { tone: 'error', message: e instanceof Error ? e.message : String(e) };
    } finally {
      this.busy = false;
    }
    scanFeedback(fb?.tone ?? 'success');
    this.lastFeedback.set(fb);
    this.count.update(n => n + 1);
    this.rows.update(list => [{ id: ++this.seq, code, feedback: fb, summary: this.summary(result) }, ...list].slice(0, 30));
  }

  private summary(r: ScanResult): string {
    const g = r.gs1;
    if (!g) return '';
    const t = this.tx();
    const parts: string[] = [];
    if (g.gtin) parts.push(`${t.gs1Gtin}: ${g.ean13 ?? g.gtin}`);
    if (g.expiry) parts.push(`${t.gs1Expiry}: ${g.expiry.toLocaleDateString('tr-TR')}`);
    if (g.lot) parts.push(`${t.gs1Lot}: ${g.lot}`);
    if (g.serial) parts.push(`${t.gs1Serial}: ${g.serial}`);
    if (g.ambiguous) parts.push(t.gs1Ambiguous);
    return parts.join(' · ');
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.stopCamera();
    this.session().finish(null);
    this.prevFocus?.focus?.();
  }

  private focusManual(): void {
    setTimeout(() => this.manualInput()?.nativeElement.focus(), 0);
  }

  private stopCamera(): void {
    try {
      this.controls?.stop();
    } catch { /* zaten durdu */ }
    this.controls = null;
  }
}
