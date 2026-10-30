import { Directive, EventEmitter, HostListener, Input, OnDestroy, Output } from '@angular/core';

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
    // Kısayol tuşları (Ctrl/Cmd/Alt) okuyucu girişi değildir
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const active = document.activeElement as HTMLElement | null;
    const activeTag = active?.tagName;
    if (
      activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT' ||
      activeTag === 'BUTTON' || active?.isContentEditable
    ) {
      this.reset();
      return;
    }

    // Açık bir dialog varken dinleme (dialog içi Enter'ı çalmasın)
    if (document.querySelector('.p-dialog-mask')) {
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

    if (event.key.length === 1) this.buffer += event.key;

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
