import { booleanAttribute, ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { LangService } from '../../core/i18n/lang.service';
import { IconButtonComponent } from '../ui/icon-button.component';
import type { UiIconButtonVariant } from '../ui/icon-button.component';
import type { UiTone } from '../ui/tone';
import { ScannerService } from './scanner.service';
import { SCANNER_TEXTS } from './scanner.i18n';
import { PRODUCT_FORMATS, ScanFormat, ScanHandler, ScanResult } from './scanner.types';

/**
 * Kamerayla okut butonu (ikon `pi-camera`).
 *
 * ```html
 * <!-- Tek okutma -->
 * <ui-scan-button (scanned)="onScan($event)" />
 * <!-- Sürekli (stok sayımı / GTS toplu): her okutmada handler, "Bitti" ile kapanır -->
 * <ui-scan-button continuous [handler]="onEachScan" label="Okut" />
 * ```
 * Kamera yoksa (Windows masaüstü çoğunlukla) buton soluk görünür ve "USB okuyucu kullanın" der; tıklanınca
 * dialog bilgi + "elle kod gir" alanı açar. Tamamen gizlemek için `hideIfNoCamera`.
 */
@Component({
  selector: 'ui-scan-button',
  standalone: true,
  imports: [ButtonModule, IconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    @if (visible()) {
      @if (label()) {
        <p-button type="button" icon="pi pi-camera" [label]="label()!" severity="secondary"
                  [outlined]="!hasCamera()" [disabled]="disabled() || scanner.active()" [ariaLabel]="aria()"
                  [attr.title]="aria()" (onClick)="run()" />
      } @else {
        <ui-icon-button icon="pi-camera" [size]="size()" [variant]="variant()" [tone]="hasCamera() ? tone() : 'neutral'"
                        [ariaLabel]="aria()" [disabled]="disabled() || scanner.active()" (click)="run()" />
      }
    }
  `,
})
export class ScanButtonComponent {
  protected readonly scanner = inject(ScannerService);
  private readonly lang = inject(LangService).lang;
  private readonly tx = computed(() => SCANNER_TEXTS[this.lang()]);

  /** Görünür metin (verilmezse yalnız ikon) */
  readonly label = input<string | null>(null);
  /** Ekran okuyucu / tooltip metni (varsayılan "Kamerayla okut") */
  readonly ariaLabel = input<string | null>(null);
  readonly title = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly formats = input<readonly ScanFormat[]>(PRODUCT_FORMATS);
  readonly continuous = input(false, { transform: booleanAttribute });
  /** Sürekli modda her okutma */
  readonly handler = input<ScanHandler | null>(null);
  readonly hideIfNoCamera = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly size = input<'sm' | 'md'>('md');
  readonly variant = input<UiIconButtonVariant>('outline');
  readonly tone = input<UiTone>('brand');

  /** Tek okutmada sonuç */
  readonly scanned = output<ScanResult>();
  /** Sürekli mod kapandı */
  readonly closed = output<void>();

  readonly hasCamera = this.scanner.hasCamera;
  readonly visible = computed(() => !(this.hideIfNoCamera() && this.scanner.availability() === 'none'));
  readonly aria = computed(() => {
    const base = this.ariaLabel() ?? this.tx().scan;
    return this.scanner.availability() === 'none' ? `${base} — ${this.tx().unavailableInfo}` : base;
  });

  async run(): Promise<void> {
    const opts = { title: this.title() ?? undefined, hint: this.hint() ?? undefined, formats: this.formats() };
    if (this.continuous()) {
      const h = this.handler();
      await this.scanner.scanContinuous(r => (h ? h(r) : this.scanned.emit(r)), opts);
      this.closed.emit();
      return;
    }
    const r = await this.scanner.scan(opts);
    if (r) this.scanned.emit(r);
  }
}
