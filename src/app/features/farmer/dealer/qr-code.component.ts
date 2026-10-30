import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { qrMatrix, qrSvgPath } from '../utils/qr';

/** Bağımlılıksız QR (SVG). Koyu/açık temada okunabilsin diye her zaman beyaz zemin (bilinçli sabit renk). */
@Component({
  selector: 'app-qr-code',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (path(); as p) {
      <svg [attr.viewBox]="viewBox()" [attr.width]="size()" [attr.height]="size()" role="img" [attr.aria-label]="label()"
           shape-rendering="crispEdges" class="block bg-white">
        <path [attr.d]="p" fill="#000" />
      </svg>
    }
  `,
})
export class QrCodeComponent {
  readonly value = input.required<string>();
  readonly size = input(200);
  readonly label = input('QR');
  private readonly matrix = computed(() => { try { return qrMatrix(this.value()); } catch { return null; } });
  readonly path = computed(() => { const m = this.matrix(); return m ? qrSvgPath(m) : null; });
  readonly viewBox = computed(() => { const n = this.matrix()?.length ?? 21; return `-4 -4 ${n + 8} ${n + 8}`; });
}
