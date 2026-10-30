import { Directive, EventEmitter, HostListener, Input, OnDestroy, Output } from '@angular/core';
import { GS } from '../scanner/gs1';
import { isGsKey } from '../scanner/gs1-keys.directive';

@Directive({
  selector: '[appBarcodeInput]',
  standalone: true,
})
export class BarcodeInputDirective implements OnDestroy {
  @Input() barcodeMinLength = 4;
  @Output() barcodeDetected = new EventEmitter<string>();

  private buffer = '';
  private lastKeyTime = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Karekod ayırıcısı (FNC1/GS): okuyucu Ctrl+] olarak gönderir; arabelleğe GS olarak yaz
    const gsKey = isGsKey(event);
    // Kısayol tuşları (Ctrl/Cmd/Alt) okuyucu girişi değildir
    if (!gsKey && (event.ctrlKey || event.metaKey || event.altKey)) return;

    const active = document.activeElement as HTMLElement | null;
    const activeTag = active?.tagName;
    if (
      activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT' ||
      activeTag === 'BUTTON' || active?.isContentEditable
    ) {
      this.reset();
      return;
    }

    // Açık bir dialog (veya kamera tarayıcı) varken dinleme (dialog içi Enter'ı çalmasın)
    if (document.querySelector('.p-dialog-mask, .ui-scanner-mask')) {
      this.reset();
      return;
    }

    const now = Date.now();
    if (now - this.lastKeyTime > 300) this.buffer = '';
    this.lastKeyTime = now;

    if (event.key === 'Enter') {
      if (this.buffer.length >= this.barcodeMinLength) {
        event.preventDefault();
        event.stopPropagation();
        this.barcodeDetected.emit(this.buffer);
      }
      this.reset();
      return;
    }

    if (gsKey) this.buffer += GS;
    else if (event.key.length === 1) this.buffer += event.key;

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => (this.buffer = ''), 500);
  }

  private reset(): void {
    this.buffer = '';
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}
